@AGENTS.md

# Protocolize

A longevity routine web app that helps users build science-backed routines for sleep, exercise, nutrition, and supplements. Users can follow structured multi-week programs or build custom routines, then track daily adherence and view progress analytics.

**Business model:** Freemium. Free tier = tracker + routine builder. Premium ($7/mo) = structured programs, full protocol library, workout logger, meal library.

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

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS v4 | ^4 |
| Language | TypeScript | ^5 |
| Fonts | Geist (sans + mono) | via next/font |
| Storage | Browser localStorage | key: `protocolize-v1` |
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
├── CLAUDE.md                       # This file
├── AGENTS.md                       # Next.js 16 agent rules
├── start-dev.sh                    # Dev server launcher (sources nvm + runs next dev --webpack)
├── package.json                    # Dependencies (next, react, tailwind, typescript)
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .eslintrc.json
│
├── src/
│   ├── app/                        # Next.js App Router pages (all "use client")
│   │   ├── layout.tsx              # Root layout — Geist fonts, metadata
│   │   ├── page.tsx                # Landing/marketing page (hero, features, pricing)
│   │   ├── globals.css             # Design tokens, glass morphism, animations
│   │   ├── favicon.ico
│   │   ├── onboarding/page.tsx     # Multi-step quiz (name + 7 questions + result)
│   │   ├── dashboard/page.tsx      # Main hub (stats, program, quick actions, protocols)
│   │   ├── protocols/page.tsx      # Protocol library with category/difficulty/source filters
│   │   ├── programs/page.tsx       # Program cards (Metabolic Reset, Body Recomp)
│   │   ├── programs/[id]/page.tsx  # Program detail with phase accordion + daily plans
│   │   ├── meals/page.tsx          # Meal library with type filters + macro bars
│   │   ├── workout/page.tsx        # Workout logger (timer, exercises, sets, history)
│   │   ├── tracker/page.tsx        # Daily check-in (progress ring, mood, energy, sleep, protocol checklist)
│   │   ├── progress/page.tsx       # Analytics (streak, 7-day chart, 30-day heatmap, adherence bars)
│   │   └── routine/page.tsx        # Routine management
│   │
│   ├── components/
│   │   ├── Shell.tsx               # App shell — sticky glass header, desktop nav, mobile hamburger, mobile bottom nav
│   │   └── ProtocolCard.tsx        # Dark card component for protocol display
│   │
│   └── lib/
│       ├── types.ts                # All TypeScript interfaces and type unions
│       ├── storage.ts              # localStorage CRUD (key: "protocolize-v1")
│       ├── protocols.ts            # 39 protocols across 4 categories + categoryInfo map
│       ├── programs.ts             # 2 programs: Metabolic Reset (6wk) + Body Recomp (5wk)
│       ├── meals.ts                # 14 meal ideas with ingredients + macros
│       └── quiz.ts                 # 7 onboarding questions + getRecommendation() logic
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

### localStorage Schema (key: `protocolize-v1`)

```typescript
interface UserRoutine {
  profile: UserProfile;           // name, goal, experience, quizAnswers, isPremium
  selectedProtocols: SelectedProtocol[];  // user's chosen protocols with weekly schedules
  dailyLogs: DailyLog[];         // array of daily entries (mood, energy, sleep, completions)
  workoutLogs: WorkoutLog[];     // array of logged workouts
  activeProgram: {               // currently active program (or null)
    programId: string;
    currentWeek: number;
    startDate: string;
  } | null;
  startDate: string;             // ISO date string (YYYY-MM-DD)
}
```

### Key Data Patterns

- **Dates:** Always `YYYY-MM-DD` ISO strings (not Date objects)
- **Day of week:** Monday = 0, Sunday = 6 (converted from JS getDay where Sun=0)
- **Weekly schedules:** `boolean[7]` array where index 0=Monday, 6=Sunday
- **Protocol IDs:** Format `{category}-{number}` (e.g., `sleep-001`, `exercise-003`, `diet-007`)
- **Program IDs:** Slug format (`metabolic-reset`, `body-recomp`)
- **Onboarding check:** `routine.profile.goal !== ""` means onboarded

