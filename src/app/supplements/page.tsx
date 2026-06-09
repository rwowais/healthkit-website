"use client";

/**
 * /supplements — the supplement management surface.
 *
 * Three tabs:
 *   1. Your stack — currently-taking list grouped by block. Tap to
 *      edit. Custom-add + browse-catalog entry points.
 *   2. Browse — the curated catalog. Add to stack with one tap.
 *   3. Grid — 14-day adherence grid (M-S × supplement).
 *
 * The page is the long-tail surface; the Today flow is unchanged
 * (SupplementBlockCard handles the daily check). This page is where
 * the user manages WHICH supplements they take.
 */
import { Suspense, useMemo, useState } from "react";
import Shell from "@/components/Shell";
import { Card, Eyebrow, Button } from "@/components/ui";
import { Icon } from "@/components/ui/icons";
import * as haptic from "@/lib/haptics";
import { useAppState } from "@/hooks/useAppState";
import {
  curatedSupplementCatalog,
  supplementsForBlock,
  isSupplementContraindicated,
} from "@/lib/supplements";
import SupplementSheet from "@/components/SupplementSheet";
import type { Supplement, TimeBlock, SafetyFlag } from "@/lib/types";
import {
  getTz,
  addDaysToKey,
  dateKeyInTz,
  dayIndexOfKeyInTz,
} from "@/lib/tz";
import { blockLabel } from "@/lib/engine";

type ViewMode = "stack" | "browse" | "grid";

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

