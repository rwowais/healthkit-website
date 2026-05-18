"use client";

import { useMemo } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getTodayLog } from "@/lib/storage";
import {
  recoveryScore,
  pillarScore,
  band,
  bandColor,
} from "@/lib/metrics";
import { RingScore } from "@/components/ui/Ring";
import { Sparkline } from "@/components/ui/Charts";
import { Card, Eyebrow, Skeleton, Divider, EmptyState } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import type { DailyLog } from "@/lib/types";

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function RecoveryPage() {
  const { state, loading, updateRatings } = useAppState();
  const log = useMemo(() => getTodayLog(state), [state]);
  const recovery = recoveryScore(log);

  const trend14 = useMemo(() => {
    const arr: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const l = state.dailyLogs.find((x) => x.date === fmtKey(d));
      arr.push(l ? recoveryScore(l) ?? 0 : 0);
    }
    return arr;
  }, [state.dailyLogs]);
  const hasTrend = trend14.some((v) => v > 0);
  const avg7 = useMemo(() => {
    const v = trend14.slice(-7).filter((x) => x > 0);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  }, [trend14]);

  const drivers = useMemo(() => {
    const sp = pillarScore(log, "sleep");
    return [
      {
        label: "Sleep Quality",
        value:
          log.sleepLog.sleepQuality != null
            ? (log.sleepLog.sleepQuality / 5) * 100
            : sp,
        color: "var(--sleep)",
      },
      {
        label: "Energy",
        value: log.energyLevel != null ? (log.energyLevel / 5) * 100 : null,
        color: "var(--readiness)",
      },
      {
        label: "Mood",
        value: log.moodLevel != null ? (log.moodLevel / 5) * 100 : null,
        color: "var(--vitality)",
      },
    ];
  }, [log]);

  const guidance = useMemo(() => {
    if (recovery == null) return "";
    if (recovery >= 75)
      return "Fully recovered. Your system can handle high strain today — train hard, think deeply, push your edges.";
    if (recovery >= 50)
      return "Moderately recovered. Hold your normal load, but stay attentive to fatigue signals through the day.";
    return "Recovery is on the lower side. Prioritize rest, hydration, and an earlier night. Keep training light and restorative.";
  }, [recovery]);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton
            className="mx-auto h-[220px] w-[220px]"
            rounded="rounded-full"
          />
          <Skeleton className="h-40 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise">
          <Eyebrow color="var(--recovery)">Recovery</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Readiness</h1>
        </div>

        {recovery == null ? (
          <Card className="anim-rise d1">
            <EmptyState
              icon={<Icon name="pulse" size={24} />}
              title="No recovery signal yet"
              body="Log today's energy and mood below — recovery is computed only from what you actually report."
            />
          </Card>
        ) : (
          <>
            <div className="anim-rise d1 flex flex-col items-center">
              <RingScore
                value={recovery}
                color={bandColor(recovery)}
                label={band(recovery)}
                sublabel="Recovery"
              />
            </div>
            <Card className="anim-rise d2 relative overflow-hidden">
              <span
                className="absolute inset-y-0 left-0 w-[3px]"
                style={{ background: "var(--recovery)" }}
              />
              <Eyebrow color="var(--text-2)">Guidance</Eyebrow>
              <p className="t-body mt-3 leading-relaxed text-[var(--text-1)]">
                {guidance}
              </p>
            </Card>
          </>
        )}

        {/* Drivers */}
        <div className="anim-rise d3">
          <h2 className="t-section mb-4 text-[var(--text-1)]">
            Recovery Drivers
          </h2>
          <Card>
            <div className="space-y-5">
              {drivers.map((d, i) => (
                <div key={d.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="t-label text-[var(--text-1)]">
                      {d.label}
                    </span>
                    <span
                      className="text-[14px] font-bold"
                      style={{
                        color:
                          d.value == null ? "var(--text-4)" : d.color,
                      }}
                    >
                      {d.value == null ? "—" : Math.round(d.value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="anim-fade h-full rounded-full"
                      style={{
                        width: `${
                          d.value == null ? 0 : Math.max(2, d.value)
                        }%`,
                        background: d.color,
                      }}
                    />
                  </div>
                  {i < drivers.length - 1 && (
                    <div className="mt-5">
                      <Divider />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Check-in */}
        <Card className="anim-rise d4">
          <Eyebrow>Today&apos;s Check-in</Eyebrow>
          <div className="mt-5 space-y-6">
            <div>
              <p className="t-caption mb-2.5">Energy</p>
              <div className="flex justify-between gap-2">
                {[1, 2, 3, 4, 5].map((lv) => {
                  const on =
                    log.energyLevel != null && lv <= log.energyLevel;
                  return (
                    <button
                      key={lv}
                      onClick={() =>
                        updateRatings(log.date, { energy: lv })
                      }
                      className="press tr-fast grid flex-1 place-items-center rounded-[var(--r-sm)] py-3.5"
                      style={{
                        background: on
                          ? "var(--readiness-soft)"
                          : "var(--surface-2)",
                        color: on
                          ? "var(--readiness)"
                          : "var(--text-4)",
                      }}
                    >
                      <Icon name="pulse" size={18} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="t-caption mb-2.5">Mood</p>
              <div className="flex justify-between gap-2">
                {["Low", "Off", "Okay", "Good", "Great"].map((m, i) => {
                  const on =
                    log.moodLevel != null && i + 1 <= log.moodLevel;
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        updateRatings(log.date, { mood: i + 1 })
                      }
                      className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[12px] font-semibold"
                      style={{
                        background: on
                          ? "var(--vitality-soft)"
                          : "var(--surface-2)",
                        color: on ? "var(--vitality)" : "var(--text-4)",
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Trend */}
        <Card className="anim-rise d5">
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>14-Day Recovery</Eyebrow>
              {avg7 == null ? (
                <p className="t-caption mt-3">
                  Trend builds after a week of check-ins.
                </p>
              ) : (
                <p className="mt-3 text-[26px] font-bold text-[var(--text-1)]">
                  {avg7}
                  <span className="ml-1 text-[13px] font-medium text-[var(--text-3)]">
                    7d avg
                  </span>
                </p>
              )}
            </div>
            {hasTrend && (
              <Sparkline
                data={trend14.map((v) => (v === 0 ? 1 : v))}
                color="var(--recovery)"
                width={130}
                height={48}
              />
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
