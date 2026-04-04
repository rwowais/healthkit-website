import { QuizQuestion } from "./types";

export const quizQuestions: QuizQuestion[] = [
  {
    id: "goal",
    question: "What's your primary goal?",
    options: [
      { value: "fat-loss", label: "Lose fat", description: "Reduce body fat while maintaining muscle" },
      { value: "muscle", label: "Build muscle", description: "Gain strength and lean mass" },
      { value: "energy", label: "More energy", description: "Feel more energized throughout the day" },
      { value: "longevity", label: "Live longer", description: "Optimize health for the long term" },
      { value: "metabolic", label: "Fix my metabolism", description: "I feel stuck — crashes, cravings, plateaus" },
    ],
  },
  {
    id: "experience",
    question: "How would you describe your fitness level?",
    options: [
      { value: "beginner", label: "Beginner", description: "New to structured exercise" },
      { value: "intermediate", label: "Intermediate", description: "I work out regularly but want better results" },
      { value: "advanced", label: "Advanced", description: "I train consistently and know my way around a gym" },
    ],
  },
  {
    id: "sleep-quality",
    question: "How's your sleep?",
    options: [
      { value: "poor", label: "Poor", description: "I struggle to fall asleep or wake up tired" },
      { value: "okay", label: "Okay", description: "It's decent but could be better" },
      { value: "good", label: "Good", description: "I sleep well most nights" },
    ],
  },
  {
    id: "energy-pattern",
    question: "How's your energy throughout the day?",
    options: [
      { value: "crashes", label: "I crash after meals", description: "Tired after eating, especially carbs" },
      { value: "afternoon-dip", label: "Afternoon dip", description: "Energy drops around 2-3 PM" },
      { value: "steady", label: "Pretty steady", description: "Consistent energy most of the day" },
    ],
  },
  {
    id: "metabolic-signs",
    question: "Do any of these apply to you?",
    options: [
      { value: "cravings", label: "Sugar cravings", description: "I crave sweets or feel hungry often" },
      { value: "bloating", label: "Bloating after carbs", description: "I get bloated or puffy after eating" },
      { value: "cant-fast", label: "Can't skip meals", description: "I feel weak or shaky if I don't eat for a few hours" },
      { value: "none", label: "None of these", description: "I feel fine metabolically" },
    ],
  },
  {
    id: "diet-style",
    question: "How do you eat currently?",
    options: [
      { value: "no-structure", label: "No real structure", description: "I eat whatever, whenever" },
      { value: "some-structure", label: "Some structure", description: "I try to eat healthy but inconsistently" },
      { value: "dialed-in", label: "Pretty dialed in", description: "I track macros or follow a clear plan" },
    ],
  },
  {
    id: "time-available",
    question: "How much time can you dedicate daily?",
    options: [
      { value: "30min", label: "30 minutes", description: "I'm busy — give me the essentials" },
      { value: "60min", label: "About an hour", description: "I can commit to a solid daily routine" },
      { value: "90min+", label: "90+ minutes", description: "I'm all in — give me everything" },
    ],
  },
];

export function getRecommendation(answers: Record<string, string>): {
  programId: string;
  reason: string;
} {
  const hasMetabolicIssues =
    answers["metabolic-signs"] !== "none" ||
    answers["energy-pattern"] === "crashes" ||
    answers["goal"] === "metabolic";

  if (hasMetabolicIssues) {
    return {
      programId: "metabolic-reset",
      reason:
        "Based on your answers, you may benefit from resetting your metabolism first. This will optimize your insulin sensitivity and energy levels before starting a training program.",
    };
  }

  return {
    programId: "body-recomp",
    reason:
      "Your metabolic health looks good. A structured strength program with progressive overload will help you build muscle, lose fat, and improve your overall fitness.",
  };
}
