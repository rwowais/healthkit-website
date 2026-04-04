import { Protocol } from "./types";

export const protocols: Protocol[] = [
  // ===== SLEEP (free) =====
  {
    id: "sleep-001",
    name: "Morning Sunlight Exposure",
    description:
      "Get direct sunlight within 30-60 minutes of waking for 10-15 minutes to set your circadian clock.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "Circadian Rhythm",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "sleep-002",
    name: "Cool Sleeping Environment",
    description:
      "Keep bedroom temperature between 60-67°F (16-19°C) to support deep sleep onset.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "Environment",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "sleep-003",
    name: "Consistent Sleep Schedule",
    description:
      "Go to bed and wake up at the same time every day, including weekends.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "Sleep Hygiene",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "sleep-004",
    name: "Dim Lights After Sunset",
    description:
      "Reduce bright artificial light in the evening. Use low lamps or candlelight after 8 PM.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "Circadian Rhythm",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "sleep-005",
    name: "No Caffeine 8-10h Before Bed",
    description:
      "Stop caffeine at least 8-10 hours before bedtime to avoid blocking sleep pressure.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "Sleep Hygiene",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "sleep-006",
    name: "No Food 2-3h Before Bed",
    description:
      "Avoid eating within 2-3 hours of bedtime to support the core temperature drop needed for sleep.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "Sleep Hygiene",
    frequency: "Daily",
    tier: "free",
  },
  // Premium sleep
  {
    id: "sleep-007",
    name: "Magnesium L-Threonate Protocol",
    description:
      "Take 200-400mg 30-60 minutes before bed to promote deeper sleep and calm the nervous system.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "Supplements",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "sleep-008",
    name: "Apigenin Sleep Stack",
    description:
      "50mg apigenin before bed to reduce racing thoughts and promote relaxation via GABA receptors.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "Supplements",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "sleep-009",
    name: "Circadian Reset Protocol",
    description:
      "A structured routine to reset your circadian rhythm: morning light, timed meals, evening wind-down.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "Advanced",
    frequency: "2-3 week protocol",
    tier: "premium",
  },

  // ===== EXERCISE (free) =====
  {
    id: "exercise-001",
    name: "Zone 2 Cardio",
    description:
      "45-60 min at conversational pace (60-75% max HR). The most important exercise for longevity.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "Cardio",
    frequency: "3-4x per week",
    tier: "free",
  },
  {
    id: "exercise-002",
    name: "10,000+ Steps Daily",
    description:
      "Walk throughout the day outside of structured exercise to support metabolic health and mood.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "Movement",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "exercise-003",
    name: "Stretching & Mobility",
    description:
      "10 minutes daily targeting hip flexors, thoracic spine, and shoulders.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "Mobility",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "exercise-004",
    name: "Grip Strength Training",
    description:
      "Dead hangs, farmer carries. Grip strength is one of the strongest predictors of longevity.",
    recommendedBy: ["Attia"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "Strength",
    frequency: "3x per week",
    tier: "free",
  },
  // Premium exercise
  {
    id: "exercise-005",
    name: "VO2 Max Intervals",
    description:
      "4×4 min all-out with 4 min recovery. VO2 max is the strongest correlate of mortality reduction.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "advanced",
    category: "exercise",
    subcategory: "Cardio",
    frequency: "1x per week",
    tier: "premium",
  },
  {
    id: "exercise-006",
    name: "Reverse Pyramid Strength Training",
    description:
      "Upper/lower body split with reverse pyramid sets at 60-85% 1RM. Progressive overload week to week.",
    recommendedBy: ["Attia"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "Strength",
    frequency: "3x per week",
    tier: "premium",
  },
  {
    id: "exercise-007",
    name: "Stability Foundation Work",
    description:
      "5-10 min before every workout targeting spine, hips, shoulders, and feet to prevent injury.",
    recommendedBy: ["Attia"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "Stability",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "exercise-008",
    name: "Deliberate Cold Exposure",
    description:
      "Cold showers or ice baths (1-5 min) to boost dopamine and metabolic rate. Not after strength training.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "Recovery",
    frequency: "3-5x per week",
    tier: "premium",
  },

  // ===== DIET (free) =====
  {
    id: "diet-001",
    name: "High Protein Intake",
    description:
      "~1g protein per pound of body weight daily across 3-4 meals (30-50g each).",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "Macronutrients",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "diet-002",
    name: "Prioritize Whole Foods",
    description:
      "Build meals around quality proteins, vegetables, fruits, nuts, seeds. Minimize processed foods.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "Food Quality",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "diet-003",
    name: "Morning Electrolytes",
    description:
      "Add sea salt or electrolyte mix to your first glass of water for hydration and energy.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "diet",
    subcategory: "Hydration",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "diet-004",
    name: "Minimize Alcohol",
    description:
      "Reduce or eliminate alcohol. It disrupts sleep, impairs recovery, and is a known carcinogen.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "Lifestyle",
    frequency: "Daily",
    tier: "free",
  },
  // Premium diet
  {
    id: "diet-005",
    name: "Carb Backloading Protocol",
    description:
      "Low-carb first half of the day, carbs at dinner. Improves insulin sensitivity and thyroid function.",
    recommendedBy: ["Attia"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "Timing",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "diet-006",
    name: "Time-Restricted Eating",
    description:
      "Eat within an 8-12 hour window. First meal after 12 PM, last meal before 7 PM.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "Timing",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "diet-007",
    name: "Metabolic Reset Nutrition",
    description:
      "Structured macro cycling to reverse insulin resistance and reset metabolic rate over 2-3 weeks.",
    recommendedBy: ["Attia"],
    difficulty: "advanced",
    category: "diet",
    subcategory: "Advanced",
    frequency: "2-3 week protocol",
    tier: "premium",
  },
  {
    id: "diet-008",
    name: "Fiber & Fermented Foods",
    description:
      "Varied fiber sources plus fermented foods (yogurt, kimchi, sauerkraut) for gut microbiome diversity.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "diet",
    subcategory: "Gut Health",
    frequency: "Daily",
    tier: "premium",
  },

  // ===== SUPPLEMENTS (free) =====
  {
    id: "supplement-001",
    name: "Omega-3 Fish Oil",
    description:
      "2-4g EPA/DHA daily. Supports heart health, reduces inflammation, benefits the brain.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Foundational",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "supplement-002",
    name: "Vitamin D3",
    description:
      "5,000 IU daily, targeting blood levels of 40-60 ng/mL. Most people are deficient.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Foundational",
    frequency: "Daily",
    tier: "free",
  },
  {
    id: "supplement-003",
    name: "Creatine Monohydrate",
    description:
      "5g daily. Supports muscle performance and emerging cognitive benefits. Extremely well-studied.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Performance",
    frequency: "Daily",
    tier: "free",
  },
  // Premium supplements
  {
    id: "supplement-004",
    name: "Magnesium Stack",
    description:
      "L-Threonate for sleep/cognition plus Bisglycinate for general levels. Supports 300+ enzyme reactions.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Foundational",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "supplement-005",
    name: "Metabolic Reset Supplements",
    description:
      "Berberine, glycine, benfotiamine, and chromium picolinate to support insulin sensitivity and metabolism.",
    recommendedBy: ["Attia"],
    difficulty: "moderate",
    category: "supplements",
    subcategory: "Metabolic",
    frequency: "With every meal",
    tier: "premium",
  },
  {
    id: "supplement-006",
    name: "Vitamin K2 + D3 Synergy",
    description:
      "Vitamin K2 (MK-7) alongside D3 to direct calcium to bones rather than arteries.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Foundational",
    frequency: "Daily",
    tier: "premium",
  },
  {
    id: "supplement-007",
    name: "Tongkat Ali",
    description:
      "400mg daily to support free testosterone levels by reducing SHBG binding.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "Hormonal",
    frequency: "Daily",
    tier: "premium",
  },
];

export const categoryInfo: Record<
  string,
  { label: string; icon: string; color: string; description: string }
> = {
  sleep: {
    label: "Sleep",
    icon: "🌙",
    color: "#5e5ce6",
    description: "Optimize your sleep quality and circadian rhythm",
  },
  exercise: {
    label: "Exercise",
    icon: "💪",
    color: "#ff453a",
    description: "Build strength, endurance, and functional fitness",
  },
  diet: {
    label: "Nutrition",
    icon: "🥗",
    color: "#30d158",
    description: "Fuel your body with evidence-based nutrition",
  },
  supplements: {
    label: "Supplements",
    icon: "💊",
    color: "#ff9f0a",
    description: "Fill gaps with targeted supplementation",
  },
};
