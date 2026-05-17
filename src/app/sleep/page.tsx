"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getTodayLog } from "@/lib/storage";
import { RingScore } from "@/components/ui/Ring";
import { TrendArea } from "@/components/ui/Charts";
import {
  Card,
  Eyebrow,
  Segmented,
  Skeleton,
  Divider,
  scoreWord,
} from "@/components/ui";
import type { DailyLog } from "@/lib/types";

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function durationMin(bed: string | null, wake: string | null): number | null {
  if (!bed || !wake) return null;
  const [bh, bm] = bed.split(":").map(Number);
  const [wh, wm] = wake.split(":").map(Number);
  let d = wh * 60 + wm - (bh * 60 + bm);
  if (d <= 0) d += 1440;
  return d;
}

function hm(min: number) {
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export default function SleepPage() {
  const { state, loading, updateSleepLog } = useAppState();
  const [range, setRange] = useState<"7d" | "30d">("7d");
  const log = useMemo(() => getTodayLog(state), [state]);

  const history = useMemo(() => {
    const days = range === "7d" ? 7 : 30;
    const out: { date: string; log?: DailyLog }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = fmtKey(d);
      out.push({ date: key, log: state.dailyLogs.find((l) => l.date === key) });
    }
    return out;
  }, [state.dailyLogs, range]);

  const durTrend = useMemo(() => {
    const step = range === "7d" ? 1 : 5;
    return history
      .filter((_, i) => i % step === 0 || i === history.length - 1)
      .map((h) => {
        const d = h.log
          ? durationMin(
              h.log.sleepLog.actualBedtime,
              h.log.sleepLog.actualWakeTime
            )
          : null;
        const dt = new Date(h.date + "T00:00:00");
        return {
          label:
            range === "7d"
              ? ["S", "M", "T", "W", "T", "F", "S"][dt.getDay()]
              : `${dt.getMonth() + 1}/${dt.getDate()}`,
          value: d ? d / 60 : 0,
        };
      });
  }, [history, range]);

  const stats = useMemo(() => {
    const withDur = history
      .map((h) =>
        h.log
          ? durationMin(
              h.log.sleepLog.actualBedtime,
              h.log.sleepLog.actualWakeTime
            )
          : null
      )
      .filter((v): v is number => v !== null);
    const avgDur = withDur.length
      ? Math.round(withDur.reduce((a, b) => a + b, 0) / withDur.length)
      : 0;

    const bedtimes = history
      .map((h) => h.log?.sleepLog.actualBedtime)
      .filter((b): b is string => !!b)
      .map((b) => {
        const [hh, mm] = b.split(":").map(Number);
        return hh * 60 + mm;
      });
    let consistency = 0;
    if (bedtimes.length >= 2) {
      const mean = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
      const variance =
        bedtimes.reduce((a, b) => a + (b - mean) ** 2, 0) / bedtimes.length;
      const sd = Math.sqrt(variance);
      consistency = Math.max(0, Math.round(100 - (sd / 60) * 25));
    }

    const adh = history
      .map((h) => h.log?.pillarScores?.sleep ?? null)
      .filter((v): v is number => v !== null && v > 0);
    const avgAdh = adh.length
      ? Math.round(adh.reduce((a, b) => a + b, 0) / adh.length)
      : 0;

    return { avgDur, consistency, avgAdh };
  }, [history]);

  const todayDur = durationMin(
    log.sleepLog.actualBedtime,
    log.sleepLog.actualWakeTime
  );

  const sleepScore = useMemo(() => {
    const durScore = todayDur
      ? Math.max(0, Math.min(100, (todayDur / 480) * 100))
      : stats.avgDur
      ? Math.max(0, Math.min(100, (stats.avgDur / 480) * 100))
      : 0;
    const adh = log.pillarScores?.sleep ?? 0;
    return Math.round(durScore * 0.5 + adh * 0.3 + stats.consistency * 0.2);
  }, [todayDur, stats, log.pillarScores]);

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
          <Eyebrow color="var(--sleep)">Sleep</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Sleep Analysis</h1>
        </div>

        <div className="anim-rise d1 flex flex-col items-center">
          <RingScore
            value={sleepScore}
            color="var(--sleep)"
            label={scoreWord(sleepScore)}
            sublabel="Sleep Score"
          />
        </div>

        <Card className="anim-rise d2">
          <Eyebrow>Last Night</Eyebrow>
          {todayDur ? (
            <div className="mt-4 flex items-baseline gap-2">
              <span className="t-metric text-[var(--text-1)]">
                {Math.floor(todayDur / 60)}
              </span>
              <span className="text-[20px] font-semibold text-[var(--text-2)]">
                h {todayDur % 60}m
              </span>
            </div>
          ) : (
            <p className="t-body mt-3">Log last night to see your duration.</p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div>
              <p className="t-caption mb-1.5">Bedtime</p>
              <input
                type="time"
                value={log.sleepLog.actualBedtime ?? ""}
                onChange={(e) =>
                  updateSleepLog(log.date, {
                    actualBedtime: e.target.value || null,
                  })
                }
                className="w-full rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
              />
            </div>
            <div>
              <p className="t-caption mb-1.5">Wake</p>
              <input
                type="time"
                value={log.sleepLog.actualWakeTime ?? ""}
                onChange={(e) =>
                  updateSleepLog(log.date, {
                    actualWakeTime: e.target.value || null,
                  })
                }
                className="w-full rounded-[var(--r-sm)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
              />
            </div>
          </div>
          <div className="my-4">
            <Divider />
          </div>
          <div>
            <p className="t-caption mb-2.5">How rested do you feel?</p>
            <div className="flex justify-between gap-2">
              {[1, 2, 3, 4, 5].map((q) => {
                const on = log.sleepLog.sleepQuality === q;
                return (
                  <button
                    key={q}
                    onClick={() =>
                      updateSleepLog(log.date, { sleepQuality: q })
                    }
                    className="press tr-fast flex-1 rounded-[var(--r-sm)] py-3 text-[14px] font-semibold"
                    style={{
                      background: on ? "var(--sleep)" : "var(--surface-2)",
                      color: on ? "#08090B" : "var(--text-3)",
                    }}
                  >
                    {q}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>

        <div className="anim-rise d3">
          <div className="mb-4 flex items-end justify-between">
            <h2 className="t-section text-[var(--text-1)]">Duration Trend</h2>
            <div className="w-[140px]">
              <Segmented
                options={[
                  { value: "7d", label: "7D" },
                  { value: "30d", label: "30D" },
                ]}
                value={range}
                onChange={setRange}
              />
            </div>
          </div>
          <Card pad="p-5">
            <TrendArea data={durTrend} color="var(--sleep)" unit="h" max={10} />
          </Card>
        </div>

        <div className="anim-rise d4 grid grid-cols-3 gap-3">
          <Card pad="p-4">
            <p className="t-eyebrow">Avg Sleep</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--text-1)]">
              {stats.avgDur ? hm(stats.avgDur) : "—"}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Consistency</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--sleep)]">
              {stats.consistency ? `${stats.consistency}%` : "—"}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Adherence</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--vitality)]">
              {stats.avgAdh ? `${stats.avgAdh}%` : "—"}
            </p>
          </Card>
        </div>

        <Link href="/track">
          <Card className="anim-rise d5 press flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-[var(--text-1)]">
                Sleep Protocols
              </p>
              <p className="t-caption mt-1">
                Wind-down, light, temperature & more
              </p>
            </div>
            <span className="text-[var(--text-3)]">→</span>
          </Card>
        </Link>
      </div>
    </Shell>
  );
}
