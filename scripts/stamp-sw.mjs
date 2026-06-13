/**
 * Stamp the service-worker cache version with the per-deploy git SHA, so
 * every production deploy ships a DISTINCT sw.js. Effect:
 *   - the activate handler purges all non-current caches (old chunks/HTML)
 *   - ServiceWorker.tsx's controllerchange listener fires → the open tab
 *     reloads once onto the new build
 * Together with network-first navigations, this guarantees a deploy
 * actually reaches users instead of sitting behind a stale cache.
 *
 * Safety: this is wrapped so it can NEVER fail the build, and it is a
 * no-op when no deploy SHA is present (local `npm run build`), so it
 * never dirties the committed public/sw.js in development.
 *
 * Also injects NEXT_PUBLIC_VAPID_PUBLIC_KEY so the SW can re-subscribe to push
 * in its pushsubscriptionchange handler (public/sw.js has no access to the
 * bundled env, unlike app code).
 *
 * Wired via vercel.json buildCommand: "node scripts/stamp-sw.mjs && next build".
 */
import { readFileSync, writeFileSync } from "node:fs";

const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";

if (!sha) {
  // Local / non-CI build: keep the committed default version, no churn.
  process.exit(0);
}

try {
  const path = "public/sw.js";
  const src = readFileSync(path, "utf8");
  const version = "build-" + sha.slice(0, 8);
  let next = src.replace(
    /const CACHE_VERSION = "[^"]*";/,
    `const CACHE_VERSION = "${version}";`
  );
  if (next !== src) {
    console.log(`[stamp-sw] CACHE_VERSION -> ${version}`);
  } else {
    console.warn("[stamp-sw] CACHE_VERSION marker not found — left unchanged");
  }
  // Inject the public VAPID key (safe to embed — it's public). Leaves the
  // placeholder untouched when the env var is absent, so the handler no-ops.
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  if (vapid) {
    next = next.replace(
      /const VAPID_PUBLIC_KEY = "[^"]*";/,
      `const VAPID_PUBLIC_KEY = "${vapid}";`
    );
    console.log("[stamp-sw] VAPID_PUBLIC_KEY injected");
  }
  if (next !== src) {
    writeFileSync(path, next);
  }
} catch (err) {
  // Cache cosmetics must never break a deploy.
  console.warn("[stamp-sw] skipped:", err && err.message);
}
