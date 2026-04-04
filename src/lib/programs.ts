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
    tagline: "Build lean muscle while losing fat",
    description:
      "Build lean muscle while losing fat through progressive overload and strategic nutrition. A 5-week periodized program moving from full-body foundation work to upper/lower splits and finishing with high-volume push/pull/legs.",
    duration: "5 weeks",
    weeks: 5,
    difficulty: "moderate",
    categories: ["exercise", "diet"],
    tier: "premium",
    phases: [
      {
        name: "Phase 1: Foundation",
        description:
          "Full body workouts 3x/week at 70% 1RM, 3 sets of 8-10 reps. Focus on compound lifts to build movement patterns and work capacity. Moderate calorie deficit with high protein (1g/lb bodyweight).",
        weekStart: 1,
        weekEnd: 2,
        dailyPlan: [
          {
            day: "Monday",
            focus: "Full Body A",
            workouts: [
              {
                name: "Full Body A — Compound Focus",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  {
                    name: "Barbell Back Squat",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                    notes: "Warm up with 2 sets at 50% and 60%",
                  },
                  {
                    name: "Barbell Bench Press",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Barbell Bent-Over Row",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Dumbbell Lateral Raises",
                    sets: 3,
                    reps: "10-12",
                    rest: "60s",
                  },
                  {
                    name: "Plank Hold",
                    sets: 3,
                    reps: "30-45s",
                    rest: "60s",
                  },
                ],
                notes:
                  "Focus on controlled tempo: 2s eccentric, 1s pause, 1s concentric.",
              },
            ],
            nutrition: {
              calories: "Moderate deficit (~300-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "40% of calories, prioritize around training",
              fats: "Remainder of calories, minimum 0.3g/lb",
              timing:
                "Pre-workout meal 2hrs before: protein + carbs. Post-workout within 1hr: protein + carbs.",
              notes: "Track intake for the first week to establish baseline.",
            },
          },
          {
            day: "Tuesday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-40 min",
                exercises: [
                  {
                    name: "Zone 2 Walk or Light Cycle",
                    sets: 1,
                    reps: "25-30 min",
                    notes: "Nasal breathing, conversational pace",
                  },
                  {
                    name: "Full Body Stretching",
                    sets: 1,
                    reps: "10 min",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "Moderate deficit (~300-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "Lower carbs on rest days (~30% of calories)",
              fats: "Slightly higher fat on rest days",
              notes: "Focus on whole foods: lean meats, vegetables, healthy fats.",
            },
          },
          {
            day: "Wednesday",
            focus: "Full Body B",
            workouts: [
              {
                name: "Full Body B — Compound Focus",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  {
                    name: "Conventional Deadlift",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                    notes: "Warm up with 2 sets at 50% and 60%",
                  },
                  {
                    name: "Overhead Press (Barbell or Dumbbell)",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Pull-ups or Lat Pulldown",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Dumbbell Lunges",
                    sets: 3,
                    reps: "8-10 each leg",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Hanging Knee Raises",
                    sets: 3,
                    reps: "10-12",
                    rest: "60s",
                  },
                ],
                notes:
                  "Same controlled tempo as Monday. Increase weight by 2.5-5 lbs if all reps completed with good form.",
              },
            ],
            nutrition: {
              calories: "Moderate deficit (~300-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "40% of calories, prioritize around training",
              fats: "Remainder of calories",
              timing:
                "Pre-workout meal 2hrs before. Post-workout shake or meal within 1hr.",
            },
          },
          {
            day: "Thursday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-40 min",
                exercises: [
                  {
                    name: "Zone 2 Walk or Light Cycle",
                    sets: 1,
                    reps: "25-30 min",
                  },
                  {
                    name: "Foam Rolling + Mobility",
                    sets: 1,
                    reps: "10 min",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "Moderate deficit",
              protein: "1g per lb bodyweight",
              carbs: "Lower carbs (~30% of calories)",
              fats: "Slightly higher fat",
            },
          },
          {
            day: "Friday",
            focus: "Full Body C",
            workouts: [
              {
                name: "Full Body C — Compound Focus",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  {
                    name: "Front Squat or Goblet Squat",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Incline Dumbbell Press",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Cable or Dumbbell Row",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Romanian Deadlift",
                    sets: 3,
                    reps: "8-10",
                    intensity: "70% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Face Pulls",
                    sets: 3,
                    reps: "12-15",
                    rest: "60s",
                    notes: "Rear delt and rotator cuff health",
                  },
                ],
                notes:
                  "Vary the movement patterns from Mon/Wed to prevent overuse.",
              },
            ],
            nutrition: {
              calories: "Moderate deficit (~300-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "40% of calories, prioritize around training",
              fats: "Remainder of calories",
              timing: "Pre-workout meal 2hrs before. Post-workout within 1hr.",
            },
          },
          {
            day: "Saturday",
            focus: "Zone 2 Cardio",
            workouts: [
              {
                name: "Zone 2 Cardio",
                type: "cardio",
                duration: "30-45 min",
                exercises: [
                  {
                    name: "Run, Cycle, Swim, or Ruck",
                    sets: 1,
                    reps: "30-45 min",
                    notes:
                      "Heart rate 120-150 bpm. Should be able to hold a conversation.",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "Moderate deficit",
              protein: "1g per lb bodyweight",
              carbs: "Lower carbs (~30% of calories)",
              fats: "Slightly higher fat",
            },
          },
          {
            day: "Sunday",
            focus: "Full Rest",
            nutrition: {
              calories: "Moderate deficit",
              protein: "1g per lb bodyweight",
              carbs: "Lowest carb day (~25% of calories)",
              fats: "Higher fat for satiety",
              notes:
                "Meal prep for the week. Sleep 7-9 hours for recovery.",
            },
          },
        ],
      },
      {
        name: "Phase 2: Intensification",
        description:
          "Upper/Lower split 4x/week at 80-85% 1RM, 4 sets of 6-8 reps. Progressive overload with heavier loads. Slight calorie increase on training days, deficit on rest days (calorie cycling).",
        weekStart: 3,
        weekEnd: 4,
        dailyPlan: [
          {
            day: "Monday",
            focus: "Upper Body A",
            workouts: [
              {
                name: "Upper Body A — Heavy Compounds",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Barbell Bench Press",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                    notes: "Warm up with 2 sets at 60% and 70%",
                  },
                  {
                    name: "Barbell Bent-Over Row",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Overhead Press",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Weighted Pull-ups or Lat Pulldown",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Barbell Curl",
                    sets: 3,
                    reps: "8-10",
                    rest: "60s",
                  },
                  {
                    name: "Tricep Dips or Pushdowns",
                    sets: 3,
                    reps: "8-10",
                    rest: "60s",
                  },
                ],
                notes:
                  "Aim to add 2.5-5 lbs to each compound lift from Phase 1. Track all weights in your log.",
              },
            ],
            nutrition: {
              calories: "At maintenance or slight surplus (+200 kcal) on training days",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories, majority around training window",
              fats: "25% of calories",
              timing:
                "Larger pre- and post-workout meals. Carbs concentrated around training.",
            },
          },
          {
            day: "Tuesday",
            focus: "Lower Body A",
            workouts: [
              {
                name: "Lower Body A — Heavy Compounds",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Barbell Back Squat",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                    notes: "Warm up with 2 sets at 60% and 70%",
                  },
                  {
                    name: "Romanian Deadlift",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Bulgarian Split Squat",
                    sets: 4,
                    reps: "6-8 each leg",
                    intensity: "80% 1RM",
                    rest: "2 min",
                  },
                  {
                    name: "Calf Raises (Standing)",
                    sets: 4,
                    reps: "10-12",
                    rest: "60s",
                  },
                  {
                    name: "Hanging Leg Raises",
                    sets: 3,
                    reps: "10-12",
                    rest: "60s",
                  },
                ],
                notes:
                  "Controlled eccentric on all movements. 3s down, 1s pause at bottom.",
              },
            ],
            nutrition: {
              calories: "At maintenance or slight surplus (+200 kcal) on training days",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "25% of calories",
              timing:
                "Post-workout: fast-digesting carbs + protein within 45 min.",
            },
          },
          {
            day: "Wednesday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-40 min",
                exercises: [
                  {
                    name: "Zone 2 Walk or Light Cycle",
                    sets: 1,
                    reps: "20-30 min",
                    notes: "Nasal breathing, easy pace",
                  },
                  {
                    name: "Hip and Shoulder Mobility Work",
                    sets: 1,
                    reps: "10-15 min",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "Deficit (~400-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "Lower carbs (~25% of calories)",
              fats: "Higher fat for satiety (~40% of calories)",
              notes: "Calorie cycling: deficit on rest days preserves the weekly deficit.",
            },
          },
          {
            day: "Thursday",
            focus: "Upper Body B",
            workouts: [
              {
                name: "Upper Body B — Variation Compounds",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Incline Barbell or Dumbbell Press",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Chest-Supported Row or Seal Row",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Dumbbell Arnold Press",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80% 1RM",
                    rest: "2-3 min",
                  },
                  {
                    name: "Close-Grip Lat Pulldown",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Face Pulls",
                    sets: 3,
                    reps: "12-15",
                    rest: "60s",
                  },
                  {
                    name: "Hammer Curls",
                    sets: 3,
                    reps: "8-10",
                    rest: "60s",
                  },
                ],
                notes:
                  "Different movement angles from Upper A for balanced development.",
              },
            ],
            nutrition: {
              calories: "At maintenance or slight surplus (+200 kcal)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "25% of calories",
              timing: "Pre-workout meal 2hrs before. Post-workout within 1hr.",
            },
          },
          {
            day: "Friday",
            focus: "Lower Body B",
            workouts: [
              {
                name: "Lower Body B — Variation Compounds",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Conventional Deadlift",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80-85% 1RM",
                    rest: "3 min",
                    notes: "Warm up with 2 sets at 60% and 70%",
                  },
                  {
                    name: "Front Squat",
                    sets: 4,
                    reps: "6-8",
                    intensity: "80% 1RM",
                    rest: "3 min",
                  },
                  {
                    name: "Walking Lunges (Dumbbell)",
                    sets: 4,
                    reps: "8 each leg",
                    intensity: "80% 1RM",
                    rest: "2 min",
                  },
                  {
                    name: "Seated Calf Raises",
                    sets: 4,
                    reps: "12-15",
                    rest: "60s",
                  },
                  {
                    name: "Ab Wheel Rollout or Cable Crunch",
                    sets: 3,
                    reps: "10-12",
                    rest: "60s",
                  },
                ],
                notes:
                  "Different movement patterns from Lower A. Progressive overload: add weight when all reps are clean.",
              },
            ],
            nutrition: {
              calories: "At maintenance or slight surplus (+200 kcal)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "25% of calories",
              timing: "Largest meal post-workout.",
            },
          },
          {
            day: "Saturday",
            focus: "Zone 2 Cardio or HIIT",
            workouts: [
              {
                name: "Conditioning",
                type: "cardio",
                duration: "30-40 min",
                exercises: [
                  {
                    name: "Zone 2 Cardio (Run, Cycle, Row)",
                    sets: 1,
                    reps: "30-40 min",
                    notes:
                      "Or 20 min HIIT: 30s sprint / 90s recovery x 8 rounds.",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "Deficit (~400-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "Lower carbs (~25% of calories)",
              fats: "Higher fat (~40% of calories)",
            },
          },
          {
            day: "Sunday",
            focus: "Full Rest",
            nutrition: {
              calories: "Deficit (~400-500 kcal below TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "Lowest carb day",
              fats: "Higher fat for satiety",
              notes:
                "Meal prep for the week. Prioritize sleep (7-9 hrs) for recovery and hormone optimization.",
            },
          },
        ],
      },
      {
        name: "Phase 3: Volume",
        description:
          "Push/Pull/Legs split at 70% 1RM taken to failure with higher volume. Maximize metabolic stress and muscle growth. Maintenance calories with high protein.",
        weekStart: 5,
        weekEnd: 5,
        dailyPlan: [
          {
            day: "Monday",
            focus: "Push (Chest, Shoulders, Triceps)",
            workouts: [
              {
                name: "Push Day — High Volume",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Barbell Bench Press",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Incline Dumbbell Press",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Overhead Press",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Cable Flyes or Pec Deck",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Lateral Raises",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Tricep Pushdowns",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                ],
                notes:
                  "Take every working set to within 1-2 reps of failure. Use drop sets on the last set of each exercise.",
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "Remainder",
              timing:
                "Even meal distribution across the day. 4-5 meals. High-carb around training.",
              notes:
                "Maintenance calories this week to fuel the high volume and support recovery.",
            },
          },
          {
            day: "Tuesday",
            focus: "Pull (Back, Biceps, Rear Delts)",
            workouts: [
              {
                name: "Pull Day — High Volume",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Conventional Deadlift",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "2 min",
                  },
                  {
                    name: "Pull-ups or Lat Pulldown",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Seated Cable Row",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Face Pulls",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Barbell Curl",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Hammer Curls",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                ],
                notes:
                  "Focus on the squeeze at peak contraction. Use controlled negatives.",
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "Remainder",
              timing: "Pre-workout: protein + carbs. Post-workout: protein + carbs.",
            },
          },
          {
            day: "Wednesday",
            focus: "Legs (Quads, Hamstrings, Glutes, Calves)",
            workouts: [
              {
                name: "Leg Day — High Volume",
                type: "strength",
                duration: "55-65 min",
                exercises: [
                  {
                    name: "Barbell Back Squat",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "2 min",
                  },
                  {
                    name: "Romanian Deadlift",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Leg Press or Bulgarian Split Squat",
                    sets: 4,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Leg Curl (Seated or Lying)",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Standing Calf Raises",
                    sets: 4,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Hanging Leg Raises",
                    sets: 3,
                    reps: "12-15",
                    rest: "60s",
                  },
                ],
                notes:
                  "High volume week. Push close to failure but maintain form. Rest-pause on the last set if needed.",
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories, extra carbs post-workout",
              fats: "Remainder",
              timing: "Largest carb meal post-workout for glycogen replenishment.",
            },
          },
          {
            day: "Thursday",
            focus: "Active Recovery",
            workouts: [
              {
                name: "Active Recovery",
                type: "recovery",
                duration: "30-40 min",
                exercises: [
                  {
                    name: "Zone 2 Walk",
                    sets: 1,
                    reps: "20-30 min",
                    notes: "Easy pace, nasal breathing",
                  },
                  {
                    name: "Full Body Stretching and Foam Rolling",
                    sets: 1,
                    reps: "10-15 min",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "35% of calories",
              fats: "Higher fat for recovery",
              notes: "Prioritize sleep and hydration. Consider Epsom salt bath.",
            },
          },
          {
            day: "Friday",
            focus: "Push/Pull Combo (Upper Volume)",
            workouts: [
              {
                name: "Upper Body Volume Finisher",
                type: "strength",
                duration: "50-60 min",
                exercises: [
                  {
                    name: "Dumbbell Bench Press",
                    sets: 3,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Dumbbell Row",
                    sets: 3,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Dumbbell Shoulder Press",
                    sets: 3,
                    reps: "12-15 to failure",
                    intensity: "70% 1RM",
                    rest: "90s",
                  },
                  {
                    name: "Cable Crossover",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Straight-Arm Pulldown",
                    sets: 3,
                    reps: "15-20 to failure",
                    rest: "60s",
                  },
                  {
                    name: "Dumbbell Curl + Overhead Tricep Extension Superset",
                    sets: 3,
                    reps: "12-15 to failure",
                    rest: "60s",
                    notes: "Superset: curl immediately into tricep extension",
                  },
                ],
                notes:
                  "Final upper session of the program. Leave nothing in the tank.",
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "45% of calories",
              fats: "Remainder",
              timing: "Even distribution. High-carb around training.",
            },
          },
          {
            day: "Saturday",
            focus: "Zone 2 Cardio",
            workouts: [
              {
                name: "Zone 2 Cardio",
                type: "cardio",
                duration: "30-45 min",
                exercises: [
                  {
                    name: "Run, Cycle, Swim, or Ruck",
                    sets: 1,
                    reps: "30-45 min",
                    notes:
                      "Heart rate 120-150 bpm. Low-impact option if legs are sore from Wednesday.",
                  },
                ],
              },
            ],
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              carbs: "35% of calories",
              fats: "Remainder",
            },
          },
          {
            day: "Sunday",
            focus: "Full Rest",
            nutrition: {
              calories: "At maintenance (TDEE)",
              protein: "1g per lb bodyweight",
              notes:
                "Program complete. Re-test your lifts next week to measure strength gains. Take progress photos and compare to week 1.",
            },
          },
        ],
      },
    ],
  },
];
