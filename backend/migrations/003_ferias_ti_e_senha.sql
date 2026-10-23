-- Ajustes da área de Tecnologia e da política de senha.
--
-- 1) Férias da TI deixam de ser exclusivas do perfil TECNOLOGIA: Supervisão, Auditoria e
--    Administração também passam a ter seus períodos cadastrados na mesma área.
-- 2) Troca de senha obrigatória no primeiro acesso: contas criadas pela Administração
--    nascem com senha provisória e só liberam o sistema depois de definir a senha própria.
--
-- Depende de backend/migrations/002_tecnologia.sql.
-- Script idempotente: pode ser executado mais de uma vez sem erro.

-- ---------------------------------------------------------
-- Senha provisória
-- ---------------------------------------------------------

alter table public.usuarios
  add column if not exists deve_trocar_senha boolean not null default false;

-- O usuário marca a própria senha como definitiva. Security definer porque a tabela
-- usuarios só aceita update de ADMIN; aqui a única linha afetada é a do próprio usuário.
create or replace function public.concluir_troca_senha()
returns public.usuarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario public.usuarios;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  update public.usuarios
  set deve_trocar_senha = false
  where id = auth.uid() and ativo = true
  returning * into v_usuario;
  if not found then
    raise exception using errcode = 'P0001', message = 'USUARIO_NAO_ENCONTRADO';
  end if;
  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (auth.uid(), 'CONFIGURACAO_ALTERADA'::public.tipo_evento, 'usuarios', auth.uid(),
          'Senha definitiva cadastrada por ' || v_usuario.nome || '.');
  return v_usuario;
end;
$$;

revoke all on function public.concluir_troca_senha() from public;
grant execute on function public.concluir_troca_senha() to authenticated;

-- ---------------------------------------------------------
-- Férias da TI para Tecnologia, Supervisão, Auditoria e Administração
-- ---------------------------------------------------------

create or replace function public.registrar_ferias_ti(
  p_usuario_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_supervisor_id uuid
)
returns public.periodos_ferias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil text;
  v_colaborador record;
  v_supervisor_id uuid;
  v_funcionario_id uuid;
  v_periodo public.periodos_ferias;
