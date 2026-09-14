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
  tipo_alerta tipo_alerta not null,
  data_envio timestamptz not null default now(),
  status_envio status_envio not null default 'ENVIADO'
);

create table if not exists public.logs_atividade (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios(id),
  tipo_evento tipo_evento not null,
  entidade_afetada text,
  entidade_id uuid,
  descricao text,
  data_hora timestamptz not null default now()
);

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

drop policy if exists "autenticados podem ler funcionarios" on public.funcionarios;
create policy "autenticados podem ler funcionarios" on public.funcionarios
  for select using (auth.role() = 'authenticated');

drop policy if exists "autenticados podem ler controle_acesso" on public.controle_acesso;
create policy "autenticados podem ler controle_acesso" on public.controle_acesso
  for select using (auth.role() = 'authenticated');

