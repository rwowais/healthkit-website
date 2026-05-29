"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import {
  RULE_METRICS,
  type MetricMeta,
  type RuleCondition,
  type RuleOp,
  type RuleTrigger,
  type RuleEffect,
  type AdaptMode,
} from "@/lib/cms/rules";

/**
 * RuleEditor — visual builder for adaptation rules.
 *
 * Replaces the previous two raw JSON textareas (one for trigger, one
 * for effect). A non-technical operator can build "if recoveryProxy <
 * 45 AND sleepQuality <= 2 → recovery mode" without typing a single
 * brace. JSON power-mode lives behind an "Advanced" disclosure for
 * the 10% of cases the visual form can't express.
 *
 * Schema (mirrors lib/cms/rules.ts so the runtime evaluator stays
 * authoritative):
 *   trigger: { all?: RuleCondition[]; any?: RuleCondition[] }
 *   condition: { metric, op, value }
 *   effect: { setMode?, headline?, tone?, reason? }
 *
 * Why the visual form maps to the "all" branch by default:
 *   "And" composition is what an operator usually means by "when X
 *   AND Y". The toggle at the top swaps to "any" (OR) when the rule
 *   should fire on either condition.
 */
const OPS: { op: RuleOp; label: string }[] = [
  { op: "<", label: "is less than" },
  { op: "<=", label: "is at most" },
  { op: ">", label: "is greater than" },
  { op: ">=", label: "is at least" },
  { op: "==", label: "equals" },
  { op: "!=", label: "is not" },
];

const MODES: { mode: AdaptMode; label: string; help: string }[] = [
  {
    mode: "rebuild",
    label: "Rebuild",
    help: "Easing back in — 3 high-leverage behaviors only",
  },
  {
    mode: "recovery",
    label: "Recovery",
    help: "Demote training; promote rest, sleep, sunlight",
  },
  {
    mode: "essentials",
    label: "Essentials",
    help: "Only leverage-3 behaviors; up to 7 max",
  },
  {
    mode: "lighter",
    label: "Lighter",
    help: "Mute leverage-1 (easy-win) behaviors",
  },
  {
    mode: "primed",
    label: "Primed",
    help: "Full day, with high-leverage emphasis",
  },
  {
    mode: "normal",
    label: "Normal",
    help: "The baseline day — no adjustment",
  },
];

interface RuleEditorProps {
  trigger: unknown;
  effect: unknown;
  onChange: (next: { trigger: unknown; effect: unknown }) => void;
  /** Whether to show the small inline preview of the resulting JSON. */
  showPreview?: boolean;
}

