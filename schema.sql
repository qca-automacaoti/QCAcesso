-- =========================================================
-- Sistema de Bloqueio/Desbloqueio de Férias — QCA
-- Schema para Supabase (PostgreSQL)
-- Script idempotente: pode ser rodado mais de uma vez sem erro
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- ENUM types (criação idempotente via DO block)
-- ---------------------------------------------------------

do $$ begin
  create type perfil_usuario as enum ('ADMIN','RH','SUPERVISOR','AUDITOR');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_funcionario as enum ('ATIVO','DE_FERIAS','BLOQUEADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_upload as enum ('PROCESSANDO','CONCLUIDO','ERRO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_revisao as enum ('PENDENTE','EDITADO','CONFIRMADO','REJEITADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_periodo as enum ('CONFIRMADO','CANCELADO','CONCLUIDO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_acao as enum ('BLOQUEIO','DESBLOQUEIO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_controle as enum ('PENDENTE','CONFIRMADO','ATRASADO','CANCELADO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_alerta as enum ('LEMBRETE_BLOQUEIO','LEMBRETE_DESBLOQUEIO','ESCALONAMENTO_ATRASO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type status_envio as enum ('ENVIADO','FALHA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_evento as enum ('UPLOAD','EDICAO_CHECKLIST','CONFIRMACAO_BLOQUEIO','CONFIRMACAO_DESBLOQUEIO','ENVIO_ALERTA','CONFIGURACAO_ALTERADA');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------

-- usuarios: estende auth.users do Supabase (mesmo id do login)
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null unique,
  perfil perfil_usuario not null default 'SUPERVISOR',
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- funcionarios: campos alinhados 1:1 com as colunas da planilha
-- (empresa = filial/unidade da QCA, cadastro = matrícula do funcionário)
create table if not exists public.funcionarios (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  cadastro text not null,
  nome text not null,
  email text,
  supervisor_id uuid references public.usuarios(id),
  status_atual status_funcionario not null default 'ATIVO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, cadastro)
);

create table if not exists public.upload_planilhas (
  id uuid primary key default gen_random_uuid(),
  nome_arquivo text not null,
  usuario_id uuid not null references public.usuarios(id),
  data_upload timestamptz not null default now(),
  total_linhas int not null default 0,
  linhas_processadas int not null default 0,
  linhas_com_erro int not null default 0,
  status status_upload not null default 'PROCESSANDO'
);

-- checklist_revisao: staging. Colunas cruas espelham a planilha
-- (inicio -> data_inicio, fimFerias -> data_fim)
create table if not exists public.checklist_revisao (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references public.upload_planilhas(id) on delete cascade,
  funcionario_id uuid references public.funcionarios(id),
  empresa text not null,
  cadastro text not null,
  nome text not null,
  data_inicio date not null,
  data_fim date not null,
  status_revisao status_revisao not null default 'PENDENTE',
  revisado_por uuid references public.usuarios(id),
  revisado_em timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.periodos_ferias (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references public.funcionarios(id),
  checklist_origem_id uuid references public.checklist_revisao(id),
  data_inicio date not null,
  data_fim date not null,
  status status_periodo not null default 'CONFIRMADO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.controle_acesso (
  id uuid primary key default gen_random_uuid(),
  periodo_ferias_id uuid not null references public.periodos_ferias(id) on delete cascade,
  tipo_acao tipo_acao not null,
  data_programada date not null,
  status status_controle not null default 'PENDENTE',
  supervisor_id uuid references public.usuarios(id),
  confirmado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.alertas (
  id uuid primary key default gen_random_uuid(),
  controle_acesso_id uuid not null references public.controle_acesso(id) on delete cascade,
  supervisor_id uuid references public.usuarios(id),
  destinatario_id uuid references public.usuarios(id),
  tipo_alerta tipo_alerta not null,
  chave_idempotencia text,
  data_envio timestamptz not null default now(),
  status_envio status_envio not null default 'ENVIADO'
);

alter table public.alertas add column if not exists destinatario_id uuid references public.usuarios(id);
alter table public.alertas add column if not exists chave_idempotencia text;
create unique index if not exists idx_alertas_chave_idempotencia on public.alertas(chave_idempotencia);

create table if not exists public.logs_atividade (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id),
  tipo_evento tipo_evento not null,
  entidade_afetada text,
  entidade_id uuid,
  descricao text,
  data_hora timestamptz not null default now()
);

-- Ações da revisão são transacionais: staging, funcionário, período, controles e log
-- mudam juntos ou permanecem como estavam.
create or replace function public.editar_checklist_revisao(
  p_checklist_id uuid,
  p_empresa text,
  p_cadastro text,
  p_nome text,
  p_data_inicio date,
  p_data_fim date,
  p_supervisor_id uuid
)
returns public.checklist_revisao
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.checklist_revisao;
  v_funcionario_id uuid;
  v_nome_supervisor text;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  if not exists (
    select 1 from public.usuarios as u
    where u.id = auth.uid() and u.ativo = true
      and u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario)
  ) then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;
  if nullif(trim(p_empresa), '') is null or nullif(trim(p_cadastro), '') is null or nullif(trim(p_nome), '') is null then
    raise exception using errcode = 'P0001', message = 'DADOS_INVALIDOS';
  end if;
  if p_data_inicio is null or p_data_fim is null or p_data_fim < p_data_inicio then
    raise exception using errcode = 'P0001', message = 'DATAS_INVALIDAS';
  end if;
  if p_supervisor_id is not null then
    select u.nome into v_nome_supervisor
    from public.usuarios as u
    where u.id = p_supervisor_id
      and u.perfil = 'SUPERVISOR'::public.perfil_usuario
      and u.ativo = true;
    if not found then
      raise exception using errcode = 'P0001', message = 'SUPERVISOR_INVALIDO';
    end if;
  end if;

  select * into v_item
  from public.checklist_revisao
  where id = p_checklist_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_NAO_ENCONTRADO';
  end if;
  if v_item.status_revisao = 'CONFIRMADO'::public.status_revisao then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_CONFIRMADO';
  end if;
  if v_item.status_revisao = 'REJEITADO'::public.status_revisao then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_REJEITADO';
  end if;

  insert into public.funcionarios (empresa, cadastro, nome, supervisor_id)
  values (trim(p_empresa), trim(p_cadastro), trim(p_nome), p_supervisor_id)
  on conflict (empresa, cadastro) do update
    set nome = excluded.nome,
        supervisor_id = excluded.supervisor_id
  returning id into v_funcionario_id;

  update public.checklist_revisao
  set funcionario_id = v_funcionario_id,
      empresa = trim(p_empresa),
      cadastro = trim(p_cadastro),
      nome = trim(p_nome),
      data_inicio = p_data_inicio,
      data_fim = p_data_fim,
      status_revisao = 'EDITADO'::public.status_revisao,
      revisado_por = auth.uid(),
      revisado_em = now()
  where id = p_checklist_id
  returning * into v_item;

  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (auth.uid(), 'EDICAO_CHECKLIST'::public.tipo_evento, 'checklist_revisao', p_checklist_id,
          'Checklist editado e associado ao funcionário e supervisor ' || coalesce(v_nome_supervisor, 'pendente') || '.');
  return v_item;
end;
$$;

create or replace function public.rejeitar_checklist_revisao(p_checklist_id uuid)
returns public.checklist_revisao
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item public.checklist_revisao;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  if not exists (
    select 1 from public.usuarios as u
    where u.id = auth.uid() and u.ativo = true
      and u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario)
  ) then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;
  select * into v_item
  from public.checklist_revisao
  where id = p_checklist_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_NAO_ENCONTRADO';
  end if;
  if v_item.status_revisao = 'CONFIRMADO'::public.status_revisao then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_CONFIRMADO';
  end if;
  if v_item.status_revisao = 'REJEITADO'::public.status_revisao then
    return v_item;
  end if;

  update public.checklist_revisao
  set status_revisao = 'REJEITADO'::public.status_revisao,
      revisado_por = auth.uid(),
      revisado_em = now()
  where id = p_checklist_id
  returning * into v_item;
  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (auth.uid(), 'EDICAO_CHECKLIST'::public.tipo_evento, 'checklist_revisao', p_checklist_id,
          'Checklist rejeitado para ' || v_item.nome || '.');
  return v_item;
end;
$$;

create or replace function public.confirmar_checklist_revisao(p_checklist_id uuid)
returns public.checklist_revisao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.checklist_revisao;
  v_periodo public.periodos_ferias;
  v_bloqueio_id uuid;
  v_desbloqueio_id uuid;
  v_supervisor_id uuid;
  v_supervisor_ativo_id uuid;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  if not exists (
    select 1 from public.usuarios as u
    where u.id = auth.uid() and u.ativo = true
      and u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario)
  ) then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;
  select * into v_item
  from public.checklist_revisao
  where id = p_checklist_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_NAO_ENCONTRADO';
  end if;
  if v_item.status_revisao = 'CONFIRMADO'::public.status_revisao then
    return v_item;
  end if;
  if v_item.status_revisao = 'REJEITADO'::public.status_revisao then
    raise exception using errcode = 'P0001', message = 'CHECKLIST_REJEITADO';
  end if;
  if v_item.funcionario_id is null then
    raise exception using errcode = 'P0001', message = 'FUNCIONARIO_AUSENTE';
  end if;

  -- Serializa confirmações de períodos do mesmo funcionário para evitar sobreposição concorrente.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_item.funcionario_id::text, 0));
  select f.supervisor_id into v_supervisor_id
  from public.funcionarios as f
  where f.id = v_item.funcionario_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'FUNCIONARIO_AUSENTE';
  end if;
  if v_supervisor_id is null then
    raise exception using errcode = 'P0001', message = 'SUPERVISOR_AUSENTE';
  end if;
  select u.id into v_supervisor_ativo_id
  from public.usuarios as u
  where u.id = v_supervisor_id
    and u.perfil = 'SUPERVISOR'::public.perfil_usuario
    and u.ativo = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'SUPERVISOR_INATIVO';
  end if;

  if exists (
    select 1 from public.periodos_ferias as p
    where p.funcionario_id = v_item.funcionario_id
      and p.status = 'CONFIRMADO'::public.status_periodo
      and p.checklist_origem_id is distinct from v_item.id
      and p.data_inicio <= v_item.data_fim
      and p.data_fim >= v_item.data_inicio
  ) then
    raise exception using errcode = 'P0001', message = 'PERIODO_CONFLITANTE';
  end if;

  select * into v_periodo
  from public.periodos_ferias
  where checklist_origem_id = v_item.id
  order by created_at
  limit 1
  for update;
  if found and v_periodo.status <> 'CONFIRMADO'::public.status_periodo then
    raise exception using errcode = 'P0001', message = 'PERIODO_INDISPONIVEL';
  end if;
  if not found then
    insert into public.periodos_ferias (funcionario_id, checklist_origem_id, data_inicio, data_fim, status)
  values (v_item.funcionario_id, v_item.id, v_item.data_inicio, v_item.data_fim, 'CONFIRMADO'::public.status_periodo)
    returning * into v_periodo;
  else
    update public.periodos_ferias
    set funcionario_id = v_item.funcionario_id,
        data_inicio = v_item.data_inicio,
        data_fim = v_item.data_fim
    where id = v_periodo.id;
  end if;

  select c.id into v_bloqueio_id from public.controle_acesso as c
  where c.periodo_ferias_id = v_periodo.id and c.tipo_acao = 'BLOQUEIO'::public.tipo_acao
  order by c.created_at limit 1 for update;
  if v_bloqueio_id is null then
    insert into public.controle_acesso (periodo_ferias_id, tipo_acao, data_programada, status, supervisor_id)
    values (v_periodo.id, 'BLOQUEIO'::public.tipo_acao, v_item.data_inicio, 'PENDENTE'::public.status_controle, v_supervisor_id);
  else
    update public.controle_acesso set data_programada = v_item.data_inicio, supervisor_id = v_supervisor_id
    where id = v_bloqueio_id and status = 'PENDENTE'::public.status_controle;
  end if;

  select c.id into v_desbloqueio_id from public.controle_acesso as c
  where c.periodo_ferias_id = v_periodo.id and c.tipo_acao = 'DESBLOQUEIO'::public.tipo_acao
  order by c.created_at limit 1 for update;
  if v_desbloqueio_id is null then
    insert into public.controle_acesso (periodo_ferias_id, tipo_acao, data_programada, status, supervisor_id)
    values (v_periodo.id, 'DESBLOQUEIO'::public.tipo_acao, v_item.data_fim, 'PENDENTE'::public.status_controle, v_supervisor_id);
  else
    update public.controle_acesso set data_programada = v_item.data_fim, supervisor_id = v_supervisor_id
    where id = v_desbloqueio_id and status = 'PENDENTE'::public.status_controle;
  end if;

  update public.checklist_revisao
  set status_revisao = 'CONFIRMADO'::public.status_revisao,
      revisado_por = auth.uid(),
      revisado_em = now()
  where id = p_checklist_id
  returning * into v_item;
  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (auth.uid(), 'EDICAO_CHECKLIST'::public.tipo_evento, 'checklist_revisao', p_checklist_id,
          'Checklist confirmado para ' || v_item.nome || '. Período e controles gerados para o supervisor associado.');
  return v_item;
