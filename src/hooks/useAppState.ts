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
  swapBehavior as swapBehaviorFn,
  clearSwap as clearSwapFn,
  toggleSupplement as toggleSupplementFn,
  bulkCheckSupplements as bulkCheckSupplementsFn,
  addSupplement as addSupplementFn,
  updateSupplement as updateSupplementFn,
  removeSupplement as removeSupplementFn,
  setVacationMode as setVacationModeFn,
  installPack as installPackFn,
  uninstallPack as uninstallPackFn,
  setBehaviorOverride as setBehaviorOverrideFn,
  upsertCustomPack as upsertCustomPackFn,
  deleteCustomPack as deleteCustomPackFn,
  duplicatePack as duplicatePackFn,
  setPackPaused as setPackPausedFn,
} from "@/lib/storage";
import { activeDataSource, STATE_EVENT } from "@/lib/datasource";
import { fetchAndApplyPublished } from "@/lib/cms/publish";
import { maybeExtendTrial } from "@/lib/entitlements";
import type {
  BiomarkerEntry,
  BehaviorOverride,
  ProtocolPack,
} from "@/lib/types";

/**
 * Canonical, key-order-independent serialization. The dedupe guard must
 * survive a round-trip through `normalize()` (which rebuilds objects with
 * a different key order); a raw JSON.stringify made every load look like
 * a change → endless save→event→load→setState churn (write amplification
 * on Supabase). Sorting keys makes a round-trip a true fixed point.
 */
function stableStringify(v: unknown): string {
  return JSON.stringify(v, function repl(_k, val) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      return Object.keys(o)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = o[k];
          return acc;
        }, {});
    }
    return val;
  });
}

export function useAppState() {
  const [state, setState] = useState<AppState>(getDefaultState);
  const [loading, setLoading] = useState(true);
  const lastJson = useRef<string>("");

  useEffect(() => {
    let alive = true;
    // Hybrid CMS refresh: adopt the newest published bundle (if any)
    // before state loads, so the timeline/merge/score serve it. Inert
    // when offline / Supabase off / nothing published — built-in stands.
    fetchAndApplyPublished()
      .catch(() => false)
      .then(() => activeDataSource.load())
      .then((raw) => {
        if (!alive) return;
        const loaded = maybeExtendTrial(raw);
      // Canonical baseline off the *pre-extension* state: if a trial
      // extension was applied, state ≠ baseline → exactly one save fires
      // and the extension persists; if not, a round-trip is a fixed
      // point and there is no save/load churn.
      lastJson.current = stableStringify(raw);
      setState(loaded);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist — debounced so a burst of toggles becomes ONE write instead
  // of re-uploading the whole document per tap. Still skips no-op writes
  // (also breaks the reload→save loop) and flushes on tab hide/unmount
  // so nothing is lost.
  const pendingSave = useRef<AppState | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True for the entire duration of a save (incl. the cloud round-trip).
  // SupabaseDataSource.save() dispatches the "state changed" event before
  // the upsert resolves; without this, the same page's resync reads the
  // *old* cloud row and reverts the optimistic edit — the click "shows
  // unchecked" until a manual refresh. Suppress self-resync while saving.
  const saving = useRef(false);
  const flush = useRef(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pendingSave.current) {
      const s = pendingSave.current;
      pendingSave.current = null;
      saving.current = true;
      Promise.resolve(activeDataSource.save(s)).finally(() => {
        saving.current = false;
      });
    }
  });

  useEffect(() => {
    if (loading) return;
    const json = stableStringify(state);
    if (json === lastJson.current) return;
    lastJson.current = json;
    pendingSave.current = state;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush.current(), 600);
  }, [state, loading]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush.current();
    };
    window.addEventListener("pagehide", flush.current);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush.current);
      document.removeEventListener("visibilitychange", onHide);
      flush.current();
    };
  }, []);

  // React to changes made by another live instance / tab / on refocus,
  // so removing or customizing a protocol updates Today immediately.
  useEffect(() => {
    if (loading) return;
    const sync = () => {
      // Never clobber an unflushed OR in-flight local write with a
      // resync — the local write wins and a later resync reconciles.
      // Closes both the debounce-window race and the self-clobber where
      // our own save's "changed" event reloads a stale cloud row.
      if (pendingSave.current || saving.current) return;
      activeDataSource.load().then((raw) => {
        if (pendingSave.current || saving.current) return;
        const j = stableStringify(raw);
        if (j === lastJson.current) return;
        lastJson.current = j;
        setState(maybeExtendTrial(raw));
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

  const toggleSupplement = useCallback((date: string, id: string) => {
    setState((prev) => toggleSupplementFn(prev, date, id));
  }, []);
  const bulkCheckSupplements = useCallback(
    (date: string, ids: string[]) => {
      setState((prev) => bulkCheckSupplementsFn(prev, date, ids));
    },
    []
  );
  const addSupplement = useCallback((supp: Parameters<typeof addSupplementFn>[1]) => {
    setState((prev) => addSupplementFn(prev, supp));
  }, []);
  const updateSupplement = useCallback(
    (id: string, patch: Parameters<typeof updateSupplementFn>[2]) => {
      setState((prev) => updateSupplementFn(prev, id, patch));
    },
    []
  );
  const removeSupplement = useCallback((id: string) => {
    setState((prev) => removeSupplementFn(prev, id));
  }, []);
  const setVacationMode = useCallback((on: boolean) => {
    setState((prev) => setVacationModeFn(prev, on));
  }, []);

  const toggleBehavior = useCallback((date: string, key: string) => {
    setState((prev) => toggleBehaviorFn(prev, date, key));
  }, []);
  const swapBehavior = useCallback(
    (date: string, fromKey: string, toKey: string) => {
      setState((prev) => swapBehaviorFn(prev, date, fromKey, toKey));
    },
    []
  );
  const clearSwap = useCallback((date: string, fromKey: string) => {
    setState((prev) => clearSwapFn(prev, date, fromKey));
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

  /**
   * Re-load state from the active source. Used by pull-to-refresh on
   * Today and by the timezone/safety prompts after the user changes a
   * setting via a different surface. The reload respects the same
   * trial-extension path as initial load so we don't lose engagement
   * stamps on refresh.
   */
  const refresh = useCallback(async () => {
    try {
      const raw = await activeDataSource.load();
      const loaded = maybeExtendTrial(raw);
      lastJson.current = stableStringify(raw);
      setState(loaded);
    } catch {
      /* offline / transient — keep current state */
    }
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
    // Supplements
    toggleSupplement,
    bulkCheckSupplements,
    addSupplement,
    updateSupplement,
    removeSupplement,
    // Vacation
    setVacationMode,
    // Protocol OS
    toggleBehavior,
    swapBehavior,
    clearSwap,
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
    // Manual refresh — pull-to-refresh, etc.
    refresh,
  };
}
