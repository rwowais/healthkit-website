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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Keep updated_at fresh on writes.
create or replace function public.touch_protocolize_state()
returns trigger language plpgsql
set search_path = '' as $$
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
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
  for select using ((select auth.uid()) = user_id);

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

-- Denormalize email onto cms_admins for human-readable display in the
-- admin UI. user_id remains the primary key / source of truth; email
-- is captured at invite time. Idempotent — safe to re-run.
alter table public.cms_admins
  add column if not exists email text;

-- Email → user id resolver. Lives behind security definer so it can
-- read auth.users (anon role cannot), and gated to admins only so a
-- regular signed-in user can't enumerate emails. Used by the
-- "Add admin (by email)" flow in /admin to avoid forcing the operator
-- to dig up Supabase UUIDs in the dashboard.
create or replace function public.cms_resolve_email(p_email text)
returns uuid
language plpgsql security definer
set search_path = public, auth as $$
declare
  uid uuid;
begin
  if not public.cms_is_admin() then
    raise exception 'Only admins can resolve emails.';
  end if;
  select id into uid from auth.users
    where lower(email) = lower(trim(p_email))
    limit 1;
  return uid;
end $$;

revoke all on function public.cms_resolve_email(text) from public;
grant execute on function public.cms_resolve_email(text) to authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql
set search_path = '' as $$
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
    'cms_revisions','cms_audit_log','cms_ai_suggestions',
    'cms_interactions'
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
-- Covering index for the behavior_id FK. The composite PK covers the
-- protocol_id side; the behavior_id side needs its own index so
-- behavior-deletes / reverse lookups don't seq-scan.
create index if not exists idx_cms_protocol_behaviors_behavior
  on public.cms_protocol_behaviors (behavior_id);

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

-- Behavior-to-behavior interactions — the data-driven generalization of the
-- hardcoded CONFLICT_PAIRS. Authored here, snapshotted into the published
-- bundle; the runtime reads it from the bundle, never directly.
create table if not exists public.cms_interactions (
  id uuid primary key default gen_random_uuid(),
  a_key text not null,
  b_key text not null,
  type text not null default 'conflict'
    check (type in ('conflict','timing','ordering','synergy')),
  severity text not null default 'soft'
    check (severity in ('soft','firm')),
  gap_hours numeric,
  bound jsonb,
  condition jsonb,
  direction text not null default 'a_to_b'
    check (direction in ('a_to_b','mutual')),
  nudge text not null default '',
  evidence_tier text
    check (evidence_tier in ('established','emerging','exploratory')),
  source text,
  -- Scientific-claim interactions (evidence_tier set) are held back from
  -- every published bundle until a human stamps these (assembleBundleFromCMS
  -- enforces it) — the analog of cms_behaviors.ai_unverified.
  source_verified_by uuid,
  source_verified_at timestamptz,
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
-- One explanation per (target, kind) — concurrent upserts used to race.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_explanations_target_kind_unique'
  ) then
    alter table public.cms_explanations
      add constraint cms_explanations_target_kind_unique
      unique (target_type, target_ref, kind);
  end if;
end $$;

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
-- One evidence row per (target_type, target_ref) — concurrent upserts
-- from the editor used to race; this makes them deterministic.
-- Wrapped in DO so the migration is idempotent across re-runs.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'cms_evidence_target_unique'
  ) then
    alter table public.cms_evidence
      add constraint cms_evidence_target_unique
      unique (target_type, target_ref);
  end if;
end $$;

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

-- Monotonic, immutable versions: two admins (or two tabs) publishing
-- concurrently must not both mint the same bundle_version with different
-- content. Without this, latest()/rollback/checksum-readback all key on a
-- non-unique version and silently pick or skip arbitrarily. publishBundle
-- catches the unique-violation and asks the second admin to refresh + re-review.
-- Idempotent; safe on existing data (current history is already distinct-versioned).
create unique index if not exists cms_publications_version_key
  on public.cms_publications (bundle_version);

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
    'cms_revisions','cms_audit_log','cms_ai_suggestions',
    'cms_interactions'
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

-- ── Account self-deletion ─────────────────────────────────────────
-- SECURITY DEFINER RPC: lets a signed-in user delete their own
-- auth.users row. RLS would otherwise block this (the auth schema
-- is locked down). The function only ever operates on auth.uid(),
-- so a malicious caller can only ever delete THEIR OWN account.
-- This is the cornerstone of GDPR Article 17 (right to erasure)
-- and equivalent CCPA/PIPEDA rights.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  -- Remove the cms_admins row, then the auth.users row itself.
  -- Deleting the auth user cascades protocolize_state, protocolize_logs
  -- and push_subscriptions (all FK `on delete cascade`), so they need no
  -- explicit deletes. NOTE: the previous version deleted from
  -- `public.app_states` — a table renamed to protocolize_state long ago
  -- and no longer present — which raised undefined_table and aborted the
  -- whole function, silently breaking account deletion under cloud sync.
  delete from public.cms_admins where user_id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Web Push subscriptions ────────────────────────────────────────
-- One row per (user, endpoint). When a user enables reminders, the
-- client subscribes via VAPID and POSTs the subscription here. A
-- server cron then walks this table at reminder time and sends the
-- pushes. RLS ensures users can only see/manage their own rows.
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  -- Per-user reminder times (HH:MM, local to the user's tz). Empty =
  -- no schedule attached (the user can still receive ad-hoc pushes
  -- like trial-ending alerts). Stored as a string array; the cron
  -- worker resolves these against the user's settings.timezone.
  reminder_times text[] not null default array[]::text[],
  -- Optional explicit timezone snapshot — used by the cron worker so
  -- it doesn't need to fetch the app_states row on every tick. Kept
  -- in sync by the client on subscribe + when the user changes tz.
  timezone text,
  created_at timestamptz not null default now(),
  last_pinged_at timestamptz,
  -- Soft-deletion: set when the push provider returns 410 (gone).
  -- The cron skips these but keeps the row briefly for debugging.
  disabled_at timestamptz,
  constraint push_subscriptions_user_endpoint_unique
    unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);
create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions(disabled_at) where disabled_at is null;

alter table public.push_subscriptions enable row level security;

drop policy if exists "own subs select" on public.push_subscriptions;
create policy "own subs select" on public.push_subscriptions
  for select using ((select auth.uid()) = user_id);
drop policy if exists "own subs insert" on public.push_subscriptions;
create policy "own subs insert" on public.push_subscriptions
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists "own subs update" on public.push_subscriptions;
create policy "own subs update" on public.push_subscriptions
  for update using ((select auth.uid()) = user_id);
drop policy if exists "own subs delete" on public.push_subscriptions;
create policy "own subs delete" on public.push_subscriptions
  for delete using ((select auth.uid()) = user_id);

-- ── Defense-in-depth: auto-enable RLS on any new public table ──────
-- A DDL event trigger that flips on row level security the moment any
-- table is created in `public`, so a future table can never ship with
-- RLS accidentally off. It's an event-trigger function (fires on DDL,
-- not via the REST API) — execute is revoked from API roles so it
-- can't be poked directly. Codified here to match what's already live.
create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer
set search_path = pg_catalog as $$
declare cmd record;
begin
  for cmd in
    select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name = 'public' then
      begin
        execute format(
          'alter table if exists %s enable row level security',
          cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed on %', cmd.object_identity;
      end;
    end if;
  end loop;
end $$;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
  execute function public.rls_auto_enable();