end;
$$;

-- Confirma a execução operacional e atualiza funcionário, período e auditoria em uma transação.
create or replace function public.confirmar_controle_acesso(p_controle_id uuid)
returns public.controle_acesso
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_controle public.controle_acesso;
  v_perfil public.perfil_usuario;
  v_funcionario_id uuid;
  v_nome text;
  v_tipo_evento public.tipo_evento;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  select u.perfil into v_perfil
  from public.usuarios as u
  where u.id = auth.uid() and u.ativo = true;
  if not found then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;
  if v_perfil not in (
    'ADMIN'::public.perfil_usuario,
    'RH'::public.perfil_usuario,
    'SUPERVISOR'::public.perfil_usuario
  ) then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;

  select * into v_controle
  from public.controle_acesso
  where id = p_controle_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ACAO_NAO_ENCONTRADA';
  end if;
  if v_perfil = 'SUPERVISOR'::public.perfil_usuario
    and v_controle.supervisor_id is distinct from auth.uid() then
    raise exception using errcode = 'P0001', message = 'ACAO_DE_OUTRO_SUPERVISOR';
  end if;
  if v_controle.status = 'CONFIRMADO'::public.status_controle then
    return v_controle;
  end if;
  if v_controle.status not in ('PENDENTE'::public.status_controle, 'ATRASADO'::public.status_controle) then
    raise exception using errcode = 'P0001', message = 'ACAO_JA_CONCLUIDA';
  end if;
  if v_controle.data_programada > (pg_catalog.now() at time zone 'America/Sao_Paulo')::date then
    raise exception using errcode = 'P0001', message = 'ACAO_ANTES_DA_DATA';
  end if;

  select f.id, f.nome into v_funcionario_id, v_nome
  from public.periodos_ferias as p
  join public.funcionarios as f on f.id = p.funcionario_id
  where p.id = v_controle.periodo_ferias_id
    and p.status = 'CONFIRMADO'::public.status_periodo
  for update of p, f;
  if not found then
    raise exception using errcode = 'P0001', message = 'PERIODO_INDISPONIVEL';
  end if;

  update public.controle_acesso
  set status = 'CONFIRMADO'::public.status_controle,
      confirmado_em = pg_catalog.now()
  where id = v_controle.id
  returning * into v_controle;

  if v_controle.tipo_acao = 'BLOQUEIO'::public.tipo_acao then
    update public.funcionarios set status_atual = 'BLOQUEADO'::public.status_funcionario where id = v_funcionario_id;
    v_tipo_evento := 'CONFIRMACAO_BLOQUEIO'::public.tipo_evento;
  else
    update public.funcionarios set status_atual = 'ATIVO'::public.status_funcionario where id = v_funcionario_id;
    update public.periodos_ferias
    set status = 'CONCLUIDO'::public.status_periodo
    where id = v_controle.periodo_ferias_id;
    v_tipo_evento := 'CONFIRMACAO_DESBLOQUEIO'::public.tipo_evento;
  end if;

  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (
    auth.uid(),
    v_tipo_evento,
    'controle_acesso',
    v_controle.id,
    case when v_controle.tipo_acao = 'BLOQUEIO'::public.tipo_acao
      then 'Bloqueio de acesso confirmado para ' || v_nome || '.'
      else 'Desbloqueio de acesso confirmado para ' || v_nome || '.'
    end
  );
  return v_controle;
