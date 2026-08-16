# Protocolize — Comprehensive Pre-Launch Test Plan
_Written 2026-07-05. Executes when Rami says "start the test plan." Goal: prove
the whole product is trustworthy end-to-end BEFORE wiring Stripe. Runs against
**production** (local `.env.local` → prod), lean-mode discipline: verify each
thing once, in the DB where it counts, and clean up test data after._

---

## 0. How this runs
- **Driver:** me, via the browser preview (real UI clicks) + Supabase reads to
  confirm what actually landed server-side + the existing Playwright e2e suite
  (`/e2e`, 16 specs) + the 51 vitest unit files as the automated backstop.
- **Accounts:** throwaway `rwowais+testNN@gmail.com` addresses (auto-confirmed
  via DB), each deleted at the end of its phase. Never touches your real account.
- **Output:** a PASS/FAIL line per case with the evidence (DB row, screenshot, or
  console/network state). Anything that fails → I root-cause + fix + re-verify
  before moving on (unless you want a findings-only pass).
- **Scope guard:** Stripe/paywall *purchase* is explicitly OUT (that's next). We
  DO test that gating/entitlement *logic* behaves — just not real charges.
- **Rough size:** ~9 phases, ~70 checks. I'll checkpoint after each phase so you
  can watch progress or stop early.

---

## Phase 1 — First-run & onboarding (the make-or-break 60 seconds)
1. Cold load `/` → landing renders, CTA works, no console errors.
2. Fresh visitor → `/onboarding`: complete the ~8-step builder for each goal
   path — **sleep, energy, focus, longevity** — and confirm each assembles a
   sensible starter system (right packs installed, `completedOnboarding=true`).
3. Onboarding → `/today` lands with a populated, non-empty timeline.
4. Abandon mid-onboarding + reload → resumes gracefully (no half-state crash).
5. Mid-day first-day "soft entry": banner is calm, progress bar / Up Next / badge
   all suppressed (the firstDaySoft contract), and the app-icon badge is 0.
6. Deep-link into `/today` as a brand-new user → onboarding guard redirects.

## Phase 2 — Core daily loop (the thing they do every day)
7. Check-in: tap sleep only → banner holds neutral (deferRead) until energy set;
   both tapped → correct adaptive mode + honest copy.
8. Complete behaviors → score updates, "Up Next" advances, day-complete
   celebration fires with correct copy (behaviors vs supplement-only wording).
9. Each **adapt mode** reachable & coherent (banner matches board):
   `normal, recovery (poor sleep+low energy), lighter, essentials (low adherence),
   primed (great recovery), rebuild (long gap return)`. Verify recovery banner is
   honest for a sleep-only user (no "demanding work set aside" when none exists).
10. Snooze / swap / stack / "move to block" a behavior → persists + reflects on board.
11. Supplements tab: take / skip / undo, block cards, "all done" states.
12. Day rollover: scrub to yesterday/tomorrow (read-only past, no accidental writes);
    simulate a new day → per-day mirrors re-read correctly, streak/goal ring update.
13. Reminders: set per-behavior reminder on a TIMED behavior (works) vs an
    "anytime"/muted one (honest "won't fire" note). Quiet-hours copy + zero-window warning.

## Phase 3 — Protocols, Library & custom builder
14. Library: install / remove official packs; free 3-pack cap enforced with clear copy.
15. Merged system: two packs sharing a behavior de-dupe by canonicalKey.
16. Custom builder (Premium): create a behavior with block + time + **Active days**
    (weekend-only) + dose; verify it schedules only on chosen days and can graduate
    to mastery. "Link it" to a library atom keeps the atom's smart timing.
17. Fork an official pack → edits isolate under the fork namespace (no `draft` leak).
18. Toggle all active-days off in the sheet → shows "paused", doesn't vanish.

## Phase 4 — Intelligence layer (Insights)
19. Cold Insights (day 0): honest "check in for ~a week" state, no fabricated data.
20. With ~1–2 weeks of seeded logs: keystone, weekly review, "what's sticking"
    (conflict-muted behavior NOT shown as a 0% red failure), correlations explorer,
    "your next habit" links to the right pack/builder.
21. Free vs Premium delay: free sees insights on the 3-day lag, Premium live.
22. Long-gap returner: suggestion card suppressed (no stale pre-gap nags under the
    welcome-back banner).

## Phase 5 — Full account lifecycle (already verified 2026-07-05 — re-confirm only if code changed)
23. Guest → sign-up → email-confirm → first-sign-in guest-data lift.
24. Live sync: edit → cloud doc + per-day logs land within seconds (check DB).
25. **Two-device / two-tab:** edits reconcile; reset-in-one-tab isn't resurrected
    by the other (reset-epoch tombstone); first-sign-in conflict modal isn't
    silently cloud-won by a background load.
26. Sign out → local cache cleared, next person can't see prior data.
27. **Reset all data** → logs/biomarkers/packs wiped, name+trial kept (verify DB).
28. **Delete account** → auth user + all rows cascade-deleted + device wiped (verify DB).
29. Export → import round-trip: a backup restores; import doesn't bypass entitlement clamps.

## Phase 6 — Entitlements & the reverse-trial engine (money-adjacent logic, no real charge)
30. New user: 14-day reverse trial starts; `getAccess` = premium during trial.
31. Engagement-gated auto-extend: hasn't hit AHA_DAYS → trial extends (not expires).
32. Trial-expired free user: Premium surfaces gate correctly (peek-don't-hide),
    `/upgrade` copy is honest (no "lock it in" urgency / no unbuyable price table
    while Stripe is inert), Profile CTA doesn't promise a restore that can't happen.
33. Clock-tampering guards: rolling device clock back doesn't grant infinite Premium;
    forward jump doesn't permanently burn the one-shot extension.
34. Biomarker cap logic is inert (feature hidden) — confirm no biomarker gate leaks.

## Phase 7 — Admin / CMS (owner-only, but it ships the whole app's content)
35. Non-admin blocked from `/admin`; admin (your account) allowed.
36. Publish diff renders (the bug we just fixed) and is accurate.
37. Transient-failure safety: a failed assembly ABORTS publish (no wrong/stripped
    bundle shipped) — simulate by pointing at a bad read.
38. Simulate tab reflects draft rules + conflict mutes (matches what publishing ships).
39. Roll back to a prior version works. "No changes" dedupe holds.
40. Evidence/timing an admin authored actually reaches the published bundle.

## Phase 8 — PWA, performance & resilience
41. **iOS install (YOUR iPhone — the one thing I can't automate):** add to home
    screen, status bar doesn't collide with notch, splash shows, offline launch
    works, auto-update after a deploy pulls the new build, badge behaves.
42. Android/desktop install prompt + installed behavior.
43. Offline: airplane-mode a cached route → branded offline page or hydrated shell,
    not a dead skeleton; edits queue and sync when back online.
44. Error boundaries: force a thrown error → friendly recovery, not a white screen.
45. Storage-full: simulate quota exceeded → save-error toast (data-loss warning).
46. Cold-load performance sanity on `/today` (no absurd bundle regressions).

## Phase 9 — Accessibility, cross-cutting & content polish
47. Keyboard-only: onboarding, check-in, sheets, move-menu (arrow keys), admin.
48. Screen-reader labels on toggles/pills/inputs; live-region toasts announce.
49. Light + dark theme: every surface legible, no hardcoded-color breakage.
50. Legal: `/terms` + `/privacy` render; acceptance banner re-prompts on version bump.
51. Copy audit: no leftover test content, no "biomarker" leaks (feature hidden),
    no overclaims, build stamp updates after deploy.
52. Run the full **Playwright e2e suite** (`/e2e`, 16 specs) + **vitest** (607) as
    the automated backstop, capture any regressions.

---

## Exit criteria (what "ready for Stripe" means)
- Every Phase 1–7 case PASSES (or has a logged, accepted deferral).
- Phase 8's iOS check done on your device.
- Zero known data-loss, auth, or entitlement-logic defects.
- All test accounts deleted; prod left clean.
- A short PASS/FAIL summary appended here with the date.

## Notes
- If you want a **fast pass**, we can run Phases 1–2, 5, 6 (the revenue-critical
  core) first and defer 3/4/7/9 to a second sitting.
- I'll adapt persona seeds from the audit personas already encoded in the repo.

---

# RUN 1 — 2026-07-24 (partial: unauthenticated scope)

Against production at commit `26ba2a4`. **22 checks executed, 22 PASS, 3 new
findings.** The account-driven majority of the plan is BLOCKED — see below.

## Why this run is partial
The plan's driver is the Playwright harness, which provisions throwaway users
with `SUPABASE_SERVICE_ROLE_KEY`. That key is not in `.env.local` and the e2e
README names it as the one manual provisioning step. Without it the live suite
can't run, and since the app is account-gated, every authenticated phase is
gated behind it too. (I can't substitute by signing up or signing in by hand —
creating accounts and entering credentials are outside what I do.)

## PASS — API trust boundaries (prod, unauthenticated)
| # | Check | Evidence |
|---|---|---|
| S1 | `push/rotate` rejects a cross-origin endpoint swap | `HTTP 400 {"reason":"Endpoint origin mismatch."}` — SEC-2 fix live-verified |
| S2 | `push/rotate` returns a uniform body (no existence oracle) | `HTTP 200 {"ok":true}`, no `rotated` field |
| S3 | `push/subscribe` refuses an unauthenticated call | `HTTP 401 "Sign in required."` |
| S4 | `push/send-due` refuses without the cron secret | `HTTP 401 "Unauthorized."` |

## PASS — Auth wall (plan #6, #26-adjacent)
| # | Check | Evidence |
|---|---|---|
| W1 | Signed-out `/today` → `/auth` | landed `/auth`, no session key in localStorage |
| W2 | Signed-out `/insights` → `/auth` | landed `/auth` |
| W3 | Legal pages stay public | `/terms` + `/privacy` render signed-out |

## PASS — Public surface & copy (plan #1, #50, #51)
| # | Check | Evidence |
|---|---|---|
| P1 | Landing renders with h1 + CTA | h1 "Your daily routine — adapted to how you actually feel today." |
| P2 | Zero console errors on cold load | console error list empty |
| P3 | `/terms` renders | h1 "Terms of Service", Version 1, 611 words |
| P4 | `/privacy` renders | h1 "Privacy Policy", 567 words |
| P5 | No "biomarker" / "Body Trends" leak on public copy | both regexes false |
| P6 | No lorem / placeholder / TODO / test copy | all regexes false |

## PASS — Theme & contrast (plan #49) — WCAG AA computed live
| Theme | text-1 | text-2 | text-3 | text-4 |
|---|---|---|---|---|
| Dark (on `--bg`) | 18.26 | 8.57 | 6.39 | **5.42** (on surface-1) |
| Light (on `--bg`) | 16.90 | 8.45 | 5.62 | **5.68** (on surface-1) |

All ≥ 4.5:1. Confirms the A11Y-1 token fix in production (was ~3.9 dark).

## PASS — PWA surfaces (plan #42/#43 partial)
`/offline.html` 200 (title "Protocolize · Offline") · `/sw.js` 200 ·
`/manifest.webmanifest` 200.

## PASS — Data-layer integrity (plan #24-adjacent, #34)
RLS enabled on **every** public table (0 without) · exactly 1 CMS admin ·
0 leftover `e2e-pw-` users · entitlements table holds 1 premium row (the owner
grandfather), so the paywall gate is inert-but-correct pre-Stripe.

## PASS — Automated backstop (plan #52, partial)
vitest **647 passed / 18 skipped** · `tsc --noEmit` clean · `next build` clean.
Playwright (16 specs) NOT run — blocked on the service-role key.

## NEW FINDINGS
1. **[Low-Med · Security] No clickjacking / MIME / referrer headers.** Only
   `strict-transport-security` is set (Vercel default). Missing
   `X-Frame-Options` (or CSP `frame-ancestors`), `X-Content-Type-Options:
   nosniff`, and `Referrer-Policy`. The app has destructive account actions
   behind a session, so framing protection is worth having. Fix: a `headers()`
   block in `next.config`. Not launch-blocking, but cheap.
2. **[RESOLVED 2026-07-24 — KEEP]** Three prod accounts that are neither yours
   nor the demo: `gbushee+healthkit@`, `idahabibi@`, `ava.habibi@`. **Confirmed
   by the owner as friends testing the app — these stay.** Treat their rows as
   real user data: never delete them in cleanup, seeding, or test teardown.
   (The Playwright teardown is already safe — it matches only the `e2e-pw-`
   prefix.) Only `rwowais+demo@` is disposable. Correcting the record: the app
   does have real users, just a small invited circle.
3. **[Low · A11y] `/terms` has no `<main>` landmark** — consistent with the
   already-logged audit finding F13 (auxiliary pages lack landmarks). Open.

---

# RUN 2 — 2026-07-24 (live e2e, after the owner supplied the service-role key)

**Result: 26/26 e2e PASS, 647/647 unit PASS — but only after fixing a real
regression the suite caught on its first run.**

## The find (this is why the plan existed)
`persistence.spec` and `sync.spec` both failed: completing a behavior did not
survive a reload or reach a second device. Deterministic, not flaky, and the
aria-labels the specs wait on matched the code exactly — so not a stale test.

A throwaway probe (click once, then dump UI state + localStorage +
`pz:pending-sync` + the DB row) localized it in a single run:

| Signal | Before fix | After fix |
|---|---|---|
| UI flips to done | true | true |
| localStorage has completion | **false** | true |
| cloud row has completion | **false** | true |
| `pz:pending-sync` | cleared (claims saved) | correct |

So a stale document was overwriting the fresh one while the app reported
success. Root cause: the REL-3 shared store. A `load()` begun before the user's
tap resolved after it and republished its pre-edit snapshot to every instance
at once. The old per-instance design masked this — a late load only clobbered
its own copy. Fixed by making async publishes compare-and-swap
(`publishIfUnchanged`), applied to both the initial load and the refocus
resync. Shipped as `be66103`; +3 unit tests pin it.

**This regression was live in production** between `ca45c3c` and `be66103`.

## Coverage confirmed by the passing suite
Auth wall · signup funnel + onboarding activating the 14-day trial · a
completed behavior persisting across reload · cross-device sync · guest-data
merge on first sign-in · cross-user RLS isolation · account deletion · logout ·
error handling · a11y pass · mobile + desktop visual tour of every screen.

## Housekeeping
Teardown left **0** `e2e-pw-` users. The 5 remaining accounts are exactly the
three friend testers, the owner, and the demo — untouched, as intended.

Also fixed: `playwright.config.ts` now loads `.env.local` itself (verified with
those vars stripped from the shell), so the README's "add the key and run" is
true — previously the harness aborted despite the key being in the file.

## STILL OPEN after Run 2
- Phase 8 #41 — **iOS install on your iPhone** (un-automatable).
- Build-stamp check (renders only on authenticated `/profile` + `/admin`).
- Phases 3/4/7 UI depth (custom builder, insights with seeded history, admin
  publish flow) — the e2e suite covers the critical paths but not every case.
- Finding #1 from Run 1: security headers still unset.

## BLOCKED — needs you
- **Playwright e2e + every authenticated phase (1–4, most of 5–7):** add
  `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (from Supabase → Settings → API)
  and I can run the whole suite unattended; it only ever deletes `e2e-pw-`
  accounts, so it is safe against prod.
- **Build-stamp check:** only rendered on `/profile` and `/admin`, both
  authenticated.
- **Phase 8 #41 — iOS install on your iPhone:** genuinely un-automatable.