function SupplementsInner() {
  const {
    state,
    addSupplement,
    updateSupplement,
    removeSupplement,
    updateSettings,
  } = useAppState();
  const [view, setView] = useState<ViewMode>("stack");
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [creating, setCreating] = useState(false);

  const userSupplements = state.supplements ?? [];
  const userIds = useMemo(
    () => new Set(userSupplements.map((s) => s.id)),
    [userSupplements]
  );
  const catalog = useMemo(curatedSupplementCatalog, []);
  const tz = getTz(state.settings);
  const today = dateKeyInTz(tz);

  // Group user's supplements by block for the stack view. We use
  // supplementsForBlock so the same safety-flag + daysActive
  // filtering that Today's SupplementBlockCard applies is honored
  // here. Without this filter, a user with `anticoagulants: true`
  // would still see fish oil here even though Today hides it.
  // Use the saved-tz weekday (matches Today's SupplementBlockCard + the
  // engine), not the device clock — otherwise a device in a different zone
  // can list a different day's set near midnight.
  const dayIndex = dayIndexOfKeyInTz(tz, today);
  const byBlock = useMemo(() => {
    const m: Record<TimeBlock, Supplement[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      anytime: [],
    };
    for (const b of BLOCKS) {
      m[b] = supplementsForBlock(
        userSupplements,
        b,
        dayIndex,
        state.settings.safetyFlags ?? {}
      );
    }
    return m;
  }, [userSupplements, dayIndex, state.settings.safetyFlags]);

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>Supplements</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {view === "browse"
              ? "Browse catalog"
              : view === "grid"
              ? "Adherence grid"
              : "Your stack"}
          </h1>
          <p className="t-caption mt-2 leading-relaxed">
            {view === "browse"
              ? "Curated supplements with doses and timing. Tap Add to put one in your stack."
              : view === "grid"
              ? "Each row is a supplement; each square is a day. Filled = taken, empty = missed."
              : "Bundle, edit, and track. Times are loose — supplements are block-based (morning, evening), not minute-based."}
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 rounded-[var(--r-pill)] p-1"
          style={{ background: "var(--surface-2)" }}
        >
          {(
            [
              ["stack", "Your stack"],
              ["browse", "Browse"],
              ["grid", "Adherence"],
            ] as Array<[ViewMode, string]>
          ).map(([v, label]) => {
            const on = view === v;
            return (
              <button
                key={v}
                onClick={() => {
                  haptic.light();
                  setView(v);
                }}
                className="flex-1 rounded-[var(--r-pill)] py-2 text-[12.5px] font-semibold tr-fast"
                style={{
                  background: on ? "var(--text-1)" : "transparent",
                  color: on ? "var(--bg)" : "var(--text-3)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {view === "stack" && (
          <StackView
            byBlock={byBlock}
            onEdit={setEditing}
            onAdd={() => setCreating(true)}
            onBrowse={() => setView("browse")}
            onHideTab={() => updateSettings({ hideSupplementsTab: true })}
            today={today}
            completions={
              state.dailyLogs.find((l) => l.date === today)
                ?.supplementCompletions ?? {}
            }
            stateSupplements={userSupplements}
            blockLabels={state.settings.blockLabels}
          />
        )}

        {view === "browse" && (
          <BrowseView
            catalog={catalog}
            installedIds={userIds}
            flags={state.settings.safetyFlags ?? {}}
            onInstall={(s) => {
              haptic.medium();
              addSupplement(s);
            }}
            onRemove={(id) => removeSupplement(id)}
          />
        )}

        {view === "grid" && (
          <GridView
            // Same safety suppressor as Stack + Today, so a contraindicated
            // supplement (hidden everywhere else) doesn't show here as a row of
            // empty cells reading "you keep missing this".
            supplements={userSupplements.filter(
              (s) =>
                !isSupplementContraindicated(s, state.settings.safetyFlags ?? {})
            )}
            logs={state.dailyLogs}
            tz={tz}
          />
        )}
      </div>

      {/* Edit existing */}
      <SupplementSheet
        supplement={editing}
        onClose={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) updateSupplement(editing.id, patch);
        }}
        onRemove={() => {
          if (editing) removeSupplement(editing.id);
        }}
      />

      {/* Create custom */}
      <SupplementSheet
        supplement={
          creating
            ? {
                id: `supp:${Date.now().toString(36)}`,
                name: "",
                block: "morning",
                source: "custom",
              }
            : null
        }
        onClose={() => setCreating(false)}
        onSave={(patch) => {
          const id = `supp:${Date.now().toString(36)}`;
          const supp: Supplement = {
            id,
            name: patch.name ?? "Custom supplement",
            dose: patch.dose,
            block: patch.block ?? "morning",
            timing: patch.timing,
            brand: patch.brand,
            notes: patch.notes,
            daysActive: patch.daysActive,
            inventory: patch.inventory,
            source: "custom",
          };
          addSupplement(supp);
        }}
      />
    </Shell>
  );
}

// ── Stack view ────────────────────────────────────────────────────

function StackView({
  byBlock,
  onEdit,
  onAdd,
  onBrowse,
  onHideTab,
  today,
  completions,
  stateSupplements,
  blockLabels,
}: {
  byBlock: Record<TimeBlock, Supplement[]>;
  onEdit: (s: Supplement) => void;
  onAdd: () => void;
  onBrowse: () => void;
  /** Optional: hide-tab callback. When present we surface the
   * "Don't take supplements? Hide this tab" link in empty state. */
  onHideTab?: () => void;
  today: string;
  completions: Record<string, boolean>;
  stateSupplements: Supplement[];
  /** Custom day-block display names (settings.blockLabels). */
  blockLabels?: {
    morning?: string;
    afternoon?: string;
    evening?: string;
    anytime?: string;
  };
}) {
  const empty = stateSupplements.length === 0;
  if (empty) {
    return (
      <Card>
        <Eyebrow>No supplements yet</Eyebrow>
        <p className="t-body mt-2 leading-relaxed text-[var(--text-2)]">
          Browse the catalog to add curated supplements (Magnesium,
          Vitamin D, NMN, etc.) or create a custom one for anything
          you take that isn&apos;t in the catalog.
        </p>
        <div className="mt-4 flex gap-2.5">
          <Button onClick={onBrowse} full>
            Browse catalog
          </Button>
          <Button onClick={onAdd} variant="ghost" full>
            Add custom
          </Button>
        </div>
        {/* In-context escape hatch — a user who doesn't take supplements
            shouldn't have to dig through Profile → Preferences to make
            the tab go away. Surface the toggle right where the empty
            state lives. */}
        {onHideTab && (
          <button
            onClick={onHideTab}
            className="press tr-fast mt-4 w-full text-center text-[12px] text-[var(--text-4)] underline-offset-2 hover:text-[var(--text-3)] hover:underline"
          >
            Don&apos;t take supplements? Hide this tab.
          </button>
        )}
      </Card>
    );
  }
  return (
    <div className="space-y-5">
      {BLOCKS.map((b) => {
        const list = byBlock[b];
        if (list.length === 0) return null;
        // Count against the SAME flag-filtered list that's rendered, so
        // the header total can never exceed the visible rows. (A
        // contraindicated supplement is dropped from byBlock but the old
        // progress helper still counted it — header read e.g. 3/5 over a
        // 4-row card.)
        const done = list.filter((s) => completions?.[s.id] === true).length;
        const prog = { done, total: list.length };
        return (
          <div key={b}>
            <div className="mb-2 flex items-center justify-between">
              <Eyebrow>{blockLabel(b, blockLabels)}</Eyebrow>
              {prog && (
                <span className="text-[11px] font-semibold text-[var(--text-3)]">
                  {prog.done}/{prog.total} today
                </span>
              )}
            </div>
            <Card>
              <div className="-my-1.5 divide-y divide-[var(--hairline)]">
                {list.map((s) => {
                  const lowStock =
                    s.inventory &&
                    s.inventory.refillAt != null &&
                    s.inventory.count <= s.inventory.refillAt;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onEdit(s)}
                      className="press tr-fast flex w-full items-center gap-3 py-3 text-left"
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--warm) 14%, var(--surface-3))",
                          color: "var(--warm)",
                        }}
                      >
                        <Icon name="pill" size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-[var(--text-1)]">
                          {s.name}
                        </p>
                        {/* Dose and timing as a single line. Joining
                            with " · " inline (instead of separate <span>
                            children) keeps the separator attached to the
                            preceding word when the line wraps on narrow
                            screens — otherwise the dot ended up floating
                            on its own line. line-clamp-1 caps height so
                            long timing reasons get truncated cleanly. */}
                        {(s.dose || s.timing) && (
                          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-[var(--text-3)]">
                            {[s.dose, s.timing].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {lowStock && (
                          <span
                            className="mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                            style={{
                              background:
                                "color-mix(in srgb, var(--alert) 18%, transparent)",
                              color: "var(--alert)",
                            }}
                          >
                            {s.inventory!.count} left
                          </span>
                        )}
                      </div>
                      <Icon
                        name="chevron"
                        size={13}
                        className="text-[var(--text-4)]"
                      />
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        );
      })}
      <div className="flex gap-2.5">
        <Button onClick={onBrowse} full>
          Browse catalog
        </Button>
        <Button onClick={onAdd} variant="ghost" full>
          Add custom
        </Button>
      </div>
    </div>
  );
}

