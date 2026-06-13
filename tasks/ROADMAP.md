# Protocolize — Roadmap / What's left
_Last updated 2026-06-13. Forward-looking priority view. Full per-item evidence
lives in `tasks/HANDOFF.md`; gotchas in `tasks/lessons.md`._

## ✅ Done recently (so we don't redo it)
- **Entire audited bug backlog** — Batches P (PWA), C (CMS publish), S (sync),
  R1 (mediums + lows), ~45 fixes — shipped and deployed.
- **DB migration #1** — `cms_publications` unique version index — applied to
  **staging + production** (prevents two admins minting the same version).
- **Biomarkers / "Body Trends" HIDDEN from users** — gated behind
  `BIOMARKERS_ENABLED` in `src/lib/flags.ts` (2026-06-13 founder call). Engine,
  the `/biomarkers` page, and any logged data are intact — flip the flag back to
  `true` (+ redeploy) to restore the whole feature with history. See item **J**
  for the work to do BEFORE re-enabling.

---

## 🔴 NOW — visible to users / security
**A. Remove "Test Protocol 1" from the live Library.**
The live bundle (v9) still serves a test protocol alongside the 6 real ones. It's
already archived in the source data, so removing it is a single **"Publish" click
in `/admin`** — but the re-publish MUST go through the app's pipeline (can't be
faked in SQL). Blocker: no CMS admin is configured yet (that table is empty).
_Me: set up admin + prep. You: one click (or I guide)._

**B. Rotate the exposed GitHub token.**
It sits in plaintext in the repo's git remote URL and was exposed in-session.
_You: rotate it (I'll guide) + I move the repo to a credential helper._

**C. On-device iPhone check.**
This session's iOS/PWA fixes (status bar, offline, auto-update) can't be tested on
desktop. _You: open the installed app once after a deploy and confirm._

## 🟠 BEFORE taking payments (whenever you launch)
**D. Stripe fulfillment webhook.** No path grants Premium after a payment today —
wiring checkout now would charge people and deliver nothing. Needs a small server
piece (Stripe webhook → stamps the user Premium). _Me: build. You: Stripe keys._
**#1 launch blocker.**

**E. Domain + analytics.** Buy `protocolize.com`, point DNS at Vercel, set
`NEXT_PUBLIC_SITE_URL` + `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`. _You: accounts; I verify._

## 🟡 FEATURE & DESIGN — no rush
**F. Day-aware background reminders** (#2) — schema + code so weekend-only
behaviors get correct-day background pings. Pair with turning push on (needs your
VAPID keys). Safe interim already live. _Me + you when activating push._

**G. Live cross-tab sync** (#581 + guest two-tab) — edits in one open tab don't
show in another until refocus. Data is safe, just stale UI. Needs a
BroadcastChannel/op-log design. _Me._

**H. Long-term storage trimming** — a multi-year daily user's data doc grows large
and re-uploads often (Phase-3 log windowing). Pure scaling; irrelevant at today's
size. _Me._

**I. Night-shift / wrap-around schedules** (#158/#165/#179) — for users who sleep
across midnight, day "blocks" file imperfectly. Schedule-model rework; niche. _Me._

**J. Biomarkers v2 — required BEFORE flipping `BIOMARKERS_ENABLED` back on:**
  - Clinical "dangerously low" thresholds (#553) — and remember low resting HR is
    GOOD for this audience, so thresholds are a real judgment call.
  - Treat blood pressure as one reading, not two free-cap slots (#546).
  - Then re-enable the flag + redeploy. _You: clinical call. Me: build._

## 🔵 MINOR / anytime
**K. Edge cases** — weekly-review memory edge, supplement undo symmetry, a fresh
targeted re-audit of the two unrun audit dimensions. Cosmetic/thoroughness. _Me._

---

### How to pick this up later
Say e.g. _"let's do A"_ (remove Test Protocol 1) or _"start on Stripe."_ Each item
above maps to detailed notes in `tasks/HANDOFF.md`.
