@AGENTS.md

# Protocolize

An adaptive longevity operating system. Users install expert-designed
**protocol packs** (sleep, training, focus, metabolic, recovery…) which
merge into one de-duplicated, time-anchored daily timeline that adapts to
recovery/adherence signals. Behaviors, biomarkers and a calm intelligence
layer (keystone, weekly review, suggestions) sit on top.

**Business model:** Freemium with a 14-day reverse trial (engagement-gated
auto-extend). Free = the full habit loop + 3 protocol packs + 7-day
insights + 3 biomarkers + local/cloud sync + export. Premium ($8.99/mo or
$79.99/yr; $179 lifetime) unlocks the intelligence layer, the complete
Library, biomarker-aware adaptation, and unlimited history. Stripe is
env-gated and inert until the owner wires Payment Links. Pricing lives in
`src/lib/billing.ts` (`PRICING`).

**Inspired by:** Peter Attia, Andrew Huberman, Siim Land's "25% Program."

---

## Owner Preferences

- **Non-technical founder.** Does not code. Build everything autonomously.
- **Do not ask for permissions** unless absolutely necessary. Just code it.
- **Premium dark design (v4).** Deep blacks/charcoal, restrained accents, calm and
  scientific. Inspiration: Oura, Whoop, Levels, Apple Health, Rise. No bright
  saturation, no rainbow dashboards, no Tailwind-template look. Elegance over density.
- **GitHub:** rwowais (repo: healthkit-website)
- **Brand name:** Protocolize (renamed from "HealthKit" which is Apple-trademarked)
- **Domain:** protocolize.com (not yet purchased)

---

## Workflow & Operating Rules

Tailored from a known-good CLAUDE.md template, reconciled with this project's
autonomy preference. **Where these conflict with Owner Preferences, Owner
Preferences win** (this owner wants autonomous execution, not check-ins).

### Planning
- Plan internally for any non-trivial task (3+ steps or an architectural
  decision). Write the plan down (task list) and work it top to bottom.
- **Do NOT pause for plan approval by default.** Surface a plan for sign-off
  ONLY when a decision is expensive or irreversible: schema/data-model changes,
  data loss, money, new infra/dependencies, or anything needing the owner's
  credentials (e.g. Supabase). Otherwise just build it.
- If something goes sideways, stop and re-plan immediately rather than pushing
  a shaky approach forward.

### Subagents
- Use subagents liberally to keep the main context window clean.
- Offload research, codebase exploration, and parallel analysis to subagents.
- One focused task per subagent.

### Self-improvement loop
- After ANY correction from the owner, capture the pattern in
  `tasks/lessons.md` and write a concrete rule that prevents the repeat.
- Review `tasks/lessons.md` at the start of a session before non-trivial work.
- Iterate on these lessons until the mistake stops recurring.

### Verification before "done"
- Never mark work complete without proving it: `npx tsc --noEmit` clean,
  `npx next build` clean, and in-browser verification of the actual change
  (preview server) for any UI/behavior change.
- Diff behavior between intended and actual; don't trust the diff alone.
- Ask: "would a staff engineer approve this?" before presenting.

### Demand elegance (balanced)
- For non-trivial changes, pause and ask "is there a more elegant way?"
  before committing to an approach.
- If a fix feels hacky, implement the clean solution instead.
- Skip this for simple, obvious fixes — don't over-engineer.

### Autonomous bug fixing
- Given a bug report or failing build/test: just fix it. Find the root cause,
  no temporary patches, no hand-holding. Zero context-switching for the owner.

### Task management
1. Plan first — write a checkable task list.
2. Track progress — mark items complete as you go.
3. Explain changes — concise high-level summary at each step.
4. Document results — what shipped, what's verified, what's still open.
5. Capture lessons — update `tasks/lessons.md` after corrections.

### Core principles
- **Simplicity first** — make every change as small as it can be; minimal code.
- **No laziness** — root causes, not band-aids. Senior-developer standards.
- **Minimal impact** — only touch what's necessary; no incidental side effects.
- **Honesty** — state caveats, limits, and what was *not* verified plainly.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS v4 | ^4 |
| Language | TypeScript | ^5 |
| Fonts | Geist (sans + mono) | via next/font |
| Storage | localStorage + optional Supabase | key: `protocolize-v3`; `SupabaseDataSource` activates only when env keys are set |

### Cloud sync setup (owner action — ~3 min)

The integration is built and **inert until configured** (no env = local-only,
zero change). To enable accounts + cross-device sync:

1. Create a free project at supabase.com.
2. SQL Editor → paste & run `supabase/schema.sql`.
3. Project Settings → API → copy **Project URL** and **anon public** key.
4. Add both as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   in `.env.local` and in Vercel env vars; redeploy.
5. (Optional) Authentication → Providers → Email: keep magic link on.

NEVER use the `service_role` key. On first sign-in, existing local data
migrates up safely (cloud-empty → upload; cloud-present → cloud wins;
nothing is deleted).
| Hosting | Vercel | — |
| Dev server | `next dev --webpack` | Turbopack crashes (PATH issue) |

