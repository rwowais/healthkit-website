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
