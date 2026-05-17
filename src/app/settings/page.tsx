"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { PILLAR_META, PILLARS } from "@/lib/constants";
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
  const s = state.settings;

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
            {PILLARS.map((p) => (
              <Row key={p} label={`${PILLAR_META[p].icon} ${PILLAR_META[p].label}`}>
                <span className="text-[14px] font-semibold text-[var(--text-2)]">
                  {state.protocols[p].filter((i) => i.isEnabled).length}
                </span>
              </Row>
            ))}
          </div>
        </Card>

        {/* Preferences */}
        <Card className="anim-rise d4">
          <Eyebrow>Preferences</Eyebrow>
          <div className="mt-2">
            <Row label="Notifications">
              <button
                onClick={() =>
                  updateSettings({
                    notificationsEnabled: !s.notificationsEnabled,
                  })
                }
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

        {/* Danger zone */}
        <Card className="anim-rise d5">
          <Eyebrow color="var(--alert)">Data</Eyebrow>
          <p className="t-caption mt-2">
            Reset clears all tracking history on this device.
          </p>
          <button
            onClick={() => setConfirmReset(true)}
            className="press tr-fast mt-4 w-full rounded-[var(--r-pill)] border border-[var(--hairline-strong)] py-3.5 text-[14px] font-semibold text-[var(--alert)]"
          >
            Reset all data
          </button>
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
              if (typeof window !== "undefined") {
                localStorage.removeItem("protocolize-v2");
                localStorage.removeItem("protocolize-v3");
              }
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