end;
$$;

revoke all on function public.editar_checklist_revisao(uuid, text, text, text, date, date, uuid) from public;
revoke all on function public.rejeitar_checklist_revisao(uuid) from public;
revoke all on function public.confirmar_checklist_revisao(uuid) from public;
revoke all on function public.confirmar_controle_acesso(uuid) from public;
grant execute on function public.editar_checklist_revisao(uuid, text, text, text, date, date, uuid) to authenticated;
grant execute on function public.rejeitar_checklist_revisao(uuid) to authenticated;
grant execute on function public.confirmar_checklist_revisao(uuid) to authenticated;
grant execute on function public.confirmar_controle_acesso(uuid) to authenticated;

-- Gestão administrativa de perfis: a alteração passa por uma função transacional
-- para impedir que a própria conta ou o último administrador sejam removidos.
create or replace function public.administrar_usuario(
  p_usuario_id uuid,
  p_perfil public.perfil_usuario,
  p_ativo boolean
)
returns public.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.usuarios;
  v_resultado public.usuarios;
  v_admins integer;
begin
  select * into v_atual from public.usuarios where id = auth.uid() and ativo = true for update;
  if not found or v_atual.perfil <> 'ADMIN'::public.perfil_usuario then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;
  select * into v_resultado from public.usuarios where id = p_usuario_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'USUARIO_NAO_ENCONTRADO'; end if;
  if p_usuario_id = auth.uid() and (not p_ativo or p_perfil <> 'ADMIN'::public.perfil_usuario) then
    raise exception using errcode = 'P0001', message = 'USUARIO_PROPRIO';
  end if;
  if v_resultado.perfil = 'ADMIN'::public.perfil_usuario and v_resultado.ativo = true
    and (not p_ativo or p_perfil <> 'ADMIN'::public.perfil_usuario) then
    select count(*) into v_admins from public.usuarios where perfil = 'ADMIN'::public.perfil_usuario and ativo = true;
    if v_admins <= 1 then raise exception using errcode = 'P0001', message = 'ULTIMO_ADMIN'; end if;
  end if;
  update public.usuarios set perfil = p_perfil, ativo = p_ativo where id = p_usuario_id returning * into v_resultado;
  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (auth.uid(), 'CONFIGURACAO_ALTERADA'::public.tipo_evento, 'usuarios', p_usuario_id,
    'Perfil/status do usuário ' || v_resultado.email || ' atualizado.');
  return v_resultado;
