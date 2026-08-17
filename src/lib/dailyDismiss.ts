"use client";

/**
 * useDailyDismiss — per-day "Got it" for Today's cards.
 *
 * Several Today cards (the evening "You moved N things", the morning briefing,
 * the day-complete celebration, the rest-day notice) had NO dismiss control at
 * all: they simply occupied the top of the screen whenever their condition was
 * true, pushing the checklist down. The founder hit this daily — the evening
 * card fires every single evening a day is partly done.
 *
 * This mirrors the per-day ack pattern already used in today/page.tsx
 * (`pz:cia:<date>`, `pz:trial-end-ack`, `pz:mastered-ack`) rather than adding
 * a second convention: dismissal is scoped to ONE day, so a card the user
 * waves away tonight can still greet them tomorrow. Device-local on purpose —
 * dismissing a celebration is not worth a cloud write or a sync conflict.
 */
import { useCallback, useEffect, useState } from "react";

const key = (id: string, day: string) => `pz:dd:${id}:${day}`;

export function useDailyDismiss(
  id: string,
  day: string
): [boolean, () => void] {
  const [dismissed, setDismissed] = useState(false);

  // Read on mount AND whenever the day flips (a board left open past midnight
  // must re-arm, exactly like the readAcked/snooze handling).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissed(localStorage.getItem(key(id, day)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [id, day]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(key(id, day), "1");
    } catch {
      /* quota/unavailable — the in-session dismissal still holds */
    }
  }, [id, day]);

  return [dismissed, dismiss];
}
