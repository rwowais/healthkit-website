"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { bundleChecksum } from "@/lib/knowledge";
import {
  buildCatalogBundle,
  listPublications,
  publishBundle,
  rollbackTo,
  type Publication,
} from "@/lib/cms/publish";
import {
  importBuiltin,
  listCmsProtocols,
  getProtocolBehaviors,
  saveProtocol,
  saveBehavior,
  createBehavior,
  reorderBehavior,
  clearUnverified,
  type CmsProtocol,
  type CmsBehavior,
} from "@/lib/cms/authoring";
import { generateBehaviorDraft } from "@/lib/cms/ai";
import {
  BLOCKS,
  ANCHORS,
  KINDS,
  ICONS,
  FIELD_HELP,
  AI_MAX_TIER,
  type AiBehaviorDraft,
} from "@/lib/cms/aiSchema";
import {
  listSuggestions,
  createSuggestion,
  approveSuggestion,
  rejectSuggestion,
  type Suggestion,
} from "@/lib/cms/suggestions";
import type { AppState, DailyLog } from "@/lib/types";
import { Eyebrow, Skeleton } from "@/components/ui";

type Gate = "checking" | "denied" | "ok";
type Tab =
  | "overview"
  | "catalog"
  | "rules"
  | "config"
  | "intelligence"
  | "simulate"
  | "edit"
  | "ai"
  | "publish";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "catalog", label: "Catalog" },
  { id: "rules", label: "Rules" },
  { id: "config", label: "Config" },
  { id: "intelligence", label: "Intelligence" },
  { id: "simulate", label: "Simulate" },
  { id: "edit", label: "Edit" },
  { id: "ai", label: "AI Review" },
  { id: "publish", label: "Publish" },
];