end;
$$;
revoke all on function public.administrar_usuario(uuid, public.perfil_usuario, boolean) from public;
grant execute on function public.administrar_usuario(uuid, public.perfil_usuario, boolean) to authenticated;

-- ---------------------------------------------------------
-- Índices
-- ---------------------------------------------------------

create index if not exists idx_funcionarios_empresa on public.funcionarios(empresa);
create index if not exists idx_checklist_upload on public.checklist_revisao(upload_id);
create index if not exists idx_periodos_funcionario on public.periodos_ferias(funcionario_id);
create index if not exists idx_controle_status_tipo on public.controle_acesso(status, tipo_acao);
create index if not exists idx_controle_data_programada on public.controle_acesso(data_programada);
create index if not exists idx_logs_data_hora on public.logs_atividade(data_hora desc);

-- ---------------------------------------------------------
-- Trigger genérico para updated_at
-- ---------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_funcionarios_updated_at on public.funcionarios;
create trigger trg_funcionarios_updated_at
  before update on public.funcionarios
  for each row execute function public.set_updated_at();

drop trigger if exists trg_periodos_updated_at on public.periodos_ferias;
create trigger trg_periodos_updated_at
  before update on public.periodos_ferias
  for each row execute function public.set_updated_at();

drop trigger if exists trg_controle_updated_at on public.controle_acesso;
create trigger trg_controle_updated_at
  before update on public.controle_acesso
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Trigger: cria automaticamente o registro em usuarios após o signup
-- (padrão comum do Supabase Auth: liga auth.users -> public.usuarios)
-- ---------------------------------------------------------

