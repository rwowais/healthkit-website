"use client";

import { useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { calculateStreak } from "@/lib/scoring";
import { PILLAR_META, PILLARS } from "@/lib/constants";
import { TrendArea, HeatStrip } from "@/components/ui/Charts";
import {
  Card,
  Eyebrow,
  Segmented,
  Skeleton,
  Divider,
} from "@/components/ui";
import type { DailyLog } from "@/lib/types";

const PILLAR_COLOR: Record<string, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

function range(days: number, logs: DailyLog[]) {
  const out: { date: string; log?: DailyLog }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = fmtKey(d);
    out.push({ date: key, log: logs.find((l) => l.date === key) });
  }
  return out;
}

export default function ProgressPage() {
  const { state, loading } = useAppState();
  const [win, setWin] = useState<"7d" | "30d">("30d");

  const streak = useMemo(
    () => calculateStreak(state.dailyLogs),
    [state.dailyLogs]
  );

  const days = win === "7d" ? 7 : 30;
  const data = useMemo(
    () => range(days, state.dailyLogs),
    [days, state.dailyLogs]
  );

  const scoreTrend = useMemo(() => {
    const step = win === "7d" ? 1 : 5;
    return data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d) => {
        const dt = new Date(d.date + "T00:00:00");
        return {
          label:
            win === "7d"
              ? ["S", "M", "T", "W", "T", "F", "S"][dt.getDay()]
              : `${dt.getMonth() + 1}/${dt.getDate()}`,
          value: d.log?.score ?? 0,
        };
      });
  }, [data, win]);

  const avgScore = useMemo(() => {
    const v = data.map((d) => d.log?.score ?? 0).filter((x) => x > 0);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  }, [data]);

  const trackedDays = useMemo(
    () => data.filter((d) => (d.log?.score ?? 0) > 0).length,
    [data]
  );

  const pillarAdherence = useMemo(() => {
    return PILLARS.map((p) => {
      const v = data
        .map((d) => d.log?.pillarScores?.[p] ?? 0)
        .filter((x) => x > 0);
      const avg = v.length
        ? Math.round(v.reduce((a, b) => a + b, 0) / v.length)
        : 0;
      return { pillar: p, avg };
    });
  }, [data]);

  const heat = useMemo(
    () =>
      range(30, state.dailyLogs).map((d) => ({
        date: d.date,
        score: d.log?.score ?? 0,
      })),
    [state.dailyLogs]
  );

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise flex items-end justify-between">
          <div>
            <Eyebrow>Analytics</Eyebrow>
            <h1 className="t-title mt-2 text-[var(--text-1)]">Trends</h1>
          </div>
          <div className="w-[140px]">
            <Segmented
              options={[
                { value: "7d", label: "7D" },
                { value: "30d", label: "30D" },
              ]}
              value={win}
              onChange={setWin}
            />
          </div>
        </div>

        {/* Headline stats */}
        <div className="anim-rise d1 grid grid-cols-3 gap-3">
          <Card pad="p-4">
            <p className="t-eyebrow">Avg Score</p>
            <p className="mt-3 text-[26px] font-bold text-[var(--text-1)]">
              {avgScore}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Streak</p>
            <p className="mt-3 text-[26px] font-bold text-[var(--warm)]">
              {streak}
            </p>
          </Card>
          <Card pad="p-4">
            <p className="t-eyebrow">Tracked</p>
            <p className="mt-3 text-[26px] font-bold text-[var(--vitality)]">
              {trackedDays}
              <span className="text-[13px] font-medium text-[var(--text-3)]">
                /{days}
              </span>
            </p>
          </Card>
        </div>

        {/* Score trend */}
        <div className="anim-rise d2">
          <h2 className="t-section mb-4 text-[var(--text-1)]">Score Trend</h2>
          <Card pad="p-5">
            <TrendArea
              data={scoreTrend}
              color="var(--readiness)"
              max={100}
            />
          </Card>
        </div>

        {/* Pillar adherence */}
        <div className="anim-rise d3">
          <h2 className="t-section mb-4 text-[var(--text-1)]">
            Pillar Adherence
          </h2>
          <Card>
            <div className="space-y-5">
              {pillarAdherence.map((pa, i) => (
                <div key={pa.pillar}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="t-label text-[var(--text-1)]">
                      {PILLAR_META[pa.pillar].icon}{" "}
                      {PILLAR_META[pa.pillar].label}
                    </span>
                    <span
                      className="text-[14px] font-bold"
                      style={{ color: PILLAR_COLOR[pa.pillar] }}
                    >
                      {pa.avg}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="anim-fade h-full rounded-full"
                      style={{
                        width: `${Math.max(2, pa.avg)}%`,
                        background: PILLAR_COLOR[pa.pillar],
                      }}
                    />
                  </div>
                  {i < pillarAdherence.length - 1 && (
                    <div className="mt-5">
                      <Divider />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* 30-day heat */}
        <div className="anim-rise d4">
          <h2 className="t-section mb-4 text-[var(--text-1)]">
            Consistency Map
          </h2>
          <Card pad="p-5">
            <HeatStrip values={heat} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <span className="t-caption">Less</span>
              {[
                "rgba(255,255,255,0.04)",
                "var(--alert)",
                "var(--warm)",
                "var(--readiness)",
                "var(--vitality)",
              ].map((c) => (
                <div
                  key={c}
                  className="h-3 w-3 rounded-[3px]"
                  style={{ background: c }}
                />
              ))}
              <span className="t-caption">More</span>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
