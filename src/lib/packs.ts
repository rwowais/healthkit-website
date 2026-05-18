/**
 * packs.ts — official Protocol Packs.
 *
 * Packs are modular systems. Behaviors share a `canonicalKey` so the
 * timeline compiler can intelligently MERGE overlapping behaviors across
 * installed packs instead of duplicating them.
 */
import type { BehaviorDef, ProtocolPack } from "./types";

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
  timingReason:
    "The last ~45 min before bed — that's the window where lowering arousal most improves sleep onset.",
  title: "Wind-down ritual",
  block: "evening",
  anchor: "bed",
  offsetMin: -45,
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
  timingReason:
    "With the first fat-containing meal — dietary fat markedly improves absorption.",
  title: "Omega-3 (EPA/DHA)",
  block: "morning",
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
        timingReason:
          "Spread across daytime meals to steady glucose through the day.",
        title: "Fiber & plants",
        block: "afternoon",
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
        timingReason:
          "The final stretch before bed — removes the most alerting light source.",
        title: "Screens off",
        block: "evening",
        anchor: "bed",
        offsetMin: -45,
        rationale: "Reduces alerting blue light and cognitive arousal pre-sleep.",
        icon: "screen",
        leverage: 2,
        kind: "avoid",
      }),
      B({
        canonicalKey: "cool-room",
        timingReason:
          "Set before bed so the room is already cool when core temperature needs to fall.",
        title: "Cool the bedroom",
        block: "evening",
        anchor: "bed",
        offsetMin: -30,
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
        timingReason:
          "At meals — eating fiber before carbs blunts that meal's glucose spike.",
        title: "Vegetables first",
        block: "afternoon",
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
        timingReason:
          "Right after eating — muscle contraction clears glucose without insulin.",
        title: "Walk after meals",
        block: "afternoon",
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
];

export function packById(id: string): ProtocolPack | undefined {
  return PACKS.find((p) => p.id === id);
}

export const DEFAULT_INSTALLED = ["longevity-foundation", "better-sleep"];
