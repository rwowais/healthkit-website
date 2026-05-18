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
