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
  previewNextBundle,
  getLatestPublishedBundle,
  diffBundles,
  type Publication,
  type BundleDiff,
} from "@/lib/cms/publish";
import {
  importBuiltin,
  listCmsProtocols,
  getProtocolBehaviors,
  saveProtocol,
  saveBehavior,
  createBehavior,
  createProtocol,
  reorderBehavior,
  clearUnverified,
  listRevisions,
  listEvidence,
  upsertEvidence,
  listExplanations,
  upsertExplanation,
  assembleBundleFromCMS,
  type CmsProtocol,
  type CmsBehavior,
  type RevisionRow,
  type EvidenceRow,
  type ExplanationRow,
} from "@/lib/cms/authoring";
import {
  generateBehaviorDraft,
  generateBehaviorDraftAndSuggestProtocol,
} from "@/lib/cms/ai";
import { PACKS } from "@/lib/packs";
import type { ProtocolPack } from "@/lib/types";
import {
  BLOCKS,
  ANCHORS,
  KINDS,
  ICONS,
  FIELD_HELP,
  AI_MAX_TIER,
  type AiBehaviorDraft,
  type AiBehaviorDraftWithSuggestions,
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
  type SimSrc = "builtin" | "drafts" | "live";
  const [simSrc, setSimSrc] = useState<SimSrc>("live");
  const [simPacks, setSimPacks] = useState<ProtocolPack[]>(() =>
    activePacks()
  );
  // Resolve simulation packs from the selected source. Built-in is the
  // frozen `PACKS` constant; drafts comes from the CMS authoring tables;
  // live is whatever the runtime is currently serving (built-in unless
  // a newer published bundle has been adopted this session).
  useEffect(() => {
    let alive = true;
    (async () => {
      if (simSrc === "builtin") {
        if (alive) setSimPacks(PACKS);
        return;
      }
      if (simSrc === "live") {
        if (alive) setSimPacks(activePacks());
        return;
      }
      const drafts = await assembleBundleFromCMS();
      if (alive) setSimPacks(drafts ?? PACKS);
    })();
    return () => {
      alive = false;
    };
  }, [simSrc, tab]);
  // When sim source changes, default selection to the first 2 packs of
  // that source so the picker isn't empty after a switch.
  useEffect(() => {
    setSel((prev) => {
      const ids = new Set(simPacks.map((p) => p.id));
      const stillValid = prev.filter((x) => ids.has(x));
      if (stillValid.length > 0) return stillValid;
      return simPacks.slice(0, 2).map((p) => p.id);
    });
  }, [simPacks]);

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

  // Bundle diff preview — assembled fresh whenever the Publish tab is
  // opened so the admin can see exactly what would ship.
  const [diff, setDiff] = useState<BundleDiff | null>(null);
  const [diffBusy, setDiffBusy] = useState(false);
  const refreshDiff = async () => {
    setDiffBusy(true);
    try {
      const [prev, next] = await Promise.all([
        getLatestPublishedBundle(),
        previewNextBundle(),
      ]);
      setDiff(diffBundles(prev, next));
    } catch {
      setDiff(null);
    } finally {
      setDiffBusy(false);
    }
  };
  useEffect(() => {
    if (gate === "ok" && tab === "publish") refreshDiff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, tab]);

  // ── Edit (relational authoring) ───────────────────────────────────
  const [cmsP, setCmsP] = useState<CmsProtocol[]>([]);
  const [edP, setEdP] = useState<CmsProtocol | null>(null);
  const [edB, setEdB] = useState<CmsBehavior[]>([]);
  const loadCms = () => listCmsProtocols().then(setCmsP);
  useEffect(() => {
    if (
      gate === "ok" &&
      (tab === "edit" || tab === "ai" || tab === "overview" || tab === "simulate")
    )
      loadCms();
  }, [gate, tab]);

  // CMS counts for the Overview "Drafts in CMS" tile.
  const [cmsBehCount, setCmsBehCount] = useState<number | null>(null);
  useEffect(() => {
    if (gate !== "ok" || tab !== "overview") return;
    let alive = true;
    (async () => {
      const sb = (await import("@/lib/supabase")).getSupabase();
      if (!sb) return;
      try {
        const { count } = await sb
          .from("cms_behaviors")
          .select("*", { count: "exact", head: true });
        if (alive) setCmsBehCount(count ?? 0);
      } catch {
        /* no-op */
      }
    })();
    return () => {
      alive = false;
    };
  }, [gate, tab]);

  // ── AI Review (constrained suggestion rail) ───────────────────────
  const [sugs, setSugs] = useState<Suggestion[]>([]);
  const [sugStatus, setSugStatus] = useState<
    "pending" | "approved" | "rejected"
  >("pending");
  const [dEntityType, setDEntityType] = useState<"protocol" | "behavior">(
    "protocol"
  );
  const [dProto, setDProto] = useState("");
  const [dBehaviorId, setDBehaviorId] = useState("");
  const [dBehaviors, setDBehaviors] = useState<CmsBehavior[]>([]);
  const [dField, setDField] = useState("rationale");
  const [dValue, setDValue] = useState("");
  const [dWhy, setDWhy] = useState("");
  const loadSugs = (status = sugStatus) =>
    listSuggestions(status).then(setSugs);
  useEffect(() => {
    if (gate === "ok" && tab === "ai") loadSugs(sugStatus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, tab, sugStatus]);
  // When the create-suggestion form switches to behavior mode, pull
  // the protocol's behavior list so the picker is populated.
  useEffect(() => {
    if (dEntityType !== "behavior" || !dProto) {
      setDBehaviors([]);
      setDBehaviorId("");
      return;
    }
    getProtocolBehaviors(dProto).then((bs) => {
      setDBehaviors(bs);
      setDBehaviorId(bs[0]?.id ?? "");
    });
  }, [dEntityType, dProto]);
  // Default the field picker to a sensible choice for the entity.
  useEffect(() => {
    setDField(dEntityType === "behavior" ? "rationale" : "tagline");
  }, [dEntityType]);
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

  // Create-protocol form (inline on the All-protocols list).
  const [newProtoOpen, setNewProtoOpen] = useState(false);
  const [newProtoName, setNewProtoName] = useState("");
  const [newProtoTagline, setNewProtoTagline] = useState("");
  const [newProtoGoal, setNewProtoGoal] = useState("");

  // Top-of-Edit "describe an idea — AI picks the protocol" entry point.
  const [aiIdea, setAiIdea] = useState("");
  const [aiIdeaBusy, setAiIdeaBusy] = useState(false);
  const [aiIdeaResult, setAiIdeaResult] =
    useState<AiBehaviorDraftWithSuggestions | null>(null);
  const [aiIdeaMsg, setAiIdeaMsg] = useState<string | null>(null);

  // Expandable per-behavior panels: history / evidence (one open at
  // a time per row keeps the editor calm).
  const [openPanel, setOpenPanel] = useState<{
    id: string;
    kind: "history" | "evidence";
  } | null>(null);
  const [historyRows, setHistoryRows] = useState<RevisionRow[]>([]);
  const [evRow, setEvRow] = useState<EvidenceRow | null>(null);
  const [exRows, setExRows] = useState<ExplanationRow[]>([]);
  const togglePanel = async (
    id: string,
    kind: "history" | "evidence",
    canonicalKey: string
  ) => {
    if (openPanel?.id === id && openPanel?.kind === kind) {
      setOpenPanel(null);
      return;
    }
    setOpenPanel({ id, kind });
    if (kind === "history") {
      const rows = await listRevisions("behavior", id, 12);
      setHistoryRows(rows);
    } else {
      const [ev, ex] = await Promise.all([
        listEvidence("behavior", canonicalKey),
        listExplanations("behavior", canonicalKey),
      ]);
      setEvRow(ev[0] ?? null);
      setExRows(ex);
    }
  };
  const patchEv = (p: Partial<EvidenceRow>) =>
    setEvRow((r) =>
      r
        ? { ...r, ...p }
        : ({
            id: "",
            target_type: "behavior",
            target_ref: "",
            tier: "emerging",
            source_label: null,
            url: null,
            summary: null,
            ...p,
          } as EvidenceRow)
    );
  const exText = (kind: string) =>
    exRows.find((r) => r.kind === kind)?.text ?? "";
  const setExText = (kind: string, text: string) =>
    setExRows((rs) => {
      const i = rs.findIndex((r) => r.kind === kind);
      if (i === -1)
        return [
          ...rs,
          {
            id: "",
            target_type: "behavior",
            target_ref: "",
            kind,
            text,
            status: "draft",
          } as ExplanationRow,
        ];
      const n = [...rs];
      n[i] = { ...n[i], text };
      return n;
    });

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
  // Per-row in-flight state — saving behavior #3 should NOT disable
  // every other row's buttons. The page-wide `busy` is reserved for
  // genuinely global actions (publish, rollback, seed-from-builtin).
  const [savingIds, setSavingIds] = useState<Record<string, true>>({});
  const markSavingStart = (id: string) =>
    setSavingIds((s) => ({ ...s, [id]: true }));
  const markSavingEnd = (id: string) =>
    setSavingIds((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });

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
      compileTimeline(state, 0, simPacks),
      a.mode,
      {}
    );
    return { mode: a.mode, headline: a.headline, tone: a.tone, shaped };
  }, [sel, sleepQ, energy, gap, simPacks]);

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
        Authoring + governance for the protocol catalog. Edits live as
        drafts until you <b>Publish</b> a bundle — the app currently
        serves the built-in v{activeBundleVersion()} catalog unless a
        newer published bundle exists.
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
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  k: "Live protocols",
                  v: packs.length,
                  hint: "Counted from the bundle currently serving users.",
                },
                {
                  k: "Live behaviors",
                  v: behaviorCount,
                  hint: "Distinct canonical keys across the live bundle.",
                },
                {
                  k: "Live bundle",
                  v: `v${activeBundleVersion()}`,
                  hint: "Built-in version unless a newer published bundle has been adopted this session.",
                },
              ].map((s) => (
                <div
                  key={s.k}
                  className={card}
                  style={surf}
                  title={s.hint}
                >
                  <p className="text-[22px] font-bold text-[var(--text-1)]">
                    {s.v}
                  </p>
                  <p className="t-caption mt-1">{s.k}</p>
                </div>
              ))}
            </div>
            <div
              className="rounded-[var(--r-md)] p-4"
              style={surf}
              title="Total rows in the CMS authoring tables — what would be assembled into the next published bundle."
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Drafts in CMS
              </p>
              <p className="mt-1 text-[14px] text-[var(--text-2)]">
                {cmsP.length} protocol{cmsP.length === 1 ? "" : "s"} ·{" "}
                {cmsBehCount === null ? "…" : cmsBehCount} behavior
                {cmsBehCount === 1 ? "" : "s"} authored in the CMS
                tables. None of these reach users until you Publish.
              </p>
            </div>
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
            <p className="t-caption leading-relaxed">
              Read-only inspector of the rules currently baked into the
              engine (<code>adapt()</code> + <code>shapeTimeline()</code>).
              Each <b>Mode</b> shows what triggers it and what users see.
              Each <b>Rule set</b> lists the behavior keys grouped under a
              tag (promote / demote / restraint / training / circadian).
              These are code today; live editing arrives when the Rules
              editor ships in Wave C.
            </p>
            <div>
              <Eyebrow>Adaptive modes</Eyebrow>
              <div className="mt-2 space-y-2">
                {ADAPTIVE_MODES.map((m) => (
                  <div
                    key={m.mode}
                    className={card}
                    style={surf}
                    title={`Mode "${m.mode}" — ${m.effect}`}
                  >
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
                  <div
                    key={r.name}
                    className={card}
                    style={surf}
                    title={`${r.name} — ${r.purpose}`}
                  >
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
            <p className="t-caption leading-relaxed">
              Runtime constants that gate trial behavior, free-tier
              caps, and intelligence thresholds. <b>Live constant</b>{" "}
              values come from <code>src/lib/entitlements.ts</code> and
              are read every render; <b>documented</b> rows describe
              behavior implemented elsewhere in the engine. CMS-backed
              editing of these lands in Wave C.
            </p>
            {CONFIG_ROWS.map((c) => (
              <div
                key={c.key}
                className="flex items-start justify-between gap-3 rounded-[var(--r-md)] p-3.5"
                style={surf}
                title={`${c.key} — ${c.note}`}
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
            <p className="t-caption leading-relaxed">
              The kinds of insights the engine produces. Each one has a
              <b> honesty gate</b> — the minimum sample / effect size /
              non-circularity check it must clear before the user sees
              it. These run in <code>src/lib/intel.ts</code>; this tab
              is documentation only.
            </p>
            {INTEL_KINDS.map((k) => (
              <div
                key={k.name}
                className={card}
                style={surf}
                title={`${k.name} — ${k.does}`}
              >
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
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>Source</Eyebrow>
                <span
                  className="t-caption"
                  title="Built-in: frozen catalog shipped in the app binary. Drafts: current CMS authoring state. Live: whatever the runtime is currently serving (Built-in unless a newer published bundle has been adopted this session)."
                >
                  what to simulate against ?
                </span>
              </div>
              <div className="mt-2 flex gap-1.5">
                {(
                  [
                    { id: "builtin", label: "Built-in" },
                    { id: "drafts", label: "Drafts" },
                    { id: "live", label: "Live" },
                  ] as { id: SimSrc; label: string }[]
                ).map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setSimSrc(o.id)}
                    className="press tr-fast flex-1 rounded-[var(--r-pill)] py-1.5 text-[12px] font-semibold"
                    style={{
                      background:
                        simSrc === o.id
                          ? "var(--text-1)"
                          : "var(--surface-3)",
                      color:
                        simSrc === o.id ? "#08090B" : "var(--text-3)",
                    }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="t-caption mt-2 leading-relaxed">
                {simSrc === "drafts"
                  ? `Preview ${simPacks.length} draft protocol${simPacks.length === 1 ? "" : "s"} from the CMS — including unpublished edits. Use this to sanity-check before Publish.`
                  : simSrc === "live"
                    ? "Run against the bundle currently serving users (built-in unless a newer published bundle has been adopted this session)."
                    : "Run against the frozen built-in catalog (what ships in the app binary)."}
              </p>
            </div>
            <div className={card} style={surf}>
              <Eyebrow>Installed packs</Eyebrow>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {simPacks.map((p) => {
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
                <div className="space-y-3">
                  <div className={card} style={surf}>
                    <Eyebrow color="var(--readiness)">
                      Have an idea? AI picks the protocol
                    </Eyebrow>
                    <p className="t-caption mt-1 leading-relaxed">
                      Describe a behavior in plain words — AI drafts it
                      AND recommends which existing protocol it fits.
                      Pick a protocol, the draft drops into its editor.
                    </p>
                    <div className="mt-3 space-y-2">
                      <input
                        className={inp}
                        value={aiIdea}
                        onChange={(e) => setAiIdea(e.target.value)}
                        placeholder="e.g. cold plunge 2 min after the workout"
                      />
                      <button
                        disabled={
                          aiIdeaBusy ||
                          !aiIdea.trim() ||
                          cmsP.length === 0
                        }
                        onClick={async () => {
                          setAiIdeaBusy(true);
                          setAiIdeaMsg(null);
                          const r =
                            await generateBehaviorDraftAndSuggestProtocol(
                              aiIdea,
                              cmsP.map((p) => ({
                                slug: p.slug,
                                name: p.name,
                                tagline: p.tagline ?? undefined,
                                goal: p.goal ?? undefined,
                              }))
                            );
                          setAiIdeaBusy(false);
                          if (r.ok && r.draft) {
                            setAiIdeaResult(r.draft);
                            setAiIdeaMsg(null);
                          } else {
                            setAiIdeaResult(null);
                            setAiIdeaMsg(
                              r.reason ?? "AI drafting failed."
                            );
                          }
                        }}
                        className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        {aiIdeaBusy
                          ? "Drafting…"
                          : cmsP.length === 0
                            ? "Seed the CMS first"
                            : "Generate + suggest protocol"}
                      </button>
                      {aiIdeaMsg && (
                        <p
                          className="rounded-[var(--r-sm)] px-3 py-2 text-[12.5px] font-medium"
                          style={{
                            background: "rgba(232,137,107,.12)",
                            color: "var(--alert)",
                          }}
                        >
                          {aiIdeaMsg}
                        </p>
                      )}
                      {aiIdeaResult && (
                        <div className="space-y-2 rounded-[var(--r-sm)] p-3" style={{ background: "var(--surface-3)" }}>
                          <p className="text-[12.5px] text-[var(--text-2)]">
                            <b>{aiIdeaResult.title}</b>{" "}
                            <span className="text-[var(--text-3)]">
                              ·{" "}
                              {aiIdeaResult.dose ?? "no dose"} ·{" "}
                              {aiIdeaResult.block} · L
                              {aiIdeaResult.leverage}
                            </span>
                          </p>
                          {aiIdeaResult.suggestedProtocols.length ===
                          0 ? (
                            <p className="t-caption">
                              No matching protocol — create one above or
                              pick from the list below.
                            </p>
                          ) : (
                            <>
                              <p className="t-caption">
                                Open the draft inside…
                              </p>
                              {aiIdeaResult.suggestedProtocols.map(
                                (s, i) => {
                                  const target = cmsP.find(
                                    (p) => p.slug === s.slug
                                  );
                                  if (!target) return null;
                                  return (
                                    <button
                                      key={s.slug}
                                      onClick={async () => {
                                        // Strip suggestions to leave a
                                        // plain AiBehaviorDraft for the
                                        // in-protocol editor.
                                        const {
                                          suggestedProtocols: _drop,
                                          ...rest
                                        } = aiIdeaResult;
                                        void _drop;
                                        await openProto(target);
                                        setAiDraft(
                                          rest as AiBehaviorDraft
                                        );
                                        setAiDesc(aiIdea);
                                        setAiIdeaResult(null);
                                        setAiIdea("");
                                      }}
                                      className="press tr-fast row flex w-full items-start gap-3 rounded-[var(--r-sm)] p-2.5 text-left"
                                      style={{
                                        background: "var(--surface-2)",
                                      }}
                                    >
                                      <span
                                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                                        style={{
                                          background:
                                            i === 0
                                              ? "var(--readiness)"
                                              : "var(--surface-3)",
                                          color:
                                            i === 0
                                              ? "#08090B"
                                              : "var(--text-3)",
                                        }}
                                      >
                                        {i + 1}
                                      </span>
                                      <span className="grow">
                                        <p className="text-[13px] font-semibold text-[var(--text-1)]">
                                          {target.name}
                                        </p>
                                        <p className="t-caption mt-0.5">
                                          {s.reason}
                                        </p>
                                      </span>
                                    </button>
                                  );
                                }
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={card} style={surf}>
                    {!newProtoOpen ? (
                      <button
                        onClick={() => setNewProtoOpen(true)}
                        className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2.5 text-[12px] font-semibold text-[#08090B]"
                      >
                        + New protocol
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <Eyebrow color="var(--readiness)">
                          New protocol
                        </Eyebrow>
                        <input
                          className={inp}
                          value={newProtoName}
                          onChange={(e) =>
                            setNewProtoName(e.target.value)
                          }
                          placeholder="Name (e.g. 'Migraine Resilience')"
                        />
                        <input
                          className={inp}
                          value={newProtoTagline}
                          onChange={(e) =>
                            setNewProtoTagline(e.target.value)
                          }
                          placeholder="Tagline (short, calm — one line)"
                        />
                        <input
                          className={inp}
                          value={newProtoGoal}
                          onChange={(e) =>
                            setNewProtoGoal(e.target.value)
                          }
                          placeholder="Goal slug (e.g. 'sleep', 'focus')"
                        />
                        <div className="flex gap-2 pt-1">
                          <button
                            disabled={busy || !newProtoName.trim()}
                            onClick={async () => {
                              setBusy(true);
                              const r = await createProtocol({
                                name: newProtoName,
                                tagline: newProtoTagline,
                                goal: newProtoGoal,
                              });
                              setBusy(false);
                              setMsg(
                                r.ok
                                  ? "Protocol created (draft)."
                                  : r.reason ?? "Failed"
                              );
                              if (r.ok) {
                                setNewProtoName("");
                                setNewProtoTagline("");
                                setNewProtoGoal("");
                                setNewProtoOpen(false);
                                loadCms();
                              }
                            }}
                            className="press tr-fast flex-1 rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                          >
                            {busy ? "Creating…" : "Create"}
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => {
                              setNewProtoOpen(false);
                              setNewProtoName("");
                              setNewProtoTagline("");
                              setNewProtoGoal("");
                            }}
                            className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-2 text-[12px] font-semibold text-[var(--text-2)]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
                            const yes = window.confirm(
                              "Discard the AI draft? All field edits in this card will be lost."
                            );
                            if (!yes) return;
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
                          disabled={savingIds[b.id]}
                          onClick={async () => {
                            markSavingStart(b.id);
                            const r = await clearUnverified(
                              b.id,
                              b.version
                            );
                            markSavingEnd(b.id);
                            if (r.ok) {
                              flashSaved(b.id);
                              setMsg(null);
                              reopen();
                            } else {
                              setMsg(r.reason ?? "Failed");
                            }
                          }}
                          className="press shrink-0 rounded-[var(--r-pill)] bg-[var(--text-1)] px-3 py-1.5 text-[11px] font-semibold text-[#08090B] disabled:opacity-40"
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
                            disabled={savingIds[b.id]}
                            onClick={async () => {
                              markSavingStart(b.id);
                              await reorderBehavior(
                                edP.id,
                                b.id,
                                d === "-1" ? -1 : 1
                              );
                              markSavingEnd(b.id);
                              reopen();
                            }}
                            className="press grid h-7 w-7 place-items-center rounded-full text-[var(--text-3)] disabled:opacity-40"
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
                      disabled={savingIds[b.id]}
                      onClick={async () => {
                        markSavingStart(b.id);
                        const r = await saveBehavior(b);
                        markSavingEnd(b.id);
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
                        : savingIds[b.id]
                          ? "Saving…"
                          : "Save behavior"}
                    </button>

                    <div className="mt-3 flex gap-2 border-t border-[var(--hairline)] pt-3">
                      <button
                        onClick={() =>
                          togglePanel(b.id, "history", b.canonical_key)
                        }
                        className="press text-[11.5px] font-semibold text-[var(--text-3)]"
                        title="Every save writes a versioned revision. This panel shows the last few."
                      >
                        {openPanel?.id === b.id &&
                        openPanel?.kind === "history"
                          ? "− Hide history"
                          : "↻ History"}
                      </button>
                      <button
                        onClick={() =>
                          togglePanel(b.id, "evidence", b.canonical_key)
                        }
                        className="press text-[11.5px] font-semibold text-[var(--text-3)]"
                        title="The cms_evidence + cms_explanations rows attached to this behavior. AI-drafted rows seed them; you can edit or add for any behavior."
                      >
                        {openPanel?.id === b.id &&
                        openPanel?.kind === "evidence"
                          ? "− Hide evidence"
                          : "📜 Evidence"}
                      </button>
                    </div>

                    {openPanel?.id === b.id &&
                      openPanel.kind === "history" && (
                        <div
                          className="mt-2 rounded-[var(--r-sm)] p-3"
                          style={{ background: "var(--surface-3)" }}
                        >
                          {historyRows.length === 0 ? (
                            <p className="t-caption">
                              No revision history yet.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {historyRows.map((r) => (
                                <div
                                  key={r.id}
                                  className="flex items-baseline justify-between gap-2"
                                  title={
                                    typeof r.snapshot === "object"
                                      ? JSON.stringify(r.snapshot).slice(
                                          0,
                                          400
                                        )
                                      : ""
                                  }
                                >
                                  <span className="text-[12px] font-semibold text-[var(--text-2)]">
                                    v{r.version}
                                  </span>
                                  <span className="grow truncate text-[11.5px] text-[var(--text-3)]">
                                    {r.change_note ?? "—"}
                                  </span>
                                  <span className="text-[10.5px] text-[var(--text-4)]">
                                    {new Date(
                                      r.created_at
                                    ).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                    {openPanel?.id === b.id &&
                      openPanel.kind === "evidence" && (
                        <div
                          className="mt-2 space-y-2 rounded-[var(--r-sm)] p-3"
                          style={{ background: "var(--surface-3)" }}
                        >
                          <div className="flex gap-2">
                            <select
                              className={inp}
                              value={evRow?.tier ?? "emerging"}
                              onChange={(e) =>
                                patchEv({ tier: e.target.value })
                              }
                              title={FIELD_HELP.evidenceTier}
                            >
                              {[
                                "strong",
                                "moderate",
                                "emerging",
                                "anecdotal",
                              ].map((t) => (
                                <option key={t}>{t}</option>
                              ))}
                            </select>
                            <input
                              className={inp}
                              value={evRow?.source_label ?? ""}
                              onChange={(e) =>
                                patchEv({
                                  source_label: e.target.value || null,
                                })
                              }
                              placeholder="Source (e.g. Meta-analysis, 2021)"
                              title={FIELD_HELP.evidenceSource}
                            />
                          </div>
                          <input
                            className={inp}
                            value={evRow?.url ?? ""}
                            onChange={(e) =>
                              patchEv({ url: e.target.value || null })
                            }
                            placeholder="Source URL (optional, http(s))"
                            title={FIELD_HELP.evidenceUrl}
                          />
                          <textarea
                            className={inp}
                            rows={2}
                            value={evRow?.summary ?? ""}
                            onChange={(e) =>
                              patchEv({
                                summary: e.target.value || null,
                              })
                            }
                            placeholder="Evidence summary"
                            title={FIELD_HELP.evidenceSummary}
                          />
                          <textarea
                            className={inp}
                            rows={2}
                            value={exText("why")}
                            onChange={(e) =>
                              setExText("why", e.target.value)
                            }
                            placeholder="Why it matters"
                            title={FIELD_HELP.why}
                          />
                          <input
                            className={inp}
                            value={exText("timing")}
                            onChange={(e) =>
                              setExText("timing", e.target.value)
                            }
                            placeholder="Why this timing"
                            title={FIELD_HELP.timing}
                          />
                          <button
                            disabled={savingIds[b.id]}
                            onClick={async () => {
                              markSavingStart(b.id);
                              const errors: string[] = [];
                              const eR = await upsertEvidence({
                                targetType: "behavior",
                                targetRef: b.canonical_key,
                                tier: evRow?.tier ?? "emerging",
                                sourceLabel:
                                  evRow?.source_label ?? undefined,
                                url: evRow?.url ?? null,
                                summary: evRow?.summary ?? undefined,
                              });
                              if (!eR.ok)
                                errors.push(eR.reason ?? "evidence");
                              for (const k of ["why", "timing"]) {
                                const t = exText(k);
                                if (!t.trim()) continue;
                                const r = await upsertExplanation({
                                  targetType: "behavior",
                                  targetRef: b.canonical_key,
                                  kind: k,
                                  text: t,
                                });
                                if (!r.ok)
                                  errors.push(r.reason ?? k);
                              }
                              markSavingEnd(b.id);
                              if (errors.length === 0) {
                                flashSaved(b.id);
                                setMsg(null);
                              } else {
                                setMsg(
                                  "Some rows failed: " + errors.join(", ")
                                );
                              }
                            }}
                            className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                          >
                            {savedIds[b.id]
                              ? "Saved ✓"
                              : savingIds[b.id]
                                ? "Saving…"
                                : "Save evidence + explanations"}
                          </button>
                        </div>
                      )}
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
                      <div className="flex gap-1.5">
                        {(["protocol", "behavior"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setDEntityType(t)}
                            className="press tr-fast flex-1 rounded-[var(--r-pill)] py-1.5 text-[11.5px] font-semibold capitalize"
                            style={{
                              background:
                                dEntityType === t
                                  ? "var(--text-1)"
                                  : "var(--surface-3)",
                              color:
                                dEntityType === t
                                  ? "#08090B"
                                  : "var(--text-3)",
                            }}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
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
                      {dEntityType === "behavior" && (
                        <select
                          className={inp}
                          value={dBehaviorId}
                          onChange={(e) => setDBehaviorId(e.target.value)}
                          disabled={!dProto}
                        >
                          {dBehaviors.length === 0 && (
                            <option value="">
                              {dProto
                                ? "(no behaviors in this protocol)"
                                : "Pick a protocol first…"}
                            </option>
                          )}
                          {dBehaviors.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.title}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex gap-2">
                        <select
                          className={inp}
                          value={dField}
                          onChange={(e) => setDField(e.target.value)}
                        >
                          {(dEntityType === "behavior"
                            ? [
                                "title",
                                "rationale",
                                "dose",
                                "block",
                                "anchor",
                                "offset_min",
                                "leverage",
                                "kind",
                                "icon",
                              ]
                            : ["tagline", "name", "accent", "goal"]
                          ).map((f) => (
                            <option key={f}>{f}</option>
                          ))}
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
                        disabled={
                          busy ||
                          (dEntityType === "protocol" && !dProto) ||
                          (dEntityType === "behavior" && !dBehaviorId) ||
                          !dValue
                        }
                        onClick={async () => {
                          setBusy(true);
                          const entityId =
                            dEntityType === "behavior"
                              ? dBehaviorId
                              : dProto;
                          // Coerce numeric fields server-side-friendly.
                          const numericFields = new Set([
                            "leverage",
                            "offset_min",
                          ]);
                          const proposed = numericFields.has(dField)
                            ? { [dField]: Number(dValue) }
                            : { [dField]: dValue };
                          const r = await createSuggestion({
                            entityType: dEntityType,
                            entityId,
                            proposed,
                            rationale: dWhy,
                          });
                          setBusy(false);
                          setMsg(r.ok ? "Proposed" : r.reason ?? "Failed");
                          if (r.ok) {
                            setDValue("");
                            setDWhy("");
                            setSugStatus("pending");
                            loadSugs("pending");
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
                  <div className="flex items-center justify-between gap-2">
                    <Eyebrow>Queue</Eyebrow>
                    <div className="flex gap-1">
                      {(["pending", "approved", "rejected"] as const).map(
                        (s) => (
                          <button
                            key={s}
                            onClick={() => setSugStatus(s)}
                            className="press rounded-[var(--r-pill)] px-3 py-1 text-[11px] font-semibold capitalize"
                            style={{
                              background:
                                sugStatus === s
                                  ? "var(--text-1)"
                                  : "var(--surface-3)",
                              color:
                                sugStatus === s
                                  ? "#08090B"
                                  : "var(--text-3)",
                            }}
                          >
                            {s}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {sugs.length === 0 && (
                    <p className="t-caption mt-2 px-1">
                      No {sugStatus} suggestions.
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
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>What's about to ship</Eyebrow>
                <button
                  onClick={refreshDiff}
                  disabled={diffBusy}
                  className="press text-[11.5px] font-semibold text-[var(--readiness)] disabled:opacity-40"
                  title="Re-assemble the next bundle and re-diff against the latest published one."
                >
                  {diffBusy ? "…" : "Refresh"}
                </button>
              </div>
              {!diff ? (
                <p className="t-caption mt-2">Loading diff…</p>
              ) : !diff.hasChanges ? (
                <p className="t-caption mt-2 leading-relaxed">
                  No changes vs the latest published bundle. Publishing
                  would be a no-op.
                </p>
              ) : (
                <div className="mt-2 space-y-2 text-[12.5px]">
                  <p
                    className="leading-relaxed text-[var(--text-2)]"
                    title="Counts of behavior-level changes between the latest published bundle and what would ship if you Publish now."
                  >
                    {[
                      diff.behaviorsAdded.length &&
                        `${diff.behaviorsAdded.length} added`,
                      diff.behaviorsChanged.length &&
                        `${diff.behaviorsChanged.length} edited`,
                      diff.behaviorsRemoved.length &&
                        `${diff.behaviorsRemoved.length} removed`,
                      diff.protocolsAdded.length &&
                        `${diff.protocolsAdded.length} new protocol${diff.protocolsAdded.length === 1 ? "" : "s"}`,
                      diff.protocolsRemoved.length &&
                        `${diff.protocolsRemoved.length} protocol${diff.protocolsRemoved.length === 1 ? "" : "s"} removed`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {diff.unchanged} unchanged
                  </p>
                  {diff.behaviorsAdded.slice(0, 8).map((b) => (
                    <p
                      key={`+${b.protocolId}/${b.canonicalKey}`}
                      className="text-[var(--vitality)]"
                    >
                      + <b>{b.title}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        in {b.protocolName}
                      </span>
                    </p>
                  ))}
                  {diff.behaviorsChanged.slice(0, 8).map((b) => (
                    <p
                      key={`~${b.protocolId}/${b.canonicalKey}`}
                      className="text-[var(--warm)]"
                    >
                      ~ <b>{b.title}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        in {b.protocolName} · {b.fields.join(", ")}
                      </span>
                    </p>
                  ))}
                  {diff.behaviorsRemoved.slice(0, 8).map((b) => (
                    <p
                      key={`-${b.protocolId}/${b.canonicalKey}`}
                      className="text-[var(--alert)]"
                    >
                      − <b>{b.title}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        in {b.protocolName}
                      </span>
                    </p>
                  ))}
                  {diff.behaviorsAdded.length +
                    diff.behaviorsChanged.length +
                    diff.behaviorsRemoved.length >
                    24 && (
                    <p className="t-caption">
                      (showing first few; refresh for the full set)
                    </p>
                  )}
                </div>
              )}
            </div>

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
                          const yes = window.confirm(
                            `Roll back to v${p.version}? This creates a NEW published version on top of history (nothing is deleted), and the app will adopt it on next refresh.`
                          );
                          if (!yes) return;
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
