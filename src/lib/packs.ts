/**
 * packs.ts — official Protocol Packs.
 *
 * Packs are modular systems. Behaviors share a `canonicalKey` so the
 * timeline compiler can intelligently MERGE overlapping behaviors across
 * installed packs instead of duplicating them.
 */
import type { BehaviorDef, ProtocolPack } from "./types";
import { activePacks } from "./knowledge";

const B = (b: BehaviorDef): BehaviorDef => b;

// ── Shared behavior atoms (reused across packs by canonicalKey) ────

const MORNING_SUNLIGHT = B({
  canonicalKey: "morning-sunlight",
  timingReason:
    "Placed within ~30 min of waking — that's when light most powerfully sets your circadian clock.",
  title: "Morning sunlight",
  block: "morning",
  anchor: "wake",
  offsetMin: 20,
  dose: "10–30 min, no sunglasses",
  rationale:
    "Anchors your circadian clock — the strongest lever for sleep, mood, and energy.",
  evidence:
    "Early outdoor light advances the cortisol peak and times melatonin onset ~16h later. Overcast daylight is still 10–50× brighter than indoor light.",
  recommendedBy: ["Clinical research"],
  icon: "sun",
  leverage: 3,
  kind: "action",
});

const HYDRATE_AM = B({
  canonicalKey: "hydrate-am",
  timingReason:
    "First thing on waking — it replaces overnight fluid loss before caffeine or food.",
  title: "Hydrate on waking",
  block: "morning",
  anchor: "wake",
  offsetMin: 5,
  dose: "500 ml + pinch of salt",
  rationale: "Rehydrates after the overnight fast and steadies morning energy.",
  icon: "droplet",
  leverage: 2,
  kind: "action",
});

const PROTEIN_BREAKFAST = B({
  canonicalKey: "protein-breakfast",
  timingReason:
    "At the first meal — a protein-led start flattens the day's first glucose curve and sets satiety.",
  title: "Protein-forward first meal",
  block: "morning",
  anchor: "wake",
  offsetMin: 90,
  dose: "30–50 g protein",
  rationale:
    "Blunts the glucose curve, drives muscle protein synthesis, and stabilizes appetite all day.",
  recommendedBy: ["Longevity research"],
  icon: "protein",
  leverage: 3,
  kind: "action",
});

const MAGNESIUM_PM = B({
  canonicalKey: "magnesium-pm",
  timingReason:
    "~45 min before bed so it's already working as you fall asleep.",
  title: "Magnesium",
  block: "evening",
  anchor: "bed",
  offsetMin: -45,
  dose: "200–400 mg glycinate / threonate",
  rationale: "Supports parasympathetic tone and sleep depth.",
  evidence:
    "Glycinate and L-threonate forms cross the blood–brain barrier; associated with improved subjective sleep quality.",
  recommendedBy: ["Clinical research"],
  icon: "pill",
  leverage: 2,
  kind: "action",
});

const WIND_DOWN = B({
  canonicalKey: "wind-down",
  // Sequenced relative to the other pre-bed essentials:
  //   bed -90: cool-room (the room takes time to cool)
  //   bed -60: screens-off (start of low-light period)
  //   bed -45: magnesium-pm (passive — take the pill)
  //   bed -30: wind-down (the active calming ritual)
  // Avoids the old bed-45 pile-up where 3 essentials rendered at the
  // same exact clock-time.
  timingReason:
    "The last ~30 min before bed — that's the window where lowering arousal most improves sleep onset.",
  title: "Wind-down ritual",
  block: "evening",
  anchor: "bed",
  offsetMin: -30,
  dose: "Dim lights, no screens, slow breathing",
  rationale:
    "Lowers core temperature and arousal so sleep onset is fast and deep.",
  recommendedBy: ["Sleep research"],
  icon: "wind",
  leverage: 3,
  kind: "action",
});

const LAST_MEAL_3H = B({
  canonicalKey: "last-meal-3h",
  timingReason:
    "~3h before bed — closing the kitchen this early protects deep sleep and overnight repair.",
  title: "Finish eating 3h before bed",
  block: "evening",
  anchor: "bed",
  offsetMin: -180,
  rationale:
    "Late meals raise core temperature and fragment deep sleep and overnight glucose control.",
  icon: "clock",
  leverage: 2,
  kind: "avoid",
});

const CAFFEINE_CUTOFF = B({
  canonicalKey: "caffeine-cutoff",
  timingReason:
    "~10h before bed — caffeine's long half-life keeps eroding deep sleep well into the night.",
  title: "Caffeine cutoff",
  block: "afternoon",
  anchor: "bed",
  offsetMin: -600,
  dose: "None within ~10h of bed",
  rationale:
    "Caffeine's long half-life erodes deep sleep even when you fall asleep fine.",
  recommendedBy: ["Clinical research"],
  icon: "coffee",
  leverage: 2,
  kind: "avoid",
});

const OMEGA3_AM = B({
  canonicalKey: "omega-3",
  // Flexible by design — "with any fat-containing meal" isn't time-
  // locked. Set to anytime so a user on IF (first meal at noon) or an
  // evening-eater isn't warned when they drop it where their actual
  // meals are.
  timingReason:
    "With any fat-containing meal — dietary fat markedly improves absorption. Time of day doesn't matter.",
  title: "Omega-3 (EPA/DHA)",
  block: "anytime",
  anchor: "wake",
  offsetMin: 90,
  dose: "2 g combined EPA/DHA",
  rationale:
    "Lowers systemic inflammation; supports cardiovascular and brain health.",
  recommendedBy: ["Clinical research"],
  icon: "fish",
  leverage: 2,
  kind: "action",
  // Higher doses (2-4 g/d EPA+DHA) can prolong bleeding time. The
  // engine's safetyFlag pipeline (compileTimeline `hasFlag`, plus
  // supplementsForBlock `contraindications`) reads this field to
  // quietly suppress the atom for users on warfarin/DOAC/aspirin.
  // Was missing — surfaced by the cautious-starter persona test.
  contraindications: ["anticoagulants"],
});

// Shared atoms for behaviors that appear in multiple packs — defined
// ONCE here so the canonicalKey contract holds (same key, identical
// definition, always merges cleanly). Previously these were inline
// B({...}) in each pack, and small drifts (offsetMin, daysActive,
// recommendedBy) made first-install-wins state subtly inconsistent.

const DELAY_CAFFEINE = B({
  canonicalKey: "delay-caffeine",
  timingReason:
    "~90 min after waking — lets adenosine clear first and blunts the afternoon crash.",
  title: "Delay caffeine 90 min",
  block: "morning",
  anchor: "wake",
  offsetMin: 90,
  rationale:
    "Delaying caffeine after waking avoids the afternoon adenosine crash.",
  recommendedBy: ["Neuroscience research"],
  icon: "coffee",
  leverage: 2,
  kind: "action",
});

const VEG_FIRST = B({
  canonicalKey: "veg-first",
  timingReason:
    "At each meal — eating fiber before carbs blunts that meal's glucose spike. Applies every time you eat.",
  title: "Vegetables first",
  block: "anytime",
  anchor: "wake",
  offsetMin: 0,
  rationale:
    "Fiber before carbs measurably blunts the post-meal glucose spike.",
  icon: "leaf",
  leverage: 2,
  kind: "action",
});

const POST_MEAL_WALK = B({
  canonicalKey: "post-meal-walk",
  timingReason:
    "Within ~30 min of any meal — muscle contraction clears glucose without insulin.",
  title: "Walk after meals",
  block: "anytime",
  anchor: "wake",
  offsetMin: 0,
  dose: "10 min after eating",
  rationale: "Muscle contraction clears glucose without insulin.",
  recommendedBy: ["Longevity research"],
  icon: "footprints",
  leverage: 3,
  kind: "action",
});

const NSDR = B({
  canonicalKey: "nsdr",
  timingReason:
    "Early afternoon — catches the post-lunch dip and resets you without harming night sleep.",
  title: "NSDR / yoga nidra",
  block: "afternoon",
  anchor: "wake",
  offsetMin: 420,
  dose: "10–20 min",
  rationale:
    "Non-sleep deep rest restores dopamine and lowers sympathetic load.",
  recommendedBy: ["Neuroscience research"],
  icon: "lungs",
  leverage: 3,
  kind: "action",
  // Default: every day. Weekly Recovery Day pack does NOT scope this
  // to Sunday-only; if a future pack needs Sunday-only NSDR, give it a
  // separate canonicalKey so it doesn't override the daily default.
});

const SOCIAL_CONNECTION = B({
  canonicalKey: "social-connection",
  timingReason:
    "Evening tends to be the natural slot — even brief connection (call, in-person) downregulates stress.",
  title: "One real human connection",
  block: "evening",
  anchor: "wake",
  offsetMin: 600,
  dose: "10+ min, ideally in person",
  rationale:
    "Social connection is one of the strongest predictors of long-term resilience and health.",
  icon: "user",
  leverage: 2,
  kind: "action",
});

const SCREENS_OFF = B({
  canonicalKey: "screens-off",
  timingReason:
    "~1h before bed — removes the most alerting light source so the wind-down can actually land.",
  title: "Screens off",
  block: "evening",
  anchor: "bed",
  offsetMin: -60,
  rationale: "Reduces alerting blue light and cognitive arousal pre-sleep.",
  icon: "screen",
  leverage: 2,
  kind: "avoid",
});

const DIM_LIGHTS = B({
  canonicalKey: "dim-lights",
  timingReason:
    "~2h before bed — bright evening light is what most delays melatonin.",
  title: "Dim the lights",
  block: "evening",
  anchor: "bed",
  offsetMin: -120,
  dose: "Warm, low light only",
  rationale: "Evening bright light suppresses melatonin and delays sleep.",
  recommendedBy: ["Neuroscience research"],
  icon: "moon",
  leverage: 2,
  kind: "action",
});

