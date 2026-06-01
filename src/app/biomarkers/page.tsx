"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getAccess, getFreeBiomarkers } from "@/lib/entitlements";
import {
  BIOMARKERS,
  biomarkerBand,
  targetText,
  type BiomarkerDef,
} from "@/lib/biomarkers";
import { Sparkline } from "@/components/ui/Charts";
import {
  Eyebrow,
  Skeleton,
  Sheet,
  Button,
  Divider,
  useToast,
} from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import type { BiomarkerEntry } from "@/lib/types";
import { getTz, dateKeyInTz } from "@/lib/tz";

export default function BiomarkersPage() {
  const { state, loading, addBiomarker, deleteBiomarker } = useAppState();
  const router = useRouter();
  const access = getAccess(state);
  const toast = useToast();
  // Saved-tz "today" (matches the store's clamp + the rest of the app), not
  // the device clock — avoids a day-off picker/max near midnight in a
  // different zone.
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);
  const [open, setOpen] = useState<BiomarkerDef | null>(null);
  const [val, setVal] = useState("");
  const [date, setDate] = useState(today);

  const byMetric = useMemo(() => {
    const m: Record<string, BiomarkerEntry[]> = {};
    for (const b of state.biomarkers) {
      (m[b.metric] ??= []).push(b);
    }
    for (const k in m) m[k].sort((a, b) => a.date.localeCompare(b.date));
    return m;
  }, [state.biomarkers]);

  const submit = () => {
    if (!open) return;
    // Strict: reject empty and partially-numeric input ("12abc") rather than
    // silently logging 12, the way parseFloat would.
    const trimmed = val.trim();
    const n = trimmed === "" ? NaN : Number(trimmed);
    if (Number.isNaN(n)) {
      toast.show("Enter a number");
      return;
    }
    // Free tier: cap distinct tracked markers.
    const distinct = new Set(
      (state.biomarkers ?? []).map((b) => b.metric)
    );
    if (
      !access.premium &&
      !distinct.has(open.key) &&
      distinct.size >= getFreeBiomarkers()
    ) {
      setOpen(null);
      router.push("/upgrade");
      return;
    }
    addBiomarker({ metric: open.key, value: n, date });
    setVal("");
    toast.show(`${open.label} logged`);
  };

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  const markerList = () => {
    return (
      <section className="anim-rise">
        <div className="well space-y-1.5 p-1.5">
          {/* Tracked metrics first (those with at least one reading), then
              the rest in catalog order — so a user who logs weight + HRV
              sees them up top instead of scrolling past untracked panels.
              V8's sort is stable, so within-group order is preserved. */}
          {[...BIOMARKERS]
            .sort(
              (a, b) =>
                ((byMetric[b.key]?.length ?? 0) > 0 ? 1 : 0) -
                ((byMetric[a.key]?.length ?? 0) > 0 ? 1 : 0)
            )
            .map((def) => {
            const hist = byMetric[def.key] ?? [];
            const last = hist[hist.length - 1];
            const bandInfo =
              last && def.direction !== "range"
                ? biomarkerBand(def, last.value)
                : null;
            return (
              <button
                key={def.key}
                onClick={() => {
                  setOpen(def);
                  setVal("");
                  setDate(today);
                }}
                className="row row-tap flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold text-[var(--text-1)]">
                    {def.label}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
                    {last
                      ? `${last.value} ${def.unit}`
                      : `Tap to log · ${def.unit}`}
                  </p>
                </div>
                {hist.length > 1 && (
                  <Sparkline
                    data={hist.map((h) => h.value)}
                    color={
                      bandInfo ? bandInfo.color : "var(--text-3)"
                    }
                    width={64}
                    height={26}
                  />
                )}
                {bandInfo ? (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold"
                    style={{
                      background: "var(--surface-3)",
                      color: bandInfo.color,
                    }}
                  >
                    {bandInfo.label}
                  </span>
                ) : (
                  <Icon
                    name="plus"
                    size={16}
                    className="shrink-0 text-[var(--text-4)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  const hist = open ? byMetric[open.key] ?? [] : [];

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise">
          <Eyebrow color="var(--recovery)">Body</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Body Trends</h1>
          <p className="t-caption mt-2 leading-relaxed">
            The body signals that move with your training and recovery —
            weight, HRV, resting heart rate, and more. For your own
            tracking, not medical advice.
          </p>
        </div>

        {markerList()}
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.label}
      >
        {open && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="t-caption">{targetText(open)}</span>
              {hist.length > 0 && (
                <span className="text-[13px] font-semibold text-[var(--text-2)]">
                  Latest {hist[hist.length - 1].value} {open.unit}
                </span>
              )}
            </div>

            {hist.length > 1 && (
              <div
                className="rounded-[var(--r-md)] p-4"
                style={{ background: "var(--surface-2)" }}
              >
                <Sparkline
                  data={hist.map((h) => h.value)}
                  color="var(--recovery)"
                  width={260}
                  height={56}
                />
              </div>
            )}

            <div
              className="rounded-[var(--r-md)] p-4"
              style={{ background: "var(--surface-2)" }}
            >
              <Eyebrow color="var(--recovery)">Why it matters</Eyebrow>
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                {open.why}
              </p>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <Eyebrow>Value ({open.unit})</Eyebrow>
                <input
                  autoFocus
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  placeholder={open.placeholder ?? "0"}
                  className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3.5 py-3 text-[16px] font-semibold text-[var(--text-1)] outline-none"
                />
              </div>
              <div className="flex-1">
                <Eyebrow>Date</Eyebrow>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3.5 py-3 text-[14px] text-[var(--text-1)] outline-none"
                />
              </div>
            </div>

            <Button full onClick={submit}>
              Log reading
            </Button>

            {hist.length > 0 && (
              <>
                <Divider />
                <div className="space-y-1">
                  <Eyebrow>History</Eyebrow>
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto no-scrollbar">
                    {[...hist]
                      .reverse()
                      .map((h) => {
                        const b =
                          open.direction !== "range"
                            ? biomarkerBand(open, h.value)
                            : null;
                        return (
                          <div
                            key={h.id}
                            className="flex items-center justify-between rounded-[10px] px-3 py-2.5"
                            style={{ background: "var(--surface-2)" }}
                          >
                            <span className="text-[13px] text-[var(--text-3)]">
                              {h.date}
                            </span>
                            <div className="flex items-center gap-3">
                              <span
                                className="text-[14px] font-semibold"
                                style={{
                                  color: b ? b.color : "var(--text-1)",
                                }}
                              >
                                {h.value} {open.unit}
                              </span>
                              <button
                                onClick={() => deleteBiomarker(h.id)}
                                aria-label="Delete"
                                className="press grid min-h-[44px] min-w-[44px] place-items-center text-[var(--text-4)] hover:text-[var(--alert)]"
                              >
                                <Icon name="ban" size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Sheet>
    </Shell>
  );
}
