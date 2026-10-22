-- Área de Tecnologia (TI): perfil TECNOLOGIA e cadastro de férias da equipe de TI.
--
-- Os colaboradores de TI são os próprios usuários do sistema com perfil TECNOLOGIA:
-- não existe cadastro paralelo. Para reaproveitar o fluxo de bloqueio/desbloqueio já
-- existente, cada colaborador recebe um registro espelho em public.funcionarios
-- (empresa 'TECNOLOGIA'), ligado ao usuário por funcionarios.usuario_id. As férias
-- entram em public.periodos_ferias e geram as duas ações em public.controle_acesso,
-- exatamente como as férias vindas da planilha de RH.
--
-- IMPORTANTE: execute este arquivo inteiro de uma vez. Os novos valores dos enums são
-- adicionados nos comandos iniciais e usados apenas dentro de corpos de função (avaliados
-- em tempo de execução) ou por comparação textual, para não conflitar com a regra do
-- PostgreSQL que proíbe usar um valor de enum recém-criado na mesma transação.
-- Script idempotente: pode ser executado mais de uma vez sem erro.

alter type public.perfil_usuario add value if not exists 'TECNOLOGIA';
alter type public.tipo_evento add value if not exists 'FERIAS_TI';

-- ---------------------------------------------------------
-- Vínculo entre o usuário de TI e seu registro de funcionário
-- ---------------------------------------------------------

alter table public.funcionarios
  add column if not exists usuario_id uuid references public.usuarios(id) on delete set null;

create unique index if not exists idx_funcionarios_usuario
  on public.funcionarios(usuario_id) where usuario_id is not null;

-- ---------------------------------------------------------
-- Cadastro de férias de TI
-- ---------------------------------------------------------

-- Espelha o colaborador de TI em funcionarios, grava o período e agenda bloqueio e
-- desbloqueio em uma única transação. Apenas ADMIN e SUPERVISOR podem executar.
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

  select u.id, u.nome, u.email into v_colaborador
  from public.usuarios as u
  where u.id = p_usuario_id and u.ativo = true and u.perfil::text = 'TECNOLOGIA';
  if not found then
    raise exception using errcode = 'P0001', message = 'COLABORADOR_INVALIDO';
  end if;

  select u.id into v_supervisor_id
  from public.usuarios as u
  where u.id = p_supervisor_id and u.ativo = true and u.perfil::text = 'SUPERVISOR';
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

-- Cancela um período de TI ainda não iniciado operacionalmente, junto das ações pendentes.
create or replace function public.cancelar_ferias_ti(p_periodo_id uuid)
returns public.periodos_ferias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil text;
  v_periodo public.periodos_ferias;
  v_nome text;
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

  select * into v_periodo
  from public.periodos_ferias
  where id = p_periodo_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'PERIODO_NAO_ENCONTRADO';
  end if;

  select f.nome into v_nome
  from public.funcionarios as f
  where f.id = v_periodo.funcionario_id and f.usuario_id is not null;
  if not found then
    raise exception using errcode = 'P0001', message = 'PERIODO_NAO_E_DE_TI';
  end if;

  if v_periodo.status = 'CANCELADO'::public.status_periodo then
    return v_periodo;
  end if;
  if v_periodo.status = 'CONCLUIDO'::public.status_periodo then
    raise exception using errcode = 'P0001', message = 'PERIODO_CONCLUIDO';
  end if;
  if exists (
    select 1 from public.controle_acesso as c
    where c.periodo_ferias_id = v_periodo.id
      and c.status = 'CONFIRMADO'::public.status_controle
  ) then
    raise exception using errcode = 'P0001', message = 'PERIODO_EM_ANDAMENTO';
  end if;

  update public.controle_acesso
  set status = 'CANCELADO'::public.status_controle
  where periodo_ferias_id = v_periodo.id
    and status in ('PENDENTE'::public.status_controle, 'ATRASADO'::public.status_controle);

  update public.periodos_ferias
  set status = 'CANCELADO'::public.status_periodo
  where id = v_periodo.id
  returning * into v_periodo;

  insert into public.logs_atividade (usuario_id, tipo_evento, entidade_afetada, entidade_id, descricao)
  values (
    auth.uid(),
    'FERIAS_TI'::public.tipo_evento,
    'periodos_ferias',
    v_periodo.id,
    'Férias de TI canceladas para ' || v_nome || '. Bloqueio e desbloqueio pendentes cancelados.'
  );
  return v_periodo;
end;
$$;

revoke all on function public.registrar_ferias_ti(uuid, date, date, uuid) from public;
revoke all on function public.cancelar_ferias_ti(uuid) from public;
grant execute on function public.registrar_ferias_ti(uuid, date, date, uuid) to authenticated;
grant execute on function public.cancelar_ferias_ti(uuid) to authenticated;

-- O calendário de TI lê usuarios, funcionarios e periodos_ferias, que já são legíveis
-- por qualquer usuário autenticado. Nenhuma policy nova é necessária: o perfil
-- TECNOLOGIA não recebe acesso a controle_acesso, alertas ou configurações.