const EXTRA_SLEEP = B({
  canonicalKey: "extra-sleep",
  // Bed-15 (was -30, colliding with wind-down) — "protect 8.5h" is
  // really a go-to-bed reminder, closer to actual bedtime. Daily in
  // both Burnout Recovery and Weekly Recovery (the daysActive merge
  // bug previously collapsed cross-pack day arrays to "every day"
  // anyway; making it explicit avoids the inconsistency).
  timingReason:
    "Set close to bed — protecting the sleep opportunity is the recovery itself.",
  title: "Protect 8.5h sleep opportunity",
  block: "evening",
  anchor: "bed",
  offsetMin: -15,
  rationale: "Recovery is built in bed before it's built in the gym.",
  icon: "bed",
  leverage: 3,
  kind: "action",
});

// ── Jetlag-recovery atoms (used by the Jetlag pack and reusable
// elsewhere when travel/circadian-shift protocols evolve) ──────────

// NEW_TZ_SUNLIGHT removed — was a near-duplicate of MORNING_SUNLIGHT.
// For a jetlagged user, "destination morning" IS their morning; the
// circadian-anchor framing applies either way. Jetlag Recovery now
// uses the shared MORNING_SUNLIGHT atom so installing it alongside
// Longevity Foundation merges into one row instead of rendering two
// near-identical morning-light cards.

const STRATEGIC_MELATONIN = B({
  canonicalKey: "strategic-melatonin",
  // Bed-50 (was -45) to step it off magnesium-pm's clock-time and stay
  // visually distinct in the pre-bed sequence; the 30–60 min window is
  // still respected.
  timingReason:
    "30–60 min before the NEW timezone's bedtime — its sleep-timing effect depends on being taken near intended sleep.",
  title: "Strategic melatonin",
  block: "evening",
  anchor: "bed",
  offsetMin: -50,
  dose: "0.3–0.5 mg (low dose)",
  rationale:
    "A small dose helps shift sleep timing; large doses don't help more and disrupt next-morning alertness.",
  evidence:
    "Low-dose melatonin (0.3 mg) effectively phase-shifts circadian rhythms during jetlag without sedation hangover.",
  recommendedBy: ["Sleep research"],
  icon: "moon",
  leverage: 3,
  kind: "action",
});

const ANCHOR_MEAL = B({
  canonicalKey: "anchor-meal",
  timingReason:
    "Eating at the NEW timezone's breakfast hour anchors your peripheral clocks (liver, gut) — the second-strongest zeitgeber after light.",
  title: "Eat at destination breakfast",
  block: "morning",
  anchor: "wake",
  offsetMin: 90,
  dose: "Protein-forward, daylight",
  rationale:
    "Food is a powerful zeitgeber for peripheral clocks; sync them to destination time, not departure time.",
  recommendedBy: ["Longevity research"],
  icon: "utensils",
  leverage: 2,
  kind: "action",
});

const TRAVEL_HYDRATE = B({
  canonicalKey: "travel-hydrate",
  timingReason:
    "Spread across the first 24h post-arrival — cabin air severely dehydrates, and dehydration mimics and worsens jetlag.",
  title: "Aggressive hydration",
  block: "anytime",
  anchor: "wake",
  offsetMin: 0,
  dose: "~3 L water + electrolytes",
  rationale:
    "Cabin air is ~10% humidity; dehydration amplifies fatigue, headaches, and brain fog.",
  icon: "droplet",
  leverage: 2,
  kind: "action",
});

const NO_ARRIVAL_ALCOHOL = B({
  canonicalKey: "no-arrival-alcohol",
  timingReason:
    "First 48h on the new timezone — alcohol fragments sleep and prolongs circadian misalignment.",
  title: "No alcohol on flight + first night",
  block: "anytime",
  anchor: "wake",
  offsetMin: 0,
  rationale:
    "Alcohol blocks REM, dehydrates further, and delays circadian realignment.",
  recommendedBy: ["Sleep research"],
  icon: "wine",
  leverage: 2,
  kind: "avoid",
});

const ARRIVAL_WALK = B({
  canonicalKey: "arrival-walk",
  timingReason:
    "Within hours of arrival in the daylight — combines light, movement, and grounding to push the body into the local time zone fast.",
  title: "Outdoor walk on arrival",
  block: "afternoon",
  anchor: "wake",
  offsetMin: 240,
  dose: "20–40 min in daylight",
  rationale:
    "Light + movement together drive faster phase shift than either alone.",
  icon: "footprints",
  leverage: 2,
  kind: "action",
});

// ── Packs ─────────────────────────────────────────────────────────

