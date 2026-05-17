"use client";

import { useCallback, useEffect, useState } from "react";
import type { AppState, Pillar, ProtocolItem, SleepLog, UserSettings } from "@/lib/types";
import {
  getDefaultState,
  getTodayLog,
  loadState,
  saveState,
  toggleCompletion as toggleCompletionFn,
  updateDailyRatings as updateDailyRatingsFn,
  updateItemNote as updateItemNoteFn,
  updateSleepLog as updateSleepLogFn,
} from "@/lib/storage";

interface UseAppStateReturn {
  state: AppState;
  loading: boolean;
  toggleCompletion: (date: string, itemId: string) => void;
  updateNote: (date: string, itemId: string, note: string) => void;
  updateSleepLog: (date: string, sleepLog: Partial<SleepLog>) => void;
  updateRatings: (date: string, updates: { energy?: number; mood?: number }) => void;
  updateSettings: (settings: Partial<UserSettings>) => void;
  updateProtocols: (pillar: Pillar, items: ProtocolItem[]) => void;
}

export function useAppState(): UseAppStateReturn {
  const [state, setState] = useState<AppState>(getDefaultState);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    setLoading(false);
  }, []);

  // Persist to localStorage on every state change (skip initial server render)
  useEffect(() => {
    if (!loading) {
      saveState(state);
    }
  }, [state, loading]);

  const toggleCompletion = useCallback(
    (date: string, itemId: string) => {
      setState((prev) => toggleCompletionFn(prev, date, itemId));
    },
    []
  );

  const updateNote = useCallback(
    (date: string, itemId: string, note: string) => {
      setState((prev) => updateItemNoteFn(prev, date, itemId, note));
    },
    []
  );

  const updateSleepLog = useCallback(
    (date: string, sleepLog: Partial<SleepLog>) => {
      setState((prev) => updateSleepLogFn(prev, date, sleepLog));
    },
    []
  );

  const updateRatings = useCallback(
    (date: string, updates: { energy?: number; mood?: number }) => {
      setState((prev) => updateDailyRatingsFn(prev, date, updates));
    },
    []
  );

  const updateSettings = useCallback(
    (updates: Partial<UserSettings>) => {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...updates },
      }));
    },
    []
  );

  const updateProtocols = useCallback(
    (pillar: Pillar, items: ProtocolItem[]) => {
      setState((prev) => ({
        ...prev,
        protocols: { ...prev.protocols, [pillar]: items },
      }));
    },
    []
  );

  return {
    state,
    loading,
    toggleCompletion,
    updateNote,
    updateSleepLog,
    updateRatings,
    updateSettings,
    updateProtocols,
  };
}
