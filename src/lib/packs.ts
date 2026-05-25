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
  recommendedBy: ["Huberman", "Walker"],
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
  recommendedBy: ["Attia"],
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
  recommendedBy: ["Huberman", "Attia"],
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
  recommendedBy: ["Walker"],
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
  recommendedBy: ["Walker", "Huberman"],
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
  recommendedBy: ["Attia", "Huberman"],
  icon: "fish",
  leverage: 2,
  kind: "action",
});

// ── Jetlag-recovery atoms (used by the Jetlag pack and reusable
// elsewhere when travel/circadian-shift protocols evolve) ──────────

const NEW_TZ_SUNLIGHT = B({
  canonicalKey: "new-tz-sunlight",
  timingReason:
    "Bright light at the new timezone's morning is the single most powerful signal for shifting your circadian clock to the destination.",
  title: "Morning light at destination",
  block: "morning",
  anchor: "wake",
  offsetMin: 30,
  dose: "20–40 min outdoor, no sunglasses",
  rationale:
    "Resets the master clock to local time — accelerates adaptation by 1–2 days.",
  evidence:
    "Light is the primary zeitgeber; properly timed exposure can shift the circadian phase by ~1h/day.",
  recommendedBy: ["Huberman", "Walker"],
  icon: "sun",
  leverage: 3,
  kind: "action",
});