-- Executada pelo supabase_auth_admin (search_path=auth): por isso search_path vazio e nomes
-- totalmente qualificados. O perfil NÃO vem de raw_user_meta_data (preenchido pelo próprio
-- usuário no signup); todo usuário nasce SUPERVISOR e só um admin promove.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, nome, email, perfil)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), new.email),
    new.email,
    'SUPERVISOR'::public.perfil_usuario
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------
-- Row Level Security (ponto de partida — refine por perfil)
-- ---------------------------------------------------------

alter table public.usuarios enable row level security;
alter table public.funcionarios enable row level security;
alter table public.upload_planilhas enable row level security;
alter table public.checklist_revisao enable row level security;
alter table public.periodos_ferias enable row level security;
alter table public.controle_acesso enable row level security;
alter table public.alertas enable row level security;
alter table public.logs_atividade enable row level security;

drop policy if exists "autenticados podem ler usuarios" on public.usuarios;
create policy "autenticados podem ler usuarios" on public.usuarios
  for select using (auth.role() = 'authenticated');
drop policy if exists "administradores podem atualizar usuarios" on public.usuarios;
create policy "administradores podem atualizar usuarios" on public.usuarios
  for update using (auth.role() = 'authenticated' and exists (select 1 from public.usuarios as atual where atual.id = auth.uid() and atual.ativo = true and atual.perfil = 'ADMIN'::public.perfil_usuario))
  with check (auth.role() = 'authenticated');
