/**
 * Dev-only persona builders — deterministic AppState fixtures for repeatable
 * UX testing across user lifecycles. Pure functions (no I/O); the /dev page
 * applies them to localStorage. NOT shipped to users — the /dev route is gated
 * to development builds.
 */
import type { AppState, DailyLog } from "@/lib/types";
import { getDefaultState } from "@/lib/storage";
import { getTz, dateKeyInTz, addDaysToKey, dayIndexOfKeyInTz } from "@/lib/tz";

export type PersonaKind =
  | "fresh"
  | "engaged"
  | "power"
  | "lapsed"
  | "vacation";

export const PERSONAS: { kind: PersonaKind; label: string; blurb: string }[] = [
  {
    kind: "fresh",
    label: "Fresh · Day 1",
    blurb:
      "Just onboarded, one starter pack, no logs, free trial. Cold-start + empty states.",
  },
  {
    kind: "engaged",
    label: "Engaged · ~3 weeks",
    blurb:
      "18 days of logs, a live streak, weekly goal, free tier. The everyday loop + delayed Insights peek.",
  },
  {
    kind: "power",
    label: "Power user · months",
    blurb:
      "60 days, premium, 3 packs, biomarkers, journal notes. Lights up the full intelligence layer.",
  },
  {
    kind: "lapsed",
    label: "Lapsed · returning",
    blurb:
      "Logged ~3 weeks then a 10-day gap. Re-engagement, broken streak, stale Insights.",
  },
  {
    kind: "vacation",
    label: "On a break",
    blurb:
      "Engaged user with vacation mode on. The calm break screen + streak protection.",
  },
];

const EMPTY_SCORECARD = {
  ateFruitsVeggies: null,
  avoidedProcessedSugar: null,
  customItems: [] as { label: string; answer: string | null }[],
  finishedEatingOnTime: null,
  hitProteinTarget: null,
  minimizedAlcohol: null,
  note: "",
  stayedHydrated: null,
};

type Level = "full" | "light";

function mkLog(date: string, level: Level, note = ""): DailyLog {
  const full = level === "full";
  const bc: Record<string, boolean> = {
    "morning-sunlight": true,
    "hydrate-am": true,
  };
  if (full) {
    bc["protein-breakfast"] = true;
    bc["omega-3"] = true;
    bc["fiber-veg"] = true;
    bc["zone2"] = true;
  }
  const energy = full ? 4 : 3;
  return {
    date,
    sleepCompletions: [{ itemId: "s1", completed: true }],
    exerciseEntries: full
      ? [{ itemId: "e1", completed: true, durationMinutes: 40, intensity: 2, feeling: 4, note: "" }]
      : [],
    nutritionScorecard: {
      ...EMPTY_SCORECARD,
      hitProteinTarget: "yes",
      stayedHydrated: "yes",
      ateFruitsVeggies: full ? "yes" : "mostly",
    },
    supplementEntries: [{ itemId: "sup1", taken: true, skipped: false, skipReason: "" }],
    completions: [],
    sleepLog: {
      actualBedtime: "22:45",
      actualWakeTime: "06:50",
      sleepDurationMinutes: 485,
      sleepQuality: full ? 4 : 3,
    },
    energyLevel: energy,
    moodLevel: energy,
    dayNote: note,
    score: full ? 78 : 52,
    pillarScores: { sleep: 80, exercise: full ? 100 : 0, nutrition: 82, supplements: 90 },
    behaviorCompletions: bc,
    supplementCompletions: { sup1: true },
  } as DailyLog;
}

const NOTES = [
  "Felt strong today.",
  "Slept poorly, kept it light.",
  "Good energy after the morning walk.",
  "Busy day but hit the essentials.",
  "Rest helped — back on track.",
];

/** Build a complete AppState for the given persona (deterministic given today). */
export function buildPersona(kind: PersonaKind): AppState {
  const base = getDefaultState();
  const tz = getTz(base.settings);
  const today = dateKeyInTz(tz);
  const trialEnds = addDaysToKey(today, 14) + "T12:00:00.000Z";

  const s: AppState = {
    ...base,
    settings: {
      ...base.settings,
      name: "Test User",
      completedOnboarding: true,
      disclaimerAcknowledged: true,
      tier: "free",
      subscriptionStatus: "trial",
      premiumTrialEndsAt: trialEnds,
    },
    installedPacks: ["longevity-foundation"],
    dailyLogs: [],
    biomarkers: [],
  };

  const level = (key: string): Level =>
    [5, 6].includes(dayIndexOfKeyInTz(tz, key)) ? "light" : "full"; // Sat/Sun lighter

  // Range of day-offsets [from..to] back from today → logs (sorted ascending).
  const range = (from: number, to: number, withNotes = false): DailyLog[] => {
    const out: DailyLog[] = [];
    for (let off = from; off <= to; off++) {
      const key = addDaysToKey(today, -off);
      const note = withNotes && off % 7 === 0 ? NOTES[(off / 7) % NOTES.length] : "";
      out.push(mkLog(key, level(key), note));
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };

  if (kind === "fresh") {
    return s; // onboarded, one pack, no logs
  }

  if (kind === "engaged") {
    s.dailyLogs = range(0, 17);
    s.settings.weeklyGoal = 5;
    return s;
  }

  if (kind === "lapsed") {
    // Logs from 10..30 days ago — a 10-day gap up to today (broken streak).
    s.dailyLogs = range(10, 30, true);
    s.settings.weeklyGoal = 5;
    return s;
  }

  if (kind === "vacation") {
    s.dailyLogs = range(0, 17);
    const start = addDaysToKey(today, -3);
    s.settings.vacationMode = true;
    s.settings.vacationStartedAt = start + "T08:00:00.000Z";
    s.settings.vacationPeriods = [{ start, end: null }];
    return s;
  }

  // power
  s.installedPacks = ["longevity-foundation", "better-sleep", "deep-focus"];
  s.settings.tier = "premium";
  s.settings.subscriptionStatus = "active";
  s.settings.weeklyGoal = 6;
  s.dailyLogs = range(0, 59, true);
  // Clean, monotonic trends so the dev persona exercises the forecast card:
  // weight drifting down, HRV rising (improving), resting HR falling
  // (improving). `w` counts backward in time (w=0 today … w=7 ~5wks ago).
  for (let w = 0; w < 8; w++) {
    const k = addDaysToKey(today, -w * 5);
    s.biomarkers.push({ id: `weight-${w}`, metric: "weight", value: 182 - w * 0.6, date: k });
    s.biomarkers.push({ id: `hrv-${w}`, metric: "hrv", value: 50 + (7 - w) * 1.2, date: k });
    s.biomarkers.push({ id: `restingHr-${w}`, metric: "restingHR", value: 56 + w * 0.5, date: k });
  }
  return s;
}
