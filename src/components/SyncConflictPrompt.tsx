"use client";

import { useEffect, useState } from "react";
import {
  CONFLICT_EVENT,
  getPendingConflict,
  resolveConflict,
} from "@/lib/datasource";
import { Sheet, Button } from "@/components/ui";

/**
 * First sign-in with both local progress and an existing cloud account:
 * never silently let "cloud win". Ask the user. Mounted once in Shell.
 */
export default function SyncConflictPrompt() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [counts, setCounts] = useState({ local: 0, cloud: 0 });

  useEffect(() => {
    const onConflict = () => {
      const pc = getPendingConflict();
      if (!pc) return;
      setCounts({
        local: pc.local.dailyLogs?.length ?? 0,
        cloud: pc.cloud.dailyLogs?.length ?? 0,
      });
      setOpen(true);
    };
    window.addEventListener(CONFLICT_EVENT, onConflict);
    return () => window.removeEventListener(CONFLICT_EVENT, onConflict);
  }, []);

  const choose = async (c: "local" | "cloud" | "merge") => {
    setBusy(true);
    await resolveConflict(c);
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <Sheet
      open={open}
      onClose={() => {}}
      dismissible={false}
      title="Two sets of data found"
    >
      <p className="t-body mb-5 leading-relaxed">
        This device has{" "}
        <span className="font-semibold text-[var(--text-1)]">
          {counts.local} day{counts.local === 1 ? "" : "s"}
        </span>{" "}
        tracked, and your account has{" "}
        <span className="font-semibold text-[var(--text-1)]">
          {counts.cloud} day{counts.cloud === 1 ? "" : "s"}
        </span>
        . Nothing is deleted until you choose.
      </p>
      <div className="space-y-2.5">
        <Button full disabled={busy} onClick={() => choose("merge")}>
          Merge both (recommended)
        </Button>
        <Button
          full
          variant="ghost"
          disabled={busy}
          onClick={() => choose("local")}
        >
          Keep this device&apos;s data
        </Button>
        <Button
          full
          variant="ghost"
          disabled={busy}
          onClick={() => choose("cloud")}
        >
          Use my account&apos;s data
        </Button>
      </div>
    </Sheet>
  );
}