export default function RuleEditor({
  trigger,
  effect,
  onChange,
  showPreview = false,
}: RuleEditorProps) {
  const parsedTrigger = useMemo<RuleTrigger>(() => {
    if (trigger && typeof trigger === "object") return trigger as RuleTrigger;
    return { all: [] };
  }, [trigger]);
  const parsedEffect = useMemo<RuleEffect>(() => {
    if (effect && typeof effect === "object") return effect as RuleEffect;
    return {};
  }, [effect]);

  const [mode, setMode] = useState<"all" | "any">(
    parsedTrigger.any ? "any" : "all"
  );
  const conditions: RuleCondition[] =
    (mode === "all" ? parsedTrigger.all : parsedTrigger.any) ?? [];
  const [advanced, setAdvanced] = useState(false);

  // Keep mode in sync when the parent updates the trigger via Advanced.
  useEffect(() => {
    if (parsedTrigger.any && mode !== "any") setMode("any");
    else if (parsedTrigger.all && mode !== "all") setMode("all");
  }, [parsedTrigger, mode]);

  const updateTrigger = (next: RuleTrigger) =>
    onChange({ trigger: next, effect: parsedEffect });
  const updateEffect = (next: RuleEffect) =>
    onChange({ trigger: parsedTrigger, effect: next });

  const setConditions = (next: RuleCondition[]) => {
    updateTrigger(mode === "all" ? { all: next } : { any: next });
  };

  const addCondition = () => {
    const first: MetricMeta = RULE_METRICS[0];
    const value: RuleCondition["value"] =
      first.type === "boolean" ? true : first.type === "string" ? "" : 0;
    setConditions([
      ...conditions,
      { metric: first.name, op: "<", value } as RuleCondition,
    ]);
  };

  const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
    setConditions(
      conditions.map((c, i) => (i === idx ? ({ ...c, ...patch } as RuleCondition) : c))
    );
  };

  const removeCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const swapMode = (next: "all" | "any") => {
    setMode(next);
    updateTrigger(next === "all" ? { all: conditions } : { any: conditions });
  };

  return (
    <div className="space-y-4">
      {/* Trigger — visual */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            When
          </p>
          <div
            className="flex gap-0.5 rounded-[var(--r-pill)] p-0.5 text-[10.5px]"
            style={{ background: "var(--surface-3)" }}
          >
            <button
              onClick={() => swapMode("all")}
              className="rounded-[var(--r-pill)] px-2 py-0.5 font-semibold tr-fast"
              style={{
                background: mode === "all" ? "var(--text-1)" : "transparent",
                color: mode === "all" ? "var(--bg)" : "var(--text-3)",
              }}
            >
              all of
            </button>
            <button
              onClick={() => swapMode("any")}
              className="rounded-[var(--r-pill)] px-2 py-0.5 font-semibold tr-fast"
              style={{
                background: mode === "any" ? "var(--text-1)" : "transparent",
                color: mode === "any" ? "var(--bg)" : "var(--text-3)",
              }}
            >
              any of
            </button>
          </div>
        </div>
        {conditions.length === 0 ? (
          <div
            className="rounded-[var(--r-sm)] py-3 px-3 text-center text-[12px] text-[var(--text-3)]"
            style={{
              background: "var(--surface-3)",
              border: "1px dashed var(--hairline)",
            }}
          >
            No conditions yet. The rule will fire every time — add at least one
            condition to gate it.
          </div>
        ) : (
          <div className="space-y-1.5">
            {conditions.map((c, idx) => {
              const meta = RULE_METRICS.find((m) => m.name === c.metric);
              return (
                <div
                  key={idx}
                  className="flex flex-wrap items-center gap-1.5 rounded-[var(--r-sm)] p-1.5"
                  style={{ background: "var(--surface-3)" }}
                >
                  <select
                    value={c.metric}
                    onChange={(e) => {
                      const m = RULE_METRICS.find((x) => x.name === e.target.value)!;
                      const def =
                        m.type === "boolean"
                          ? true
                          : m.type === "string"
                          ? ""
                          : 0;
                      updateCondition(idx, { metric: m.name, value: def });
                    }}
                    className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-1)] outline-none max-w-[180px] truncate"
                    title={meta?.description}
                  >
                    {RULE_METRICS.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={c.op}
                    onChange={(e) =>
                      updateCondition(idx, { op: e.target.value as RuleOp })
                    }
                    className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-1)] outline-none"
                  >
                    {OPS.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {meta?.type === "boolean" ? (
                    <select
                      value={String(c.value)}
                      onChange={(e) =>
                        updateCondition(idx, { value: e.target.value === "true" })
                      }
                      className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-1)] outline-none"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : meta?.type === "string" ? (
                    <input
                      value={String(c.value)}
                      onChange={(e) =>
                        updateCondition(idx, { value: e.target.value })
                      }
                      className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-1)] outline-none flex-1 min-w-[80px]"
                    />
                  ) : (
                    <input
                      type="number"
                      value={Number(c.value)}
                      onChange={(e) =>
                        updateCondition(idx, { value: Number(e.target.value) })
                      }
                      className="rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1 text-[12px] text-[var(--text-1)] outline-none w-24"
                    />
                  )}
                  <button
                    onClick={() => removeCondition(idx)}
                    className="press tr-fast ml-auto rounded-full p-1 text-[var(--text-4)] hover:text-[var(--alert)]"
                    aria-label="Remove condition"
                    title="Remove"
                  >
                    <Icon name="ban" size={12} />
                  </button>
                  {meta && (
                    <p className="basis-full text-[10.5px] text-[var(--text-4)] pl-1">
                      {meta.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <button
          onClick={addCondition}
          className="press tr-fast mt-2 inline-flex items-center gap-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] px-3 py-1 text-[11.5px] font-semibold text-[var(--text-2)]"
        >
          <Icon name="plus" size={11} />
          Add condition
        </button>
      </div>

      {/* Effect — visual */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)] mb-2">
          Then
        </p>
        <div className="rounded-[var(--r-sm)] p-2 space-y-2" style={{ background: "var(--surface-3)" }}>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-3)]">
              Set adaptive mode
            </label>
            <select
              value={parsedEffect.setMode ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateEffect({
                  ...parsedEffect,
                  setMode: v === "" ? undefined : (v as AdaptMode),
                });
              }}
              className="mt-1 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none"
            >
              <option value="">— Don&apos;t change the mode —</option>
              {MODES.map((m) => (
                <option key={m.mode} value={m.mode}>
                  {m.label} — {m.help}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-3)]">
              Override headline (optional)
            </label>
            <input
              value={parsedEffect.headline ?? ""}
              onChange={(e) =>
                updateEffect({
                  ...parsedEffect,
                  headline: e.target.value || undefined,
                })
              }
              placeholder="e.g. Soft start today"
              className="mt-1 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[var(--text-3)]">
              Add reason (shown to user)
            </label>
            <input
              value={parsedEffect.reason ?? ""}
              onChange={(e) =>
                updateEffect({
                  ...parsedEffect,
                  reason: e.target.value || undefined,
                })
              }
              placeholder="e.g. Two rough nights in a row"
              className="mt-1 w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-2 py-1.5 text-[12px] text-[var(--text-1)] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Advanced JSON — opt-in escape hatch */}
      <details
        open={advanced}
        onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]">
          Advanced: edit as JSON
        </summary>
        <div className="mt-2 space-y-2">
          <textarea
            rows={3}
            value={JSON.stringify(parsedTrigger, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && typeof parsed === "object") {
                  updateTrigger(parsed);
                }
              } catch {
                /* keep stale until valid */
              }
            }}
            className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-2 py-1.5 font-mono text-[11px] text-[var(--text-1)] outline-none"
          />
          <textarea
            rows={2}
            value={JSON.stringify(parsedEffect, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                if (parsed && typeof parsed === "object") {
                  updateEffect(parsed);
                }
              } catch {}
            }}
            className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-2 py-1.5 font-mono text-[11px] text-[var(--text-1)] outline-none"
          />
        </div>
      </details>

      {showPreview && (
        <pre
          className="text-[10px] text-[var(--text-4)] rounded-[var(--r-sm)] p-2 overflow-x-auto"
          style={{ background: "var(--surface-3)" }}
        >
          {JSON.stringify({ trigger: parsedTrigger, effect: parsedEffect }, null, 2)}
        </pre>
      )}
    </div>
  );
}
