-- Protocolize — cloud state schema
-- Run once in your Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (idempotent).

create table if not exists public.protocolize_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.protocolize_state enable row level security;

-- Each user can read/write ONLY their own row.
drop policy if exists "own row" on public.protocolize_state;
create policy "own row"
  on public.protocolize_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on writes.
create or replace function public.touch_protocolize_state()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_protocolize_state on public.protocolize_state;
create trigger trg_touch_protocolize_state
  before update on public.protocolize_state
  for each row execute function public.touch_protocolize_state();

-- ── Per-day log rows (scalability) ────────────────────────────────────
-- Optional next step: store daily logs as one row per day so a single
-- toggle uploads only that day instead of the whole history, and
-- multi-device conflicts are scoped per-day. The app keeps working on
-- protocolize_state alone until this is enabled; safe to create now.
create table if not exists public.protocolize_logs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  log_date   text not null,                 -- 'YYYY-MM-DD'
  log        jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

alter table public.protocolize_logs enable row level security;

drop policy if exists "own logs" on public.protocolize_logs;
create policy "own logs"
  on public.protocolize_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop trigger if exists trg_touch_protocolize_logs on public.protocolize_logs;
create trigger trg_touch_protocolize_logs
  before update on public.protocolize_logs
  for each row execute function public.touch_protocolize_state();

-- ════════════════════════════════════════════════════════════════════
-- Protocol Intelligence CMS (internal authoring layer)
-- Additive & idempotent. The live app keeps running on its built-in
-- catalog until a bundle is published; these tables are the source of
-- truth for AUTHORING only. Safe to run before any UI exists.
-- ════════════════════════════════════════════════════════════════════

-- Admin allowlist — your Supabase user id(s). Nothing here is reachable
-- by normal users; every cms_* table is admin-gated except published
-- bundles (read-only, non-sensitive) which the app may refresh from.
create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.cms_admins enable row level security;
drop policy if exists "admins self-read" on public.cms_admins;
create policy "admins self-read" on public.cms_admins
  for select using (auth.uid() = user_id);

-- Wave C: let an admin list + manage the allowlist from the UI
-- (otherwise admin onboarding requires the SQL editor). The
-- self-read policy above stays so non-admins can still detect their
-- own admin status. cms_is_admin() is a security-definer function so
-- referencing it here avoids the recursive policy-on-policy trap.
drop policy if exists "admin list all" on public.cms_admins;
create policy "admin list all" on public.cms_admins
  for select using (public.cms_is_admin());
drop policy if exists "admin insert" on public.cms_admins;
create policy "admin insert" on public.cms_admins
  for insert with check (public.cms_is_admin());
drop policy if exists "admin delete" on public.cms_admins;
create policy "admin delete" on public.cms_admins
  for delete using (public.cms_is_admin());

create or replace function public.cms_is_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from public.cms_admins where user_id = auth.uid())
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- Helper: apply an admin-only RLS policy + updated_at touch to a table.
do $cms$
declare t text;
begin
  foreach t in array array[
    'cms_protocols','cms_behaviors','cms_protocol_behaviors',
    'cms_adaptation_rules','cms_insight_templates','cms_explanations',
    'cms_evidence','cms_recommendation_templates',
    'cms_intelligence_config','cms_wearable_mappings',
    'cms_revisions','cms_audit_log','cms_ai_suggestions'
  ] loop
    -- created lazily below; policies (re)applied here after creation
    null;
  end loop;
end $cms$;

create table if not exists public.cms_protocols (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  goal text,
  accent text,
  icon text,
  source text default 'official',
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_behaviors (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique not null,
  title text not null,
  block text check (block in ('morning','afternoon','evening','anytime')),
  anchor text,
  offset_min int default 0,
  dose text,
  leverage int default 2 check (leverage between 1 and 3),
  kind text default 'action',
  icon text,
  rationale text,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  -- AI-drafted rows land with this TRUE. A human must clear it (in the
  -- editor) before the behavior can ever reach a published bundle —
  -- assembleBundleFromCMS() filters these out regardless of status.
  ai_unverified boolean not null default false,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
-- Idempotent migration for projects seeded before the AI rail existed.
alter table public.cms_behaviors
  add column if not exists ai_unverified boolean not null default false;

create table if not exists public.cms_protocol_behaviors (
  protocol_id uuid references public.cms_protocols (id) on delete cascade,
  behavior_id uuid references public.cms_behaviors (id) on delete cascade,
  position int not null default 0,
  primary key (protocol_id, behavior_id)
);

create table if not exists public.cms_adaptation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  priority int not null default 100,
  trigger jsonb not null default '{}'::jsonb,
  effect jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_insight_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  template text not null,
  conditions jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_explanations (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,            -- 'behavior' | 'rule' | 'protocol'
  target_ref text not null,             -- canonical_key / slug / rule id
  kind text not null,                   -- 'why' | 'rationale' | 'timing'
  text text not null,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_evidence (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_ref text not null,
  tier text not null
    check (tier in ('strong','moderate','emerging','anecdotal')),
  source_label text,
  url text,
  summary text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_recommendation_templates (
  id uuid primary key default gen_random_uuid(),
  context text not null,
  copy text not null,
  variables jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','published','archived')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_intelligence_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.cms_wearable_mappings (
  id uuid primary key default gen_random_uuid(),
  metric text not null,
  provider text not null,
  normalize jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

-- Generic history + audit + AI proposals.
create table if not exists public.cms_revisions (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  version int not null,
  snapshot jsonb not null,
  change_note text,
  author uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_cms_rev_entity
  on public.cms_revisions (entity_type, entity_id, version desc);

create table if not exists public.cms_audit_log (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text,
  action text not null,
  diff jsonb,
  author uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text,
  proposed jsonb not null,
  rationale text,
  model text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected')),
  reviewed_by uuid,
  created_at timestamptz not null default now()
);

-- Immutable published bundles. READ is open (the app may refresh the
-- catalog when online); WRITE is admin-only.
create table if not exists public.cms_publications (
  id bigint generated always as identity primary key,
  bundle_version int not null,
  bundle jsonb not null,
  checksum text not null,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- RLS: admin-gated for every authoring/governance table; updated_at
-- trigger where the column exists.
do $cms$
declare t text;
begin
  foreach t in array array[
    'cms_protocols','cms_behaviors','cms_protocol_behaviors',
    'cms_adaptation_rules','cms_insight_templates','cms_explanations',
    'cms_evidence','cms_recommendation_templates',
    'cms_intelligence_config','cms_wearable_mappings',
    'cms_revisions','cms_audit_log','cms_ai_suggestions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all
         using (public.cms_is_admin()) with check (public.cms_is_admin())',
      t);
  end loop;
end $cms$;

alter table public.cms_publications enable row level security;
drop policy if exists "published readable" on public.cms_publications;
create policy "published readable" on public.cms_publications
  for select using (true);
drop policy if exists "publish admin only" on public.cms_publications;
create policy "publish admin only" on public.cms_publications
  for all using (public.cms_is_admin())
  with check (public.cms_is_admin());