export const PACKS: ProtocolPack[] = [
  {
    id: "longevity-foundation",
    name: "Longevity Foundation",
    tagline: "Build a durable base for long-term health and energy.",
    goal: "longevity",
    accent: "var(--readiness)",
    icon: "pulse",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      HYDRATE_AM,
      MORNING_SUNLIGHT,
      PROTEIN_BREAKFAST,
      OMEGA3_AM,
      B({
        canonicalKey: "zone2",
        timingReason:
          "Mid-day fits sustained aerobic work without competing with strength or sleep.",
        title: "Zone 2 movement",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 300,
        dose: "20–45 min easy aerobic",
        rationale:
          "Builds mitochondrial density and aerobic base — a top predictor of lifespan.",
        recommendedBy: ["Longevity research"],
        icon: "footprints",
        leverage: 3,
        kind: "action",
        category: "workout",
        intensity: "moderate",
      }),
      B({
        canonicalKey: "strength",
        timingReason:
          "Afternoon — body temperature and force output peak, which lowers injury risk.",
        title: "Strength training",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "3×/week, compound lifts",
        rationale:
          "Muscle and strength are *associated with* lower risk across nearly every cause of late-life decline. Causal direction is debated; both directions probably hold.",
        recommendedBy: ["Longevity research"],
        icon: "dumbbell",
        leverage: 3,
        kind: "action",
        category: "workout",
        intensity: "high",
        daysActive: [true, false, true, false, true, false, false],
      }),
      B({
        canonicalKey: "fiber-veg",
        // "Across the day" is genuinely time-flexible — surfacing a
        // cross-block warning when the user moves this to morning or
        // anytime would be misleading. Block: anytime keeps it warning-
        // free; timingReason still recommends spreading.
        timingReason:
          "Spread across daytime meals — pace beats one big serving for both microbiome and glucose stability.",
        title: "Fiber & plants",
        block: "anytime",
        anchor: "wake",
        offsetMin: 330,
        dose: "30+ g fiber across the day",
        rationale: "Feeds the microbiome and steadies glucose.",
        icon: "leaf",
        leverage: 2,
        kind: "action",
      }),
      LAST_MEAL_3H,
      WIND_DOWN,
    ],
  },
  {
    id: "better-sleep",
    name: "Better Sleep",
    tagline: "Protect deep recovery and circadian stability.",
    goal: "sleep",
    accent: "var(--sleep)",
    icon: "moon",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      MORNING_SUNLIGHT,
      CAFFEINE_CUTOFF,
      DIM_LIGHTS,
      SCREENS_OFF,
      B({
        canonicalKey: "cool-room",
        // Bed -90: a real room takes time to cool. Earliest of the
        // pre-bed sequence so by the time the user is lying down the
        // air temp has actually dropped. (Was bed-30, which collided
        // with wind-down.)
        timingReason:
          "~90 min before bed — the room needs time to cool, and the temperature drop is what triggers sleep onset.",
        title: "Cool the bedroom",
        block: "evening",
        anchor: "bed",
        offsetMin: -90,
        dose: "~18°C / 65°F",
        rationale: "A cool room enables the core-temp drop that triggers sleep.",
        recommendedBy: ["Sleep research"],
        icon: "thermometer",
        leverage: 2,
        kind: "action",
      }),
      MAGNESIUM_PM,
      WIND_DOWN,
    ],
  },
  {
    id: "daily-essentials",
    name: "Daily Essentials",
    tagline: "Close common nutrient gaps with an evidence-based core.",
    goal: "supplements",
    accent: "var(--warm)",
    icon: "pill",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      B({
        canonicalKey: "vitamin-d3",
        timingReason:
          "With a morning fat-containing meal — fat aids absorption. If you take warfarin, the K2 component is contraindicated — switch to D3-only.",
        title: "Vitamin D3 + K2",
        block: "morning",
        anchor: "wake",
        offsetMin: 90,
        dose: "2,000–5,000 IU D3 + K2",
        rationale:
          "Corrects widespread insufficiency; K2 directs calcium to bone, not arteries. K2 directly antagonizes warfarin — anyone on warfarin should take D3 alone, not D3+K2.",
        recommendedBy: ["Clinical research"],
        icon: "sun",
        leverage: 2,
        kind: "action",
      }),
      OMEGA3_AM,
      B({
        canonicalKey: "creatine",
        timingReason:
          "Anytime — for creatine, daily consistency matters far more than the clock.",
        title: "Creatine monohydrate",
        block: "anytime",
        anchor: "wake",
        offsetMin: 120,
        dose: "5 g daily",
        rationale:
          "The most evidence-backed supplement — strength, power, and cognition.",
        recommendedBy: ["Clinical research"],
        icon: "flask",
        leverage: 2,
        kind: "action",
      }),
      MAGNESIUM_PM,
    ],
  },
  {
    id: "deep-focus",
    name: "Deep Focus",
    tagline: "Protect attention and sustain clear, focused work.",
    goal: "focus",
    accent: "var(--readiness)",
    icon: "sparkle",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      MORNING_SUNLIGHT,
      DELAY_CAFFEINE,
      B({
        canonicalKey: "deep-work",
        timingReason:
          "Late morning — peak alertness for your hardest cognitive block.",
        title: "One deep-work block",
        block: "morning",
        anchor: "wake",
        offsetMin: 150,
        dose: "60–90 min, no inputs",
        rationale:
          "A single protected block beats a fragmented day for meaningful output.",
        icon: "sparkle",
        leverage: 3,
        kind: "action",
      }),
      B({
        canonicalKey: "walk-break",
        timingReason:
          "Mid-afternoon — restores attention right as focus naturally dips.",
        title: "Mid-day walk break",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "10–15 min outside",
        rationale: "Restores directed attention and diffuses stress.",
        icon: "footprints",
        leverage: 2,
        kind: "action",
      }),
      CAFFEINE_CUTOFF,
    ],
  },
  {
    id: "burnout-recovery",
    name: "Burnout Recovery",
    tagline: "Rebuild sustainable recovery capacity, gently.",
    goal: "recovery",
    accent: "var(--recovery)",
    icon: "lungs",
    source: "official",
    durationLabel: "4–6 weeks",
    behaviors: [
      MORNING_SUNLIGHT,
      NSDR,
      B({
        canonicalKey: "no-intense",
        timingReason:
          "Applies all day — on a depleted system, intensity deepens the hole.",
        title: "No intense training",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Hard training on a depleted system deepens the hole. Walk and mobilize instead.",
        icon: "ban",
        leverage: 3,
        kind: "avoid",
      }),
      EXTRA_SLEEP,
      MAGNESIUM_PM,
      WIND_DOWN,
    ],
  },
  {
    id: "blood-sugar",
    name: "Blood Sugar Optimization",
    tagline: "Support steady energy and lower metabolic risk.",
    goal: "metabolic",
    accent: "var(--vitality)",
    icon: "leaf",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      PROTEIN_BREAKFAST,
      VEG_FIRST,
      POST_MEAL_WALK,
      B({
        canonicalKey: "no-liquid-sugar",
        timingReason:
          "Any time — liquid sugar spikes fastest with the least satiety.",
        title: "No liquid sugar",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Sugary drinks are the fastest route to a glucose spike with no satiety.",
        icon: "ban",
        leverage: 2,
        kind: "avoid",
      }),
      LAST_MEAL_3H,
    ],
  },
  {
    id: "jetlag-recovery",
    name: "Jetlag Recovery",
    tagline:
      "Reset to a new timezone in days, not a week — with light, food, and timing.",
    goal: "recovery",
    accent: "var(--sleep)",
    icon: "compass",
    source: "official",
    durationLabel: "4–7 days",
    behaviors: [
      // Use the canonical MORNING_SUNLIGHT atom. For a jetlagged user,
      // destination morning IS their morning — the circadian-anchor
      // framing applies either way, and merging eliminates a duplicate
      // card when stacked with Longevity Foundation or Better Sleep.
      MORNING_SUNLIGHT,
      ANCHOR_MEAL,
      TRAVEL_HYDRATE,
      ARRIVAL_WALK,
      // Use the canonical DELAY_CAFFEINE atom. Same intent, same offset,
      // same advice — the timezone framing was carried in a duplicate
      // canonicalKey that defeated the merge contract.
      DELAY_CAFFEINE,
      NO_ARRIVAL_ALCOHOL,
      STRATEGIC_MELATONIN,
      WIND_DOWN,
    ],
  },
  {
    id: "fasted-mornings",
    name: "Fasted Mornings",
    tagline:
      "A clean morning fast, well-timed eating window, and steady energy.",
    goal: "metabolic",
    accent: "var(--vitality)",
    icon: "flame",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      HYDRATE_AM,
      MORNING_SUNLIGHT,
      B({
        canonicalKey: "delay-first-meal",
        // Time-restricted eating is *not* appropriate for everyone.
        // Contraindicated during pregnancy/breastfeeding, in under-18s
        // (growth), and for anyone with an eating-disorder history —
        // calorie-restriction structures are a known relapse trigger.
        timingReason:
          "Push the first calorie ~14–16h after dinner. Not recommended during pregnancy/breastfeeding, in adolescents, or with an eating-disorder history.",
        title: "Delay first meal to ~11am–1pm",
        block: "morning",
        anchor: "wake",
        offsetMin: 240,
        dose: "Black coffee / tea / water only",
        rationale:
          "Long overnight fasts are associated with better insulin sensitivity and metabolic flexibility in some studies. Causal claims about autophagy in humans remain less certain than the supplement industry suggests. Don't do this if you have an eating-disorder history.",
        recommendedBy: ["Longevity research"],
        icon: "clock",
        leverage: 3,
        kind: "action",
        evidenceTier: "emerging",
        contraindications: [
          "pregnant",
          "breastfeeding",
          "under-18",
          "eating-disorder-history",
          "diabetes-meds",
        ],
      }),
      B({
        canonicalKey: "break-fast-protein",
        timingReason:
          "When breaking the fast — a protein-led first meal protects muscle and blunts the rebound glucose spike.",
        title: "Break the fast with protein",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 270,
        dose: "30–50 g protein, fiber, fat",
        rationale:
          "Protein-led refeeding preserves muscle and stabilizes the post-fast glucose response.",
        recommendedBy: ["Longevity research"],
        icon: "protein",
        leverage: 3,
        kind: "action",
      }),
      // Merge with `last-meal-3h` (Longevity Foundation) since they're
      // structurally identical — both = "stop eating ~3h before bed".
      // Same canonical key MERGES the two rows when both packs are
      // installed (was rendering as two evening cards saying the same
      // thing under different titles).
      LAST_MEAL_3H,
      WIND_DOWN,
    ],
  },
  {
    id: "cold-heat-therapy",
    name: "Cold & Heat Therapy",
    tagline:
      "Stack cold and sauna for cardiovascular and mental resilience.",
    goal: "recovery",
    accent: "var(--recovery)",
    icon: "snowflake",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      B({
        canonicalKey: "cold-plunge-am",
        timingReason:
          "Morning — cold delivers a sustained dopamine and noradrenaline lift. Avoid with cardiac arrhythmia, pregnancy, or Raynaud's; the cold pressor response is real.",
        title: "Cold plunge or cold shower",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        dose: "1–3 min, ~10–15°C",
        rationale:
          "Cold exposure raises norepinephrine and dopamine for hours; observational data suggests stress-resilience benefits. Acute hemodynamic stress is significant — not appropriate with cardiac arrhythmia, severe hypertension, pregnancy, or Raynaud's.",
        evidence:
          "Cold exposure (~14°C, 1 min) elevates norepinephrine ~5× in small studies; effect lasts hours.",
        recommendedBy: ["Neuroscience research"],
        icon: "snowflake",
        leverage: 2,
        kind: "action",
        evidenceTier: "emerging",
        contraindications: [
          "cardiac-arrhythmia",
          "pregnant",
          "under-18",
        ],
      }),
      B({
        canonicalKey: "no-cold-post-lift",
        timingReason:
          "Within ~6h after strength training — cold immediately after lifting blunts the muscle-growth adaptation you just trained for.",
        title: "No cold within 6h post-lift",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Cold post-resistance training reduces hypertrophy signaling; separate them.",
        recommendedBy: ["Neuroscience research"],
        icon: "ban",
        leverage: 2,
        kind: "avoid",
        // Visual link target — the Today timeline renders a small "→
        // Strength training" affordance under this card so the user
        // sees the relationship without an engine deciding.
        targets: ["strength"],
      }),
      B({
        canonicalKey: "sauna-pm",
        // Moved to bed-210 (was -180) so sauna doesn't render at the
        // same clock-time as last-meal-3h (bed-180). The "finish 1-2h
        // before bed" guidance is preserved — a 25-min session starting
        // bed-210 ends ~bed-185, comfortably within the window.
        timingReason:
          "Evening — heat shock lowers cortisol, raises HRV, and supports sleep when finished ~1–2h before bed.",
        title: "Sauna session",
        block: "evening",
        anchor: "bed",
        offsetMin: -210,
        dose: "15–25 min, 80–90°C, 2–4×/wk",
        rationale:
          "Regular sauna is *associated with* lower cardiovascular and all-cause mortality in observational cohorts — that's a correlation, not a proven cause. The mechanistic case (heat shock, HRV) is plausible.",
        evidence:
          "Finnish cohort studies report meaningful mortality differences in high-frequency sauna users — observational, so confounders (income, leisure time, baseline health) explain some of the signal.",
        recommendedBy: ["Observational research"],
        icon: "thermometer",
        leverage: 3,
        kind: "action",
        evidenceTier: "emerging",
        // Contraindicated for cardiac arrhythmia (orthostatic + thermal
        // stress raises risk), pregnancy (hyperthermia caution),
        // anticoagulants (bleeding + dehydration interaction). The
        // engine quietly suppresses this atom when any flag is set.
        contraindications: [
          "cardiac-arrhythmia",
          "pregnant",
          "under-18",
        ],
        daysActive: [true, false, true, false, true, true, false],
      }),
      B({
        canonicalKey: "post-sauna-hydrate",
        // Moved to bed-165 (was -150) to stay just-after-sauna while
        // not colliding with evening-walk's new bed-135 slot in
        // Evening Shutdown.
        timingReason:
          "Right after sauna — heavy fluid and electrolyte replacement protects against orthostatic dips and cramping.",
        title: "Replenish electrolytes after sauna",
        block: "evening",
        anchor: "bed",
        offsetMin: -165,
        dose: "500 ml + sodium/potassium",
        rationale:
          "Sauna sweat loss is mostly water + sodium; replace both.",
        icon: "droplet",
        leverage: 1,
        kind: "action",
      }),
    ],
  },
  {
    id: "stress-resilience",
    name: "Stress Resilience",
    tagline:
      "Lower baseline arousal so daily stress doesn't cumulate into depletion.",
    goal: "recovery",
    accent: "var(--recovery)",
    icon: "lungs",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      MORNING_SUNLIGHT,
      B({
        canonicalKey: "cyclic-sighing",
        timingReason:
          "Mid-morning OR pre-bed — both windows reliably drop sympathetic load within minutes.",
        title: "Cyclic sighing",
        block: "morning",
        anchor: "wake",
        offsetMin: 150,
        dose: "5 min · double inhale, long exhale",
        rationale:
          "The fastest-acting voluntary tool to drop heart rate and stress in the moment.",
        evidence:
          "Stanford-led RCT (2023): 5 min/day cyclic sighing reduced anxiety and improved mood more than equivalent mindfulness.",
        recommendedBy: ["Neuroscience research"],
        icon: "wind",
        leverage: 3,
        kind: "action",
      }),
      B({
        canonicalKey: "nature-time",
        timingReason:
          "Afternoon — restores attention and lowers cortisol fastest in daylight.",
        title: "Outdoor time without phone",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "20+ min, no screens",
        rationale:
          "Even brief outdoor time reduces rumination and cortisol; phone-free amplifies the effect.",
        icon: "leaf",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "caffeine-cap-dose",
        // Different concept from `delay-caffeine` (Deep Focus, +90) —
        // that's about WHEN to take caffeine, this is HOW MUCH. Live
        // alongside but at a different offset so the two don't render
        // at the same exact clock-time when both packs are installed.
        timingReason:
          "Cap dose, not just timing — high caffeine on a stressed system pushes cortisol higher and worsens sleep.",
        title: "Cap caffeine at 1–2 cups",
        block: "morning",
        anchor: "wake",
        offsetMin: 120,
        rationale:
          "On an already-stressed system, caffeine amplifies cortisol and erodes recovery.",
        icon: "coffee",
        leverage: 2,
        kind: "action",
      }),
      SOCIAL_CONNECTION,
      WIND_DOWN,
      MAGNESIUM_PM,
    ],
  },
  {
    id: "heart-health",
    name: "Heart Health",
    tagline:
      "A research-backed cardiovascular protocol — zone 2, strength, lipids, sleep.",
    goal: "longevity",
    accent: "var(--alert)",
    icon: "pulse",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      // Use the canonical `zone2` key so installing Heart Health
      // alongside Longevity Foundation MERGES the two zone2 rows
      // instead of rendering duplicates. Heart Health prescribes the
      // 3×/wk cadence; the merge keeps whichever schedule is added
      // first (acceptable for v1; a future merge that unions days
      // across packs would be more correct).
      B({
        canonicalKey: "zone2",
        timingReason:
          "Mid-day — fits sustained aerobic work without competing with strength or sleep, and avoids late-evening sympathetic load.",
        title: "Zone 2, 3×/week",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 300,
        dose: "45 min nasal-breathing pace",
        rationale:
          "Builds mitochondrial density and lactate clearance — a top cardiovascular lever in longevity research.",
        evidence:
          "Aerobic fitness (VO2 max) is one of the strongest predictors of all-cause mortality across cohorts.",
        recommendedBy: ["Longevity research"],
        icon: "footprints",
        leverage: 3,
        kind: "action",
        category: "workout",
        intensity: "moderate",
        daysActive: [true, false, true, false, true, false, false],
      }),
      B({
        canonicalKey: "vo2max-intervals",
        timingReason:
          "Once weekly — high-intensity intervals demand full recovery between, so cap frequency to protect the rest.",
        title: "VO2 max intervals",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "4×4 min at 90% HRmax",
        rationale:
          "Brief high-intensity work raises VO2 max — strongest known fitness predictor of late-life function.",
        recommendedBy: ["Longevity research"],
        icon: "pulse",
        leverage: 3,
        kind: "action",
        category: "workout",
        intensity: "high",
        daysActive: [false, false, false, false, false, true, false],
      }),
      // Same canonical key as the Longevity Foundation strength row
      // so the two MERGE instead of rendering twice at the same offset
      // (the old `strength-heart` key defeated the merge contract).
      B({
        canonicalKey: "strength",
        timingReason:
          "Afternoon — body temperature and force output peak, lowering injury risk.",
        title: "Strength training",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "3×/week, compound lifts",
        rationale:
          "Strength training improves arterial compliance and metabolic risk markers.",
        recommendedBy: ["Longevity research"],
        icon: "dumbbell",
        leverage: 3,
        kind: "action",
        category: "workout",
        intensity: "high",
        daysActive: [false, true, false, true, false, false, true],
      }),
      OMEGA3_AM,
      B({
        canonicalKey: "bp-check",
        timingReason:
          "Same time daily — consistent measurement window is what makes the trend interpretable.",
        title: "Check blood pressure",
        block: "morning",
        anchor: "wake",
        offsetMin: 60,
        dose: "Weekly, same time",
        rationale:
          "Tracking BP at home reveals trends invisible at sporadic clinic visits.",
        recommendedBy: ["Longevity research"],
        icon: "pulse",
        leverage: 2,
        kind: "action",
        daysActive: [true, false, false, false, false, false, false],
      }),
      WIND_DOWN,
    ],
  },
  {
    id: "gut-health",
    name: "Gut Health",
    tagline:
      "Feed the microbiome, calm the gut–brain axis, eat in rhythm with circadian metabolism.",
    goal: "metabolic",
    accent: "var(--vitality)",
    icon: "leaf",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      HYDRATE_AM,
      B({
        canonicalKey: "fermented-daily",
        timingReason:
          "With any meal — what matters is daily frequency, not the clock.",
        title: "Fermented food daily",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        dose: "~1 serving · yogurt, kefir, kimchi, sauerkraut",
        rationale:
          "Increases microbial diversity, a strong predictor of metabolic and immune health.",
        icon: "leaf",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "prebiotic-fiber",
        timingReason:
          "Across the day — the microbiome thrives on consistent, varied fiber, not one big dose.",
        title: "Diverse prebiotic fiber",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        dose: "30+ g across 25+ plant types/week",
        rationale:
          "Prebiotic fiber feeds beneficial bacteria and short-chain fatty acid production.",
        icon: "leaf",
        leverage: 3,
        kind: "action",
      }),
      // No-late-eating was a near-duplicate of LAST_MEAL_3H — both
      // rendered at bed-180 in the same pack, both kind: "avoid", same
      // intent. Removed to leave only LAST_MEAL_3H so Gut Health stops
      // showing two near-identical avoid cards stacked on top of each
      // other.
      LAST_MEAL_3H,
    ],
  },
  {
    id: "longevity-supplements",
    name: "Longevity Stack",
    tagline:
      "A minimal, evidence-backed supplement stack — close common gaps, no megadoses.",
    goal: "supplements",
    accent: "var(--warm)",
    icon: "pill",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      OMEGA3_AM,
      B({
        canonicalKey: "vitamin-d3",
        timingReason:
          "With a morning fat-containing meal — fat aids absorption. If you take warfarin, the K2 component is contraindicated — switch to D3-only.",
        title: "Vitamin D3 + K2",
        block: "morning",
        anchor: "wake",
        offsetMin: 90,
        dose: "2,000–5,000 IU D3 + K2",
        rationale:
          "Corrects widespread insufficiency; K2 directs calcium to bone, not arteries. K2 directly antagonizes warfarin — anyone on warfarin should take D3 alone, not D3+K2.",
        recommendedBy: ["Clinical research"],
        icon: "sun",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "creatine",
        timingReason:
          "Anytime — for creatine, daily consistency matters far more than the clock.",
        title: "Creatine monohydrate",
        block: "anytime",
        anchor: "wake",
        offsetMin: 120,
        dose: "5 g daily",
        rationale:
          "The most evidence-backed supplement — strength, power, and cognition.",
        recommendedBy: ["Clinical research"],
        icon: "flask",
        leverage: 2,
        kind: "action",
      }),
      MAGNESIUM_PM,
    ],
  },
  {
    id: "cognitive-performance",
    name: "Cognitive Performance",
    tagline:
      "Sharpen focus, protect attention, build the conditions for deep work.",
    goal: "focus",
    accent: "var(--readiness)",
    icon: "bulb",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      MORNING_SUNLIGHT,
      HYDRATE_AM,
      B({
        canonicalKey: "deep-work",
        timingReason:
          "Late morning — peak alertness for your hardest cognitive block.",
        title: "One deep-work block",
        block: "morning",
        anchor: "wake",
        offsetMin: 150,
        dose: "60–90 min, no inputs",
        rationale:
          "A single protected block beats a fragmented day for meaningful output.",
        icon: "sparkle",
        leverage: 3,
        kind: "action",
      }),
      DELAY_CAFFEINE,
      B({
        canonicalKey: "walking-meditation",
        timingReason:
          "Between deep-work blocks — restores attention faster than passive rest.",
        title: "Walking break, no phone",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 300,
        dose: "10–15 min outdoors",
        rationale:
          "Movement + outdoor exposure restores directed attention — peer-reviewed.",
        icon: "footprints",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "notification-window",
        timingReason:
          "All day — interruption is the enemy of deep work; batch reactive input.",
        title: "Notifications batched twice/day",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        dose: "Check at 11am & 4pm",
        rationale:
          "Each notification fragment costs ~23 min of recovery time; batching protects flow.",
        icon: "screen",
        leverage: 2,
        kind: "avoid",
      }),
      CAFFEINE_CUTOFF,
    ],
  },
  {
    id: "metabolic-health",
    name: "Metabolic Health",
    tagline:
      "Improve insulin sensitivity, glucose stability, and metabolic flexibility.",
    goal: "metabolic",
    accent: "var(--vitality)",
    icon: "pulse",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      PROTEIN_BREAKFAST,
      VEG_FIRST,
      POST_MEAL_WALK,
      B({
        canonicalKey: "no-liquid-sugar",
        timingReason:
          "Any time — liquid sugar spikes fastest with the least satiety.",
        title: "No liquid sugar",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Sugary drinks are the fastest route to a glucose spike with no satiety.",
        icon: "ban",
        leverage: 2,
        kind: "avoid",
      }),
      LAST_MEAL_3H,
    ],
  },
  {
    id: "longevity-mobility",
    name: "Mobility & Joint Health",
    tagline:
      "Stay strong in the joints that matter most — hips, shoulders, spine.",
    goal: "longevity",
    accent: "var(--recovery)",
    icon: "stretch",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      B({
        canonicalKey: "daily-mobility",
        timingReason:
          "Morning — joints are stiffest after sleep; mobility opens them for the day.",
        title: "10-min mobility flow",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        dose: "10 min · hips, shoulders, spine",
        rationale:
          "Daily mobility work preserves joint range — a leading factor in healthy aging.",
        icon: "stretch",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "balance-practice",
        timingReason:
          "Anytime — balance is built through daily reps, not single sessions.",
        title: "Balance practice",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        dose: "2 min single-leg + eyes closed",
        rationale:
          "Falls account for major late-life disability; balance training is preventive.",
        icon: "balance",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "loaded-carry",
        timingReason:
          "On training days — grip strength and core stability tie to longevity directly.",
        title: "Loaded carry",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 360,
        dose: "2 × 30s farmer's carry",
        rationale:
          "Grip strength *correlates strongly* with all-cause mortality in observational studies — a marker, not necessarily a lever.",
        recommendedBy: ["Longevity research"],
        icon: "hand",
        leverage: 2,
        kind: "action",
        daysActive: [true, false, true, false, true, false, false],
      }),
    ],
  },
  {
    id: "morning-momentum",
    name: "Morning Momentum",
    tagline:
      "A research-backed wake-up sequence that compounds energy across the day.",
    goal: "energy",
    accent: "var(--warm)",
    icon: "sun",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      HYDRATE_AM,
      MORNING_SUNLIGHT,
      B({
        canonicalKey: "no-snooze",
        timingReason:
          "At wake time — snoozing fragments REM and starts the day in sleep inertia.",
        title: "No snooze button",
        block: "morning",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Snoozing pulls you back into a new sleep cycle you'll have to break out of mid-stage.",
        icon: "ban",
        leverage: 2,
        kind: "avoid",
      }),
      // 60s-cold-finish is conceptually the same as cold-plunge-am
      // (the Cold & Heat pack's primary cold behavior) — both are
      // morning cold exposure for an alertness lift. Merging by
      // canonicalKey means a user with both packs sees ONE row
      // instead of two redundant cold morning cards. Morning Momentum
      // ships the lighter dose-default; the merge wins whichever was
      // installed first.
      B({
        canonicalKey: "cold-plunge-am",
        timingReason:
          "Morning — cold delivers a clean alertness lift without a sleep cost. Start with 60s at the end of your shower; build to a real plunge.",
        title: "Cold exposure (60s+)",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        dose: "60s cold at end of shower OR 1–3 min plunge",
        rationale:
          "Brief cold raises norepinephrine and alertness for hours.",
        recommendedBy: ["Neuroscience research"],
        icon: "snowflake",
        leverage: 2,
        kind: "action",
      }),
      PROTEIN_BREAKFAST,
      DELAY_CAFFEINE,
    ],
  },
  {
    id: "evening-shutdown",
    name: "Evening Shutdown",
    tagline:
      "A calm, deliberate evening sequence that protects sleep quality.",
    goal: "sleep",
    accent: "var(--sleep)",
    icon: "moon",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      CAFFEINE_CUTOFF,
      LAST_MEAL_3H,
      // Evening walk at -150 (was -120, which collided with dim-lights
      // Full pre-bed cadence — every offset distinct so a power-user
      // installing Cold/Heat + Evening Shutdown + Better Sleep
      // simultaneously doesn't see clock-time pile-ups:
      //   bed-240 alcohol-cutoff
      //   bed-210 sauna-pm (Cold/Heat)
      //   bed-180 last-meal-3h
      //   bed-165 post-sauna-hydrate (Cold/Heat)
      //   bed-135 evening-walk
      //   bed-120 dim-lights
      //   bed-90  cool-room
      //   bed-60  screens-off
      //   bed-50  strategic-melatonin (Jetlag)
      //   bed-45  magnesium-pm
      //   bed-30  wind-down
      B({
        canonicalKey: "evening-walk",
        timingReason:
          "After the last meal — a short walk doubles as digestion + a wind-down cue.",
        title: "Evening walk",
        block: "evening",
        anchor: "bed",
        offsetMin: -135,
        dose: "15 min easy pace",
        rationale:
          "Helps digestion, lowers post-meal glucose, and signals end-of-day to the nervous system.",
        icon: "footprints",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "alcohol-cutoff",
        timingReason:
          "4h before bed — alcohol blocks REM even at small doses; close the window early so dinner can land.",
        title: "No alcohol within 4h of bed",
        block: "evening",
        anchor: "bed",
        offsetMin: -240,
        rationale:
          "Alcohol fragments sleep architecture and suppresses REM, even at modest doses.",
        recommendedBy: ["Sleep research"],
        icon: "wine",
        leverage: 2,
        kind: "avoid",
      }),
      DIM_LIGHTS,
      SCREENS_OFF,
      MAGNESIUM_PM,
      WIND_DOWN,
    ],
  },
  {
    id: "weekly-recovery",
    name: "Weekly Recovery Day",
    tagline:
      "One day per week to deload, recover, and let adaptation catch up.",
    goal: "recovery",
    accent: "var(--recovery)",
    icon: "lungs",
    source: "official",
    durationLabel: "Ongoing",
    behaviors: [
      B({
        canonicalKey: "deload-day",
        timingReason:
          "One day per week — adaptation happens during recovery, not training.",
        title: "Full deload — no intense training",
        block: "anytime",
        anchor: "wake",
        offsetMin: 0,
        rationale:
          "Recovery is when adaptation happens; ignoring it stalls progress and raises injury risk.",
        icon: "ban",
        leverage: 3,
        kind: "avoid",
        daysActive: [false, false, false, false, false, false, true],
      }),
      B({
        canonicalKey: "easy-walk",
        timingReason:
          "Mid-day on the deload — gentle movement promotes recovery without adding load.",
        title: "Easy 30-min walk",
        block: "afternoon",
        anchor: "wake",
        offsetMin: 300,
        dose: "30 min nasal breathing",
        rationale: "Gentle aerobic movement enhances recovery via blood flow.",
        icon: "footprints",
        leverage: 2,
        kind: "action",
        daysActive: [false, false, false, false, false, false, true],
      }),
      // Use the shared NSDR atom (no daysActive) so installing Weekly
      // Recovery + Burnout Recovery doesn't produce inconsistent
      // first-install-wins state. If the user wants NSDR strictly on
      // their deload day, they can disable it on other days via the
      // behavior override sheet.
      NSDR,
      // Use the shared EXTRA_SLEEP atom (daily). The earlier Sun-only
      // daysActive collapsed to "every day" anyway via the merge rule
      // when stacked with Burnout Recovery; making it daily-in-both
      // packs eliminates the merge inconsistency.
      EXTRA_SLEEP,
    ],
  },
];

