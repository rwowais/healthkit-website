"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AppState,
  ExerciseEntry,
  NutritionScorecard,
  Pillar,
  ProtocolItem,
  SleepLog,
  SupplementEntry,
  SupplementMeta,
  UserSettings,
} from "@/lib/types";
import {
  getDefaultState,
  toggleSleepItem as toggleSleepItemFn,
  updateExerciseEntry as updateExerciseEntryFn,
  updateNutritionScorecard as updateNutritionScorecardFn,
  updateSupplementEntry as updateSupplementEntryFn,
  updateSupplementMeta as updateSupplementMetaFn,
  updateSleepLog as updateSleepLogFn,
  updateDailyRatings as updateDailyRatingsFn,
  addBiomarker as addBiomarkerFn,
  deleteBiomarker as deleteBiomarkerFn,
  toggleBehavior as toggleBehaviorFn,
  installPack as installPackFn,
  uninstallPack as uninstallPackFn,
  setBehaviorOverride as setBehaviorOverrideFn,
  upsertCustomPack as upsertCustomPackFn,
  deleteCustomPack as deleteCustomPackFn,
  duplicatePack as duplicatePackFn,
  setPackPaused as setPackPausedFn,
} from "@/lib/storage";
import { activeDataSource, STATE_EVENT } from "@/lib/datasource";
import { maybeExtendTrial } from "@/lib/entitlements";
import type {
  BiomarkerEntry,
  BehaviorOverride,
  ProtocolPack,
} from "@/lib/types";

export function useAppState() {
  const [state, setState] = useState<AppState>(getDefaultState);
  const [loading, setLoading] = useState(true);
  const lastJson = useRef<string>("");

  useEffect(() => {
    let alive = true;
    activeDataSource.load().then((raw) => {
      if (!alive) return;
      const loaded = maybeExtendTrial(raw);
      // Persist baseline so an extension is saved on next change.
      lastJson.current = JSON.stringify(raw);
      setState(loaded);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist — skip no-op writes (also breaks the reload→save loop).
  useEffect(() => {
    if (loading) return;
    const json = JSON.stringify(state);
    if (json === lastJson.current) return;
    lastJson.current = json;
    void activeDataSource.save(state);
  }, [state, loading]);

  // React to changes made by another live instance / tab / on refocus,
  // so removing or customizing a protocol updates Today immediately.
  useEffect(() => {
    if (loading) return;
    const sync = () => {
      activeDataSource.load().then((loaded) => {
        const j = JSON.stringify(loaded);
        if (j !== lastJson.current) {
          lastJson.current = j;
          setState(loaded);
        }
      });
    };
    window.addEventListener(STATE_EVENT, sync);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener(STATE_EVENT, sync);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [loading]);

  // ── Sleep tracking ──────────────────────────────────────────

  const toggleSleepItem = useCallback(
    (date: string, itemId: string) => {
      setState((prev) => toggleSleepItemFn(prev, date, itemId));
    },
    []
  );

  // ── Exercise tracking ───────────────────────────────────────

  const updateExerciseEntry = useCallback(
    (date: string, itemId: string, updates: Partial<ExerciseEntry>) => {
      setState((prev) => updateExerciseEntryFn(prev, date, itemId, updates));
    },
    []
  );

  // ── Nutrition tracking ──────────────────────────────────────

  const updateNutritionScorecard = useCallback(
    (date: string, updates: Partial<NutritionScorecard>) => {
      setState((prev) => updateNutritionScorecardFn(prev, date, updates));
    },
    []
  );

  // ── Supplement tracking ─────────────────────────────────────

  const updateSupplementEntry = useCallback(
    (date: string, itemId: string, updates: Partial<SupplementEntry>) => {
      setState((prev) => updateSupplementEntryFn(prev, date, itemId, updates));
    },
    []
  );

  const updateSupplementMeta = useCallback(
    (itemId: string, updates: Partial<SupplementMeta>) => {
      setState((prev) => updateSupplementMetaFn(prev, itemId, updates));
    },
    []
  );

  // ── Sleep log ───────────────────────────────────────────────

  const updateSleepLog = useCallback(
    (date: string, sleepLog: Partial<SleepLog>) => {
      setState((prev) => updateSleepLogFn(prev, date, sleepLog));
    },
    []
  );

  // ── Ratings ─────────────────────────────────────────────────

  const updateRatings = useCallback(
    (date: string, updates: { energy?: number; mood?: number }) => {
      setState((prev) => updateDailyRatingsFn(prev, date, updates));
    },
    []
  );

  // ── Settings & Protocols ────────────────────────────────────

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

  // ── Biomarkers ──────────────────────────────────────────────

  const addBiomarker = useCallback(
    (entry: Omit<BiomarkerEntry, "id">) => {
      setState((prev) => addBiomarkerFn(prev, entry));
    },
    []
  );

  const deleteBiomarker = useCallback((id: string) => {
    setState((prev) => deleteBiomarkerFn(prev, id));
  }, []);

  // ── Protocol OS ─────────────────────────────────────────────

  const toggleBehavior = useCallback((date: string, key: string) => {
    setState((prev) => toggleBehaviorFn(prev, date, key));
  }, []);
  const installPack = useCallback((id: string) => {
    setState((prev) => installPackFn(prev, id));
  }, []);
  const uninstallPack = useCallback((id: string) => {
    setState((prev) => uninstallPackFn(prev, id));
  }, []);
  const setBehaviorOverride = useCallback(
    (key: string, ov: BehaviorOverride) => {
      setState((prev) => setBehaviorOverrideFn(prev, key, ov));
    },
    []
  );
  const upsertCustomPack = useCallback((pack: ProtocolPack) => {
    setState((prev) => upsertCustomPackFn(prev, pack));
  }, []);
  const deleteCustomPack = useCallback((id: string) => {
    setState((prev) => deleteCustomPackFn(prev, id));
  }, []);
  const duplicatePack = useCallback((source: ProtocolPack) => {
    setState((prev) => duplicatePackFn(prev, source));
  }, []);
  const setPackPaused = useCallback((id: string, paused: boolean) => {
    setState((prev) => setPackPausedFn(prev, id, paused));
  }, []);

  return {
    state,
    loading,
    // Sleep
    toggleSleepItem,
    // Exercise
    updateExerciseEntry,
    // Nutrition
    updateNutritionScorecard,
    // Supplements
    updateSupplementEntry,
    updateSupplementMeta,
    // Wellness
    updateSleepLog,
    updateRatings,
    // Biomarkers
    addBiomarker,
    deleteBiomarker,
    // Protocol OS
    toggleBehavior,
    installPack,
    uninstallPack,
    setBehaviorOverride,
    upsertCustomPack,
    deleteCustomPack,
    duplicatePack,
    setPackPaused,
    // Config
    updateSettings,
    updateProtocols,
  };
}
