-- ════════════════════════════════════════════════════════════════════
-- Protocolize — schedule background push reminders (owner runs ONCE)
-- ════════════════════════════════════════════════════════════════════
-- Background reminders (tab closed / installed PWA) fire from the
-- /api/push/send-due endpoint, which must be called every minute. The
-- endpoint already exists and is bearer-authenticated — it just needs a
-- scheduler. This wires the Supabase pg_cron path (recommended, no plan
-- limits). Run this once in the Supabase SQL editor.
--
-- Prereqs:
--   1. Dashboard → Database → Extensions: enable `pg_cron` and `pg_net`.
--   2. In Vercel env, set PUSH_CRON_SECRET to a long random string and
--      redeploy (the endpoint rejects any call without this bearer).
--   3. Replace YOUR_DOMAIN and YOUR_PUSH_CRON_SECRET below.
--
-- Security note: prefer storing the bearer in Supabase Vault and reading it
-- via `vault.decrypted_secrets` rather than inlining it, so the secret isn't
-- visible in cron.job. Inline is shown here for clarity.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'protocolize-send-due',
  '* * * * *',               -- every minute
  $$
  select net.http_post(
    url     := 'https://YOUR_DOMAIN/api/push/send-due',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer YOUR_PUSH_CRON_SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Inspect:   select * from cron.job where jobname = 'protocolize-send-due';
-- Remove:    select cron.unschedule('protocolize-send-due');

-- ────────────────────────────────────────────────────────────────────
-- ALTERNATIVE — Vercel Cron (instead of pg_cron). Requires Vercel PRO
-- (Hobby caps cron frequency, so per-minute reminders won't fire).
-- 1. Set a CRON_SECRET env var in Vercel.
-- 2. Add to vercel.json (the endpoint already accepts GET + CRON_SECRET):
--      "crons": [{ "path": "/api/push/send-due", "schedule": "* * * * *" }]
-- Do NOT add the Vercel cron on Hobby — the deploy/limits won't honor a
-- per-minute schedule. Use the pg_cron path above on any Supabase plan.
-- ────────────────────────────────────────────────────────────────────
