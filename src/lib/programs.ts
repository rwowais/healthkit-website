import { Program } from "./types";

export const programs: Program[] = [
  {
    id: "metabolic-reset",
    name: "Metabolic Reset",
    tagline: "Reset your metabolism in 3 phases",
    description:
      "A structured protocol to identify metabolic issues, reset insulin sensitivity, and restore optimal metabolic function through carb backloading, circadian alignment, and targeted supplementation.",
    duration: "4-6 weeks",
    weeks: 6,
    difficulty: "moderate",
    categories: ["diet", "sleep", "supplements"],
    tier: "premium",
    phases: [
      {
        name: "Phase 1: Identify",
        description:
          "Test your insulin sensitivity and identify metabolic weak points through carbohydrate challenges and self-assessment.",
        weekStart: 1,
        weekEnd: 1,
        dailyPlan: [
          {
            day: "Day 1-2",
            focus: "Carbohydrate Challenge Test",
            protocols: ["diet-005", "sleep-009"],
            nutrition: {
              timing:
                "Eat 70-100g carbs in a fasted state (8-12 AM). Note energy and blood sugar response over 3 hours.",
              notes:
                "Use bananas, blueberries, or potatoes. Different source each day.",
            },
          },
          {
            day: "Day 3-7",
            focus: "Baseline Habits",
            protocols: ["sleep-001", "sleep-003", "diet-003"],
            nutrition: {
              protein: "25% of calories (1.4-1.6 g/kg/day)",
              carbs: "40% of calories",
              fats: "35% of calories",
              fiber: "30-45g/day",
              timing: "2 meals + 1 snack. First meal before 12 PM, last before 7 PM.",
            },
          },
        ],
      },
      {
        name: "Phase 2: Reset",
        description:
          "Implement carb backloading, circadian rhythm alignment, exercise protocols, and targeted supplements to reverse insulin resistance.",
        weekStart: 2,
        weekEnd: 4,
        dailyPlan: [
          {
            day: "Monday",
            focus: "Upper Body + Low-Carb Day",
            workouts: [
              {
                name: "Upper Body Strength",
                type: "strength",
                duration: "45-60 min",
                exercises: [
                  {
                    name: "Vertical Push (OHP / DB Press)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Vertical Pull (Pull-ups / Lat Pulldown)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Horizontal Push (Bench / Push-ups)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Horizontal Pull (Row / Ring Row)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Accessory Work (Lateral Raises, Curls)",
                    sets: 3,
                    reps: "8-12",
                    rest: "60s",
                    notes: "Optional",
                  },
                ],
                notes:
                  "Reverse pyramid: warm up to working weight, then maintain. Cooldown set at 50% for max reps.",
              },
            ],
            nutrition: {
              calories: "Maintenance or slight deficit",
              protein: "25% of calories",
              carbs: "Low-carb breakfast (20-30g), carbs at dinner (100-200g)",
              fats: "35% of calories, higher in first meal",
              timing:
                "First meal: eggs, veggies, healthy fats. Dinner: lean protein, rice/potatoes, low fat.",
            },
            protocols: ["sleep-001", "sleep-005", "sleep-006"],
          },
          {
            day: "Tuesday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-45 min",
                exercises: [
                  {
                    name: "Long Walk",
                    sets: 1,
                    reps: "30-45 min",
                    notes: "Zone 2 pace, nasal breathing",
                  },
                  {
                    name: "Stretching & Mobility",
                    sets: 1,
                    reps: "10-15 min",
                  },
                ],
                notes: "Optional: Sauna 20 min at 70-80°C",
              },
            ],
            nutrition: {
              calories: "Maintenance",
              carbs: "Moderate — keep over 50g even on rest days",
              timing: "Same meal timing as training days",
            },
          },
          {
            day: "Wednesday",
            focus: "Lower Body + Carb Backload",
            workouts: [
              {
                name: "Lower Body Strength",
                type: "strength",
                duration: "45-60 min",
                exercises: [
                  {
                    name: "Squat (Barbell / Goblet / Pistol)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Horizontal Lower (Lunges / Split Squat)",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                    rest: "1-3 min",
                  },
                  {
                    name: "Calf Raises",
                    sets: 3,
                    reps: "Max reps",
                    rest: "60s",
                  },
                  {
                    name: "Hanging Knee Raises",
                    sets: 2,
                    reps: "80% of max",
                    rest: "60s",
                  },
                ],
                notes: "Same reverse pyramid structure as Monday.",
              },
            ],
            nutrition: {
              calories: "Maintenance or slight surplus on training days",
              carbs:
                "Low-carb breakfast, higher carb dinner (150-300g depending on body weight)",
              timing:
                "Post-workout dinner: potatoes, rice, fruit + lean protein.",
            },
          },
          {
            day: "Thursday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-45 min",
                exercises: [
                  { name: "Long Walk", sets: 1, reps: "30-45 min" },
                  { name: "Mobility Work", sets: 1, reps: "10 min" },
                ],
              },
            ],
          },
          {
            day: "Friday",
            focus: "Upper Body + Sprint Intervals",
            workouts: [
              {
                name: "Upper Body Strength",
                type: "strength",
                duration: "45 min",
                exercises: [
                  {
                    name: "Vertical Push",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                  },
                  {
                    name: "Vertical Pull",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                  },
                  {
                    name: "Horizontal Push",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                  },
                  {
                    name: "Horizontal Pull",
                    sets: 3,
                    reps: "8-12",
                    intensity: "70% 1RM",
                  },
                ],
              },
            ],
            nutrition: {
              carbs: "Higher carbs at dinner to refuel for the weekend",
            },
          },
          {
            day: "Saturday",
            focus: "Zone 2 Cardio or At-Home Circuit",
            workouts: [
              {
                name: "Zone 2 Cardio or Circuit",
                type: "cardio",
                duration: "30-45 min",
                exercises: [
                  {
                    name: "Zone 2 Run / Cycle / Walk",
                    sets: 1,
                    reps: "30-45 min",
                    notes:
                      "OR pick a circuit from the Workout Vault: Power 30, Tabata, etc.",
                  },
                ],
              },
            ],
          },
          {
            day: "Sunday",
            focus: "Full Rest",
            protocols: ["sleep-001", "sleep-003"],
          },
        ],
      },
      {
        name: "Phase 3: Progress Check",
        description:
          "Re-test insulin sensitivity and adjust the protocol based on results. Increase carbs if improved, maintain if not.",
        weekStart: 5,
        weekEnd: 6,
        dailyPlan: [
          {
            day: "Day 1-2",
            focus: "Re-test Carbohydrate Challenge",
            nutrition: {
              timing:
                "Repeat the Phase 1 carb challenge. Compare blood sugar response to baseline.",
              notes:
                "If improved: increase evening carbs by 20-30%. If same: continue Phase 2 for 2 more weeks.",
            },
          },
          {
            day: "Day 3-7",
            focus: "Adjusted Protocol",
            nutrition: {
              notes:
                "Adjust carbohydrate intake in the backloading window based on your test results.",
            },
          },
        ],
      },
    ],
  },
  {
    id: "body-recomp",
    name: "Body Recomposition",
    tagline: "Build muscle, lose fat, gain strength",
    description:
      "A progressive 5-week strength program with periodized intensity, structured nutrition, and recovery protocols for optimal body composition.",
    duration: "5 weeks",
    weeks: 5,
    difficulty: "moderate",
    categories: ["exercise", "diet"],
    tier: "premium",
    phases: [
      {
        name: "Weeks 1-2: Foundation",
        description:
          "Moderate intensity (70% 1RM), 8-12 reps per set. Build movement patterns and work capacity.",
        weekStart: 1,
        weekEnd: 2,
        dailyPlan: [
          {
            day: "Mon / Fri",
            focus: "Upper Body",
            workouts: [
              {
                name: "Upper Body — Moderate Intensity",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  { name: "Vertical Push", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Vertical Pull", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Horizontal Push", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Horizontal Pull", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Accessory (Lateral Raises, Curls)", sets: 3, reps: "8-12", notes: "Optional" },
                ],
                notes: "Reverse pyramid structure. Cooldown set at 50% for AMRAP.",
              },
            ],
          },
          {
            day: "Wed",
            focus: "Lower Body",
            workouts: [
              {
                name: "Lower Body — Moderate Intensity",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  { name: "Squat Movement", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Horizontal Lower (Lunges)", sets: 3, reps: "8-12", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Calf Raises", sets: 3, reps: "Max", rest: "60s" },
                  { name: "Core (Hanging Knee Raises, V-ups)", sets: 2, reps: "80% max", rest: "60s" },
                ],
              },
            ],
          },
          { day: "Tue / Thu", focus: "Active Recovery (Walk + Mobility)" },
          { day: "Sat", focus: "Zone 2 Cardio or Home Circuit (30-45 min)" },
          { day: "Sun", focus: "Full Rest" },
        ],
      },
      {
        name: "Weeks 3-4: Intensification",
        description:
          "Higher intensity (80-85% 1RM), 3-5 reps, 5 working sets. Build maximum strength.",
        weekStart: 3,
        weekEnd: 4,
        dailyPlan: [
          {
            day: "Mon / Fri",
            focus: "Upper Body — Heavy",
            workouts: [
              {
                name: "Upper Body — High Intensity",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  { name: "Vertical Push", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                  { name: "Vertical Pull", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                  { name: "Horizontal Push", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                  { name: "Horizontal Pull", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                ],
                notes: "Longer rest. Focus on perfect form. Cooldown at 50% for AMRAP.",
              },
            ],
          },
          {
            day: "Wed",
            focus: "Lower Body — Heavy",
            workouts: [
              {
                name: "Lower Body — High Intensity",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  { name: "Squat Movement", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                  { name: "Horizontal Lower", sets: 5, reps: "3-5", intensity: "80-85% 1RM", rest: "3-5 min" },
                  { name: "Calf Raises", sets: 3, reps: "Max", rest: "60s" },
                  { name: "Core", sets: 2, reps: "80% max" },
                ],
              },
            ],
          },
          { day: "Tue / Thu", focus: "Active Recovery" },
          { day: "Sat", focus: "Sprint Intervals or Home Circuit" },
          { day: "Sun", focus: "Full Rest" },
        ],
      },
      {
        name: "Week 5: Volume",
        description:
          "High volume (70% 1RM), 12-15 reps to failure. Metabolic stress for muscle growth.",
        weekStart: 5,
        weekEnd: 5,
        dailyPlan: [
          {
            day: "Mon / Fri",
            focus: "Upper Body — Volume",
            workouts: [
              {
                name: "Upper Body — High Volume",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  { name: "Vertical Push", sets: 2, reps: "12-15 to failure", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Vertical Pull", sets: 2, reps: "12-15 to failure", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Horizontal Push", sets: 2, reps: "12-15 to failure", intensity: "70% 1RM", rest: "1-3 min" },
                  { name: "Horizontal Pull", sets: 2, reps: "12-15 to failure", intensity: "70% 1RM", rest: "1-3 min" },
                ],
              },
            ],
          },
          { day: "Wed", focus: "Lower Body — Volume (same pattern)" },
          { day: "Tue / Thu", focus: "Active Recovery" },
          { day: "Sat", focus: "Zone 2 Cardio" },
          { day: "Sun", focus: "Full Rest" },
        ],
      },
    ],
  },
];
