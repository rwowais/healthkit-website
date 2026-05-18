"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getTodayLog } from "@/lib/storage";
import {
  sleepScore,
  sleepDurationMinutes,
  bedtimeConsistency,
  pillarScore,
  band,
  bandColor,
} from "@/lib/metrics";
import { RingScore } from "@/components/ui/Ring";
import { TrendArea } from "@/components/ui/Charts";
import {
  Card,
  Eyebrow,
  Segmented,
  Skeleton,
  Divider,
  EmptyState,
  NoData,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import type { DailyLog } from "@/lib/types";

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
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
        const d = h.log ? sleepDurationMinutes(h.log) : null;
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
  const hasDurTrend = durTrend.some((d) => d.value > 0);

  const allLogs = useMemo(
    () => history.map((h) => h.log).filter((l): l is DailyLog => !!l),
    [history]
  );
  const consistency = bedtimeConsistency(allLogs);

  const stats = useMemo(() => {
    const withDur = allLogs
      .map((l) => sleepDurationMinutes(l))
      .filter((v): v is number => v !== null);
    const avgDur = withDur.length
      ? Math.round(withDur.reduce((a, b) => a + b, 0) / withDur.length)
      : null;
    const adh = allLogs
      .map((l) => pillarScore(l, "sleep"))
      .filter((v): v is number => v != null && v > 0);
    const avgAdh = adh.length
      ? Math.round(adh.reduce((a, b) => a + b, 0) / adh.length)
      : null;
    return { avgDur, avgAdh };
  }, [allLogs]);

  const todayDur = sleepDurationMinutes(log);
  const score = sleepScore(log, consistency);

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

        {score == null ? (
          <Card className="anim-rise d1">
            <EmptyState
              icon={<Icon name="moon" size={24} />}
              title="Log last night to begin"
              body="Enter your bedtime and wake time below. Your sleep score is built only from data you record."
            />
          </Card>
        ) : (
          <div className="anim-rise d1 flex flex-col items-center">
            <RingScore
              value={score}
              color={bandColor(score)}
              label={band(score)}
              sublabel="Sleep Score"
            />
          </div>
        )}

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
            <p className="t-caption mt-3">Not logged yet.</p>
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
                className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
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
                className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none"
              />
            </div>
          </div>
          <div className="my-4">
            <Divider />
          </div>
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
            {hasDurTrend ? (
              <TrendArea
                data={durTrend}
                color="var(--sleep)"
                unit="h"
                max={10}
              />
            ) : (
              <p className="t-caption py-10 text-center">
                Log a few nights and your duration trend appears here.
              </p>
            )}
          </Card>
        </div>

        <div className="anim-rise d4 grid grid-cols-3 gap-3">
          <Card pad="p-4">
            <p className="t-eyebrow">Avg Sleep</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--text-1)]">
              {stats.avgDur ? hm(stats.avgDur) : <NoData size={18} />}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Consistency</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--sleep)]">
              {consistency == null ? (
                <NoData size={18} />
              ) : (
                `${consistency}%`
              )}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Adherence</p>
            <p className="mt-3 text-[18px] font-bold text-[var(--vitality)]">
              {stats.avgAdh == null ? (
                <NoData size={18} />
              ) : (
                `${stats.avgAdh}%`
              )}
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
            <Icon name="chevron" size={18} className="text-[var(--text-3)]" />
          </Card>
        </Link>
      </div>
    </Shell>
  );
}
