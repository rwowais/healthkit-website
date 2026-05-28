"use client";

import { useEffect, useState } from "react";
import { subscribe, getSyncState, type SyncState } from "@/lib/sync";

/**
 * Calm sync status pill. Subscribes to lib/sync and shows the user
 * what's happening with the cloud copy of their data.
 *
 * Visibility rules (calm UX, never alarming):
 *   - "synced"  → nothing rendered (no news is good news)
 *   - "syncing" → tiny "Syncing…" with subtle pulse, ~2s show window
 *                 (otherwise it'd flash on every keystroke save)
 *   - "pending" → "Saved locally" with a check — local copy is safe,
 *                 cloud just hasn't caught up. Disappears as soon
 *                 as the next save succeeds.
 *   - "offline" → "Offline" with a calm dot — user knows but isn't
 *                 alarmed. Their data still saves locally.
 *   - "error"   → "Sync paused" — only after 3+ failures. Tells the
 *                 user something's wrong without naming a tech reason.
 *
 * Placement: rendered inside Shell next to the header so it lives in
 * the user's peripheral vision, not in the way of any action.
 */
export default function SyncIndicator() {
  const [s, setS] = useState<SyncState>(() => {
    if (typeof window === "undefined") return "synced";
    return getSyncState();
  });
  const [showSyncing, setShowSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribe((next) => setS(next));
    return unsub;
  }, []);

  // Debounce the "syncing" indicator so it shows briefly (so the user
  // knows something happened) without flashing on every keystroke.
  useEffect(() => {
    if (s === "syncing") {
      setShowSyncing(true);
      const t = setTimeout(() => setShowSyncing(false), 1200);
      return () => clearTimeout(t);
    }
  }, [s]);

  if (s === "synced") return null;
  if (s === "syncing" && !showSyncing) return null;

  let label = "";
  let color = "var(--text-3)";
  let dot = "var(--text-3)";
  switch (s) {
    case "syncing":
      label = "Syncing…";
      color = "var(--text-2)";
      dot = "var(--readiness)";
      break;
    case "pending":
      label = "Saved locally";
      color = "var(--text-3)";
      dot = "var(--warm)";
      break;
    case "offline":
      label = "Offline";
      color = "var(--text-3)";
      dot = "var(--text-4)";
      break;
    case "error":
      label = "Sync paused";
      color = "var(--alert)";
      dot = "var(--alert)";
      break;
    default:
      return null;
  }

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10.5px] font-medium tr-fast"
      style={{
        background: "var(--surface-2)",
        color,
      }}
      role="status"
      aria-live="polite"
      aria-label={`Sync status: ${label}`}
    >
      <span
        className={s === "syncing" ? "animate-pulse" : ""}
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dot,
        }}
      />
      {label}
    </div>
  );
}
