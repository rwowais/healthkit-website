"use client";

/**
 * GoalsCard — outcome goals the user steers toward (a biomarker target, a
 * streak, or weekly active days). Progress is derived live (goals.ts), never
 * stored. Creating/removing a goal mutates settings.outcomeGoals via onUpdate.
 */
import { useMemo, useState } from "react";
import type { AppState, OutcomeGoal, UserSettings } from "@/lib/types";
import { goalProgress, newId } from "@/lib/goals";
import { BIOMARKERS, biomarkerDef } from "@/lib/biomarkers";
import { MiniRing } from "@/components/ui/Ring";
import { Eyebrow, Sheet, Button, Segmented, useToast } from "@/components/ui";
import { Icon } from "@/components/ui/icons";

type Kind = OutcomeGoal["kind"];

const FIELD =
  "w-full rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--surface-2)] px-3.5 py-2.5 text-[14px] text-[var(--text-1)] outline-none focus:border-[var(--hairline-strong)]";

export default function GoalsCard({
  state,
  onUpdate,
}: {
  state: AppState;
  onUpdate: (patch: Partial<UserSettings>) => void;
}) {
  const toast = useToast();
  const goals = useMemo(
    () => state.settings.outcomeGoals ?? [],
    [state.settings.outcomeGoals]
  );
  const progresses = useMemo(
    () => goals.map((g) => goalProgress(state, g)),
    [goals, state]
  );

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("biomarker");
  const [metric, setMetric] = useState("restingHR");
  const [target, setTarget] = useState("");

  const latestFor = (m: string): number | null => {
    let best: { date: string; value: number } | null = null;
    for (const b of state.biomarkers ?? [])
      if (b.metric === m && (!best || b.date > best.date))
        best = { date: b.date, value: b.value };
    return best?.value ?? null;
  };

  const targetNum = Number(target);
  const valid =
    target.trim() !== "" &&
    isFinite(targetNum) &&
    targetNum > 0 &&
    (kind !== "weeklyActive" || (targetNum >= 1 && targetNum <= 7)) &&
    (kind !== "streak" || targetNum >= 2);

  const reset = () => {
    setKind("biomarker");
    setMetric("restingHR");
    setTarget("");
  };

  const save = () => {
    if (!valid) return;
    let goal: OutcomeGoal;
    const base = { id: newId("goal"), target: targetNum, createdAt: new Date().toISOString() };
    if (kind === "biomarker") {
      const def = biomarkerDef(metric);
      const dir = def?.direction;
      const word = dir === "lower" ? "under" : dir === "higher" ? "over" : "→";
      goal = {
        ...base,
        kind,
        metric,
        startValue: latestFor(metric) ?? undefined,
        label: `${def?.label ?? metric} ${word} ${targetNum}${
          def?.unit ? " " + def.unit : ""
        }`,
      };
    } else if (kind === "streak") {
      goal = { ...base, kind, label: `${targetNum}-day streak` };
    } else {
      goal = { ...base, kind, label: `${targetNum} active days a week` };
    }
    onUpdate({ outcomeGoals: [...goals, goal] });
    setOpen(false);
    reset();
    toast.show("Goal set");
  };

  const remove = (id: string) => {
    onUpdate({ outcomeGoals: goals.filter((g) => g.id !== id) });
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Eyebrow color="var(--vitality)">Goals</Eyebrow>
        {goals.length > 0 && (
          <button
            onClick={() => setOpen(true)}
            className="press tr-fast text-[12px] font-semibold text-[var(--text-3)]"
          >
            + Add
          </button>
        )}
      </div>

      {goals.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="press tr-fast panel mt-3 flex w-full items-center gap-3 p-4 text-left"
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--r-sm)]"
            style={{
              background: "color-mix(in srgb, var(--vitality) 14%, var(--surface-3))",
              color: "var(--vitality)",
            }}
          >
            <Icon name="compass" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-[var(--text-1)]">
              Set a target to steer toward
            </span>
            <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
              A body metric, a streak, or weekly active days — and watch the
              progress fill.
            </span>
          </span>
          <Icon name="chevron" size={13} className="shrink-0 text-[var(--text-4)]" />
        </button>
      ) : (
        <div className="well mt-3 space-y-1.5 p-1.5">
          {progresses.map((p) => (
            <div key={p.goal.id} className="row flex items-center gap-3.5 px-3 py-3">
              <MiniRing
                value={p.pct * 100}
                size={46}
                stroke={4}
                color={p.achieved ? "var(--vitality)" : "var(--readiness)"}
                icon={
                  p.achieved ? (
                    <Icon name="check" size={16} stroke={2.2} />
                  ) : undefined
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-[var(--text-1)]">
                  {p.goal.label}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-3)]">
                  {p.current != null && `Now ${p.current}${p.unit === "/wk" ? "" : ""} · `}
                  {p.detail}
                </p>
              </div>
              <button
                onClick={() => remove(p.goal.id)}
                aria-label="Remove goal"
                className="press tr-fast grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-4)]"
                style={{ background: "var(--surface-3)" }}
              >
                <Icon name="ban" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Set a goal">
        <div className="flex flex-col gap-4">
          <Segmented<Kind>
            options={[
              { value: "biomarker", label: "Body metric" },
              { value: "streak", label: "Streak" },
              { value: "weeklyActive", label: "Weekly" },
            ]}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setTarget("");
            }}
          />

          {kind === "biomarker" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-3)]">
                Metric
              </label>
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className={FIELD}
              >
                {BIOMARKERS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label} ({b.unit})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium text-[var(--text-3)]">
              {kind === "biomarker"
                ? `Target ${biomarkerDef(metric)?.unit ?? ""}`.trim()
                : kind === "streak"
                ? "Target streak (days)"
                : "Active days per week (1–7)"}
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                kind === "biomarker"
                  ? String(biomarkerDef(metric)?.optimal ?? "")
                  : kind === "streak"
                  ? "30"
                  : "5"
              }
              className={FIELD}
            />
            {kind === "biomarker" && (
              <p className="mt-1.5 text-[11.5px] text-[var(--text-4)]">
                {latestFor(metric) != null
                  ? `Latest reading: ${latestFor(metric)} ${biomarkerDef(metric)?.unit}. Progress is measured from there.`
                  : "No reading yet — log one on Body trends to track progress."}
              </p>
            )}
          </div>

          <Button full onClick={save} disabled={!valid}>
            Set goal
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