/**
 * Look up a pack by id in the LIVE catalog (built-in OR latest
 * published CMS bundle), not just the frozen built-in. Without this,
 * any CMS-authored protocol is invisible to Library / Protocols /
 * Onboarding / Insights — the entire point of CMS-authoring breaks.
 *
 * ./knowledge also imports PACKS from this module; ESM resolves the
 * cycle correctly so long as packById is only called after module
 * evaluation completes (which is always — it's runtime-only).
 */
export function packById(id: string): ProtocolPack | undefined {
  return activePacks().find((p) => p.id === id);
}

export const DEFAULT_INSTALLED = ["longevity-foundation", "better-sleep"];

/**
 * Flat, de-duplicated atom library — every unique behavior across all
 * official packs. Powers the 2B custom-behavior builder: users search
 * this list first ("Magnesium", "Morning sunlight", "Cold plunge")
 * and pick an atom instead of free-typing a row that misses every
 * intelligence-layer hook.
 *
 * Returns DEEP COPIES so callers can mutate dose/time/days without
 * mutating the module-level atom (which would silently affect every
 * official pack that references it).
 */
export interface BehaviorAtom extends BehaviorDef {
  /** Origin packs (for "this is from …" hints in the picker). */
  fromOfficialPacks: string[];
}

/**
 * Standalone atoms — curated behaviors discoverable in the atom-library
 * picker but NOT part of any installable pack. Lets the library cover
 * common behaviors people add custom-style (stretching, gratitude
 * journaling, weighing in, etc.) without bloating any official pack
 * with stuff most users wouldn't want by default.
 *
 * Same intelligence-layer participation as pack-bound atoms: when a
 * user picks one of these, their custom behavior gets a derivedFrom
 * pointer so merging, conflict resolution, mastery, and adaptive
 * shaping all work normally.
 */
