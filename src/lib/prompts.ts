/**
 * prompts.ts — gentle, rotating reflection prompts for the daily journal.
 * A blank box is intimidating; a calm question lowers the barrier to
 * reflecting. Deterministic rotation by calendar day so the prompt is stable
 * within a day and varies across days (same on every device, no storage).
 */
const REFLECTION_PROMPTS = [
  "What gave you energy today?",
  "What's one small thing that went well?",
  "What drained you — and could you do a little less of it?",
  "What are you grateful for right now?",
  "What would make tomorrow 1% better?",
  "When did you feel most like yourself today?",
  "What did your body need today — and did you give it that?",
  "What's one thing you're proud of, however small?",
  "What's on your mind as the day winds down?",
  "What would you tell a friend who had your exact day?",
  "What's one thing worth protecting in your routine?",
  "How did you move today — and how did it feel?",
];

/** A stable-per-day reflection prompt for the given YYYY-MM-DD key. */
export function reflectionPrompt(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return REFLECTION_PROMPTS[0];
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const i = ((dayNum % REFLECTION_PROMPTS.length) + REFLECTION_PROMPTS.length) %
    REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[i];
}
