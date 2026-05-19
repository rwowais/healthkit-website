"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { activePacks, activeBundleVersion } from "@/lib/knowledge";
import {
  ADAPTIVE_MODES,
  RULE_SETS,
  CONFIG_ROWS,
  INTEL_KINDS,
} from "@/lib/cms/introspect";
import { getDefaultState } from "@/lib/storage";
import { adapt, compileTimeline, shapeTimeline } from "@/lib/engine";
import type { AppState, DailyLog } from "@/lib/types";
import { Eyebrow, Skeleton } from "@/components/ui";

type Gate = "checking" | "denied" | "ok";
type Tab =
  | "overview"
  | "catalog"
  | "rules"
  | "config"
  | "intelligence"
  | "simulate";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "catalog", label: "Catalog" },
  { id: "rules", label: "Rules" },
  { id: "config", label: "Config" },
  { id: "intelligence", label: "Intelligence" },
  { id: "simulate", label: "Simulate" },
];

function dk(off: number) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminHome() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let alive = true;
    isAdmin().then((ok) => {
      if (!alive) return;
      setGate(ok ? "ok" : "denied");
      if (!ok) setTimeout(() => router.replace("/today"), 1400);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  const packs = activePacks();

  // ── Simulate ──────────────────────────────────────────────────────
  const [sel, setSel] = useState<string[]>(() =>
    packs.slice(0, 2).map((p) => p.id)
  );
  const [sleepQ, setSleepQ] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [gap, setGap] = useState(0);

  const sim = useMemo(() => {
    const base = getDefaultState();
    const logs: DailyLog[] = [];
    const mkLog = (date: string, p: Partial<DailyLog>): DailyLog =>
      ({
        date,
        behaviorCompletions: {},
        score: 0,
        sleepLog: {},
        energyLevel: null,
        moodLevel: null,
        exerciseEntries: [],
        supplementEntries: [],
        sleepCompletions: [],
        completions: [],
        nutritionScorecard: { customItems: [], note: "" },
        ...p,
      }) as unknown as DailyLog;
    // today's check-in encodes recovery
    logs.push(
      mkLog(dk(0), {
        sleepLog: { sleepQuality: sleepQ } as DailyLog["sleepLog"],
        energyLevel: energy,
      })
    );
    // a prior active day gap+1 days ago → drives gapDays
    if (gap > 0)
      logs.push(mkLog(dk(gap + 1), { score: 60, energyLevel: 3 }));
    const state: AppState = {
      ...base,
      installedPacks: sel,
      dailyLogs: logs,
    };
    const a = adapt(state);
    const shaped = shapeTimeline(
      compileTimeline(state, 0),
      a.mode,
      {}
    );
    return { mode: a.mode, headline: a.headline, tone: a.tone, shaped };
  }, [sel, sleepQ, energy, gap]);

  if (gate === "checking")
    return (
      <div className="mx-auto max-w-[720px] px-6 py-16">
        <Skeleton className="h-6 w-40" rounded="rounded-full" />
        <Skeleton className="mt-5 h-40 w-full" />
      </div>
    );
  if (gate === "denied")
    return (
      <div className="mx-auto flex max-w-[720px] flex-col items-center px-6 py-24 text-center">
        <p className="t-section text-[var(--text-1)]">Not authorized</p>
        <p className="t-caption mt-2">
          Internal area. Returning you to the app…
        </p>
      </div>
    );

  const behaviorCount = new Set(
    packs.flatMap((p) => p.behaviors.map((b) => b.canonicalKey))
  ).size;

  const card = "rounded-[var(--r-md)] p-4";
  const surf = { background: "var(--surface-2)" } as const;

  return (
    <div className="mx-auto max-w-[720px] px-6 py-12">
      <Eyebrow color="var(--readiness)">
        Internal · Protocol Intelligence
      </Eyebrow>
      <h1 className="t-title mt-2 text-[var(--text-1)]">Knowledge CMS</h1>
      <p className="t-caption mt-2 leading-relaxed">
        Read-only inspector of the live intelligence. The app runs on the
        built-in catalog (bundle v{activeBundleVersion()}) until a reviewed
        bundle is published.
      </p>

      <div className="no-scrollbar mt-6 flex gap-1.5 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="press tr-fast shrink-0 rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-semibold"
            style={{
              background:
                tab === t.id ? "var(--text-1)" : "var(--surface-2)",
              color: tab === t.id ? "#08090B" : "var(--text-3)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Protocols", v: packs.length },
              { k: "Behaviors", v: behaviorCount },
              { k: "Live bundle", v: `v${activeBundleVersion()}` },
            ].map((s) => (
              <div key={s.k} className={card} style={surf}>
                <p className="text-[22px] font-bold text-[var(--text-1)]">
                  {s.v}
                </p>
                <p className="t-caption mt-1">{s.k}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "catalog" && (
          <div className="space-y-3">
            {packs.map((p) => (
              <div key={p.id} className={card} style={surf}>
                <p className="text-[15px] font-bold text-[var(--text-1)]">
                  {p.name}{" "}
                  <span className="t-caption font-normal">
                    · {p.source} · {p.behaviors.length} behaviors
                  </span>
                </p>
                <p className="t-caption mt-0.5">{p.tagline}</p>
                <div className="mt-3 space-y-1">
                  {p.behaviors.map((b) => (
                    <div
                      key={b.canonicalKey}
                      className="flex items-center justify-between gap-3 text-[12.5px]"
                    >
                      <span className="text-[var(--text-2)]">
                        {b.title}
                      </span>
                      <span className="shrink-0 text-[var(--text-4)]">
                        {b.block} · L{b.leverage} ·{" "}
                        <code>{b.canonicalKey}</code>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "rules" && (
          <div className="space-y-4">
            <div>
              <Eyebrow>Adaptive modes</Eyebrow>
              <div className="mt-2 space-y-2">
                {ADAPTIVE_MODES.map((m) => (
                  <div key={m.mode} className={card} style={surf}>
                    <p className="text-[14px] font-bold capitalize text-[var(--text-1)]">
                      {m.mode}
                    </p>
                    <p className="mt-1 text-[12.5px] text-[var(--text-2)]">
                      <b>Trigger:</b> {m.trigger}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-[var(--text-3)]">
                      <b>Effect:</b> {m.effect}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow>Behavior rule sets</Eyebrow>
              <div className="mt-2 space-y-2">
                {RULE_SETS.map((r) => (
                  <div key={r.name} className={card} style={surf}>
                    <p className="text-[14px] font-bold text-[var(--text-1)]">
                      {r.name}
                    </p>
                    <p className="mt-0.5 t-caption">{r.purpose}</p>
                    <p className="mt-1.5 text-[12px] text-[var(--text-3)]">
                      {r.keys.length ? r.keys.join(" · ") : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "config" && (
          <div className="space-y-2">
            {CONFIG_ROWS.map((c) => (
              <div
                key={c.key}
                className="flex items-start justify-between gap-3 rounded-[var(--r-md)] p-3.5"
                style={surf}
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--text-1)]">
                    {c.key}
                  </p>
                  <p className="t-caption mt-0.5">{c.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-bold text-[var(--text-1)]">
                    {c.value}
                  </p>
                  <p className="text-[10px] text-[var(--text-4)]">
                    {c.kind}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "intelligence" && (
          <div className="space-y-2">
            {INTEL_KINDS.map((k) => (
              <div key={k.name} className={card} style={surf}>
                <p className="text-[14px] font-bold text-[var(--text-1)]">
                  {k.name}
                </p>
                <p className="mt-0.5 text-[12.5px] text-[var(--text-2)]">
                  {k.does}
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-3)]">
                  Honesty gate: {k.gate}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === "simulate" && (
          <div className="space-y-4">
            <div className={card} style={surf}>
              <Eyebrow>Installed packs</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {packs.map((p) => {
                  const on = sel.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() =>
                        setSel((s) =>
                          on
                            ? s.filter((x) => x !== p.id)
                            : [...s, p.id]
                        )
                      }
                      className="press rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold"
                      style={{
                        background: on
                          ? "var(--readiness)"
                          : "var(--surface-3)",
                        color: on ? "#08090B" : "var(--text-3)",
                      }}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Sleep",
                    val: sleepQ,
                    set: setSleepQ,
                    opts: [2, 3, 5],
                  },
                  {
                    label: "Energy",
                    val: energy,
                    set: setEnergy,
                    opts: [2, 3, 5],
                  },
                  {
                    label: "Gap days",
                    val: gap,
                    set: setGap,
                    opts: [0, 1, 2, 4],
                  },
                ].map((g) => (
                  <div key={g.label}>
                    <p className="t-caption mb-1">{g.label}</p>
                    <div className="flex gap-1">
                      {g.opts.map((o) => (
                        <button
                          key={o}
                          onClick={() => g.set(o)}
                          className="press flex-1 rounded-[8px] py-1.5 text-[12px] font-semibold"
                          style={{
                            background:
                              g.val === o
                                ? "var(--text-1)"
                                : "var(--surface-3)",
                            color:
                              g.val === o ? "#08090B" : "var(--text-3)",
                          }}
                        >
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={card} style={surf}>
              <Eyebrow color="var(--readiness)">
                Result · mode: {sim.mode}
              </Eyebrow>
              <p className="mt-2 text-[14px] font-bold text-[var(--text-1)]">
                {sim.headline}
              </p>
              <p className="mt-1 text-[12.5px] text-[var(--text-3)]">
                {sim.tone}
              </p>
              <div className="mt-3 space-y-1">
                {sim.shaped.length === 0 && (
                  <p className="t-caption">No behaviors (no packs).</p>
                )}
                {sim.shaped.map((it) => (
                  <div
                    key={it.canonicalKey}
                    className="flex items-center justify-between gap-3 text-[12.5px]"
                    style={{ opacity: it.muted ? 0.45 : 1 }}
                  >
                    <span className="text-[var(--text-1)]">
                      {it.title}
                    </span>
                    <span className="shrink-0 text-[var(--text-4)]">
                      {it.block}
                      {it.muted ? " · eased" : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
        Protocolize · internal · build{" "}
        {process.env.NEXT_PUBLIC_BUILD ?? "dev"}
      </p>
    </div>
  );
}