const STRATEGIC_MELATONIN = B({
  canonicalKey: "strategic-melatonin",
  timingReason:
    "30–60 min before the NEW timezone's bedtime — its sleep-timing effect depends on being taken near intended sleep.",
  title: "Strategic melatonin",
  block: "evening",
  anchor: "bed",
  offsetMin: -45,
  dose: "0.3–0.5 mg (low dose)",
  rationale:
    "A small dose helps shift sleep timing; large doses don't help more and disrupt next-morning alertness.",
  evidence:
    "Low-dose melatonin (0.3 mg) effectively phase-shifts circadian rhythms during jetlag without sedation hangover.",
  recommendedBy: ["Walker"],
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
  recommendedBy: ["Attia"],
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
  recommendedBy: ["Walker"],
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
        recommendedBy: ["Attia"],
        icon: "footprints",
        leverage: 3,
        kind: "action",
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
          "Muscle and strength are protective against nearly every cause of late-life decline.",
        recommendedBy: ["Attia"],
        icon: "dumbbell",
        leverage: 3,
        kind: "action",
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
      B({
        canonicalKey: "dim-lights",
        timingReason:
          "~2h before bed — bright evening light is what most delays melatonin.",
        title: "Dim the lights",
        block: "evening",
        anchor: "bed",
        offsetMin: -120,
        dose: "Warm, low light only",
        rationale: "Evening bright light suppresses melatonin and delays sleep.",
        recommendedBy: ["Huberman"],
        icon: "moon",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "screens-off",
        // Bed -60 (was -45) so it sits BEFORE magnesium-pm and the
        // wind-down ritual — the screens-off cue is a precondition for
        // those, not parallel to them. See WIND_DOWN comment for the
        // pre-bed sequence.
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
      }),
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
        recommendedBy: ["Walker"],
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
          "With a morning fat-containing meal — fat aids absorption and it suits a daytime rhythm.",
        title: "Vitamin D3 + K2",
        block: "morning",
        anchor: "wake",
        offsetMin: 90,
        dose: "2,000–5,000 IU D3 + K2",
        rationale:
          "Corrects widespread insufficiency; K2 directs calcium to bone, not arteries.",
        recommendedBy: ["Attia", "Huberman"],
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
        recommendedBy: ["Huberman", "Attia"],
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
      B({
        canonicalKey: "delay-caffeine",
        timingReason:
          "~90 min after waking — lets adenosine clear first and blunts the afternoon crash.",
        title: "Delay caffeine 90 min",
        block: "morning",
        anchor: "wake",
        offsetMin: 90,
        rationale:
          "Delaying caffeine after waking avoids the afternoon adenosine crash.",
        recommendedBy: ["Huberman"],
        icon: "coffee",
        leverage: 2,
        kind: "action",
      }),
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
      B({
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
        recommendedBy: ["Huberman"],
        icon: "lungs",
        leverage: 3,
        kind: "action",
      }),
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
      B({
        canonicalKey: "extra-sleep",
        timingReason:
          "Set at night — protecting the sleep opportunity is the recovery itself.",
        title: "Protect 8.5h sleep opportunity",
        block: "evening",
        anchor: "bed",
        offsetMin: -30,
        rationale: "Recovery is built in bed before it's built in the gym.",
        icon: "bed",
        leverage: 3,
        kind: "action",
      }),
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
      B({
        canonicalKey: "veg-first",
        // "At every meal" is not a specific time block — anytime
        // keeps the warning honest.
        timingReason:
          "At each meal — eating fiber before carbs blunts that meal's glucose spike. Applies every time you eat.",
        title: "Vegetables first",
        block: "anytime",
        anchor: "wake",
        offsetMin: 330,
        rationale:
          "Fiber before carbs measurably blunts the post-meal glucose spike.",
        icon: "leaf",
        leverage: 2,
        kind: "action",
      }),
      B({
        canonicalKey: "post-meal-walk",
        // After meals — happens whenever the user eats, not locked
        // to one block. Anytime here preserves the science (walk
        // within ~30 min of eating) without falsely warning.
        timingReason:
          "Within ~30 min of any meal — muscle contraction clears glucose without insulin.",
        title: "Walk after meals",
        block: "anytime",
        anchor: "wake",
        offsetMin: 360,
        dose: "10 min after eating",
        rationale: "Muscle contraction clears glucose without insulin.",
        recommendedBy: ["Attia"],
        icon: "footprints",
        leverage: 3,
        kind: "action",
      }),
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
      NEW_TZ_SUNLIGHT,
      ANCHOR_MEAL,
      TRAVEL_HYDRATE,
      ARRIVAL_WALK,
      B({
        canonicalKey: "delay-caffeine-tz",
        timingReason:
          "~90 min after waking at destination — anchors alertness to the new morning instead of pulling you back to departure-time.",
        title: "Caffeine at new-morning + 90",
        block: "morning",
        anchor: "wake",
        offsetMin: 90,
        dose: "Normal dose, new timezone",
        rationale:
          "Caffeine timing reinforces the new wake-time; off-timezone caffeine prolongs misalignment.",
        recommendedBy: ["Huberman"],
        icon: "coffee",
        leverage: 2,
        kind: "action",
      }),
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
        timingReason:
          "Push the first calorie ~14–16h after dinner — that's where most autophagy and metabolic flexibility benefits accrue.",
        title: "Delay first meal to ~11am–1pm",
        block: "morning",
        anchor: "wake",
        offsetMin: 240,
        dose: "Black coffee / tea / water only",
        rationale:
          "A long overnight fast supports insulin sensitivity, autophagy, and metabolic flexibility.",
        recommendedBy: ["Attia"],
        icon: "clock",
        leverage: 3,
        kind: "action",
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
        recommendedBy: ["Attia"],
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
          "Morning — cold delivers a clean, sustained dopamine and noradrenaline lift that's perfect to start the day, and avoids sleep disruption.",
        title: "Cold plunge or cold shower",
        block: "morning",
        anchor: "wake",
        offsetMin: 30,
        dose: "1–3 min, ~10–15°C",
        rationale:
          "Dopamine and norepinephrine rise sharply and stay elevated; builds stress resilience.",
        evidence:
          "Cold exposure (~14°C, 1 min) elevates norepinephrine ~5×; effect lasts hours.",
        recommendedBy: ["Huberman"],
        icon: "snowflake",
        leverage: 2,
        kind: "action",
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
        recommendedBy: ["Huberman"],
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
        timingReason:
          "Evening — heat shock lowers cortisol, raises HRV, and supports sleep when finished ~1–2h before bed.",
        title: "Sauna session",
        block: "evening",
        anchor: "bed",
        offsetMin: -180,
        dose: "15–25 min, 80–90°C, 2–4×/wk",
        rationale:
          "Regular sauna is associated with lower all-cause and cardiovascular mortality.",
        evidence:
          "Finnish cohort studies show 4–7 sauna sessions/week associated with ~40% lower all-cause mortality.",
        recommendedBy: ["Attia"],
        icon: "thermometer",
        leverage: 3,
        kind: "action",
        daysActive: [true, false, true, false, true, true, false],
      }),
      B({
        canonicalKey: "post-sauna-hydrate",
        timingReason:
          "Right after sauna — heavy fluid and electrolyte replacement protects against orthostatic dips and cramping.",
        title: "Replenish electrolytes after sauna",
        block: "evening",
        anchor: "bed",
        offsetMin: -150,
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
        recommendedBy: ["Huberman"],
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
      B({
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
      }),
      WIND_DOWN,
      MAGNESIUM_PM,
    ],
  },
  {
    id: "heart-health",
    name: "Heart Health",
    tagline:
      "An Attia-style cardiovascular protocol — zone 2, strength, lipids, sleep.",
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
          "Builds mitochondrial density and lactate clearance — Attia's top cardiovascular lever.",
        evidence:
          "Aerobic fitness (VO2 max) is one of the strongest predictors of all-cause mortality across cohorts.",
        recommendedBy: ["Attia"],
        icon: "footprints",
        leverage: 3,
        kind: "action",
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
        recommendedBy: ["Attia"],
        icon: "pulse",
        leverage: 3,
        kind: "action",
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
        recommendedBy: ["Attia"],
        icon: "dumbbell",
        leverage: 3,
        kind: "action",
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
        recommendedBy: ["Attia"],
        icon: "pulse",
        leverage: 2,
        kind: "action",
        daysActive: [true, false, false, false, false, false, false],
      }),
      WIND_DOWN,
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
