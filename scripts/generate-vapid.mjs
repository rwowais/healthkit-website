#!/usr/bin/env node
/**
 * One-time VAPID keypair generator. Run with:
 *   node scripts/generate-vapid.mjs
 *
 * Copy the printed keys into:
 *   - .env.local (for local dev)
 *   - Vercel env vars (Production + Preview)
 *
 * VAPID keys identify your server to push providers (Apple/Google/
 * Mozilla). Generate them ONCE and never rotate unless absolutely
 * necessary — every rotation invalidates every existing user
 * subscription, forcing re-prompts.
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("\nGenerated VAPID keys. Add to .env.local + Vercel:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hello@protocolize.com`);
console.log(`PUSH_CRON_SECRET=${cryptoRandom(40)}\n`);
console.log("Then in Supabase SQL editor, set up the cron job:");
console.log(`
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
`);

function cryptoRandom(len) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  const bytes = new Uint8Array(len);
  // Node 19+ has globalThis.crypto; fall back to require for older.
  const c = globalThis.crypto ?? (await import("node:crypto"));
  c.getRandomValues(bytes);
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}