// ── Browse view ───────────────────────────────────────────────────

function BrowseView({
  catalog,
  installedIds,
  flags,
  onInstall,
  onRemove,
}: {
  catalog: Supplement[];
  installedIds: Set<string>;
  flags: Partial<Record<SafetyFlag, boolean>>;
  onInstall: (s: Supplement) => void;
  onRemove: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((s) => s.name.toLowerCase().includes(q));
  }, [catalog, search]);
  return (
    <div className="space-y-4">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search supplements"
        aria-label="Search supplements"
        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[14px] text-[var(--text-1)] outline-none"
      />
      <Card>
        <div className="-my-1.5 divide-y divide-[var(--hairline)]">
          {filtered.length === 0 && (
            <p className="py-3 text-center text-[13px] text-[var(--text-3)]">
              Nothing matches that search.
            </p>
          )}
          {filtered.map((s) => {
            const installed = installedIds.has(s.id);
            // A contraindicated supplement is hidden from the Stack + Today by
            // the safety filter, so a working Add/Remove here is misleading
            // (Add looked like nothing happened). Show an honest note instead.
            const contra = isSupplementContraindicated(s, flags);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 py-3"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                  style={{
                    background:
                      "color-mix(in srgb, var(--warm) 14%, var(--surface-3))",
                    color: "var(--warm)",
                  }}
                >
                  <Icon name="pill" size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--text-1)]">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-3)] line-clamp-1">
                    {s.dose ?? "—"}{" "}
                    {s.evidenceTier && (
                      <span
                        className="ml-1 rounded-[5px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{
                          background: "var(--surface-3)",
                          color: "var(--text-3)",
                        }}
                      >
                        {s.evidenceTier}
                      </span>
                    )}
                  </p>
                </div>
                {contra ? (
                  <span
                    className="shrink-0 text-right text-[11px] font-medium leading-tight text-[var(--text-3)]"
                    style={{ maxWidth: 132 }}
                  >
                    Not recommended with your health settings
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      if (installed) {
                        // Confirm before removing — matches the editor sheet's
                        // guard, so a stray tap in Browse can't silently drop a
                        // supplement. (History is preserved either way.)
                        if (
                          window.confirm(
                            `Stop tracking ${s.name}? Your history is kept.`
                          )
                        )
                          onRemove(s.id);
                      } else onInstall(s);
                    }}
                    className="press tap-44 tr-fast rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold"
                    style={{
                      background: installed
                        ? "var(--surface-3)"
                        : "var(--text-1)",
                      color: installed ? "var(--text-2)" : "var(--bg)",
                    }}
                  >
                    {installed ? "Remove" : "Add"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ── Grid view (14-day adherence) ──────────────────────────────────

function GridView({
  supplements,
  logs,
  tz,
}: {
  supplements: Supplement[];
  logs: { date: string; supplementCompletions?: Record<string, boolean> }[];
  tz: string;
}) {
  const today = dateKeyInTz(tz);
  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 13; i >= 0; i--) out.push(addDaysToKey(today, -i));
    return out;
  }, [today]);
  const logByDate = useMemo(() => {
    const m = new Map<string, Record<string, boolean>>();
    for (const l of logs) m.set(l.date, l.supplementCompletions ?? {});
    return m;
  }, [logs]);
  if (supplements.length === 0) {
    return (
      <Card>
        <p className="t-body text-[var(--text-3)]">
          No supplements to track yet.
        </p>
      </Card>
    );
  }
  return (
    <Card>
      <Eyebrow>Last 14 days</Eyebrow>
      <p className="t-caption mt-1 mb-3 leading-relaxed">
        Each row is one supplement. Each square is one day — filled
        means you took it, empty means you didn&apos;t.
      </p>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-semibold text-[var(--text-4)] uppercase tracking-wide pr-2 pb-2">
                Supplement
              </th>
              {days.map((d) => {
                const day = d.slice(8);
                return (
                  <th
                    key={d}
                    className="px-0.5 pb-2 text-center text-[10px] font-medium text-[var(--text-4)]"
                  >
                    {day}
                  </th>
                );
              })}
              <th className="pl-2 pb-2 text-right text-[10px] font-semibold text-[var(--text-4)] uppercase tracking-wide">
                Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {supplements.map((s) => {
              let done = 0;
              const cells = days.map((d) => {
                // Off-days (a supplement scheduled only some weekdays via
                // daysActive, [Mon..Sun]) can't be taken, so they must not
                // count against its rate — else a Mon/Wed/Fri supplement caps
                // near 43% even at perfect adherence.
                const dow = dayIndexOfKeyInTz(tz, d);
                const scheduled =
                  !s.daysActive ||
                  s.daysActive.length !== 7 ||
                  s.daysActive[dow] !== false;
                const log = logByDate.get(d);
                const isDone = log?.[s.id] === true;
                if (isDone && scheduled) done++;
                return { d, isDone, scheduled };
              });
              const scheduledCount = cells.filter((c) => c.scheduled).length;
              const rate = scheduledCount
                ? Math.round((done / scheduledCount) * 100)
                : 0;
              return (
                <tr key={s.id}>
                  <td className="pr-2 py-1 text-[12.5px] text-[var(--text-1)] truncate max-w-[140px]">
                    {s.name}
                  </td>
                  {cells.map(({ d, isDone, scheduled }) => (
                    <td
                      key={d}
                      className="text-center"
                      title={`${d} — ${
                        !scheduled
                          ? "not scheduled"
                          : isDone
                          ? "done"
                          : "missed"
                      }`}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-[3px]"
                        style={
                          !scheduled
                            ? {
                                border: "1px dashed var(--hairline-strong)",
                                opacity: 0.4,
                              }
                            : {
                                background: isDone
                                  ? "var(--vitality)"
                                  : "var(--surface-3)",
                                opacity: isDone ? 1 : 0.5,
                              }
                        }
                      />
                    </td>
                  ))}
                  <td className="pl-2 py-1 text-right text-[12px] font-semibold text-[var(--text-2)]">
                    {rate}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SupplementsPage() {
  return (
    <Suspense
      fallback={
        <Shell>
          <p className="t-eyebrow">Supplements</p>
        </Shell>
      }
    >
      <SupplementsInner />
    </Suspense>
  );
}
