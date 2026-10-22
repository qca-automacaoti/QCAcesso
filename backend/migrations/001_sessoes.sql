-- Sessões persistidas: necessárias para rodar a API em ambiente serverless (Vercel),
-- onde a memória do processo não sobrevive entre requisições.
-- A tabela guarda os tokens do Supabase Auth associados ao token opaco enviado ao navegador.
-- Acesso exclusivo da service role: RLS habilitada e nenhuma policy criada (nega todos os demais).

create table if not exists public.sessoes (
  token_hash text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists sessoes_expires_at_idx on public.sessoes (expires_at);
create index if not exists sessoes_usuario_id_idx on public.sessoes (usuario_id);

alter table public.sessoes enable row level security;

revoke all on public.sessoes from anon, authenticated;