/**
 * Exported for the governance + admin dashboard to inspect. The atom
 * library reads STANDALONE_ATOMS internally via the same const; the
 * `_REGISTRY` alias below is what cross-module callers should use.
 */
const STANDALONE_ATOMS: BehaviorDef[] = [
  B({
    canonicalKey: "sleep-regularity",
    timingReason:
      "Anchored to bedtime — the goal is a CONSISTENT bed/wake time (even weekends); regularity matters as much as how long you sleep.",
    title: "Consistent sleep–wake time",
    block: "evening",
    anchor: "bed",
    offsetMin: 0,
    dose: "Same time ±30 min nightly",
    rationale:
      "Keeping bed and wake times steady stabilizes your circadian rhythm — one of the strongest, most-overlooked levers for sleep quality, energy, and metabolic health.",
    evidence:
      "Sleep-timing regularity independently predicts health outcomes — in large cohorts an irregular schedule tracks with worse cardiometabolic markers and higher all-cause mortality risk, beyond total sleep duration.",
    evidenceTier: "established",
    recommendedBy: ["Clinical research"],
    icon: "moon",
    leverage: 3,
    kind: "action",
  }),
  B({
    canonicalKey: "weighted-vest-walk",
    timingReason:
      "Anytime that fits — a daytime walk that doubles as light cardio plus load-bearing for bone and muscle.",
    title: "Weighted-vest walk",
    block: "anytime",
    anchor: "wake",
    offsetMin: 420,
    dose: "20–40 min, 10–20% bodyweight",
    rationale:
      "Adding load to an easy walk raises the cardio plus bone/muscle stimulus without the recovery cost of hard training — an efficient longevity add-on.",
    evidence:
      "Weighted walking (rucking) increases energy expenditure and mechanical loading versus unloaded walking; the longevity-specific mortality evidence is still emerging, so treat the bone/muscle benefit as promising rather than proven.",
    evidenceTier: "emerging",
    category: "workout",
    intensity: "moderate",
    recommendedBy: ["Longevity research"],
    icon: "dumbbell",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "gratitude-journal",
    timingReason:
      "Evening — naming what went well primes the brain for rest and shifts the next-day baseline.",
    title: "Gratitude journal",
    block: "evening",
    anchor: "bed",
    offsetMin: -60,
    dose: "3 things, 2 min",
    rationale:
      "Brief gratitude practice is one of the most-replicated positive-psychology interventions.",
    icon: "sparkle",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "weigh-in",
    timingReason:
      "Morning, post-bathroom, pre-coffee — the most consistent reading window.",
    title: "Weigh in",
    block: "morning",
    anchor: "wake",
    offsetMin: 15,
    dose: "Same time daily",
    rationale:
      "Consistent measurement reveals trends invisible at sporadic readings.",
    icon: "pulse",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "hrv-check",
    timingReason:
      "Morning before stimulation — captures the resting baseline before sympathetic activation.",
    title: "Morning HRV check",
    block: "morning",
    anchor: "wake",
    offsetMin: 10,
    dose: "2-min reading at rest",
    rationale:
      "HRV trend (not single readings) tracks autonomic recovery.",
    icon: "pulse",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "meditation",
    timingReason:
      "Morning OR pre-bed — both windows reliably drop arousal and improve focus.",
    title: "Meditation",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "10–20 min",
    rationale:
      "Regular meditation thickens prefrontal cortex and reduces stress reactivity.",
    icon: "lungs",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "breath-work",
    timingReason:
      "Anytime stressed — the fastest voluntary tool to drop heart rate.",
    title: "Box breathing",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "5 min · 4-4-4-4 cycle",
    rationale:
      "Slow, paced breathing activates the parasympathetic system within minutes.",
    icon: "wind",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "journaling",
    timingReason:
      "Morning brain-dump OR evening reflection — both improve clarity.",
    title: "Journaling (5 min)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "5 min unstructured",
    rationale:
      "Expressive writing reduces rumination and improves working memory.",
    icon: "sparkle",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "stretching",
    timingReason:
      "After waking OR pre-bed — gentle stretching at either end of the day works.",
    title: "Full-body stretch",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "10 min · major joints",
    rationale: "Daily stretching maintains range of motion across the joints.",
    icon: "stretch",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "10k-steps",
    timingReason:
      "Across the day — total step count matters more than one big walk.",
    title: "10,000 steps",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "~10k cumulative",
    rationale:
      "Total daily movement is one of the strongest health markers; aim for spread, not bursts.",
    icon: "footprints",
    leverage: 2,
    kind: "action",
  }),
  // social-connection lives in the Stress Resilience pack now — the
  // standalone copy was unreachable (listBehaviorAtoms skips a
  // standalone if the same canonicalKey exists pack-bound). Removed
  // to prevent confusion when curating evidence on either copy.
  B({
    canonicalKey: "no-phone-bedroom",
    timingReason:
      "From wind-down until wake — phone in another room protects both sleep and morning attention.",
    title: "No phone in the bedroom",
    block: "evening",
    anchor: "bed",
    offsetMin: -60,
    rationale:
      "Removes the snooze trap, late-night scrolling, and morning attention raid in one move.",
    icon: "ban",
    leverage: 2,
    kind: "avoid",
  }),
  B({
    canonicalKey: "vitamin-c",
    timingReason:
      "With breakfast — supports collagen synthesis and immune function.",
    title: "Vitamin C",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "500–1000 mg with food",
    rationale: "Antioxidant + collagen cofactor; safe and inexpensive.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "berberine",
    // Contraindication moved INTO timingReason so it surfaces on the
    // Today timeline card, not buried in the long-form rationale that
    // only opens on tap. Hypoglycemia risk + diabetes meds is the
    // single most-important real-world interaction here.
    timingReason:
      "Before carb-heavy meals — peak effect is on the next-meal glucose response. Hypoglycemia risk if you take diabetes medication — talk to your clinician first.",
    title: "Berberine",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "500 mg pre-meal",
    rationale:
      "Improves insulin sensitivity. Contraindicated with metformin / sulfonylureas / insulin without supervision — additive hypoglycemia is real.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "l-theanine",
    timingReason:
      "With caffeine — smooths the caffeine alertness curve and lowers jitter.",
    title: "L-theanine with coffee",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "100–200 mg",
    rationale:
      "Synergistic with caffeine for focused calm; especially helpful for caffeine-sensitive users.",
    icon: "flask",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "ashwagandha",
    timingReason:
      "Evening — helps lower cortisol toward sleep; AM dosing has mixed evidence.",
    title: "Ashwagandha",
    block: "evening",
    anchor: "bed",
    offsetMin: -120,
    dose: "300–600 mg",
    rationale:
      "Adaptogen with replicated cortisol-lowering effects in stressed populations.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "kegels",
    timingReason:
      "Anytime — sets of 10 spread across the day build the habit.",
    title: "Pelvic floor exercises",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "3 × 10 reps",
    rationale:
      "Often-overlooked group that contributes to core stability, continence, and sexual health.",
    icon: "balance",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "humming-vagal",
    timingReason:
      "Anytime stressed — humming stimulates the vagus nerve via vocal-cord vibration.",
    title: "Humming or chanting (vagal tone)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "5 min, low pitch",
    rationale:
      "Stimulates vagal afferents; a low-effort way to nudge the autonomic system parasympathetic.",
    icon: "lungs",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "screen-distance",
    timingReason:
      "While working — eye strain compounds across the day; 20-20-20 prevents it.",
    title: "20-20-20 eye rule",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "Every 20 min, look 20 ft away for 20 sec",
    rationale:
      "Reduces eye strain, dryness, and computer-vision-syndrome symptoms.",
    icon: "screen",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "no-news-am",
    timingReason:
      "First hour after waking — sets the day's emotional baseline; news raids it.",
    title: "No news in the first hour",
    block: "morning",
    anchor: "wake",
    offsetMin: 0,
    rationale:
      "Negative news priming raises cortisol and impairs working memory for hours after.",
    icon: "ban",
    leverage: 2,
    kind: "avoid",
  }),
  B({
    canonicalKey: "phone-airplane-night",
    timingReason:
      "From sleep to wake — eliminates 100% of overnight notifications.",
    title: "Phone on airplane mode overnight",
    block: "evening",
    anchor: "bed",
    offsetMin: -15,
    rationale:
      "Protects sleep continuity from any push notification that slips through other guards.",
    icon: "ban",
    leverage: 2,
    kind: "avoid",
  }),
  B({
    canonicalKey: "creative-output",
    timingReason:
      "Daily — small consistent creative output beats sporadic big sessions.",
    title: "30 min creative work",
    block: "afternoon",
    anchor: "wake",
    offsetMin: 480,
    dose: "30+ min · writing, music, art",
    rationale:
      "Regular creative practice correlates with lower depression risk and higher life satisfaction.",
    icon: "sparkle",
    leverage: 1,
    kind: "action",
  }),

  // ── Longevity supplements ─────────────────────────────────────────
  // Common stack across longevity communities. Doses are starting
  // points sourced from published research and clinical practice;
  // anything beyond foundational supplements should be cleared with
  // a clinician before stacking. Order roughly by how common they
  // are in long-term protocols.

  B({
    canonicalKey: "b-complex",
    timingReason:
      "Morning with food — B vitamins are energizing for most people; taking them at night can disrupt sleep.",
    title: "Methylated B-complex",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "1 capsule (methylated forms)",
    rationale:
      "Covers methylation cofactors (methyl-B12, methyl-folate, P-5-P) — especially important for MTHFR variants.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "nmn",
    timingReason:
      "Morning on empty stomach — NAD+ precursors align with the body's daytime energy demand. FDA-NDI status is unresolved; talk to a clinician if you have a personal cancer history.",
    title: "NMN (NAD+ precursor)",
    block: "morning",
    anchor: "wake",
    offsetMin: 10,
    dose: "250–500 mg",
    rationale:
      "Raises NAD+ on biomarker assays. NAD+ declines with age and is involved in mitochondrial function and DNA repair pathways — but meaningful human clinical outcomes (longevity, healthspan markers) remain unproven in RCTs.",
    icon: "flask",
    leverage: 1,
    kind: "action",
    evidenceTier: "exploratory",
    // Pregnancy + breastfeeding: no safety data. Active cancer history:
    // theoretical concern about NAD+ boosting tumor metabolism, though
    // not established. The engine quietly suppresses.
    contraindications: ["pregnant", "breastfeeding", "under-18"],
  }),
  B({
    canonicalKey: "nr",
    timingReason:
      "Morning on empty stomach — NAD+ precursors align with the body's daytime energy demand.",
    title: "NR (Nicotinamide riboside)",
    block: "morning",
    anchor: "wake",
    offsetMin: 10,
    dose: "300–500 mg",
    rationale:
      "Alternative NAD+ precursor; some prefer NR's longer human-trial track record over NMN. Published trials used 300–1000 mg.",
    icon: "flask",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "tmg",
    timingReason:
      "With NAD+ precursors — TMG donates a methyl group to balance the methylation NAD+ supplementation consumes.",
    title: "TMG (Trimethylglycine)",
    block: "morning",
    anchor: "wake",
    offsetMin: 15,
    dose: "500–1000 mg",
    rationale:
      "Replenishes methyl groups depleted by NAD+ pathway; important when stacking with NMN/NR.",
    icon: "flask",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "coq10",
    timingReason:
      "With a fat-containing meal — fat-soluble; absorption is much better with dietary fat.",
    title: "CoQ10 / Ubiquinol",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "100–200 mg",
    rationale:
      "Mitochondrial electron-transport-chain cofactor; depleted by statins and aging. Ubiquinol (reduced form) absorbs better and is preferred for users over 40 or on statins; ubiquinone is fine and cheaper for younger users.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "curcumin",
    timingReason:
      "With a fat + black pepper meal for absorption — antiplatelet activity, check with clinician if on blood thinners.",
    title: "Curcumin (with piperine)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "500–1000 mg with BioPerine",
    rationale:
      "Anti-inflammatory; consistent benefits across cardiovascular + joint-health trials. Contraindicated with warfarin / aspirin / clopidogrel — has measurable antiplatelet effect.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "resveratrol",
    timingReason:
      "With breakfast (fat-soluble) — though clinical evidence is mixed compared to other longevity compounds.",
    title: "Resveratrol",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "250–500 mg trans-resveratrol",
    rationale:
      "Polyphenol with sirtuin-activating properties in cell studies. Honest read of human RCTs: most well-controlled trials have been null on the longevity-relevant endpoints. Some users still take it for hormetic / cardiovascular reasons.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
    evidenceTier: "exploratory",
    // Aromatase activity affects estrogen sensitive cancers + drug
    // metabolism; not recommended during pregnancy or for users on
    // hormone-modulating cancer therapy. Calm suppression for the
    // flag we collect (pregnancy + active cancer is a future flag).
    contraindications: ["pregnant", "breastfeeding", "under-18"],
  }),
  B({
    canonicalKey: "quercetin",
    timingReason:
      "Morning with food — antihistamine and polyphenol benefits; works synergistically with curcumin.",
    title: "Quercetin",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "250–500 mg",
    rationale:
      "Polyphenol with antihistamine and metabolic-support evidence. Note: senolytic effects require *pulsed* dosing (specific intermittent protocols) — daily dosing here is for the antihistamine / polyphenol benefits, not senolysis.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "spermidine",
    timingReason:
      "Morning — supports autophagy (cellular self-cleaning) which compounds across the day.",
    title: "Spermidine",
    block: "morning",
    anchor: "wake",
    offsetMin: 60,
    dose: "1–3 mg supplement (or wheat germ for higher amounts)",
    rationale:
      "Linked to autophagy pathways in cell and animal studies; observational human data is suggestive but not conclusive. Food sources (wheat germ, aged cheese, mushrooms) are arguably the better starting point than supplements.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
    evidenceTier: "exploratory",
    contraindications: ["pregnant", "breastfeeding", "under-18"],
  }),
  B({
    canonicalKey: "nac",
    timingReason:
      "Morning on empty stomach — glutathione precursor. Avoid combining with nitroglycerin (rare BP-lowering effect).",
    title: "NAC (N-Acetyl Cysteine)",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "600–1200 mg",
    rationale:
      "Glutathione precursor; supports detox pathways and lung/liver health. Mild blood-pressure-lowering effect — caution if combined with nitroglycerin or other vasodilators.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "glycine",
    timingReason:
      "Pre-bed — lowers core body temperature and supports deeper sleep.",
    title: "Glycine",
    block: "evening",
    anchor: "bed",
    offsetMin: -45,
    dose: "3 g",
    rationale:
      "Lowers core body temperature, improves subjective sleep quality, supports collagen synthesis.",
    icon: "pill",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "taurine",
    timingReason:
      "With breakfast OR pre-workout — supports mitochondrial and cardiovascular function.",
    title: "Taurine",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "1–3 g",
    rationale:
      "Conditional amino acid that declines with age; supports mitochondria, heart, and brain.",
    icon: "flask",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "alpha-lipoic-acid",
    timingReason:
      "Morning on empty stomach — competes with other amino acids for absorption.",
    title: "Alpha-Lipoic Acid (ALA)",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "300–600 mg R-ALA",
    rationale:
      "Both water- and fat-soluble antioxidant; supports glucose metabolism and recycles other antioxidants.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "lions-mane",
    timingReason:
      "Morning — supports nerve growth factor (NGF) and cognition; energizing for most.",
    title: "Lion's mane",
    block: "morning",
    anchor: "wake",
    offsetMin: 60,
    dose: "500–1500 mg",
    rationale:
      "Mushroom extract with NGF-stimulating compounds; preliminary cognitive benefits.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "rhodiola",
    timingReason:
      "Morning — adaptogen for stress; energizing, can disrupt sleep if taken late.",
    title: "Rhodiola rosea",
    block: "morning",
    anchor: "wake",
    offsetMin: 60,
    dose: "200–400 mg (3% rosavins)",
    rationale:
      "Adaptogen with consistent evidence for reducing stress-related fatigue.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "bacopa",
    timingReason:
      "With breakfast — fat-soluble; cognitive effects emerge over 4–12 weeks of consistent use.",
    title: "Bacopa monnieri",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "300 mg (50% bacosides)",
    rationale:
      "Strong evidence for memory and cognitive function with sustained use.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "citicoline",
    timingReason:
      "Morning — choline precursor; supports focus and acetylcholine synthesis.",
    title: "Citicoline (CDP-Choline)",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "250–500 mg",
    rationale:
      "Brain choline precursor; supports cognition and may benefit recovery from injury.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "phosphatidylserine",
    timingReason:
      "Anytime — supports stress response and cognition; PS can lower elevated cortisol.",
    title: "Phosphatidylserine",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "100–300 mg",
    rationale:
      "Phospholipid concentrated in brain cells; modulates the stress response.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "zinc",
    timingReason:
      "With dinner (away from coffee/tea). Pair with 1–2 mg copper if dosing >15 mg long-term.",
    title: "Zinc",
    block: "evening",
    anchor: "wake",
    offsetMin: 720,
    dose: "15–30 mg picolinate",
    rationale:
      "Cofactor in 300+ enzymes; supports immune function, testosterone, wound healing. Long-term zinc above 15 mg/day without paired copper (~1–2 mg) can cause copper-deficiency anemia.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "selenium",
    timingReason:
      "Anytime with food — narrow therapeutic window; one Brazil nut covers a daily dose.",
    title: "Selenium",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "100–200 mcg (or 1 Brazil nut)",
    rationale:
      "Thyroid, antioxidant, and immune cofactor; deficiency is more common than people realize.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "iodine",
    timingReason:
      "If you have or suspect autoimmune thyroid disease, test TSH/TPO antibodies first — iodine can flare Hashimoto's even at RDA doses.",
    title: "Iodine",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "150–300 mcg",
    rationale:
      "Essential for thyroid hormone synthesis; common deficiency outside iodized-salt regions. Important caveat: in autoimmune thyroiditis (Hashimoto's), even RDA-range iodine can flare disease; test thyroid antibodies first.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "probiotics",
    timingReason:
      "With breakfast — food buffers stomach acid so more live organisms survive transit.",
    title: "Probiotic (multi-strain)",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "10–50 billion CFU, 5+ strains",
    rationale:
      "Diversifies the gut microbiome; supports digestion and immune function. Consistency matters more than perfect timing.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "l-citrulline",
    timingReason:
      "30–60 min pre-workout — boosts nitric oxide for blood flow and pump.",
    title: "L-Citrulline",
    block: "afternoon",
    anchor: "wake",
    offsetMin: 300,
    dose: "6–8 g citrulline malate (or 3–6 g pure L-citrulline)",
    rationale:
      "Increases nitric oxide, improving exercise endurance and blood flow. Note: 'citrulline malate' is a 1:1 or 2:1 blend; pure L-citrulline doses are roughly half.",
    icon: "flask",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "beetroot",
    timingReason:
      "Pre-workout — nitric oxide donor; effect kicks in 2–3h after ingestion.",
    title: "Beetroot powder",
    block: "afternoon",
    anchor: "wake",
    offsetMin: 240,
    dose: "5–10 g powder OR 1 cup juice",
    rationale:
      "Dietary nitrate source; improves endurance, blood pressure, and cognitive performance.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "boron",
    timingReason:
      "Anytime with food — supports magnesium, vitamin D, and hormone metabolism.",
    title: "Boron",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "3–6 mg",
    rationale:
      "Trace mineral that supports bone health, hormone balance, and inflammation modulation.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "apigenin",
    timingReason:
      "Pre-bed — chamomile compound that supports GABA receptors and sleep.",
    title: "Apigenin",
    block: "evening",
    anchor: "bed",
    offsetMin: -45,
    dose: "50 mg",
    rationale:
      "Chamomile-derived flavonoid; mild sedative via GABA-A receptor; non-habit-forming.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "inositol",
    timingReason:
      "Pre-bed — myo-inositol supports calm sleep and insulin sensitivity.",
    title: "Inositol",
    block: "evening",
    anchor: "bed",
    offsetMin: -60,
    dose: "2 g myo-inositol",
    rationale:
      "Supports insulin signaling, mood, and is well-studied for PCOS and anxiety.",
    icon: "pill",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "lutein-zeaxanthin",
    timingReason:
      "With breakfast — fat-soluble; protects eyes from blue light damage.",
    title: "Lutein + Zeaxanthin",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "10 mg lutein + 2 mg zeaxanthin",
    rationale:
      "Concentrated in the retina; protects against macular degeneration and blue-light damage.",
    icon: "sun",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "astaxanthin",
    timingReason:
      "With breakfast — strong antioxidant; fat-soluble.",
    title: "Astaxanthin",
    block: "morning",
    anchor: "wake",
    offsetMin: 90,
    dose: "4–12 mg",
    rationale:
      "Carotenoid antioxidant with skin, eye, and exercise-recovery benefits.",
    icon: "sun",
    leverage: 1,
    kind: "action",
  }),

  // ── Lifestyle / recovery behaviors ────────────────────────────────

  B({
    canonicalKey: "red-light-therapy",
    timingReason:
      "Morning or post-workout — mechanistic case for mitochondrial / skin / joint effects, though clinical evidence is still maturing.",
    title: "Red light therapy",
    block: "morning",
    anchor: "wake",
    offsetMin: 60,
    dose: "10–20 min on target tissue",
    rationale:
      "Photobiomodulation has plausible cellular mechanisms; small clinical trials show modest effects on skin healing and joint pain. Calling this 'proven' would overstate where the evidence is.",
    icon: "sun",
    leverage: 1,
    kind: "action",
    evidenceTier: "emerging",
  }),
  B({
    canonicalKey: "grounding",
    timingReason:
      "Anytime outdoors — barefoot contact with soil/grass is *associated* with calmer inflammation markers in early studies; treat as low-cost, low-evidence.",
    title: "Grounding (barefoot outdoors)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "10–30 min daily",
    rationale:
      "Early studies suggest modulation of inflammation markers; evidence is preliminary and mostly small samples. Low-cost, low-risk — good as an outdoor ritual either way.",
    icon: "leaf",
    leverage: 1,
    kind: "action",
    evidenceTier: "exploratory",
  }),
  B({
    canonicalKey: "wim-hof-breath",
    // Wim Hof in water has caused fatal vasovagal syncope cases — never
    // practice in a pool or bath. Pregnancy + cardiac arrhythmia
    // contraindicated (peripheral vasoconstriction + breath holds).
    timingReason:
      "Morning, on land only — never in water (vasovagal syncope risk). Avoid if pregnant or with a cardiac arrhythmia.",
    title: "Wim Hof breathing",
    block: "morning",
    anchor: "wake",
    offsetMin: 30,
    dose: "3 rounds · 30 breaths each",
    rationale:
      "Hyperventilation + breath holds modulate stress response and oxygen tolerance. Several documented drowning deaths from practicing in water; on land only.",
    icon: "wind",
    leverage: 1,
    kind: "action",
    evidenceTier: "emerging",
    contraindications: ["pregnant", "cardiac-arrhythmia", "under-18"],
  }),
  B({
    canonicalKey: "foam-rolling",
    timingReason:
      "Pre-workout (activation) OR post-workout (recovery) — both timings work.",
    title: "Foam rolling / self-myofascial release",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "5–10 min on major muscle groups",
    rationale:
      "Reduces muscle stiffness, improves range of motion, supports recovery.",
    icon: "stretch",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "yoga-session",
    timingReason:
      "Morning OR evening — both windows work for the flexibility + nervous-system benefits.",
    title: "Yoga session",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "20–60 min · any style",
    rationale:
      "Combines mobility, breath, and parasympathetic activation in one practice.",
    icon: "stretch",
    leverage: 2,
    kind: "action",
  }),
  B({
    canonicalKey: "tongue-scraping",
    timingReason:
      "Morning before brushing — removes overnight bacterial film; Ayurvedic practice with modern oral-health backing.",
    title: "Tongue scraping",
    block: "morning",
    anchor: "wake",
    offsetMin: 5,
    dose: "10 strokes back-to-front",
    rationale:
      "Removes nitrogen-rich biofilm; supports oral microbiome and fresh breath.",
    icon: "sparkle",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "mouth-tape",
    // Mouth-taping with undiagnosed sleep apnea is dangerous — the
    // mouth can be a compensatory airway. Get a sleep study first.
    timingReason:
      "Pre-bed — only if you've ruled out sleep apnea. Snoring, gasping, or daytime sleepiness? Get a sleep study before trying this.",
    title: "Mouth tape for sleep",
    block: "evening",
    anchor: "bed",
    offsetMin: -10,
    dose: "Small piece of micropore tape",
    rationale:
      "Promotes nasal breathing during sleep; may reduce snoring and improve oxygenation.",
    icon: "bed",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "blackout-sleep",
    timingReason:
      "All-night — even small amounts of light through eyelids suppress melatonin.",
    title: "Blackout bedroom",
    block: "evening",
    anchor: "bed",
    offsetMin: -15,
    dose: "Blackout curtains + eye mask",
    rationale:
      "Light through closed eyelids suppresses melatonin; full darkness deepens sleep architecture.",
    icon: "moon",
    leverage: 2,
    kind: "action",
  }),
  // CGM trial + quarterly labs are INTERMITTENT practices — they
  // shouldn't show as daily todos. Until BehaviorDef gains a proper
  // cadence field (weekly/monthly/quarterly), we approximate via a
  // Sunday-only daysActive so they surface once per week as a calm
  // reminder, not 7×/wk noise. Leverage dropped to 1.
  B({
    canonicalKey: "cgm-tracking",
    timingReason:
      "Once a week, review your CGM data window — patterns emerge over weeks, not days.",
    title: "Review CGM trends",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "10 min · weekly review",
    rationale:
      "Trial a CGM for 2 weeks; the value is in patterns across many meals, not single readings.",
    icon: "pulse",
    leverage: 1,
    kind: "action",
    daysActive: [false, false, false, false, false, false, true],
  }),
  B({
    canonicalKey: "quarterly-labs",
    timingReason:
      "Weekly reminder to check whether quarterly bloodwork is due — labs reveal trends invisible to symptoms.",
    title: "Bloodwork check-in",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "Quarterly · lipids, A1c, hsCRP, vit D, ferritin, hormones",
    rationale:
      "Most longevity-relevant changes are invisible without measurement. Quarterly is the right cadence; the weekly check-in just prompts you to schedule when due.",
    icon: "pulse",
    leverage: 1,
    kind: "action",
    daysActive: [false, false, false, false, false, false, true],
  }),
  B({
    canonicalKey: "hot-tub",
    timingReason:
      "Evening — heat exposure lowers cortisol; finish ~1h before bed for sleep onset.",
    title: "Hot tub / hot bath",
    block: "evening",
    anchor: "bed",
    offsetMin: -120,
    dose: "10–20 min · 38–40°C",
    rationale:
      "Heat shock raises HRV, lowers blood pressure, and the post-bath temp drop accelerates sleep onset.",
    icon: "thermometer",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "contrast-shower",
    timingReason:
      "Morning — alternating hot/cold finish improves circulation and alertness.",
    title: "Contrast shower",
    block: "morning",
    anchor: "wake",
    offsetMin: 25,
    dose: "3 rounds: 1 min hot, 30s cold",
    rationale:
      "Combines heat and cold benefits in one shower; trains vascular tone.",
    icon: "snowflake",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "tabata-hiit",
    timingReason:
      "Afternoon — high-intensity demands warmth + glycogen; not before bed.",
    title: "Tabata interval (4 min)",
    block: "afternoon",
    anchor: "wake",
    offsetMin: 360,
    dose: "8 × 20s on, 10s off",
    rationale:
      "Time-efficient way to push VO2 max and metabolic adaptation.",
    icon: "pulse",
    leverage: 2,
    kind: "action",
    category: "workout",
    intensity: "high",
    daysActive: [false, false, true, false, false, true, false],
  }),
  B({
    canonicalKey: "extended-walk",
    timingReason:
      "Anytime daylight — long walks deliver mitochondrial + mental-health benefits at low intensity.",
    title: "60-min walk",
    block: "afternoon",
    anchor: "wake",
    offsetMin: 480,
    dose: "60+ min · easy pace, outdoors",
    rationale:
      "Long, slow movement is one of the best predictors of healthspan in observational studies.",
    icon: "footprints",
    leverage: 2,
    kind: "action",
    category: "workout",
    intensity: "low",
  }),
  B({
    canonicalKey: "standing-desk",
    timingReason:
      "Throughout the workday — alternate sitting/standing to break up sedentary time.",
    title: "Stand at desk (alternating)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "Alternate every 30–60 min",
    rationale:
      "Reduces total sitting time, which is independently linked to mortality risk.",
    icon: "stretch",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "mindful-eating",
    timingReason:
      "Every meal — slow chewing and no distractions improve digestion and satiety.",
    title: "Mindful eating (no screens)",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    dose: "Phone away, chew thoroughly",
    rationale:
      "Slows eating, improves digestion via cephalic phase, and amplifies satiety signaling.",
    icon: "utensils",
    leverage: 1,
    kind: "action",
  }),
  B({
    canonicalKey: "epsom-bath",
    timingReason:
      "Pre-bed — magnesium absorption + heat shock primes sleep onset.",
    title: "Epsom salt bath",
    block: "evening",
    anchor: "bed",
    offsetMin: -120,
    dose: "20 min · 2 cups Epsom salts",
    rationale:
      "Transdermal magnesium + heat exposure; mild relaxant effect plus pre-bed cooling.",
    icon: "thermometer",
    leverage: 1,
    kind: "action",
    daysActive: [false, true, false, false, true, false, true],
  }),
  B({
    canonicalKey: "caffeine-off-day",
    timingReason:
      "1–2 days per week — reset adenosine receptor sensitivity so caffeine keeps working.",
    title: "Caffeine-free day",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    rationale:
      "Periodic caffeine breaks prevent tolerance creep and restore the alertness response.",
    icon: "ban",
    leverage: 1,
    kind: "avoid",
    daysActive: [false, false, false, false, false, true, false],
  }),
  B({
    canonicalKey: "no-alcohol-week",
    timingReason:
      "Weeknights — even small amounts of alcohol blunt REM sleep and recovery.",
    title: "No alcohol Mon–Thu",
    block: "anytime",
    anchor: "wake",
    offsetMin: 0,
    rationale:
      "Most users see meaningful sleep + HRV gains from cutting weekday drinking.",
    icon: "ban",
    leverage: 2,
    kind: "avoid",
    daysActive: [true, true, true, true, false, false, false],
  }),
];