---

## Page Details

### Landing Page (`/`)
- Marketing page shown to unauthenticated users
- Sections: Hero (gradient text), Features (4 cards), How It Works (3 steps), Pricing (Free vs $7/mo), Footer (medical disclaimer)
- Detects onboarding status: shows "Get Started" or "Open App"

### Onboarding (`/onboarding`)
- Step 0: Name input
- Steps 1-7: Quiz questions (goal, experience, sleep, energy, metabolic signs, diet, time)
- Result screen: Shows recommended program (Metabolic Reset or Body Recomp)
- Progress bar: `(step + 1) / 9 * 100`, 100% on result

### Dashboard (`/dashboard`)
- Redirects to `/onboarding` if not completed
- Shows: greeting with date, 4 stat cards (streak, active protocols, done today, workouts this week)
- Active program card or recommended program
- Quick actions: Daily Check-in, Log Workout, Meal Ideas
- Recent protocols preview (first 5)
- Skeleton loading state during hydration

### Protocols (`/protocols`)
- Category tabs: All, Sleep, Exercise, Diet, Supplements
- Dropdown filters: Difficulty, Source (Attia/Huberman)
- Protocol cards with add/remove toggle
- Premium protocols show "Unlock with Premium" button instead of add
- Toast notification for premium clicks

### Programs (`/programs`)
- Cards for each program with phase breakdown
- Start Program / Currently Active buttons
- Details link to `/programs/[id]`

### Program Detail (`/programs/[id]`)
- Phase accordion with daily plans
- Workout templates (exercises, sets, reps, intensity, rest)
- Nutrition guidelines per day

### Meals (`/meals`)
- Type filter tabs: All, Breakfast, Lunch, Dinner, Snack, Dessert
- Meal cards with ingredients, macro bars (protein=blue, carbs=orange, fat=red)
- Premium meals show blurred content with lock overlay

### Workout (`/workout`)
- Start/Finish workout with elapsed timer
- Add exercises, manage sets (weight, reps, type)
- Set types: warmup, working, cooldown
- Workout history with volume calculations

### Tracker (`/tracker`)
- Date navigation (can go back, not forward past today)
- SVG circular progress ring (% of scheduled protocols completed)
- Mood (emoji selector), Energy (lightning bolts), Sleep (hour stepper)
- Protocol checklist with completion toggle
- Only shows protocols scheduled for that day of week

### Progress (`/progress`)
- Stats row: streak, active count, avg mood, avg energy, avg sleep
- 7-day bar chart (completion %, color-coded: green=100%, blue>50%, orange>0%, gray=0)
- 30-day heatmap (GitHub contribution style)
- Per-protocol adherence bars (30-day lookback, green>=80%, orange>=50%, red<50%)

---

## Navigation

### Desktop
- Sticky glass header with all 7 nav items inline
- Active state: `bg-[#1d1d1f] text-white` pill

### Mobile
- **Header:** Logo + hamburger menu (contains Meals, Workout)
- **Bottom nav (5 items):** Dashboard, Programs, Protocols, Tracker, Progress
- Active state: blue text + blue icon
- `aria-current="page"` on active items

---

## Current Limitations (Phase 1 — localStorage only)

- No user accounts or authentication
- Data stored in browser only (lost if cache cleared)
- No real premium enforcement (UI gates only, no backend check)
- No Stripe payments integrated
- Programs can't be switched without manual reset
- No data export or cloud sync
- Two programs only (Metabolic Reset + Body Recomp)

---

## Planned Phases

- **Phase 2:** Supabase (Postgres + magic link auth) — migrate from localStorage to cloud
- **Phase 3:** Stripe subscription payments ($7/mo premium tier)
- **Phase 4:** Legal (Terms of Service, Privacy Policy, health disclaimer)
- **Phase 5:** Custom domain (protocolize.com) on Vercel, SEO, analytics, launch
