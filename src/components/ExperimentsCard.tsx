"use client";

/**
 * ExperimentsCard — run a structured self-experiment: test one change
 * against a chosen check-in metric over a fixed window, measuring the
 * metric during the test vs a baseline window just before it. The readout
 * (goals.ts) refuses a verdict until both windows have ≥4 data points and
 * never claims causation — it reports the before/during difference plainly.
 */
import { useMemo, useState } from "react";
import type { AppState, Experiment, UserSettings } from "@/lib/types";
import { experimentReadout, newId } from "@/lib/goals";
import { getTz, dateKeyInTz, addDaysToKey } from "@/lib/tz";
import { Eyebrow, Sheet, Button, useToast } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

const METRICS: { value: Experiment["metric"]; label: string }[] = [
  { value: "sleepQuality", label: "Sleep quality" },
  { value: "energy", label: "Energy" },
  { value: "mood", label: "Mood" },
  { value: "sleepDuration", label: "Sleep duration" },
];

const VERDICT: Record<string, { color: string; label: string }> = {
  better: { color: "var(--vitality)", label: "Helped" },
  worse: { color: "var(--alert)", label: "Didn't help" },
  "no-change": { color: "var(--text-3)", label: "No effect" },
  inconclusive: { color: "var(--readiness)", label: "Gathering data" },
};

const FIELD =
  "w-full rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] text-[var(--text-1)] outline-none focus:border-[var(--hairline-strong)]";

export default function ExperimentsCard({
  state,
  onUpdate,
}: {
  state: AppState;
  onUpdate: (patch: Partial<UserSettings>) => void;
}) {
  const toast = useToast();
  const experiments = useMemo(
    () => state.settings.experiments ?? [],
    [state.settings.experiments]
  );
  const readouts = useMemo(
    () =>
      experiments
        .map((e) => experimentReadout(state, e))
        .sort((a, b) => Number(b.active) - Number(a.active)),
    [experiments, state]
  );

  const [open, setOpen] = useState(false);
  const [hypothesis, setHypothesis] = useState("");
  const [metric, setMetric] = useState<Experiment["metric"]>("sleepQuality");
  const [duration, setDuration] = useState(14);

  const valid = hypothesis.trim().length >= 3;

  const save = () => {
    if (!valid) return;
    const today = dateKeyInTz(getTz(state.settings));
    const exp: Experiment = {
      id: newId("exp"),
      hypothesis: hypothesis.trim(),
      metric,
      startDate: today,
      endDate: addDaysToKey(today, duration),
      baselineDays: 7,
      createdAt: new Date().toISOString(),
    };
    onUpdate({ experiments: [...experiments, exp] });
    setOpen(false);
    setHypothesis("");
    setMetric("sleepQuality");
    setDuration(14);
    toast.show("Experiment started");
  };

  const conclude = (id: string) => {
    onUpdate({
      experiments: experiments.map((e) =>
        e.id === id ? { ...e, concludedAt: new Date().toISOString() } : e
      ),
    });
  };
  const remove = (id: string) => {
    onUpdate({ experiments: experiments.filter((e) => e.id !== id) });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Eyebrow color="var(--recovery)">Experiments</Eyebrow>
        {experiments.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="press tr-fast text-[12px] font-semibold text-[var(--text-3)]"
          >
            + New
          </button>
        )}
      </div>

      {experiments.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="press tr-fast panel mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-sm)]"
            style={{
              background: "color-mix(in srgb, var(--recovery) 14%, var(--surface-3))",
              color: "var(--recovery)",
            }}
          >
            <Icon name="flask" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[var(--text-1)]">
              Test what actually works for you
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
              Try one change for a few weeks — the app measures the before vs
              during, honestly.
            </span>
          </span>
          <Icon name="chevron" size={13} className="shrink-0 text-[var(--text-4)]" />
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5">
          {readouts.map((r) => {
            const v = VERDICT[r.verdict];
            return (
              <div key={r.exp.id} className="panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold leading-snug text-[var(--text-1)]">
                    {r.exp.hypothesis}
                  </p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
                    style={{
                      color: v.color,
                      background: `color-mix(in srgb, ${v.color} 16%, transparent)`,
                    }}
                  >
                    {v.label}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-[var(--text-3)]">
                  Measuring {r.metricLabel.toLowerCase()}
                  {r.active
                    ? ` · ${r.daysLeft} day${r.daysLeft === 1 ? "" : "s"} left`
                    : " · concluded"}
                </p>
                {r.baselineAvg != null && r.duringAvg != null && (
                  <div className="mt-2.5 flex items-center gap-2 text-[13px] font-semibold tabular-nums text-[var(--text-2)]">
                    <span className="text-[var(--text-4)]">
                      {r.baselineAvg}
                      {r.unit}
                    </span>
                    <Icon name="arrowRight" size={12} className="text-[var(--text-4)]" />
                    <span style={{ color: v.color }}>
                      {r.duringAvg}
                      {r.unit}
                    </span>
                  </div>
                )}
                <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-3)]">
                  {r.summary}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {r.active && (
                    <button
                      onClick={() => conclude(r.exp.id)}
                      className="press tr-fast text-[12px] font-semibold text-[var(--text-2)]"
                    >
                      Conclude now
                    </button>
                  )}
                  <button
                    onClick={() => remove(r.exp.id)}
                    className="press tr-fast text-[12px] font-semibold text-[var(--text-4)]"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Start an experiment">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-3)]">
              What are you testing?
            </label>
            <input
              type="text"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Magnesium before bed improves my sleep"
              className={FIELD}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-3)]">
              Outcome to measure
            </label>
            <select
              aria-label="Outcome to measure"
              value={metric}
              onChange={(e) => setMetric(e.target.value as Experiment["metric"])}
              className={FIELD}
            >
              {METRICS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-3)]">
              Run for
            </label>
            <div className="flex gap-2">
              {[14, 21, 28].map((dur) => (
                <button
                  key={dur}
                  onClick={() => setDuration(dur)}
                  className="press tr-fast flex-1 rounded-[var(--r-md)] py-2.5 text-[13px] font-semibold"
                  style={{
                    background:
                      duration === dur ? "var(--recovery)" : "var(--surface-2)",
                    color: duration === dur ? "var(--bg)" : "var(--text-3)",
                  }}
                >
                  {dur} days
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--text-4)]">
              Your last 7 days become the baseline. Keep checking in daily so
              there&rsquo;s enough to compare.
            </p>
          </div>
          <Button full onClick={save} disabled={!valid}>
            Start experiment
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
