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
