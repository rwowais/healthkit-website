import type { ProtocolItem } from "../types";

export const defaultNutritionProtocol: ProtocolItem[] = [
  // ── MORNING (timingAnchor: "wake") ────────────────────────────
  {
    id: "nutrition-default-001",
    pillar: "nutrition",
    name: "Hydrate First",
    description:
      "Drink 16-24 oz of water with a pinch of sea salt upon waking. Rehydrates after 7-8 hours of sleep-induced fasting and restores electrolyte balance.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 5,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 1,
    isEnabled: true,
    icon: "💧",
    recommendedBy: ["Huberman"],
    evidenceNote:
      "You lose approximately 1 liter of water overnight through respiration and perspiration. Early hydration with electrolytes (sodium, potassium) restores plasma volume and supports cortisol clearance.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "nutrition-default-002",
    pillar: "nutrition",
    name: "Protein-Rich Breakfast",
    description:
      "30-50g protein at first meal. Drives muscle protein synthesis, stabilizes blood sugar, and increases satiety for the day.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 90,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 2,
    isEnabled: true,
    icon: "🥩",
    recommendedBy: ["Attia", "Huberman"],
    evidenceNote:
      "Distributing protein evenly across meals (30-50g per meal) maximizes muscle protein synthesis compared to loading it all at dinner. The leucine threshold (~2.5-3g) must be met at each meal to trigger mTOR-mediated synthesis.",
    createdAt: "2026-01-01T00:00:00Z",
  },

  // ── MIDDAY (timingAnchor: "wake") ─────────────────────────────
  {
    id: "nutrition-default-003",
    pillar: "nutrition",
    name: "Protein Target: Lunch",
    description:
      "Another 30-50g protein at midday. Aim for 1g protein per pound of lean body mass across the day.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 330,
    timeOfDay: "afternoon",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 3,
    isEnabled: true,
    icon: "🍗",
    recommendedBy: ["Attia"],
    evidenceNote:
      "Attia recommends 1g protein per pound of target lean body mass daily. For most adults this is 120-180g/day, split across 3-4 meals to maximize the muscle protein synthesis response at each feeding.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "nutrition-default-004",
    pillar: "nutrition",
    name: "Fiber & Vegetables",
    description:
      "Include 2+ servings of non-starchy vegetables with lunch. Fiber supports gut microbiome diversity and blood sugar regulation.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 330,
    timeOfDay: "afternoon",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 4,
    isEnabled: true,
    icon: "🥦",
    recommendedBy: ["Attia"],
    evidenceNote:
      "Higher dietary fiber intake is associated with reduced cardiovascular mortality and improved glycemic control. Aiming for 30-50g of fiber daily from whole food sources supports a diverse gut microbiome.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "nutrition-default-005",
    pillar: "nutrition",
    name: "Omega-3 Fats",
    description:
      "Include fatty fish, chia seeds, walnuts, or take fish oil. Omega-3s reduce systemic inflammation and support brain and cardiovascular health.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 330,
    timeOfDay: "afternoon",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 5,
    isEnabled: true,
    icon: "🐟",
    recommendedBy: ["Attia", "Huberman"],
    evidenceNote:
      "EPA and DHA omega-3 fatty acids have anti-inflammatory effects and support neuronal membrane integrity. Aim for 2-4g combined EPA/DHA daily from food or supplementation.",
    createdAt: "2026-01-01T00:00:00Z",
  },

  // ── EVENING (timingAnchor: "bed") ─────────────────────────────
  {
    id: "nutrition-default-006",
    pillar: "nutrition",
    name: "Last Meal Window",
    description:
      "Finish dinner 3+ hours before bed. Late eating impairs sleep quality, glucose tolerance, and fat oxidation during sleep.",
    source: "default",
    timingAnchor: "bed",
    timingOffsetMinutes: -180,
    timeOfDay: "evening",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 6,
    isEnabled: true,
    icon: "🍽️",
    recommendedBy: ["Attia", "Huberman"],
    evidenceNote:
      "Late-night eating elevates core body temperature through diet-induced thermogenesis, which directly opposes the thermoregulatory drop required for sleep onset. It also impairs overnight growth hormone secretion.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "nutrition-default-007",
    pillar: "nutrition",
    name: "Minimize Alcohol",
    description:
      "Limit or avoid alcohol, especially within 3 hours of bed. Even 1-2 drinks fragments sleep architecture and suppresses REM sleep.",
    source: "default",
    timingAnchor: "bed",
    timingOffsetMinutes: -180,
    timeOfDay: "evening",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 7,
    isEnabled: true,
    icon: "🚫",
    recommendedBy: ["Walker", "Huberman"],
    evidenceNote:
      "Alcohol is a sedative, not a sleep aid. It blocks REM sleep, causes more awakenings in the second half of the night, and disrupts the body's overnight repair processes. Even moderate drinking impairs sleep quality measurably.",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "nutrition-default-008",
    pillar: "nutrition",
    name: "Limit Processed Sugar",
    description:
      "Minimize refined sugars and ultra-processed foods. Chronic high sugar intake drives insulin resistance, the root of metabolic disease.",
    source: "default",
    timingAnchor: "wake",
    timingOffsetMinutes: 0,
    timeOfDay: "morning",
    daysActive: [true, true, true, true, true, true, true],
    sortOrder: 8,
    isEnabled: true,
    icon: "🍬",
    recommendedBy: ["Attia"],
    evidenceNote:
      "Chronic hyperinsulinemia from refined sugar consumption is a primary driver of metabolic syndrome, type 2 diabetes, cardiovascular disease, and potentially neurodegenerative disease. Focus on whole food carbohydrate sources.",
    createdAt: "2026-01-01T00:00:00Z",
  },
];