/**
 * Read-side alias for cross-module consumers (governance.ts, admin
 * dashboard). Keeps the internal const private-ish while exposing a
 * stable name we can keep even if the underlying shape evolves.
 */
export const STANDALONE_ATOMS_REGISTRY: ReadonlyArray<BehaviorDef> =
  STANDALONE_ATOMS;

export function listBehaviorAtoms(): BehaviorAtom[] {
  const byKey = new Map<string, BehaviorAtom>();
  for (const pack of activePacks()) {
    if (pack.source !== "official") continue;
    for (const b of pack.behaviors) {
      const existing = byKey.get(b.canonicalKey);
      if (existing) {
        if (!existing.fromOfficialPacks.includes(pack.name))
          existing.fromOfficialPacks.push(pack.name);
        continue;
      }
      byKey.set(b.canonicalKey, {
        ...b,
        fromOfficialPacks: [pack.name],
      });
    }
  }
  // Merge standalone atoms — discoverable in the library picker but
  // not part of any pack. If a standalone shares a canonicalKey with a
  // pack-bound atom (it shouldn't, but be defensive), the pack-bound
  // version wins so the picker shows the richer "from X pack" hint.
  for (const a of STANDALONE_ATOMS) {
    if (byKey.has(a.canonicalKey)) continue;
    byKey.set(a.canonicalKey, {
      ...a,
      fromOfficialPacks: ["Library"],
    });
  }
  return [...byKey.values()].sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

/**
 * Generate a user-namespaced canonical key for a custom behavior. The
 * `custom:` prefix is what the engine looks for to skip the hardcoded
 * intelligence-layer key matches (RESTRAINT_KEYS, CIRCADIAN, etc.) —
 * a user typing "Strength" no longer contaminates the burnout-recovery
 * mute, and two users typing "Sleep" don't silently merge.
 */
export function customCanonicalKey(packId: string, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  // Random suffix so two custom behaviors with the same title in the
  // same pack don't collide. Short enough to stay readable in debug
  // logs and the URL bar if it ever surfaces.
  const suffix = Math.random().toString(36).slice(2, 6);
  return `custom:${packId}:${base || "item"}-${suffix}`;
}
