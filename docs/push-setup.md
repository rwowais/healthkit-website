# Web Push setup (one-time owner action, ~10 min)

The push infrastructure ships off but inert. To turn it on:

## 1. Generate VAPID keys

```sh
node scripts/generate-vapid.mjs
```

Copy the printed keys to your `.env.local`:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:hello@protocolize.com
PUSH_CRON_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...   # from Supabase Settings → API
```

And to Vercel (Project Settings → Environment Variables, set for
Production and Preview):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_CRON_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*`
variable.** It bypasses RLS and would expose every user's data if
shipped to the client.

## 2. Make sure the Supabase schema is up to date

Re-run `supabase/schema.sql` in your Supabase SQL editor. The script
is idempotent — it'll create the new `push_subscriptions` table the
first time and no-op on subsequent runs.

## 3. Enable Supabase extensions and set up the cron

In the Supabase SQL editor, ensure the `pg_cron` and `pg_net`
extensions are enabled (Database → Extensions):

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
```

Then schedule the job (replace `YOUR_DOMAIN` and the secret):

```sql
select cron.schedule(
  'pz-push-send-due',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://YOUR_DOMAIN/api/push/send-due',
      headers := jsonb_build_object(
        'authorization', 'Bearer YOUR_PUSH_CRON_SECRET',
        'content-type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);
```

To remove it later:

```sql
select cron.unschedule('pz-push-send-due');
```

## 4. Test it

1. Redeploy (Vercel picks up the new env vars).
2. Open the app, sign in, go to Profile → Reminders.
3. Toggle reminders on, grant permission.
4. Click "Send a test reminder" — you should receive a push.
5. On iOS, only the installed PWA path works (Add to Home Screen
   first, then sign in inside the installed app).

## How it works

- The client subscribes to push via the VAPID public key when the
  user enables reminders.
- The subscription (endpoint + keys) is stored in `push_subscriptions`
  via `/api/push/subscribe`. RLS ensures only the user can see/edit
  their own.
- Once a minute, Supabase pg_cron hits `/api/push/send-due` with the
  shared `PUSH_CRON_SECRET`. The route walks every active subscription
  and sends a push if the current minute (in the user's tz) matches
  one of their reminder times.
- The service worker (`public/sw.js`) handles the `push` event and
  shows the notification — works with the tab closed.

## Cost notes

- Supabase pg_cron is free.
- Each push is a single HTTPS POST to the user's browser vendor's push
  service (Apple/Google/Mozilla) — also free.
- `web-push` runs in our Vercel function, no external service.

So push infrastructure is effectively free until very large scale.
