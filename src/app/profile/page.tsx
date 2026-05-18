"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import {
  clearAllData,
  exportState,
  importState,
  saveState,
} from "@/lib/storage";
import { activeDataSource } from "@/lib/datasource";
import {
  Card,
  Eyebrow,
  Divider,
  Skeleton,
  Sheet,
  Button,
  useToast,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

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
      <div>{children}</div>
    </div>
  );
}

const INTEGRATIONS: { name: string; icon: IconName }[] = [
  { name: "Apple Health", icon: "pulse" },
  { name: "Oura Ring", icon: "moon" },
  { name: "Whoop", icon: "flame" },
];

export default function ProfilePage() {
  const { state, loading, updateSettings } = useAppState();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-32" rounded="rounded-full" />
          <Skeleton className="h-40 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-48 w-full" />
        </div>
      </Shell>
    );
  }

  const s = state.settings;
  const input =
    "w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none";

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
    } else toast.show("Permission denied in browser");
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
    const r = new FileReader();
    r.onload = () => {
      const parsed = importState(String(r.result));
      if (!parsed) {
        toast.show("Invalid backup file");
        return;
      }
      saveState(parsed);
      toast.show("Data restored");
      setTimeout(() => window.location.reload(), 700);
    };
    r.readAsText(file);
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>Account</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Profile</h1>
        </div>

        {/* Identity */}
        <Card>
          <Eyebrow>You</Eyebrow>
          <input
            value={s.name}
            placeholder="Your name"
            onChange={(e) => updateSettings({ name: e.target.value })}
            className={`mt-3 ${input}`}
          />
          {s.primaryGoal && (
            <p className="t-caption mt-3">
              Focus: <span className="capitalize">{s.primaryGoal}</span>
            </p>
          )}
        </Card>

        {/* Biomarkers entry */}
        <Link href="/biomarkers">
          <Card className="press flex items-center gap-4">
            <span
              className="chip h-12 w-12 shrink-0"
              style={{
                background:
                  "color-mix(in srgb, var(--recovery) 16%, var(--surface-3))",
                color: "var(--recovery)",
              }}
            >
              <Icon name="pulse" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--text-1)]">
                Biomarkers
              </p>
              <p className="t-caption mt-0.5">
                Body & bloodwork — {state.biomarkers.length} readings logged
              </p>
            </div>
            <Icon
              name="chevron"
              size={18}
              className="text-[var(--text-3)]"
            />
          </Card>
        </Link>

        {/* Sleep schedule */}
        <Card>
          <Eyebrow>Sleep Schedule</Eyebrow>
          <p className="t-caption mt-2">
            Anchors the timing of wind-down & morning behaviors.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="t-caption mb-1.5">Bedtime</p>
              <input
                type="time"
                value={s.bedtime}
                onChange={(e) => updateSettings({ bedtime: e.target.value })}
                className={input}
              />
            </div>
            <div>
              <p className="t-caption mb-1.5">Wake</p>
              <input
                type="time"
                value={s.wakeTime}
                onChange={(e) => updateSettings({ wakeTime: e.target.value })}
                className={input}
              />
            </div>
          </div>
        </Card>

        {/* Integrations */}
        <Card>
          <Eyebrow>Integrations</Eyebrow>
          <p className="t-caption mt-2">
            Wearable sync will make the day adapt automatically.
          </p>
          <div className="mt-4 space-y-1">
            {INTEGRATIONS.map((it, i) => (
              <div key={it.name}>
                <div className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-3 t-label text-[var(--text-1)]">
                    <Icon
                      name={it.icon}
                      size={17}
                      className="text-[var(--text-3)]"
                    />
                    {it.name}
                  </span>
                  <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-3)]">
                    Soon
                  </span>
                </div>
                {i < INTEGRATIONS.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        </Card>

        {/* Preferences */}
        <Card>
          <Eyebrow>Preferences</Eyebrow>
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
          <p className="t-caption mt-1 leading-relaxed">
            Reminders fire at each behavior&apos;s scheduled time while
            Protocolize is open in a tab. Always-on background reminders
            arrive with the native app.
          </p>
          {s.notificationsEnabled && (
            <button
              onClick={async () => {
                if (
                  typeof window === "undefined" ||
                  !("Notification" in window) ||
                  Notification.permission !== "granted"
                ) {
                  toast.show("Enable reminders first");
                  return;
                }
                try {
                  const reg = await navigator.serviceWorker.ready;
                  await reg.showNotification("Protocolize", {
                    body: "Test reminder — you're all set.",
                    icon: "/icon.svg",
                    tag: "pz-test",
                  });
                  toast.show("Test sent");
                } catch {
                  toast.show("Could not send");
                }
              }}
              className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--surface-3)] py-3 text-[13px] font-semibold text-[var(--text-1)]"
            >
              Send a test reminder
            </button>
          )}
        </Card>

        {/* Data */}
        <Card>
          <Eyebrow>Data & Sync</Eyebrow>
          <p className="t-caption mt-2 leading-relaxed">
            Storage:{" "}
            <span className="text-[var(--text-2)]">
              {activeDataSource.isCloud ? "Cloud" : "This device"}
            </span>
            . Cloud sync & accounts are architected and ready to enable. Export
            regularly until then.
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
        <Card>
          <Eyebrow>Disclaimer & Privacy</Eyebrow>
          <p className="t-caption mt-2.5 leading-relaxed">
            Protocolize is an educational tool — not medical advice, diagnosis,
            or treatment. Biomarker ranges are general references; interpret all
            health data with a qualified clinician. Your data stays on this
            device unless you export it.
          </p>
        </Card>

        <p className="pb-2 text-center text-[11px] text-[var(--text-4)]">
          Protocolize · Adaptive Protocol OS
        </p>
      </div>

      <Sheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data?"
      >
        <p className="t-body mb-6">
          This permanently clears your protocols, tracking, biomarkers, and
          streaks on this device. Consider exporting first. This cannot be
          undone.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setConfirmReset(false)}>
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