revoke update on public.usuarios from anon, authenticated;

drop policy if exists "autenticados podem ler funcionarios" on public.funcionarios;
create policy "autenticados podem ler funcionarios" on public.funcionarios
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem ler controle_acesso" on public.controle_acesso;
create policy "autenticados podem ler controle_acesso" on public.controle_acesso
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.usuarios as u
      where u.id = auth.uid() and u.ativo = true
        and (
          u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario, 'AUDITOR'::public.perfil_usuario)
          or (u.perfil = 'SUPERVISOR'::public.perfil_usuario and controle_acesso.supervisor_id = u.id)
        )
    )
  );

drop policy if exists "autenticados podem ler alertas" on public.alertas;
create policy "autenticados podem ler alertas" on public.alertas
  for select using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.usuarios as u
      where u.id = auth.uid() and u.ativo = true
        and (
          u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario, 'AUDITOR'::public.perfil_usuario)
          or alertas.supervisor_id = u.id
          or alertas.destinatario_id = u.id
        )
    )
  );
revoke insert, update, delete on public.alertas from anon, authenticated;
grant select on public.alertas to authenticated;
grant select, insert, update on public.alertas to service_role;
grant select, update on public.controle_acesso to service_role;
grant select on public.periodos_ferias, public.funcionarios, public.usuarios to service_role;
grant insert on public.logs_atividade to service_role;

drop policy if exists "autenticados podem inserir funcionarios" on public.funcionarios;
create policy "autenticados podem inserir funcionarios" on public.funcionarios
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem atualizar funcionarios" on public.funcionarios;
create policy "autenticados podem atualizar funcionarios" on public.funcionarios
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem ler uploads" on public.upload_planilhas;
create policy "autenticados podem ler uploads" on public.upload_planilhas
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem inserir uploads proprios" on public.upload_planilhas;
create policy "autenticados podem inserir uploads proprios" on public.upload_planilhas
  for insert with check (auth.role() = 'authenticated' and usuario_id = auth.uid());

drop policy if exists "autenticados podem ler checklist" on public.checklist_revisao;
create policy "autenticados podem ler checklist" on public.checklist_revisao
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem inserir checklist" on public.checklist_revisao;
create policy "autenticados podem inserir checklist" on public.checklist_revisao
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem atualizar checklist" on public.checklist_revisao;
create policy "autenticados podem atualizar checklist" on public.checklist_revisao
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem ler periodos" on public.periodos_ferias;
create policy "autenticados podem ler periodos" on public.periodos_ferias
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem inserir periodos" on public.periodos_ferias;
create policy "autenticados podem inserir periodos" on public.periodos_ferias
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem atualizar periodos" on public.periodos_ferias;
create policy "autenticados podem atualizar periodos" on public.periodos_ferias
  for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "autenticados podem inserir controle_acesso" on public.controle_acesso;
drop policy if exists "autenticados podem atualizar controle_acesso" on public.controle_acesso;
revoke insert, update, delete on public.controle_acesso from anon, authenticated;

drop policy if exists "autenticados podem ler logs" on public.logs_atividade;
create policy "autenticados podem ler logs" on public.logs_atividade
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem inserir logs" on public.logs_atividade;
create policy "autenticados podem inserir logs" on public.logs_atividade
  for insert with check (auth.role() = 'authenticated');
