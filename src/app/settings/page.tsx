"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useRef } from "react";
import { useAppState } from "@/hooks/useAppState";
import {
  clearAllData,
  exportState,
  importState,
  saveState,
} from "@/lib/storage";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import { Icon, type IconName } from "@/components/ui/icons";
import {
  Card,
  Eyebrow,
  Divider,
  Skeleton,
  Sheet,
  Button,
  useToast,
} from "@/components/ui";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <span className="t-label text-[var(--text-1)]">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { state, loading, updateSettings } = useAppState();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const s = state.settings;

  const toggleNotifications = async () => {
    if (s.notificationsEnabled) {
      updateSettings({ notificationsEnabled: false });
      return;
    }
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.show("Notifications not supported here");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      updateSettings({ notificationsEnabled: true });
      toast.show("Reminders on");
    } else {
      toast.show("Permission denied in browser");
    }
  };

  const doExport = () => {
    const blob = new Blob([exportState(state)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `protocolize-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.show("Backup exported");
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = importState(String(reader.result));
      if (!parsed) {
        toast.show("Invalid backup file");
        return;
      }
      saveState(parsed);
      toast.show("Data restored");
      setTimeout(() => window.location.reload(), 700);
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-32" rounded="rounded-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Shell>
    );
  }

  const totalProtocols = PILLARS.reduce(
    (n, p) => n + state.protocols[p].filter((i) => i.isEnabled).length,
    0
  );

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise">
          <Eyebrow>Account</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Settings</h1>
        </div>

        {/* Profile */}
        <Card className="anim-rise d1">
          <Eyebrow>Profile</Eyebrow>
          <div className="mt-4">
            <p className="t-caption mb-1.5">Name</p>
            <input
              type="text"
              value={s.name}
              placeholder="Your name"
              onChange={(e) => updateSettings({ name: e.target.value })}
              className="w-full rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
            />
          </div>
        </Card>

        {/* Sleep schedule */}
        <Card className="anim-rise d2">
          <Eyebrow>Sleep Schedule</Eyebrow>
          <p className="t-caption mt-2">
            Anchors timing for wind-down & wake protocols.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="t-caption mb-1.5">Target Bedtime</p>
              <input
                type="time"
                value={s.bedtime}
                onChange={(e) => updateSettings({ bedtime: e.target.value })}
                className="w-full rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
              />
            </div>
            <div>
              <p className="t-caption mb-1.5">Target Wake</p>
              <input
                type="time"
                value={s.wakeTime}
                onChange={(e) => updateSettings({ wakeTime: e.target.value })}
                className="w-full rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Protocols summary */}
        <Card className="anim-rise d3">
          <Eyebrow>Active Protocols</Eyebrow>
          <p className="mt-3 text-[26px] font-bold text-[var(--text-1)]">
            {totalProtocols}
            <span className="ml-1.5 text-[13px] font-medium text-[var(--text-3)]">
              enabled
            </span>
          </p>
          <div className="mt-3">
            <Divider />
          </div>
          <div className="mt-1">
            {PILLARS.map((p) => {
              const ic: Record<string, IconName> = {
                sleep: "moon",
                exercise: "pulse",
                nutrition: "leaf",
                supplements: "pill",
              };
              return (
                <div
                  key={p}
                  className="flex items-center justify-between py-3.5"
                >
                  <span className="flex items-center gap-2.5 t-label text-[var(--text-1)]">
                    <Icon
                      name={ic[p]}
                      size={16}
                      stroke={1.7}
                      className="text-[var(--text-3)]"
                    />
                    {PILLAR_META[p].label}
                  </span>
                  <span className="text-[14px] font-semibold text-[var(--text-2)]">
                    {state.protocols[p].filter((i) => i.isEnabled).length}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Preferences */}
        <Card className="anim-rise d4">
          <Eyebrow>Preferences</Eyebrow>
          <div className="mt-2">
            <Row label="Protocol reminders">
              <button
                onClick={toggleNotifications}
                className="tr-fast h-7 w-12 rounded-full p-1"
                style={{
                  background: s.notificationsEnabled
                    ? "var(--vitality)"
                    : "var(--surface-3)",
                }}
              >
                <div
                  className="tr-fast h-5 w-5 rounded-full bg-white"
                  style={{
                    transform: s.notificationsEnabled
                      ? "translateX(20px)"
                      : "translateX(0)",
                  }}
                />
              </button>
            </Row>
          </div>
        </Card>

        {/* Data */}
        <Card className="anim-rise d5">
          <Eyebrow>Data & Backup</Eyebrow>
          <p className="t-caption mt-2">
            Your data lives only in this browser. Export regularly so you never
            lose your history.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={doExport}
              className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] py-3.5 text-[14px] font-semibold text-[var(--text-1)]"
            >
              Export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] py-3.5 text-[14px] font-semibold text-[var(--text-1)]"
            >
              Import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) doImport(f);
                e.target.value = "";
              }}
            />
          </div>
          <button
            onClick={() => setConfirmReset(true)}
            className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] border border-[var(--hairline-strong)] py-3.5 text-[14px] font-semibold text-[var(--alert)]"
          >
            Reset all data
          </button>
        </Card>

        {/* Disclaimer */}
        <Card className="anim-rise d5">
          <Eyebrow>Disclaimer & Privacy</Eyebrow>
          <p className="t-caption mt-2.5 leading-relaxed">
            Protocolize is an educational tool — not medical advice, diagnosis,
            or treatment. Biomarker ranges are general references; interpret all
            health data with a qualified clinician. Your data never leaves this
            device unless you export it.
          </p>
        </Card>

        <p className="pb-2 text-center text-[11px] text-[var(--text-4)]">
          Protocolize · Longevity Intelligence ·{" "}
          {s.subscriptionStatus === "trial" ? "Trial" : "Member"}
        </p>
      </div>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data?"
      >
        <p className="t-body mb-6">
          This permanently clears your tracking history, scores, and streaks on
          this device. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            full
            onClick={() => setConfirmReset(false)}
          >
            Cancel
          </Button>
          <Button
            full
            onClick={() => {
              clearAllData();
              setConfirmReset(false);
              toast.show("Data reset");
              setTimeout(() => window.location.reload(), 800);
            }}
            className="!bg-[var(--alert)] !text-[#08090B]"
          >
            Reset
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
