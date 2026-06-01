/**
 * quicklog.ts — a small, dependency-free natural-language parser for the
 * daily check-in. Turns "slept 7h, energy low, felt great" into structured
 * sleep / energy / mood values. Heuristic by design (no external API): it
 * only fills what it's confident about and preserves the full text as the
 * day note, so nothing the user typed is lost. It deliberately does NOT
 * auto-complete behaviors — matching free text to specific habits is too
 * ambiguous to do safely, so "skipped workout" just stays in the note.
 */

export interface QuickLogParse {
  /** 1–5, if an energy phrase was recognized. */
  energy?: number;
  /** 1–5, if a mood phrase was recognized. */
  mood?: number;
  /** 1–5, if a sleep-quality phrase was recognized. */
  sleepQuality?: number;
  /** Hours, if a duration like "7h" / "slept 7.5 hours" was found. */
  sleepHours?: number;
  /** The full input, kept verbatim as the day note (lossless). */
  note: string;
  /** Human-readable summary of what was understood (for a confirm toast). */
  understood: string[];
}

const LOW = 2;
const MID = 3;
const HIGH = 5;

function firstMatch(text: string, res: [RegExp, number][]): number | undefined {
  for (const [re, val] of res) if (re.test(text)) return val;
  return undefined;
}

export function parseQuickLog(input: string): QuickLogParse {
  const note = input.trim();
  const t = ` ${note.toLowerCase()} `;
  const understood: string[] = [];

  // ── Sleep duration: "7h", "7.5 hrs", "slept 8 hours" ──
  let sleepHours: number | undefined;
  const dur =
    t.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours)\b/) ??
    t.match(/slept\s+(\d+(?:\.\d+)?)\b/);
  if (dur) {
    const h = parseFloat(dur[1]);
    if (h > 0 && h <= 16) {
      sleepHours = h;
      understood.push(`Sleep: ${h}h`);
    }
  }

  // ── Sleep quality words ──
  const sleepQuality = firstMatch(t, [
    [/slept (?:great|amazing|wonderfully|really well)/, HIGH],
    [/slept (?:well|good|fine|ok|okay)/, 4],
    [/slept (?:poorly|badly|terribly|rough|awful)|bad sleep|rough night|barely slept|couldn'?t sleep/, LOW],
  ]);
  if (sleepQuality != null)
    understood.push(`Sleep quality: ${sleepQuality >= 4 ? "good" : "poor"}`);

  // ── Energy ──
  const energy = firstMatch(t, [
    [/energy (?:is )?(?:high|great|strong|amazing)|energized|lots of energy|high energy/, HIGH],
    [/energy (?:is )?(?:ok|okay|fine|steady|moderate|alright|decent)/, MID],
    [/energy (?:is )?(?:low|down|drained|flat)|exhausted|drained|wiped|so tired|really tired|no energy|low energy/, LOW],
    [/\btired\b|\bsluggish\b/, LOW],
  ]);
  if (energy != null)
    understood.push(`Energy: ${energy >= 5 ? "high" : energy <= 2 ? "low" : "steady"}`);

  // ── Mood ──
  const mood = firstMatch(t, [
    [/mood (?:is )?(?:great|good|happy|amazing)|feeling great|feeling good|felt great|felt good|happy|content|calm and|in a good mood/, HIGH],
    [/mood (?:is )?(?:ok|okay|fine|neutral|steady)|felt (?:ok|okay|fine)/, MID],
    [/mood (?:is )?(?:low|down|bad|sad|off)|felt (?:bad|low|off|down|terrible)|stressed|anxious|low mood|feeling down|irritable|frustrated/, LOW],
  ]);
  if (mood != null)
    understood.push(`Mood: ${mood >= 5 ? "good" : mood <= 2 ? "low" : "okay"}`);

  return { energy, mood, sleepQuality, sleepHours, note, understood };
}