begin
  if auth.uid() is null then
    raise exception using errcode = 'P0001', message = 'NAO_AUTENTICADO';
  end if;
  select u.perfil::text into v_perfil
  from public.usuarios as u
  where u.id = auth.uid() and u.ativo = true;
  if not found or v_perfil not in ('ADMIN', 'SUPERVISOR') then
    raise exception using errcode = 'P0001', message = 'PERFIL_NAO_PERMITIDO';
  end if;

  if p_data_inicio is null or p_data_fim is null or p_data_fim <= p_data_inicio then
    raise exception using errcode = 'P0001', message = 'DATAS_INVALIDAS';
  end if;
  if p_data_fim - p_data_inicio > 180 then
    raise exception using errcode = 'P0001', message = 'PERIODO_MUITO_LONGO';
  end if;

  -- Perfis com férias controladas nesta área. RH permanece no fluxo das planilhas.
  select u.id, u.nome, u.email into v_colaborador
  from public.usuarios as u
  where u.id = p_usuario_id and u.ativo = true
    and u.perfil::text in ('TECNOLOGIA', 'SUPERVISOR', 'AUDITOR', 'ADMIN');
  if not found then
    raise exception using errcode = 'P0001', message = 'COLABORADOR_INVALIDO';
  end if;

  -- Responsável pelas ações de acesso: Supervisão ou Administração.
  select u.id into v_supervisor_id
  from public.usuarios as u
  where u.id = p_supervisor_id and u.ativo = true and u.perfil::text in ('SUPERVISOR', 'ADMIN');
  if not found then
    raise exception using errcode = 'P0001', message = 'SUPERVISOR_INVALIDO';
  end if;

  -- Serializa cadastros do mesmo colaborador para que duas requisições simultâneas
  -- não criem períodos sobrepostos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_usuario_id::text, 0));

  select f.id into v_funcionario_id
  from public.funcionarios as f
  where f.usuario_id = p_usuario_id
  for update;
  if not found then
    insert into public.funcionarios (empresa, cadastro, nome, email, supervisor_id, usuario_id)
    values (
      'TECNOLOGIA',
      'TI-' || pg_catalog.upper(pg_catalog.substr(pg_catalog.replace(p_usuario_id::text, '-', ''), 1, 8)),
      v_colaborador.nome,
      v_colaborador.email,
      v_supervisor_id,
      p_usuario_id
    )
    returning id into v_funcionario_id;
  else
    update public.funcionarios
    set nome = v_colaborador.nome,
        email = v_colaborador.email,
        supervisor_id = v_supervisor_id
    where id = v_funcionario_id;
  end if;

  if exists (
    select 1 from public.periodos_ferias as p
    where p.funcionario_id = v_funcionario_id
      and p.status <> 'CANCELADO'::public.status_periodo
      and p.data_inicio <= p_data_fim
      and p.data_fim >= p_data_inicio
  ) then
    raise exception using errcode = 'P0001', message = 'PERIODO_CONFLITANTE';
  end if;

  insert into public.periodos_ferias (funcionario_id, data_inicio, data_fim, status)
  values (v_funcionario_id, p_data_inicio, p_data_fim, 'CONFIRMADO'::public.status_periodo)
  returning * into v_periodo;

  insert into public.controle_acesso (periodo_ferias_id, tipo_acao, data_programada, status, supervisor_id)
  values (v_periodo.id, 'BLOQUEIO'::public.tipo_acao, p_data_inicio, 'PENDENTE'::public.status_controle, v_supervisor_id);
  insert into public.controle_acesso (periodo_ferias_id, tipo_acao, data_programada, status, supervisor_id)
  values (v_periodo.id, 'DESBLOQUEIO'::public.tipo_acao, p_data_fim, 'PENDENTE'::public.status_controle, v_supervisor_id);

  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (
    auth.uid(),
    'FERIAS_TI'::public.tipo_evento,
    'periodos_ferias',
    v_periodo.id,
    'Férias de TI cadastradas para ' || v_colaborador.nome || ' (' ||
      pg_catalog.to_char(p_data_inicio, 'DD/MM/YYYY') || ' a ' || pg_catalog.to_char(p_data_fim, 'DD/MM/YYYY') ||
      '). Bloqueio e desbloqueio agendados.'
  );
  return v_periodo;
end;
$$;

revoke all on function public.registrar_ferias_ti(uuid, date, date, uuid) from public;
grant execute on function public.registrar_ferias_ti(uuid, date, date, uuid) to authenticated;

-- ---------------------------------------------------------
-- Responsável pelas ações de acesso: Supervisão ou Administração
-- ---------------------------------------------------------
--
-- As duas funções abaixo são as mesmas de schema.sql, com a única diferença de
-- aceitarem um ADMIN como responsável, além do SUPERVISOR.

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
      and u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario, 'SUPERVISOR'::public.perfil_usuario)
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
      and u.perfil in ('SUPERVISOR'::public.perfil_usuario, 'ADMIN'::public.perfil_usuario)
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
      and u.perfil in ('ADMIN'::public.perfil_usuario, 'RH'::public.perfil_usuario, 'SUPERVISOR'::public.perfil_usuario)
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
    and u.perfil in ('SUPERVISOR'::public.perfil_usuario, 'ADMIN'::public.perfil_usuario)
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

revoke all on function public.editar_checklist_revisao(uuid, text, text, text, date, date, uuid) from public;
revoke all on function public.confirmar_checklist_revisao(uuid) from public;
grant execute on function public.editar_checklist_revisao(uuid, text, text, text, date, date, uuid) to authenticated;
grant execute on function public.confirmar_checklist_revisao(uuid) to authenticated;