function dk(off: number) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A labelled field row with a hover/tap help tooltip (native title). */
function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          {label}
        </span>
        {help && (
          <span
            title={help}
            className="grid h-3.5 w-3.5 cursor-help place-items-center rounded-full bg-[var(--surface-3)] text-[9px] font-bold text-[var(--text-3)]"
            aria-label={help}
          >
            ?
          </span>
        )}
      </span>
      {children}
    </label>
  );
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

  // ── Publish ───────────────────────────────────────────────────────
  const [pubs, setPubs] = useState<Publication[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const liveSum = useMemo(
    () => bundleChecksum(buildCatalogBundle(0)),
    []
  );
  const refreshPubs = () => listPublications().then(setPubs);
  useEffect(() => {
    if (gate === "ok") refreshPubs();
  }, [gate]);

  // ── Edit (relational authoring) ───────────────────────────────────
  const [cmsP, setCmsP] = useState<CmsProtocol[]>([]);
  const [edP, setEdP] = useState<CmsProtocol | null>(null);
  const [edB, setEdB] = useState<CmsBehavior[]>([]);
  const loadCms = () => listCmsProtocols().then(setCmsP);
  useEffect(() => {
    if (gate === "ok" && (tab === "edit" || tab === "ai")) loadCms();
  }, [gate, tab]);

  // ── AI Review (constrained suggestion rail) ───────────────────────
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [dProto, setDProto] = useState("");
  const [dField, setDField] = useState("rationale");
  const [dValue, setDValue] = useState("");
  const [dWhy, setDWhy] = useState("");
  const loadSugs = () => listSuggestions("pending").then(setSugs);
  useEffect(() => {
    if (gate === "ok" && tab === "ai") loadSugs();
  }, [gate, tab]);
  const openProto = async (p: CmsProtocol) => {
    setEdP({ ...p });
    setEdB(await getProtocolBehaviors(p.id));
  };
  const reopen = async () => {
    if (edP) setEdB(await getProtocolBehaviors(edP.id));
  };
  const [nbTitle, setNbTitle] = useState("");
  const [nbBlock, setNbBlock] = useState("morning");
  const [nbLev, setNbLev] = useState(2);

  // ── AI draft-an-item (server route; clamped, draft-only) ──────────
  const [aiDesc, setAiDesc] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiBehaviorDraft | null>(null);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const patchDraft = (p: Partial<AiBehaviorDraft>) =>
    setAiDraft((d) => (d ? { ...d, ...p } : d));

  // Per-row "Saved ✓" transient confirmation for behavior + verify
  // actions — much clearer than the global status line buried far
  // below the row the user clicked on.
  const [savedIds, setSavedIds] = useState<Record<string, true>>({});
  const flashSaved = (id: string) => {
    setSavedIds((s) => ({ ...s, [id]: true }));
    setTimeout(
      () => setSavedIds((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      }),
      1500
    );
  };

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
        {tab === "edit" &&
          (() => {
            const inp =
              "w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none";
            if (cmsP.length === 0)
              return (
                <div className={card} style={surf}>
                  <p className="text-[13.5px] text-[var(--text-2)]">
                    The CMS is empty. Seed it from the built-in catalog
                    (idempotent, byte-identical) to start editing.
                  </p>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setMsg(null);
                      const r = await importBuiltin();
                      setBusy(false);
                      setMsg(r.ok ? "Seeded." : r.reason ?? "Failed");
                      if (r.ok) loadCms();
                    }}
                    className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[13px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    {busy ? "…" : "Seed from built-in catalog"}
                  </button>
                  {msg && (
                    <p className="mt-2 text-[12px] text-[var(--text-3)]">
                      {msg}
                    </p>
                  )}
                </div>
              );
            if (!edP)
              return (
                <div className="space-y-1.5">
                  {cmsP.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openProto(p)}
                      className="press row flex w-full items-center justify-between px-4 py-3 text-left"
                    >
                      <span className="text-[14px] font-medium text-[var(--text-1)]">
                        {p.name}
                      </span>
                      <span className="t-caption">
                        {p.status} · v{p.version}
                      </span>
                    </button>
                  ))}
                </div>
              );
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setEdP(null);
                      setEdB([]);
                    }}
                    className="press text-[13px] font-semibold text-[var(--readiness)]"
                  >
                    ← All protocols
                  </button>
                  <button
                    onClick={() => setTab("publish")}
                    title="Edits are drafts until you Publish — that's when users (and Simulate) see them."
                    className="press tr-fast rounded-[var(--r-pill)] bg-[var(--surface-3)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--text-2)]"
                  >
                    → Publish to make live
                  </button>
                </div>
                <div className={card} style={surf}>
                  <Eyebrow>Protocol</Eyebrow>
                  <div className="mt-2 space-y-2">
                    <input
                      className={inp}
                      value={edP.name}
                      onChange={(e) =>
                        setEdP({ ...edP, name: e.target.value })
                      }
                      placeholder="Name"
                    />
                    <input
                      className={inp}
                      value={edP.tagline ?? ""}
                      onChange={(e) =>
                        setEdP({ ...edP, tagline: e.target.value })
                      }
                      placeholder="Tagline"
                    />
                    <div className="flex gap-2">
                      <input
                        className={inp}
                        value={edP.accent ?? ""}
                        onChange={(e) =>
                          setEdP({ ...edP, accent: e.target.value })
                        }
                        placeholder="Accent (CSS var)"
                      />
                      <select
                        className={inp}
                        value={edP.status}
                        onChange={(e) =>
                          setEdP({ ...edP, status: e.target.value })
                        }
                      >
                        {["draft", "published", "archived"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      const r = await saveProtocol(edP);
                      setBusy(false);
                      setMsg(
                        r.ok ? "Protocol saved" : r.reason ?? "Failed"
                      );
                      if (r.ok) loadCms();
                    }}
                    className="press tr-fast mt-3 rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    Save protocol
                  </button>
                </div>

                <div className={card} style={surf}>
                  <Eyebrow color="var(--readiness)">
                    Add an item with AI
                  </Eyebrow>
                  <p className="t-caption mt-1 leading-relaxed">
                    Describe it in plain words — AI drafts every
                    attribute. It lands as an <b>unverified draft</b>:
                    evidence is capped at <b>{AI_MAX_TIER}</b> and it
                    can&apos;t reach users until you verify it and
                    Publish.
                  </p>

                  {!aiDraft && (
                    <div className="mt-3 space-y-2">
                      <input
                        className={inp}
                        value={aiDesc}
                        onChange={(e) => setAiDesc(e.target.value)}
                        placeholder="e.g. magnesium glycinate 300mg before bed"
                      />
                      <button
                        disabled={aiBusy || !aiDesc.trim()}
                        onClick={async () => {
                          setAiBusy(true);
                          setAiMsg(null);
                          const r = await generateBehaviorDraft(aiDesc);
                          setAiBusy(false);
                          if (r.ok && r.draft) {
                            setAiDraft(r.draft);
                            setAiMsg(null);
                          } else {
                            setAiMsg(r.reason ?? "AI drafting failed.");
                          }
                        }}
                        className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        {aiBusy ? "Drafting…" : "Generate with AI"}
                      </button>
                      {aiMsg && (
                        <p
                          className="rounded-[var(--r-sm)] px-3 py-2 text-[12.5px] font-medium"
                          style={{
                            background: "rgba(232,137,107,.12)",
                            color: "var(--alert)",
                          }}
                        >
                          {aiMsg}
                        </p>
                      )}
                    </div>
                  )}

                  {aiDraft && (
                    <div className="mt-4 space-y-3">
                      <div
                        className="rounded-[var(--r-sm)] px-3 py-2 text-[12px] font-medium"
                        style={{
                          background: "rgba(232,137,107,.12)",
                          color: "var(--alert)",
                        }}
                      >
                        AI-drafted — verify every field against a real
                        source before publishing.
                      </div>

                      <Field label="Title" help={FIELD_HELP.title}>
                        <input
                          className={inp}
                          value={aiDraft.title}
                          onChange={(e) =>
                            patchDraft({ title: e.target.value })
                          }
                        />
                      </Field>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Field label="Block" help={FIELD_HELP.block}>
                            <select
                              className={inp}
                              value={aiDraft.block}
                              onChange={(e) =>
                                patchDraft({
                                  block: e.target
                                    .value as AiBehaviorDraft["block"],
                                })
                              }
                            >
                              {BLOCKS.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="flex-1">
                          <Field label="Anchor" help={FIELD_HELP.anchor}>
                            <select
                              className={inp}
                              value={aiDraft.anchor}
                              onChange={(e) =>
                                patchDraft({
                                  anchor: e.target
                                    .value as AiBehaviorDraft["anchor"],
                                })
                              }
                            >
                              {ANCHORS.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Field
                            label="Offset (min)"
                            help={FIELD_HELP.offsetMin}
                          >
                            <input
                              type="number"
                              className={inp}
                              value={aiDraft.offsetMin}
                              onChange={(e) =>
                                patchDraft({
                                  offsetMin: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                        </div>
                        <div className="flex-1">
                          <Field
                            label="Leverage"
                            help={FIELD_HELP.leverage}
                          >
                            <select
                              className={inp}
                              value={aiDraft.leverage}
                              onChange={(e) =>
                                patchDraft({
                                  leverage: Number(
                                    e.target.value
                                  ) as AiBehaviorDraft["leverage"],
                                })
                              }
                            >
                              {[1, 2, 3].map((s) => (
                                <option key={s} value={s}>
                                  L{s}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Field label="Kind" help={FIELD_HELP.kind}>
                            <select
                              className={inp}
                              value={aiDraft.kind}
                              onChange={(e) =>
                                patchDraft({
                                  kind: e.target
                                    .value as AiBehaviorDraft["kind"],
                                })
                              }
                            >
                              {KINDS.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="flex-1">
                          <Field label="Icon" help={FIELD_HELP.icon}>
                            <select
                              className={inp}
                              value={aiDraft.icon}
                              onChange={(e) =>
                                patchDraft({ icon: e.target.value })
                              }
                            >
                              {ICONS.map((s) => (
                                <option key={s}>{s}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </div>

                      <Field label="Dose" help={FIELD_HELP.dose}>
                        <input
                          className={inp}
                          value={aiDraft.dose ?? ""}
                          onChange={(e) =>
                            patchDraft({
                              dose: e.target.value || null,
                            })
                          }
                          placeholder="e.g. 300 mg (blank if none)"
                        />
                      </Field>

                      <Field
                        label="Rationale"
                        help={FIELD_HELP.rationale}
                      >
                        <textarea
                          className={inp}
                          rows={2}
                          value={aiDraft.rationale}
                          onChange={(e) =>
                            patchDraft({ rationale: e.target.value })
                          }
                        />
                      </Field>

                      <div
                        className="rounded-[var(--r-sm)] p-3"
                        style={{ background: "var(--surface-3)" }}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                            Evidence
                          </span>
                          <span
                            title={FIELD_HELP.evidenceTier}
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: "rgba(232,137,107,.14)",
                              color: "var(--alert)",
                            }}
                          >
                            {aiDraft.evidence.tier} · capped
                          </span>
                        </div>
                        <div className="space-y-2">
                          <Field
                            label="Source"
                            help={FIELD_HELP.evidenceSource}
                          >
                            <input
                              className={inp}
                              value={aiDraft.evidence.sourceLabel}
                              onChange={(e) =>
                                patchDraft({
                                  evidence: {
                                    ...aiDraft.evidence,
                                    sourceLabel: e.target.value,
                                  },
                                })
                              }
                            />
                          </Field>
                          <Field
                            label="Source URL"
                            help={FIELD_HELP.evidenceUrl}
                          >
                            <input
                              className={inp}
                              value={aiDraft.evidence.url ?? ""}
                              onChange={(e) =>
                                patchDraft({
                                  evidence: {
                                    ...aiDraft.evidence,
                                    url: e.target.value || null,
                                  },
                                })
                              }
                              placeholder="https://… (optional)"
                            />
                          </Field>
                          <Field
                            label="Evidence summary"
                            help={FIELD_HELP.evidenceSummary}
                          >
                            <textarea
                              className={inp}
                              rows={2}
                              value={aiDraft.evidence.summary}
                              onChange={(e) =>
                                patchDraft({
                                  evidence: {
                                    ...aiDraft.evidence,
                                    summary: e.target.value,
                                  },
                                })
                              }
                            />
                          </Field>
                        </div>
                      </div>

                      <Field
                        label="Why it matters"
                        help={FIELD_HELP.why}
                      >
                        <textarea
                          className={inp}
                          rows={2}
                          value={aiDraft.explanation.why}
                          onChange={(e) =>
                            patchDraft({
                              explanation: {
                                ...aiDraft.explanation,
                                why: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>
                      <Field
                        label="Why this timing"
                        help={FIELD_HELP.timing}
                      >
                        <input
                          className={inp}
                          value={aiDraft.explanation.timing}
                          onChange={(e) =>
                            patchDraft({
                              explanation: {
                                ...aiDraft.explanation,
                                timing: e.target.value,
                              },
                            })
                          }
                        />
                      </Field>

                      <div className="flex gap-2 pt-1">
                        <button
                          disabled={busy || !aiDraft.title.trim()}
                          onClick={async () => {
                            setBusy(true);
                            setAiMsg(null);
                            const r = await createBehavior(edP.id, {
                              title: aiDraft.title,
                              block: aiDraft.block,
                              leverage: aiDraft.leverage,
                              dose: aiDraft.dose,
                              rationale: aiDraft.rationale,
                              anchor: aiDraft.anchor,
                              offsetMin: aiDraft.offsetMin,
                              kind: aiDraft.kind,
                              icon: aiDraft.icon,
                              aiUnverified: true,
                              evidence: aiDraft.evidence,
                              explanation: aiDraft.explanation,
                            });
                            setBusy(false);
                            if (r.ok) {
                              setAiDraft(null);
                              setAiDesc("");
                              setAiMsg(null);
                              setMsg("Saved as unverified draft.");
                              reopen();
                            } else {
                              setAiMsg(r.reason ?? "Save failed.");
                              console.error("[ai] save failed", r);
                            }
                          }}
                          className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                        >
                          {busy ? "Saving…" : "Save as draft"}
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setAiDraft(null);
                            setAiMsg(null);
                          }}
                          className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-2.5 text-[12px] font-semibold text-[var(--text-2)]"
                        >
                          Discard
                        </button>
                      </div>
                      {aiMsg && (
                        <p
                          className="rounded-[var(--r-sm)] px-3 py-2 text-[12.5px] font-medium"
                          style={{
                            background: "rgba(232,137,107,.12)",
                            color: "var(--alert)",
                          }}
                        >
                          {aiMsg}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Eyebrow>Behaviors</Eyebrow>
                {edB.map((b, idx) => (
                  <div key={b.id} className={card} style={surf}>
                    {b.ai_unverified && (
                      <div
                        className="mb-2 flex items-center justify-between gap-2 rounded-[var(--r-sm)] px-3 py-2"
                        style={{
                          background: "rgba(232,137,107,.12)",
                        }}
                      >
                        <span className="text-[11.5px] font-semibold text-[var(--alert)]">
                          AI-drafted — verify against source. Excluded
                          from publish until cleared.
                        </span>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            const r = await clearUnverified(
                              b.id,
                              b.version
                            );
                            setBusy(false);
                            if (r.ok) {
                              flashSaved(b.id);
                              setMsg(null);
                              reopen();
                            } else {
                              setMsg(r.reason ?? "Failed");
                            }
                          }}
                          className="press shrink-0 rounded-[var(--r-pill)] bg-[var(--text-1)] px-3 py-1.5 text-[11px] font-semibold text-[#08090B]"
                        >
                          {savedIds[b.id] ? "Verified ✓" : "Mark verified"}
                        </button>
                      </div>
                    )}
                    <div className="mb-2 flex items-center justify-between">
                      <span className="t-caption">#{idx + 1}</span>
                      <span className="flex gap-1">
                        {(["-1", "1"] as const).map((d) => (
                          <button
                            key={d}
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              await reorderBehavior(
                                edP.id,
                                b.id,
                                d === "-1" ? -1 : 1
                              );
                              setBusy(false);
                              reopen();
                            }}
                            className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)]"
                            style={{ background: "var(--surface-3)" }}
                            aria-label={d === "-1" ? "Move up" : "Move down"}
                          >
                            {d === "-1" ? "↑" : "↓"}
                          </button>
                        ))}
                      </span>
                    </div>
                    <input
                      className={inp}
                      value={b.title}
                      onChange={(e) =>
                        setEdB((xs) =>
                          xs.map((x, i) =>
                            i === idx
                              ? { ...x, title: e.target.value }
                              : x
                          )
                        )
                      }
                      placeholder="Title"
                    />
                    <div className="mt-2 flex gap-2">
                      <select
                        className={inp}
                        value={b.block}
                        onChange={(e) =>
                          setEdB((xs) =>
                            xs.map((x, i) =>
                              i === idx
                                ? { ...x, block: e.target.value }
                                : x
                            )
                          )
                        }
                      >
                        {[
                          "morning",
                          "afternoon",
                          "evening",
                          "anytime",
                        ].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <select
                        className={inp}
                        value={b.leverage}
                        onChange={(e) =>
                          setEdB((xs) =>
                            xs.map((x, i) =>
                              i === idx
                                ? {
                                    ...x,
                                    leverage: Number(e.target.value),
                                  }
                                : x
                            )
                          )
                        }
                      >
                        {[1, 2, 3].map((s) => (
                          <option key={s} value={s}>
                            L{s}
                          </option>
                        ))}
                      </select>
                      <select
                        className={inp}
                        value={b.status}
                        onChange={(e) =>
                          setEdB((xs) =>
                            xs.map((x, i) =>
                              i === idx
                                ? { ...x, status: e.target.value }
                                : x
                            )
                          )
                        }
                      >
                        {["draft", "published", "archived"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      className={`${inp} mt-2`}
                      value={b.dose ?? ""}
                      onChange={(e) =>
                        setEdB((xs) =>
                          xs.map((x, i) =>
                            i === idx
                              ? { ...x, dose: e.target.value }
                              : x
                          )
                        )
                      }
                      placeholder="Dose"
                    />
                    <textarea
                      className={`${inp} mt-2`}
                      rows={2}
                      value={b.rationale ?? ""}
                      onChange={(e) =>
                        setEdB((xs) =>
                          xs.map((x, i) =>
                            i === idx
                              ? { ...x, rationale: e.target.value }
                              : x
                          )
                        )
                      }
                      placeholder="Rationale"
                    />
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const r = await saveBehavior(b);
                        setBusy(false);
                        if (r.ok) {
                          flashSaved(b.id);
                          setMsg(null);
                        } else {
                          setMsg(r.reason ?? "Save failed.");
                        }
                      }}
                      className="press tr-fast mt-3 rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                    >
                      {savedIds[b.id]
                        ? "Saved ✓"
                        : busy
                          ? "Saving…"
                          : "Save behavior"}
                    </button>
                  </div>
                ))}

                <div className={card} style={surf}>
                  <Eyebrow color="var(--readiness)">Add behavior</Eyebrow>
                  <input
                    className={`${inp} mt-2`}
                    value={nbTitle}
                    onChange={(e) => setNbTitle(e.target.value)}
                    placeholder="Title"
                  />
                  <div className="mt-2 flex gap-2">
                    <select
                      className={inp}
                      value={nbBlock}
                      onChange={(e) => setNbBlock(e.target.value)}
                    >
                      {[
                        "morning",
                        "afternoon",
                        "evening",
                        "anytime",
                      ].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <select
                      className={inp}
                      value={nbLev}
                      onChange={(e) => setNbLev(Number(e.target.value))}
                    >
                      {[1, 2, 3].map((s) => (
                        <option key={s} value={s}>
                          L{s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    disabled={busy || !nbTitle.trim()}
                    onClick={async () => {
                      setBusy(true);
                      const r = await createBehavior(edP.id, {
                        title: nbTitle.trim(),
                        block: nbBlock,
                        leverage: nbLev,
                      });
                      setBusy(false);
                      setMsg(
                        r.ok ? "Behavior added" : r.reason ?? "Failed"
                      );
                      if (r.ok) {
                        setNbTitle("");
                        reopen();
                      }
                    }}
                    className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    Add behavior
                  </button>
                </div>
                {msg && (
                  <p className="text-[12px] text-[var(--text-3)]">
                    {msg}
                  </p>
                )}
                <p className="t-caption">
                  Edits are drafts until you Publish a bundle — users
                  (and the Simulate tab) see nothing change until then.
                  When you&apos;re ready, hit{" "}
                  <button
                    onClick={() => setTab("publish")}
                    className="press font-semibold text-[var(--readiness)] underline-offset-2 hover:underline"
                  >
                    Publish
                  </button>
                  .
                </p>
              </div>
            );
          })()}

        {tab === "ai" &&
          (() => {
            const inp =
              "w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none";
            return (
              <div className="space-y-4">
                <div className={card} style={surf}>
                  <Eyebrow color="var(--readiness)">
                    Draft a suggestion
                  </Eyebrow>
                  <p className="t-caption mt-1">
                    Exactly the row shape a future model submits. It only
                    ever creates a <b>pending</b> proposal — never a live
                    change.
                  </p>
                  {cmsP.length === 0 ? (
                    <p className="mt-3 text-[12.5px] text-[var(--text-3)]">
                      Seed the CMS in the Edit tab first.
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <select
                        className={inp}
                        value={dProto}
                        onChange={(e) => setDProto(e.target.value)}
                      >
                        <option value="">Select a protocol…</option>
                        {cmsP.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <select
                          className={inp}
                          value={dField}
                          onChange={(e) => setDField(e.target.value)}
                        >
                          {["tagline", "name", "accent", "goal"].map(
                            (f) => (
                              <option key={f}>{f}</option>
                            )
                          )}
                        </select>
                        <input
                          className={inp}
                          value={dValue}
                          onChange={(e) => setDValue(e.target.value)}
                          placeholder="Proposed value"
                        />
                      </div>
                      <input
                        className={inp}
                        value={dWhy}
                        onChange={(e) => setDWhy(e.target.value)}
                        placeholder="Rationale"
                      />
                      <button
                        disabled={busy || !dProto || !dValue}
                        onClick={async () => {
                          setBusy(true);
                          const r = await createSuggestion({
                            entityType: "protocol",
                            entityId: dProto,
                            proposed: { [dField]: dValue },
                            rationale: dWhy,
                          });
                          setBusy(false);
                          setMsg(r.ok ? "Proposed" : r.reason ?? "Failed");
                          if (r.ok) {
                            setDValue("");
                            setDWhy("");
                            loadSugs();
                          }
                        }}
                        className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Submit suggestion
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <Eyebrow>Pending review</Eyebrow>
                  {sugs.length === 0 && (
                    <p className="t-caption mt-2 px-1">
                      No pending suggestions.
                    </p>
                  )}
                  <div className="mt-2 space-y-2">
                    {sugs.map((s) => (
                      <div key={s.id} className={card} style={surf}>
                        <p className="text-[12px] text-[var(--text-3)]">
                          {s.entity_type} · {s.model ?? "—"}
                        </p>
                        <p className="mt-1 text-[13px] text-[var(--text-1)]">
                          <code>{JSON.stringify(s.proposed)}</code>
                        </p>
                        {s.rationale && (
                          <p className="mt-1 text-[12.5px] text-[var(--text-2)]">
                            {s.rationale}
                          </p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              const r = await approveSuggestion(s);
                              setBusy(false);
                              setMsg(
                                r.ok
                                  ? "Approved → draft updated (not live)"
                                  : r.reason ?? "Failed"
                              );
                              loadSugs();
                            }}
                            className="press rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1.5 text-[12px] font-semibold text-[#08090B]"
                          >
                            Approve → draft
                          </button>
                          <button
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              await rejectSuggestion(s.id);
                              setBusy(false);
                              loadSugs();
                            }}
                            className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-2)]"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {msg && (
                    <p className="mt-2 text-[12px] text-[var(--text-3)]">
                      {msg}
                    </p>
                  )}
                  <p className="t-caption mt-3">
                    Approving writes a draft only. Nothing reaches users
                    until you Publish a bundle.
                  </p>
                </div>
              </div>
            );
          })()}

        {tab === "publish" && (
          <div className="space-y-4">
            <div className={card} style={surf}>
              <Eyebrow color="var(--readiness)">
                Current effective catalog
              </Eyebrow>
              <p className="mt-2 text-[12.5px] text-[var(--text-2)]">
                Checksum <code>{liveSum}</code>. Publishing snapshots this
                into a new immutable version the app refreshes to when
                online. Nothing here mutates production automatically.
              </p>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Change note (what & why)"
                className="mt-3 w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[13px] text-[var(--text-1)] outline-none"
              />
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg(null);
                  const r = await publishBundle(note.trim());
                  setBusy(false);
                  setMsg(
                    r.ok
                      ? `Published v${r.version} (${r.checksum})`
                      : r.reason
                  );
                  if (r.ok) {
                    setNote("");
                    refreshPubs();
                  }
                }}
                className="press tr-fast mt-3 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-3 text-[13px] font-semibold text-[#08090B] disabled:opacity-40"
              >
                {busy ? "…" : "Publish current catalog"}
              </button>
              {msg && (
                <p className="mt-2 text-[12px] text-[var(--text-3)]">
                  {msg}
                </p>
              )}
            </div>

            <div>
              <Eyebrow>History (immutable)</Eyebrow>
              <div className="mt-2 space-y-1.5">
                {pubs.length === 0 && (
                  <p className="t-caption px-1">
                    No publications yet (or Supabase not configured).
                  </p>
                )}
                {pubs.map((p, i) => (
                  <div
                    key={p.version}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-md)] p-3.5"
                    style={surf}
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--text-1)]">
                        v{p.version}
                        {i === 0 && (
                          <span className="ml-2 text-[10px] text-[var(--vitality)]">
                            LIVE
                          </span>
                        )}
                      </p>
                      <p className="t-caption mt-0.5 truncate">
                        {p.note ?? "—"} · {p.checksum}
                      </p>
                    </div>
                    {i !== 0 && (
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setMsg(null);
                          const r = await rollbackTo(p.version);
                          setBusy(false);
                          setMsg(
                            r.ok
                              ? `Rolled back → v${r.version}`
                              : r.reason
                          );
                          if (r.ok) refreshPubs();
                        }}
                        className="press shrink-0 rounded-[var(--r-pill)] bg-[var(--surface-3)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-2)]"
                      >
                        Roll back
                      </button>
                    )}
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
