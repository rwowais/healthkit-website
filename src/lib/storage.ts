import { UserRoutine, SelectedProtocol, DailyLog } from "./types";

const STORAGE_KEY = "healthkit-routine";

function getDefaultRoutine(): UserRoutine {
  return {
    selectedProtocols: [],
    dailyLogs: [],
    startDate: new Date().toISOString().split("T")[0],
    planWeeks: 4,
  };
}

export function loadRoutine(): UserRoutine {
  if (typeof window === "undefined") return getDefaultRoutine();
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return getDefaultRoutine();
  try {
    return JSON.parse(data);
  } catch {
    return getDefaultRoutine();
  }
}

export function saveRoutine(routine: UserRoutine): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routine));
}

export function addProtocol(protocolId: string): UserRoutine {
  const routine = loadRoutine();
  if (routine.selectedProtocols.find((p) => p.protocolId === protocolId))
    return routine;
  const selected: SelectedProtocol = {
    protocolId,
    addedAt: new Date().toISOString(),
    weeklySchedule: [true, true, true, true, true, true, true],
    notes: "",
  };
  routine.selectedProtocols.push(selected);
  saveRoutine(routine);
  return routine;
}

export function removeProtocol(protocolId: string): UserRoutine {
  const routine = loadRoutine();
  routine.selectedProtocols = routine.selectedProtocols.filter(
    (p) => p.protocolId !== protocolId
  );
  saveRoutine(routine);
  return routine;
}

export function updateProtocolSchedule(
  protocolId: string,
  weeklySchedule: boolean[]
): UserRoutine {
  const routine = loadRoutine();
  const protocol = routine.selectedProtocols.find(
    (p) => p.protocolId === protocolId
  );
  if (protocol) {
    protocol.weeklySchedule = weeklySchedule;
    saveRoutine(routine);
  }
  return routine;
}

export function toggleDailyCompletion(
  date: string,
  protocolId: string
): UserRoutine {
  const routine = loadRoutine();
  let log = routine.dailyLogs.find((l) => l.date === date);
  if (!log) {
    log = {
      date,
      completedProtocols: [],
      mood: 0,
      energy: 0,
      sleepHours: 0,
      notes: "",
    };
    routine.dailyLogs.push(log);
  }
  const idx = log.completedProtocols.indexOf(protocolId);
  if (idx >= 0) {
    log.completedProtocols.splice(idx, 1);
  } else {
    log.completedProtocols.push(protocolId);
  }
  saveRoutine(routine);
  return routine;
}

export function updateDailyLog(
  date: string,
  updates: Partial<DailyLog>
): UserRoutine {
  const routine = loadRoutine();
  let log = routine.dailyLogs.find((l) => l.date === date);
  if (!log) {
    log = {
      date,
      completedProtocols: [],
      mood: 0,
      energy: 0,
      sleepHours: 0,
      notes: "",
    };
    routine.dailyLogs.push(log);
  }
  Object.assign(log, updates);
  saveRoutine(routine);
  return routine;
}

export function getStreakDays(routine: UserRoutine): number {
  if (routine.selectedProtocols.length === 0) return 0;
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const log = routine.dailyLogs.find((l) => l.date === dateStr);
    if (log && log.completedProtocols.length > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}
