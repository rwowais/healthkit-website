"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getAccess } from "@/lib/entitlements";
import { clearAllData, exportState, importState } from "@/lib/storage";
import { getTz, dateKeyInTz } from "@/lib/tz";
import { activeDataSource } from "@/lib/datasource";
import { deleteAccount, supabaseEnabled } from "@/lib/auth";
import { getUserId } from "@/lib/supabase";
import { sendTestPush } from "@/lib/push";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import {
  Card,
  Eyebrow,
  Divider,
  Skeleton,
  Sheet,
  Button,
  Segmented,
  useToast,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import SupabaseAuth from "@/components/SupabaseAuth";

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
  const { state, loading, updateSettings, setVacationMode } = useAppState();
  const router = useRouter();
  const access = getAccess(state);
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [theme, setTheme] = useState<ThemePref>("light");
  useEffect(() => {
    // localStorage is unavailable during SSR, so the first client render
    // matches the server ("dark"); sync to the real saved pref after mount.
    setTheme(getThemePref());
  }, []);

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
    r.onload = async () => {
      const parsed = importState(String(r.result));
      if (!parsed) {
        toast.show("Invalid backup file");
        return;
      }
      // Push through the active data source so a restore also lands in
      // the cloud — otherwise the next load lets the old cloud row win.
      await activeDataSource.save(parsed);
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
            maxLength={40}
            onChange={(e) => updateSettings({ name: e.target.value })}
            onBlur={(e) => {
              // Trim leading/trailing space on blur (not on change — that
              // would block typing a space between first and last name).
              const t = e.target.value.trim();
              if (t !== s.name) updateSettings({ name: t });
            }}
            className={`mt-3 ${input}`}
          />
          {s.primaryGoal && (
            <p className="t-caption mt-3">
              Focus: <span className="capitalize">{s.primaryGoal}</span>
            </p>
          )}
        </Card>

        {/* Body trends entry */}
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
                Body Trends
              </p>
              <p className="t-caption mt-0.5">
                Weight, HRV, resting HR &amp; more — {state.biomarkers.length}{" "}
                readings logged
              </p>
            </div>
            <Icon
              name="chevron"
              size={18}
              className="text-[var(--text-3)]"
            />
          </Card>
        </Link>

        {/* Appearance — theme preference (stored per-device, not synced). */}
        <Card>
          <Eyebrow>Appearance</Eyebrow>
          <p className="t-caption mt-2">
            Light is the default. Dark is the deep, original look; System
            follows your device.
          </p>
          <div className="mt-4">
            <Segmented
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={(v) => {
                setTheme(v);
                setThemePref(v);
              }}
            />
          </div>
        </Card>

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

        {/* Day blocks — rename and re-time the day's sections. Lets a shift
            worker or night owl reshape their day (e.g. Dawn / Midday /
            Wind-down, with custom start times) so behaviors file where they
            belong. Renaming is display-only; the block model is unchanged. */}
        <Card>
          <Eyebrow>Day blocks</Eyebrow>
          <p className="t-caption mt-2">
            Rename and re-time your day&rsquo;s sections — call them whatever
            fits your life and set when each begins. Behaviors file under the
            section matching their time.
          </p>
          <div className="mt-4 space-y-3">
            {(
              [
                ["morning", "Morning", "05:00"],
                ["afternoon", "Afternoon", "12:00"],
                ["evening", "Evening", "17:00"],
              ] as const
            ).map(([key, label, def]) => (
              <div key={key} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <p className="t-caption mb-1.5">{label}</p>
                  <input
                    type="text"
                    value={s.blockLabels?.[key] ?? ""}
                    placeholder={`Name (default: ${label})`}
                    onChange={(e) =>
                      updateSettings({
                        blockLabels: {
                          ...(s.blockLabels ?? {}),
                          [key]: e.target.value || undefined,
                        },
                      })
                    }
                    className={input}
                  />
                </div>
                <div className="w-[7.5rem] shrink-0">
                  <p className="t-caption mb-1.5">Starts</p>
                  <input
                    type="time"
                    value={s.blockBoundaries?.[key] ?? def}
                    onChange={(e) => {
                      const cur = s.blockBoundaries ?? {
                        morning: "05:00",
                        afternoon: "12:00",
                        evening: "17:00",
                      };
                      updateSettings({
                        blockBoundaries: { ...cur, [key]: e.target.value },
                      });
                    }}
                    className={input}
                  />
                </div>
              </div>
            ))}
          </div>
          {(s.blockBoundaries || s.blockLabels) && (
            <button
              onClick={() =>
                updateSettings({
                  blockBoundaries: undefined,
                  blockLabels: undefined,
                })
              }
              className="press tr-fast mt-3 text-[12px] font-semibold text-[var(--readiness)]"
            >
              Reset to default
            </button>
          )}
          <p className="t-caption mt-2 text-[var(--text-4)]">
            Start times must go in order; otherwise the 5am / 12pm / 5pm
            defaults apply.
          </p>
        </Card>

        {/* Weekly goal — an active-days target; a calm ring on Today
            tracks progress over the trailing 7 days. */}
        <Card>
          <Eyebrow>Weekly goal</Eyebrow>
          <p className="t-caption mt-2">
            A target number of active days each week. A calm ring on Today
            tracks it — no pressure, just a gentle aim.
          </p>
          <div className="mt-4 flex gap-2">
            {[0, 3, 4, 5, 6, 7].map((n) => {
              const active = (s.weeklyGoal ?? 0) === n;
              return (
                <button
                  key={n}
                  onClick={() => updateSettings({ weeklyGoal: n || undefined })}
                  className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2 text-[13px] font-semibold"
                  style={{
                    background: active ? "var(--text-1)" : "var(--surface-3)",
                    color: active ? "var(--bg)" : "var(--text-2)",
                  }}
                >
                  {n === 0 ? "Off" : n}
                </button>
              );
            })}
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

        {/* Taking a break — vacation mode. One toggle pauses every
            pack, clears Today, and freezes the streak. The user can
            travel / be sick / take a real rest without watching their
            streak die or their score crash. id="break" so Today's
            "End break in Profile" link can scroll the user straight
            here via /profile#break instead of dumping them at the top. */}
        <Card id="break">
          <Eyebrow>Taking a break</Eyebrow>
          <Row label="Pause everything">
            <button
              onClick={() => setVacationMode(!s.vacationMode)}
              role="switch"
              aria-checked={!!s.vacationMode}
              aria-label="Pause everything"
              className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
              style={{
                background: s.vacationMode
                  ? "var(--warm)"
                  : "var(--surface-3)",
              }}
            >
              <div
                className="tr-fast h-5 w-5 rounded-full bg-white"
                style={{
                  transform: s.vacationMode
                    ? "translateX(20px)"
                    : "translateX(0)",
                }}
              />
            </button>
          </Row>
          <p className="t-caption mt-1 leading-relaxed">
            Travel, sick days, or any stretch where you need real rest.
            Your timeline goes quiet, your streak holds, your data
            stays intact. Flip it off when you&apos;re ready to come
            back — everything resumes where you left off.
          </p>
          <Divider />
          <Row label="Rest day today">
            {(() => {
              const tk = dateKeyInTz(getTz(s));
              const rd = s.restDays ?? [];
              const on = rd.includes(tk);
              return (
                <button
                  onClick={() =>
                    updateSettings({
                      restDays: on
                        ? rd.filter((d) => d !== tk)
                        : [...rd, tk],
                    })
                  }
                  role="switch"
                  aria-checked={on}
                  aria-label="Rest day today"
                  className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
                  style={{
                    background: on ? "var(--recovery)" : "var(--surface-3)",
                  }}
                >
                  <div
                    className="tr-fast h-5 w-5 rounded-full bg-white"
                    style={{
                      transform: on ? "translateX(20px)" : "translateX(0)",
                    }}
                  />
                </button>
              );
            })()}
          </Row>
          <p className="t-caption mt-1 leading-relaxed">
            A single day off — your streak holds and your timeline stays. For
            one intentional rest day without pausing everything.
          </p>
        </Card>

        {/* Preferences */}
        <Card>
          <Eyebrow>Preferences</Eyebrow>
          <Row label="Re-run setup">
            <button
              onClick={() => router.push("/onboarding?redo=1")}
              className="press tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold"
              style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
            >
              Start
            </button>
          </Row>
          <p className="t-caption -mt-1 mb-2 leading-relaxed">
            Re-tune your protocol as life changes — it adds the recommended
            packs and keeps your trial, data, and history intact.
          </p>
          <Divider />
          <Row label="Show Supplements tab">
            <button
              onClick={() =>
                updateSettings({
                  hideSupplementsTab: !s.hideSupplementsTab,
                })
              }
              role="switch"
              aria-checked={!s.hideSupplementsTab}
              aria-label="Show Supplements tab in the bottom nav"
              className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
              style={{
                background: !s.hideSupplementsTab
                  ? "var(--vitality)"
                  : "var(--surface-3)",
              }}
            >
              <div
                className="tr-fast h-5 w-5 rounded-full bg-white"
                style={{
                  transform: !s.hideSupplementsTab
                    ? "translateX(20px)"
                    : "translateX(0)",
                }}
              />
            </button>
          </Row>
          <p className="t-caption mt-1 mb-3 leading-relaxed">
            Hide if you don&apos;t take supplements — you can still
            reach the page via the Manage link inside your daily
            supplement card.
          </p>
          <Row label="App icon badge">
            <button
              onClick={() =>
                updateSettings({
                  disableAppBadge: !s.disableAppBadge,
                })
              }
              role="switch"
              aria-checked={!s.disableAppBadge}
              aria-label="Show remaining count on the home-screen app icon"
              className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
              style={{
                background: !s.disableAppBadge
                  ? "var(--vitality)"
                  : "var(--surface-3)",
              }}
            >
              <div
                className="tr-fast h-5 w-5 rounded-full bg-white"
                style={{
                  transform: !s.disableAppBadge
                    ? "translateX(20px)"
                    : "translateX(0)",
                }}
              />
            </button>
          </Row>
          <p className="t-caption mt-1 mb-3 leading-relaxed">
            That number on your installed app icon is the count of
            today&apos;s behaviors still to do — not unread
            notifications. It clears when you finish the day. Turn off
            if it&apos;s more pressure than help.
          </p>
          <Row label="Protocol reminders">
            <button
              onClick={toggleNotifications}
              role="switch"
              aria-checked={s.notificationsEnabled}
              aria-label="Protocol reminders"
              className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
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
            Reminders fire at each behavior&apos;s scheduled time —
            including when the app is closed, if you&apos;ve added
            Protocolize to your home screen. iOS Safari requires
            installing to the home screen first.
          </p>
          {s.notificationsEnabled && (
            <div className="mt-3">
              <Row label="Quiet hours">
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    aria-label="Quiet hours start"
                    value={s.quietHours?.start ?? ""}
                    onChange={(e) =>
                      updateSettings({
                        quietHours: e.target.value
                          ? {
                              start: e.target.value,
                              end: s.quietHours?.end || "07:00",
                            }
                          : undefined,
                      })
                    }
                    className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-1)] outline-none"
                  />
                  <span className="text-[12px] text-[var(--text-4)]">to</span>
                  <input
                    type="time"
                    aria-label="Quiet hours end"
                    value={s.quietHours?.end ?? ""}
                    onChange={(e) =>
                      updateSettings({
                        quietHours: e.target.value
                          ? {
                              start: s.quietHours?.start || "22:00",
                              end: e.target.value,
                            }
                          : undefined,
                      })
                    }
                    className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text-1)] outline-none"
                  />
                </div>
              </Row>
              <p className="t-caption mt-1 leading-relaxed">
                No reminders fire between these times — a wind-down window so
                nothing buzzes overnight. Clear a field to turn it off.
              </p>
              <div className="mt-3">
                <Row label="Smart timing">
                  <button
                    onClick={() =>
                      updateSettings({
                        smartReminders: s.smartReminders ? undefined : true,
                      })
                    }
                    role="switch"
                    aria-checked={!!s.smartReminders}
                    aria-label="Smart reminder timing"
                    className="tap-44 tr-fast h-7 w-12 rounded-full p-1"
                    style={{
                      background: s.smartReminders
                        ? "var(--vitality)"
                        : "var(--surface-3)",
                    }}
                  >
                    <div
                      className="tr-fast h-5 w-5 rounded-full bg-white"
                      style={{
                        transform: s.smartReminders
                          ? "translateX(20px)"
                          : "translateX(0)",
                      }}
                    />
                  </button>
                </Row>
                <p className="t-caption mt-1 leading-relaxed">
                  Learns when you actually complete each behavior and nudges
                  you then, instead of a fixed time. It improves as you log —
                  until there&rsquo;s enough history, reminders use the
                  scheduled time.
                </p>
              </div>
            </div>
          )}
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
                // First try the server-side push (works with tab
                // closed). Fall back to a local in-tab notification
                // if push isn't configured server-side.
                try {
                  const r = await sendTestPush();
                  if (r.ok) {
                    toast.show("Test push sent");
                    return;
                  }
                  // Fall through to local fallback.
                } catch {}
                try {
                  const reg = await navigator.serviceWorker.ready;
                  await reg.showNotification("Protocolize", {
                    body: "Test reminder — you're all set (foreground only).",
                    icon: "/icon.svg",
                    tag: "pz-test",
                  });
                  toast.show("Test shown (foreground only)");
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

        {/* Personal factors — what the system suppresses without
            saying anything clinical. The engine reads safetyFlags
            and silently drops contraindicated atoms from the
            timeline (cold plunge on a pregnant user, intermittent
            fasting on someone under-18, etc.). Toggling here updates
            the timeline immediately on the next compile. No alarms,
            no popups; the affected behaviors just don't appear. */}
        <Card>
          <Eyebrow>Personal factors</Eyebrow>
          <p className="t-caption mt-1 mb-3 leading-relaxed">
            We use these to quietly leave out behaviors that aren&apos;t
            right for your situation. We never share or display these
            elsewhere.
          </p>
          {(
            [
              { key: "pregnant", label: "Pregnant" },
              { key: "breastfeeding", label: "Breastfeeding" },
              { key: "under-18", label: "Under 18" },
              {
                key: "anticoagulants",
                label: "Taking blood thinners (warfarin, DOACs, antiplatelets)",
              },
              {
                key: "diabetes-meds",
                label: "Taking diabetes medication (metformin, sulfonylureas, insulin)",
              },
              {
                key: "thyroid-meds",
                label: "Taking thyroid medication (levothyroxine)",
              },
              { key: "ssri", label: "Taking SSRIs or SNRIs" },
              {
                key: "eating-disorder-history",
                label: "History with disordered eating",
              },
              {
                key: "cardiac-arrhythmia",
                label: "Cardiac arrhythmia",
              },
            ] as const
          ).map((f) => {
            const on =
              (s.safetyFlags as Record<string, boolean> | undefined)?.[
                f.key
              ] === true;
            return (
              <div
                key={f.key}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--hairline)] last:border-0"
              >
                <span className="text-[13.5px] leading-snug text-[var(--text-2)]">
                  {f.label}
                </span>
                <button
                  onClick={() =>
                    updateSettings({
                      safetyFlags: {
                        ...(s.safetyFlags ?? {}),
                        [f.key]: !on,
                      },
                    })
                  }
                  role="switch"
                  aria-checked={on}
                  aria-label={f.label}
                  className="tap-44 tr-fast h-7 w-12 rounded-full p-1 shrink-0"
                  style={{
                    background: on ? "var(--vitality)" : "var(--surface-3)",
                  }}
                >
                  <div
                    className="tr-fast h-5 w-5 rounded-full bg-white"
                    style={{
                      transform: on ? "translateX(20px)" : "translateX(0)",
                    }}
                  />
                </button>
              </div>
            );
          })}
        </Card>

        {/* Membership */}
        <Card>
          <Eyebrow color="var(--readiness)">Membership</Eyebrow>
          {access.paid ? (
            <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-2)]">
              <span className="font-semibold text-[var(--text-1)]">
                Premium
              </span>{" "}
              — the full intelligence layer is on. Thank you.
            </p>
          ) : access.inTrial ? (
            <>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-2)]">
                You&apos;re on the{" "}
                <span className="font-semibold text-[var(--text-1)]">
                  free trial of Premium
                </span>{" "}
                — {access.trialDaysLeft} day
                {access.trialDaysLeft === 1 ? "" : "s"} of full
                intelligence left.
              </p>
              <button
                onClick={() => router.push("/upgrade")}
                className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[var(--bg)]"
              >
                Keep Premium
              </button>
            </>
          ) : (
            <>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--text-2)]">
                You&apos;re on the free plan. Your starter system stays
                free forever — Premium unlocks the parts that learn from
                you.
              </p>
              <button
                onClick={() => router.push("/upgrade")}
                className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[14px] font-semibold text-[var(--bg)]"
              >
                {access.trialExpired
                  ? "Restore full intelligence"
                  : "Explore Premium"}
              </button>
            </>
          )}
        </Card>

        {/* Data */}
        <Card>
          <Eyebrow>Data & Sync</Eyebrow>
          <p className="t-caption mt-2 leading-relaxed">
            Storage:{" "}
            <span className="text-[var(--text-2)]">
              {activeDataSource.isCloud
                ? "Cloud sync available"
                : "This device"}
            </span>
            . Export regularly as your own backup.
          </p>
          <SupabaseAuth />
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

        {/* Disclaimer + legal links */}
        <Card>
          <Eyebrow>Disclaimer & Privacy</Eyebrow>
          <div
            className="mt-2.5 rounded-[var(--r-md)] p-3"
            style={{
              background:
                "color-mix(in srgb, var(--alert) 8%, var(--surface-2))",
              border:
                "1px solid color-mix(in srgb, var(--alert) 24%, transparent)",
            }}
          >
            <p className="text-[13px] font-semibold text-[var(--alert)] mb-1">
              Not medical advice
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--text-2)]">
              Protocolize is an educational tool — not medical advice,
              diagnosis, or treatment. The ranges shown are general
              references; interpret any health data with a qualified
              clinician. If you&apos;re pregnant, under 18, on
              medication, or have any condition, please consult your
              doctor before changing your routine.
            </p>
          </div>
          <p className="t-caption mt-3 leading-relaxed">
            Your data stays on this device unless you sign in. With an
            account, it&apos;s stored in a private row in our database
            and never shared.
          </p>
          <div className="mt-4 flex gap-3 text-[13px]">
            <Link
              href="/privacy"
              className="text-[var(--readiness)] underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-[var(--readiness)] underline"
            >
              Terms of Service
            </Link>
          </div>
        </Card>

        {/* Permanent account deletion — only when cloud sync is active.
            Local-only users use "Reset all data" above; for them there's
            no account to delete. */}
        {supabaseEnabled && (
          <Card>
            <Eyebrow color="var(--alert)">Delete account</Eyebrow>
            <p className="t-caption mt-2 leading-relaxed">
              Permanently removes your account and every byte of your
              data from our database. Local data on this device is
              cleared too. This cannot be undone.
            </p>
            <button
              onClick={() => {
                setDeleteConfirmText("");
                setConfirmDeleteAccount(true);
              }}
              className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] border border-[var(--alert)] py-3 text-[13px] font-semibold text-[var(--alert)]"
            >
              Delete my account
            </button>
          </Card>
        )}

        <p className="pb-2 text-center text-[11px] text-[var(--text-4)]">
          Protocolize · Adaptive Protocol OS · build{" "}
          {process.env.NEXT_PUBLIC_BUILD ?? "dev"}
        </p>
      </div>

      {/* Account-deletion confirmation — requires typing DELETE so
          the user is forced to slow down and read what's about to
          happen. Better than a single "Are you sure?" button. */}
      <Sheet
        open={confirmDeleteAccount}
        onClose={() => setConfirmDeleteAccount(false)}
        title="Delete your account?"
      >
        <p className="t-body mb-3 text-[var(--text-2)]">
          This deletes your account row, all your protocol data,
          biomarkers, logs, and sign-in. It happens immediately and
          cannot be reversed.
        </p>
        <p className="t-body mb-4 text-[var(--text-2)]">
          If you want a copy of your data first, cancel and use Export.
        </p>
        <label className="block text-[12px] font-semibold text-[var(--text-3)] mb-2">
          Type DELETE to confirm
        </label>
        <input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder="DELETE"
          className="mb-5 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
          autoFocus
        />
        <div className="flex gap-3">
          <Button
            variant="ghost"
            full
            onClick={() => setConfirmDeleteAccount(false)}
          >
            Cancel
          </Button>
          <Button
            full
            disabled={
              deleteConfirmText !== "DELETE" || deletingAccount
            }
            onClick={async () => {
              setDeletingAccount(true);
              const r = await deleteAccount();
              if (!r.ok) {
                toast.show(r.error ?? "Could not delete account");
                setDeletingAccount(false);
                return;
              }
              // Wipe local too.
              try {
                clearAllData();
              } catch {}
              setConfirmDeleteAccount(false);
              if (r.error) toast.show(r.error);
              else toast.show("Account deleted");
              router.push("/");
            }}
          >
            {deletingAccount ? "Deleting…" : "Delete forever"}
          </Button>
        </div>
      </Sheet>

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
            onClick={async () => {
              // Reset all data, but if the user is signed in we
              // preserve their identity: pre-seed a fresh local
              // state that already has completedOnboarding=true and
              // their name (so they land back on /today, not on
              // the "what's your name" screen). Signed-out users
              // get the full fresh-start path.
              const hasSession =
                supabaseEnabled && (await getUserId()) !== null;
              await activeDataSource.clearRemote();
              clearAllData();
              if (hasSession) {
                // Mint a minimal state that skips onboarding so the
                // returning signed-in user lands on /today instead
                // of the "what's your name" screen.
                try {
                  // Preserve the user's wake/bed/tz settings so a
                  // signed-in reset doesn't silently overwrite
                  // their schedule with stock defaults.
                  const seed = {
                    version: 3,
                    settings: {
                      name: s.name || "",
                      bedtime: s.bedtime || "23:00",
                      wakeTime: s.wakeTime || "07:00",
                      timezone: s.timezone || "",
                      // Carry the user's existing trial / entitlement across a
                      // reset (retention) instead of restarting or dropping it.
                      // Without tier + premiumTrialEndsAt, getAccess read the
                      // user as expired-free immediately after a reset.
                      tier: s.tier,
                      subscriptionStatus: s.subscriptionStatus ?? "trial",
                      trialStartDate: s.trialStartDate,
                      premiumTrialEndsAt: s.premiumTrialEndsAt,
                      notificationsEnabled: false,
                      weekStartsOn: 1,
                      completedOnboarding: true,
                    },
                  };
                  localStorage.setItem(
                    "protocolize-v3",
                    JSON.stringify(seed)
                  );
                } catch {}
              }
              setConfirmReset(false);
              toast.show(
                hasSession ? "Data cleared — fresh start" : "Data reset"
              );
              setTimeout(
                () => (window.location.href = hasSession ? "/today" : "/"),
                800
              );
            }}
            className="!bg-[var(--alert)] !text-[var(--bg)]"
          >
            Reset
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
