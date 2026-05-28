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
  const next = src.replace(
    /const CACHE_VERSION = "[^"]*";/,
    `const CACHE_VERSION = "${version}";`
  );
  if (next !== src) {
    writeFileSync(path, next);
    console.log(`[stamp-sw] CACHE_VERSION -> ${version}`);
  } else {
    console.warn("[stamp-sw] CACHE_VERSION marker not found — left unchanged");
  }
} catch (err) {
  // Cache cosmetics must never break a deploy.
  console.warn("[stamp-sw] skipped:", err && err.message);
}