**Important Tailwind v4 notes:**
- Uses `@import "tailwindcss"` (NOT `@tailwind base/components/utilities`)
- Uses `@theme inline { }` block for custom theme tokens
- No `tailwind.config.js` file — config is in `globals.css`

**Dev server:**
- Run via `start-dev.sh` wrapper (sources nvm before launching)
- Must use `--webpack` flag (Turbopack fails due to node PATH in child processes)
- Node.js managed through nvm (installed via Homebrew)

---

## Folder Structure

```
healthkit-website/
├── CLAUDE.md / AGENTS.md           # This file / Next.js 16 agent rules
├── start-dev.sh                    # Dev launcher (sources nvm + next dev --webpack)
├── supabase/schema.sql             # Cloud table + RLS (owner runs once)
│
├── src/
│   ├── app/                        # App Router pages (all "use client")
│   │   ├── layout.tsx              # Root layout — fonts, providers, SW
│   │   ├── page.tsx                # Landing/marketing
│   │   ├── globals.css             # Design tokens, glass, animations
│   │   ├── manifest.ts             # PWA manifest
│   │   ├── onboarding/page.tsx     # Adaptive ~8-step system builder
│   │   ├── auth/page.tsx           # Sign in / up / magic / forgot
│   │   ├── auth/reset/page.tsx     # Password reset target
│   │   ├── today/page.tsx          # The adaptive daily timeline (home)
│   │   ├── protocols/page.tsx      # Installed system: merged behaviors
│   │   ├── library/page.tsx        # Discover & install protocol packs
│   │   ├── insights/page.tsx       # Intelligence layer (gated)
│   │   ├── biomarkers/page.tsx     # Body & bloodwork tracking
│   │   ├── profile/page.tsx        # Account, sync, data, membership
│   │   └── upgrade/page.tsx        # Premium / pricing
│   │
│   ├── components/                 # Shell, BehaviorSheet, PremiumGate,
│   │   ├── ...                     #   SupabaseAuth, Reminders, ServiceWorker
│   │   └── ui/                     # Primitives, icons, charts, toast
│   │
│   ├── hooks/useAppState.ts        # Single state hook (load/save/sync)
│   │
│   └── lib/
│       ├── types.ts                # All interfaces / unions
│       ├── constants.ts            # Storage keys, score weights
│       ├── storage.ts              # State CRUD, normalize, v2→v3 migrate
│       ├── datasource.ts           # Local | Supabase abstraction
│       ├── supabase.ts auth.ts     # Env-gated client + auth wrappers
│       ├── packs.ts                # Protocol pack catalog
│       ├── engine.ts               # compileTimeline + adapt/shapeTimeline
│       ├── intel.ts                # keystone, weekly review, suggestions
│       ├── time.ts timing.ts       # Schedule/time helpers
│       ├── entitlements.ts         # Access + reverse-trial logic
│       ├── billing.ts              # Stripe Payment Links (env-gated)
│       ├── biomarkers.ts metrics.ts insights.ts scoring.ts
│       └── defaults/               # Seed sleep/exercise/nutrition/supps
```

---

## Design System (v4 — Premium Dark)

Full token set + reusable components live in `src/app/globals.css` and
`src/components/ui/`. Use the design-system classes (`.card`, `.t-title`,
`.t-eyebrow`, `.anim-rise`, etc.) and primitives (`Card`, `Button`, `RingScore`,
`TrendArea`, `Segmented`, `Sheet`, `useToast`) — do not hardcode colors.

### Core tokens (CSS vars)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#08090B` | Page background (radial-graded) |
| `--surface-1/2/3` | `#101216`→`#1D2128` | Card / elevated surfaces |
| `--hairline` | `rgba(255,255,255,.055)` | Subtle borders |
| `--text-1/2/3/4` | `#F4F5F7`→`#494D55` | Text scale (warm off-white) |
| `--sleep` | `#8E9CF7` | Sleep (soft indigo) |
| `--recovery` | `#57D2C4` | Recovery (muted teal) |
| `--readiness` | `#6FA8F5` | Readiness / exercise (soft blue) |
| `--vitality` | `#86D99C` | Nutrition / positive (subtle green) |
| `--warm` | `#E8C99B` | Supplements / streak (warm sand) |
| `--alert` | `#E8896B` | Sparingly: low/destructive (muted coral) |

8px spacing system. Typography via `.t-*` classes. Animations: `.anim-rise`,
`.anim-fade`, `.anim-ring` with `.d1`–`.d6` stagger delays.

### Legacy (pre-v4, do not use)

| Token | Hex |
|-------|-----|
| `--accent` | `#0071e3` |
| `--success` | `#34c759` |
| `--warning` | `#ff9f0a` |

### Category Colors

| Category | Color | Hex |
|----------|-------|-----|
| Sleep | Purple | `#5e5ce6` |
| Exercise | Red | `#ff453a` |
| Diet | Green | `#30d158` |
| Supplements | Orange | `#ff9f0a` |

