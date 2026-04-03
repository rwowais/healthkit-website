import { Protocol } from "./types";

export const protocols: Protocol[] = [
  // ===== SLEEP =====
  {
    id: "sleep-001",
    name: "Morning Sunlight Exposure",
    description:
      "Get direct sunlight within 30-60 minutes of waking for 10-15 minutes. Sets your circadian clock and triggers a cortisol pulse that initiates melatonin release later at night.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "circadian rhythm",
    frequency: "Daily",
  },
  {
    id: "sleep-002",
    name: "Cool Sleeping Environment",
    description:
      "Keep bedroom temperature between 60-67°F (16-19°C). Your core body temperature must drop 1-3°F to initiate and maintain deep sleep.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "environment",
    frequency: "Daily",
  },
  {
    id: "sleep-003",
    name: "Consistent Sleep Schedule",
    description:
      "Go to bed and wake up at the same time every day, including weekends. Consistency anchors the circadian rhythm more than any supplement.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "sleep hygiene",
    frequency: "Daily",
  },
  {
    id: "sleep-004",
    name: "Magnesium L-Threonate Before Bed",
    description:
      "Take 200-400mg of Magnesium L-Threonate 30-60 minutes before bed. Crosses the blood-brain barrier, calms the nervous system, and promotes deeper sleep.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "supplements",
    frequency: "Daily",
  },
  {
    id: "sleep-005",
    name: "Avoid Caffeine 8-10 Hours Before Bed",
    description:
      "Stop caffeine at least 8-10 hours before bedtime. Caffeine has a half-life of ~5 hours and blocks adenosine receptors, directly interfering with sleep pressure.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "sleep hygiene",
    frequency: "Daily",
  },
  {
    id: "sleep-006",
    name: "Dim Lights in the Evening",
    description:
      "Reduce overhead and bright artificial light after sunset. Use low-positioned lamps or candlelight. Bright light between 10 PM-4 AM suppresses dopamine and disrupts your clock.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "circadian rhythm",
    frequency: "Daily",
  },
  {
    id: "sleep-007",
    name: "No Food 2-3 Hours Before Bed",
    description:
      "Avoid eating within 2-3 hours of bedtime. Late meals raise core body temperature through thermogenesis, opposing the temperature drop required for sleep.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "moderate",
    category: "sleep",
    subcategory: "sleep hygiene",
    frequency: "Daily",
  },
  {
    id: "sleep-008",
    name: "Apigenin for Sleep",
    description:
      "Take 50mg of apigenin (chamomile derivative) 30-60 minutes before bed. Acts as a mild sedative by modulating GABA receptors and reduces racing thoughts.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "supplements",
    frequency: "Daily",
  },
  {
    id: "sleep-009",
    name: "Sleep Tracking with Wearable",
    description:
      "Use a wearable like Oura Ring or WHOOP to monitor sleep stages, HRV, and total sleep time. Use data to identify patterns and adjust protocols.",
    recommendedBy: ["Attia"],
    difficulty: "easy",
    category: "sleep",
    subcategory: "tracking",
    frequency: "Daily",
  },

  // ===== EXERCISE =====
  {
    id: "exercise-001",
    name: "Zone 2 Cardio (3-4x/week)",
    description:
      "45-60 minutes at Zone 2 intensity (60-75% max HR, can hold conversation). The single most important exercise for longevity — improves mitochondrial function and metabolic health.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "cardio",
    frequency: "3-4x per week",
  },
  {
    id: "exercise-002",
    name: "VO2 Max Intervals (1x/week)",
    description:
      "4x4-minute all-out efforts with 4 min recovery. VO2 max is the single strongest correlate of all-cause mortality reduction. Even small improvements have outsized benefits.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "advanced",
    category: "exercise",
    subcategory: "cardio",
    frequency: "1x per week",
  },
  {
    id: "exercise-003",
    name: "Strength Training (3x/week)",
    description:
      "Full-body resistance training, 45-60 min per session. Alternate between strength phases (4-8 reps) and hypertrophy phases (8-15 reps). Target all major muscle groups.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "strength",
    frequency: "3x per week",
  },
  {
    id: "exercise-004",
    name: "Daily Stability Training",
    description:
      "5-10 minutes before every workout targeting spine, hips, shoulders, and feet. Attia considers stability the foundation that prevents injury and enables lifelong training.",
    recommendedBy: ["Attia"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "stability",
    frequency: "Daily",
  },
  {
    id: "exercise-005",
    name: "Grip Strength Training",
    description:
      "Dead hangs, farmer carries, and grip-specific exercises. Grip strength is one of the strongest predictors of all-cause mortality and functional independence in later life.",
    recommendedBy: ["Attia"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "strength",
    frequency: "3x per week",
  },
  {
    id: "exercise-006",
    name: "Deliberate Cold Exposure",
    description:
      "Cold showers or ice baths (1-5 min at 40-60°F). Increases dopamine, norepinephrine, and brown fat. Avoid immediately after strength training as it can blunt muscle growth.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "recovery",
    frequency: "3-5x per week",
  },
  {
    id: "exercise-007",
    name: "10,000+ Steps Daily",
    description:
      "Walk at least 10,000 steps per day outside of structured exercise. Low-grade movement throughout the day supports metabolic health, mood, and longevity beyond formal workouts.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "movement",
    frequency: "Daily",
  },
  {
    id: "exercise-008",
    name: "Stretching & Mobility (10 min/day)",
    description:
      "Dedicate 10 minutes daily to stretching and mobility work. Focus on hip flexors, thoracic spine, and shoulders — areas that tighten from modern sedentary life.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "exercise",
    subcategory: "mobility",
    frequency: "Daily",
  },
  {
    id: "exercise-009",
    name: "Nasal Breathing During Zone 2",
    description:
      "Breathe exclusively through the nose during Zone 2 cardio. If you can't maintain it, you're likely above Zone 2. Improves CO2 tolerance and parasympathetic tone.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "exercise",
    subcategory: "cardio",
    frequency: "During Zone 2 sessions",
  },

  // ===== DIET =====
  {
    id: "diet-001",
    name: "High Protein (1g per lb bodyweight)",
    description:
      "Consume ~1g protein per pound of body weight daily across 3-4 meals (30-50g each). Critical for muscle maintenance and growth, especially with age.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "macronutrients",
    frequency: "Daily",
  },
  {
    id: "diet-002",
    name: "Delay Caffeine 90-120 Min After Waking",
    description:
      "Wait 90-120 minutes after waking before caffeine. Allows the natural cortisol awakening response to peak and clear adenosine, preventing afternoon crashes.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "timing",
    frequency: "Daily",
  },
  {
    id: "diet-003",
    name: "Time-Restricted Eating (12-16h Fast)",
    description:
      "Limit eating to an 8-12 hour window. No food for 60 min after waking and 2-3 hours before bed. Improves insulin sensitivity and gut microbiome diversity.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "timing",
    frequency: "Daily",
  },
  {
    id: "diet-004",
    name: "Prioritize Whole, Unprocessed Foods",
    description:
      "Build meals around quality proteins, vegetables, fruits, nuts, seeds, and complex carbs. Minimize ultra-processed foods, seed oils, and added sugars.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "food quality",
    frequency: "Daily",
  },
  {
    id: "diet-005",
    name: "Minimize or Eliminate Alcohol",
    description:
      "Reduce or eliminate alcohol entirely. Even moderate drinking disrupts sleep architecture, impairs recovery, and is a known carcinogen with no proven health benefits.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "moderate",
    category: "diet",
    subcategory: "lifestyle",
    frequency: "Daily",
  },
  {
    id: "diet-006",
    name: "Morning Electrolytes / Salt Water",
    description:
      "Add sea salt or electrolyte mix (like LMNT) to first glass of water. Supports hydration, blunts hunger during fasting, and supports adrenal function.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "diet",
    subcategory: "hydration",
    frequency: "Daily",
  },
  {
    id: "diet-007",
    name: "Fiber & Fermented Foods for Gut Health",
    description:
      "Eat varied fiber sources and fermented foods (yogurt, kimchi, sauerkraut, kombucha). A diverse microbiome reduces inflammation and improves metabolic markers.",
    recommendedBy: ["Huberman", "Attia"],
    difficulty: "easy",
    category: "diet",
    subcategory: "gut health",
    frequency: "Daily",
  },
  {
    id: "diet-008",
    name: "Carbs Around Training",
    description:
      "Include more carbohydrates (rice, oatmeal, potatoes) in post-workout meals to replenish glycogen. Keep carbs lower on rest days.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "diet",
    subcategory: "timing",
    frequency: "Training days",
  },
  {
    id: "diet-009",
    name: "Monitor Blood Glucose (CGM)",
    description:
      "Use a continuous glucose monitor to understand your glycemic response. Target average glucose below 100 mg/dL and minimize spikes above 140 mg/dL.",
    recommendedBy: ["Attia"],
    difficulty: "advanced",
    category: "diet",
    subcategory: "tracking",
    frequency: "Continuous",
  },

  // ===== SUPPLEMENTS =====
  {
    id: "supplement-001",
    name: "Omega-3 Fish Oil (EPA/DHA)",
    description:
      "2-4g EPA/DHA daily from high-quality fish oil. Supports cardiovascular health, reduces inflammation, and benefits brain function. One of the most evidence-backed supplements.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "foundational",
    frequency: "Daily",
  },
  {
    id: "supplement-002",
    name: "Vitamin D3 (5,000 IU)",
    description:
      "5,000 IU daily, targeting blood levels of 40-60 ng/mL. Essential for immune function, bone health, and hormone production. Most people are deficient.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "foundational",
    frequency: "Daily",
  },
  {
    id: "supplement-003",
    name: "Magnesium (Multiple Forms)",
    description:
      "L-Threonate for sleep/cognition plus Bisglycinate for general levels. Most people are deficient. Supports 300+ enzymatic reactions in the body.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "foundational",
    frequency: "Daily",
  },
  {
    id: "supplement-004",
    name: "Creatine Monohydrate (5g/day)",
    description:
      "5g daily, every day including rest days. Supports muscle performance and recovery with emerging cognitive benefits. One of the most studied supplements ever.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "performance",
    frequency: "Daily",
  },
  {
    id: "supplement-005",
    name: "Vitamin K2 (with D3)",
    description:
      "Take Vitamin K2 (MK-7 form) alongside D3 to direct calcium to bones rather than arteries. Important synergy when taking higher doses of D3.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "foundational",
    frequency: "Daily",
  },
  {
    id: "supplement-006",
    name: "Tongkat Ali (Testosterone Support)",
    description:
      "400mg daily to support free testosterone levels by reducing SHBG binding. Research supports modest increases in free testosterone.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "hormonal",
    frequency: "Daily",
  },
  {
    id: "supplement-007",
    name: "Alpha-GPC (Cognitive Focus)",
    description:
      "300-600mg before workouts or cognitively demanding tasks. Increases acetylcholine for focus, memory, and mind-muscle connection during training.",
    recommendedBy: ["Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "cognitive",
    frequency: "As needed",
  },
  {
    id: "supplement-008",
    name: "AG1 / Greens Powder",
    description:
      "Daily greens powder as nutritional insurance covering vitamins, minerals, probiotics, and adaptogens. A convenient baseline, not a replacement for whole foods.",
    recommendedBy: ["Attia", "Huberman"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "foundational",
    frequency: "Daily",
  },
  {
    id: "supplement-009",
    name: "NMN or NR (NAD+ Precursor)",
    description:
      "500mg NMN or NR daily to support NAD+ levels which decline with age. Critical for cellular energy metabolism and DNA repair.",
    recommendedBy: ["Huberman"],
    difficulty: "moderate",
    category: "supplements",
    subcategory: "longevity",
    frequency: "Daily",
  },
  {
    id: "supplement-010",
    name: "Methylfolate + Methyl B12",
    description:
      "400mcg methylfolate and 500mcg methyl-B12 daily to keep homocysteine low. Elevated homocysteine is a risk marker for cardiovascular disease and dementia.",
    recommendedBy: ["Attia"],
    difficulty: "easy",
    category: "supplements",
    subcategory: "cardiovascular",
    frequency: "Daily",
  },
];

export const categoryInfo: Record<
  string,
  { label: string; icon: string; color: string; description: string }
> = {
  sleep: {
    label: "Sleep",
    icon: "🌙",
    color: "#6366f1",
    description: "Optimize your sleep quality and circadian rhythm",
  },
  exercise: {
    label: "Exercise",
    icon: "💪",
    color: "#ef4444",
    description: "Build strength, endurance, and functional fitness",
  },
  diet: {
    label: "Diet",
    icon: "🥗",
    color: "#22c55e",
    description: "Fuel your body with evidence-based nutrition",
  },
  supplements: {
    label: "Supplements",
    icon: "💊",
    color: "#f59e0b",
    description: "Fill nutritional gaps with targeted supplementation",
  },
};
