-- ============================================================
-- Leak Stop CRM - Schema Supabase/PostgreSQL
-- Use no Supabase SQL Editor antes do deploy em produção.
-- Dados são segregados por workspace_id (hash SHA-256 do token).
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists public.prospectos (
  workspace_id  text not null,
  id            text not null,
  nome          text not null default '',
  telefone      text,
  nicho         text not null default 'outro',
  origem        text not null default 'outro',
  status        text not null default 'new',
  valor         numeric(12,2) not null default 0,
  notas         text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluida_em   timestamptz,
  primary key (workspace_id, id),
  constraint prospectos_status_check check (status in ('new', 'contacted', 'negotiation', 'client', 'lost')),
  constraint prospectos_valor_check check (valor >= 0)
);

create index if not exists idx_prospectos_workspace_status
  on public.prospectos (workspace_id, status)
  where excluida_em is null;

create index if not exists idx_prospectos_workspace_atualizado
  on public.prospectos (workspace_id, atualizado_em desc);

create index if not exists idx_prospectos_workspace_excluida
  on public.prospectos (workspace_id, excluida_em desc)
  where excluida_em is not null;

comment on table public.prospectos is
  'Leads/prospectos do Leak Stop CRM. Exclusao logica por excluida_em para sincronizacao offline-first.';

comment on column public.prospectos.workspace_id is
  'Hash SHA-256 do token de sincronizacao. Nunca armazene o token puro aqui.';

alter table public.prospectos enable row level security;

-- A aplicacao usa Netlify Function com SUPABASE_SERVICE_KEY.
-- Nao crie policy publica para anon/authenticated sem implementar autenticacao real.

create table if not exists public.workspace_audit (
  id           uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  evento       text not null,
  criado_em    timestamptz not null default now()
);

create index if not exists idx_workspace_audit_workspace
  on public.workspace_audit (workspace_id, criado_em desc);

alter table public.workspace_audit enable row level security;