### Typography

- **Font:** Geist Sans (via `next/font/local`)
- **Sizes:** Apple-style scale using px values in brackets: `text-[32px]`, `text-[19px]`, `text-[17px]`, `text-[15px]`, `text-[13px]`, `text-[12px]`, `text-[11px]`, `text-[10px]`
- **Weights:** `font-bold` (headings), `font-semibold` (subheadings), `font-medium` (labels)
- **Tracking:** `tracking-tight` on large headings

### Layout Patterns

- **Cards:** `bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-4` (or p-6)
- **Buttons (primary):** `bg-[#0071e3] hover:bg-[#0077ed] text-white px-6 py-3 rounded-full text-[13px] font-semibold`
- **Buttons (secondary):** `border border-[#d2d2d7] rounded-full px-4 py-2 text-[13px]`
- **Pills/tabs:** `rounded-full px-4 py-2 text-[13px]` with active state `bg-[#1d1d1f] text-white`
- **Glass header:** `glass` class (72% white bg + 20px blur)
- **Transitions:** `transition-apple` class (0.3s cubic-bezier)
- **Max width:** `max-w-2xl mx-auto` (Shell wraps all pages)
- **Mobile spacing:** Bottom `h-20 lg:hidden` spacer for bottom nav clearance
- **Safe area:** `pb-[env(safe-area-inset-bottom)]` on bottom nav

### Premium Visual Patterns

- **Premium badge:** `bg-[#f5e6d3] text-[#9a6b35]` with lock icon
- **Locked content:** Blurred placeholder with lock overlay
- **Unlock button:** `bg-[#f3e8ff] text-[#7c3aed]` purple theme
- **Toast:** Fixed bottom center, auto-dismiss after 3s, `animate-fade-in`

---

## Data Architecture

State is one `AppState` object (see `src/lib/types.ts`) persisted under
localStorage key **`protocolize-v3`** (legacy v1/v2 keys auto-migrate via
`storage.ts` → `migrateV2toV3` + `normalize`). The app never touches
storage directly — it goes through `useAppState` → `activeDataSource`
(Local or Supabase). With Supabase env set, the cloud row is the source
of truth (local is an offline cache); without it, behaviour is unchanged.

`AppState` (abridged): `settings` (name, sleep window, tier,
`completedOnboarding`, `premiumTrialEndsAt`), `installedPacks` /
`pausedPacks` / `customPacks`, `behaviorOverrides`, `dailyLogs`,
`biomarkers`, `insights`, `currentStreak`, `protocols` + `supplementMeta`
(legacy pillars), `version: 3`.

### Key Data Patterns

- **Dates:** `YYYY-MM-DD` ISO strings everywhere (never Date objects).
- **Day of week:** Monday = 0 … Sunday = 6 (converted from JS `getDay`).
- **Behaviors merge by `canonicalKey`** across installed packs;
  `behaviorOverrides` (timing/dose/disable) keyed by `canonicalKey`.
  `normalize` prunes overrides for uninstalled packs; forked packs
  namespace their keys (`<packId>:<key>`).
- **Score = % of the *shaped* (non-muted) timeline done that day** so it
  matches on-screen progress and "day complete".
- **Onboarding check:** `settings.completedOnboarding === true`. `/today`
  redirects to `/onboarding` when false (covers post-auth new accounts).
- **Entitlements:** `getAccess(state)` — premium = paid OR active trial.
  Reverse trial auto-extends if the user hasn't hit `AHA_DAYS`.

---

## Routes & Navigation

5-tab bottom/side nav (`Shell.tsx`): **Today · Protocols · Insights ·
Library · Profile**. Other routes: `/` (landing), `/onboarding`, `/auth`,
`/auth/reset`, `/biomarkers`, `/upgrade`, `/manifest.webmanifest`.

- **Today** — adaptive timeline, daily check-in, Up Next, suggestions.
- **Protocols** — installed system as merged behaviors; per-behavior edit.
- **Library** — install/remove packs; free cap = 3 *official* packs.
- **Insights** — keystone / weekly review / correlations (premium-gated,
  peek-don't-hide).
- **Biomarkers** — body & bloodwork; free cap = 3 distinct metrics.
- **Profile** — sleep schedule, reminders, membership, export/import,
  Supabase auth, reset (clears local **and** cloud row).

Auth is hybrid: the app is fully usable as a guest; an account just adds
cross-device sync. All auth entry points route through `/today` (the
onboarding guard handles new vs returning).

---

## Status

- ✅ Local-first + optional Supabase cloud sync (env-gated, RLS own-row).
- ✅ Email/password + magic link + password reset; OAuth built, disabled
  until providers configured.
- ✅ Freemium gating + reverse-trial engine.
- ⏳ Stripe: Payment Links env-gated, inert until the owner adds keys.
- ⏳ Legal pages (ToS / Privacy), custom domain, analytics — not yet.
