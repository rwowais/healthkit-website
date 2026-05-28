"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { activePacks, activeBundleVersion } from "@/lib/knowledge";
import {
  ADAPTIVE_MODES,
  RULE_SETS,
  CONFIG_ROWS,
  INTEL_KINDS,
  KNOWN_CONFIG_KEYS,
  KNOWN_INSIGHT_KINDS,
} from "@/lib/cms/introspect";
import { getCfgNumber, activeInsightTemplates } from "@/lib/knowledge";
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
  fetchAndApplyPublished,
  resetRefresh,
  type Publication,
  type BundleDiff,
} from "@/lib/cms/publish";
import {
  importBuiltin,
  listCmsProtocols,
  listAllCmsBehaviors,
  type AllBehaviorRow,
  getProtocolBehaviors,
  saveProtocol,
  saveBehavior,
  createBehavior,
  createProtocol,
  reorderBehavior,
  setBehaviorOrder,
  bulkSetBehaviorStatus,
  clearUnverified,
  getBehaviorById,
  listRevisions,
  listEvidence,
  upsertEvidence,
  listExplanations,
  upsertExplanation,
  assembleBundleFromCMS,
  listAdmins,
  addAdmin,
  addAdminByEmail,
  removeAdmin,
  listAuditLog,
  listConfigOverrides,
  upsertConfigOverride,
  deleteConfigOverride,
  listInsightTemplates,
  saveInsightTemplate,
  deleteInsightTemplate,
  listRecTemplates,
  saveRecTemplate,
  deleteRecTemplate,
  listAdaptationRules,
  saveAdaptationRule,
  deleteAdaptationRule,
  type AdaptationRuleRow,
  type CmsProtocol,
  type CmsBehavior,
  type RevisionRow,
  type EvidenceRow,
  type ExplanationRow,
  type AdminRow,
  type AuditRow,
  type ConfigOverrideRow,
  type InsightTemplateRow,
  type RecTemplateRow,
} from "@/lib/cms/authoring";
import {
  generateBehaviorDraft,
  generateBehaviorDraftAndSuggestProtocol,
} from "@/lib/cms/ai";
import { PACKS } from "@/lib/packs";
import {
  buildAtomRegistry,
  auditOntology,
  catalogInventory,
  explainBehavior,
  type AtomRegistryEntry,
  type OntologyIssue,
  type CatalogInventory,
  type BehaviorExplanation,
} from "@/lib/governance";
import { RULE_METRICS } from "@/lib/cms/rules";
import { HELP } from "@/lib/cms/help";
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
import RuleEditor from "@/components/admin/RuleEditor";

type Gate = "checking" | "denied" | "ok";
type Tab =
  | "home"
  | "content"
  | "engine"
  | "simulate"
  | "publish"
  | "intelligence";
type ContentMode = "author" | "review";
type EngineSub = "rules" | "config" | "intelligence" | "access";

const TABS: { id: Tab; label: string; hint: string }[] = [
  {
    id: "home",
    label: "Home",
    hint: "At-a-glance: live catalog, draft counts, what's about to ship.",
  },
  {
    id: "content",
    label: "Content",
    hint: "Authoring workbench + AI Review queue.",
  },
  {
    id: "engine",
    label: "Engine",
    hint: "Adaptation rules, runtime config, intelligence honesty gates.",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    hint: "Atom registry, trust tiers, ontology audit, behavior provenance.",
  },
  {
    id: "simulate",
    label: "Simulate",
    hint: "Preview the merged daily timeline against built-in, drafts, or live.",
  },
  {
    id: "publish",
    label: "Publish",
    hint: "Diff-before-publish + immutable history with rollback.",
  },
];

function dk(off: number) {
  const d = new Date();
  d.setDate(d.getDate() - off);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Click-to-toggle field hint with a one-line summary + a concrete
 * example. Designed for mobile (hover doesn't work there) and reads
 * better than the native `title` attribute on every browser.
 */
function Hint({
  k,
  size = "sm",
}: {
  /** Key into the HELP map in src/lib/cms/help.ts. */
  k: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const entry = HELP[k];
  if (!entry) return null;
  const dim = size === "md" ? "h-4 w-4 text-[10px]" : "h-3.5 w-3.5 text-[9px]";
  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        aria-label={entry.summary}
        title={entry.summary}
        className={`press grid ${dim} cursor-help place-items-center rounded-full font-bold`}
        style={{
          background: open ? "var(--readiness)" : "var(--surface-3)",
          color: open ? "#08090B" : "var(--text-3)",
        }}
      >
        ?
      </button>
      {open && (
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 top-full z-30 mt-1 w-72 rounded-[var(--r-sm)] border p-3 text-[12px] leading-relaxed shadow-2xl"
          style={{
            background: "var(--surface-2)",
            borderColor: "var(--hairline-strong)",
          }}
        >
          <p className="text-[var(--text-1)]">{entry.summary}</p>
          {entry.example && (
            <p className="mt-2 text-[var(--text-3)]">
              <span className="font-semibold text-[var(--text-4)]">
                Example:{" "}
              </span>
              <code className="text-[var(--text-2)]">{entry.example}</code>
            </p>
          )}
        </div>
      )}
    </span>
  );
}

/** A labelled field row with the Hint popover next to the label. */
function Field({
  label,
  help,
  children,
}: {
  label: string;
  /** Key into the HELP map (preferred), or a plain summary string (legacy). */
  help?: string;
  children: ReactNode;
}) {
  const isKey = help && HELP[help] !== undefined;
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          {label}
        </span>
        {help &&
          (isKey ? (
            <Hint k={help} />
          ) : (
            <span
              title={help}
              className="grid h-3.5 w-3.5 cursor-help place-items-center rounded-full bg-[var(--surface-3)] text-[9px] font-bold text-[var(--text-3)]"
              aria-label={help}
            >
              ?
            </span>
          ))}
      </span>
      {children}
    </label>
  );
}

export default function AdminHome() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");
  const [tab, setTab] = useState<Tab>("home");
  const [contentMode, setContentMode] = useState<ContentMode>("author");
  const [engineSub, setEngineSub] = useState<EngineSub>("rules");

  // Intelligence dashboard state — registry / inventory / ontology
  // issues are computed on-demand from in-memory catalogs (cheap, no
  // network). The explainer holds the most-recently-inspected
  // explanation so admins can click rows to drill in.
  const intelData = useMemo(() => {
    if (tab !== "intelligence")
      return null as
        | null
        | {
            registry: Map<string, AtomRegistryEntry>;
            inventory: CatalogInventory;
            issues: OntologyIssue[];
          };
    const registry = buildAtomRegistry();
    return {
      registry,
      inventory: catalogInventory(registry),
      issues: auditOntology(registry),
    };
  }, [tab]);
  const [intelFilter, setIntelFilter] = useState("");
  const [intelTierFilter, setIntelTierFilter] = useState<
    "all" | "established" | "emerging" | "exploratory" | "untiered"
  >("all");
  const [intelInspect, setIntelInspect] =
    useState<BehaviorExplanation | null>(null);
  const [intelInspectKey, setIntelInspectKey] = useState<string | null>(null);
  useEffect(() => {
    if (!intelInspectKey || !intelData) {
      setIntelInspect(null);
      return;
    }
    // Build a synthetic "all packs installed" state so explainBehavior
    // can resolve the behavior's full merge state and any conflict-
    // pair mutes that would fire. The dashboard is for inspection —
    // we want to see what WOULD happen, not just what the current
    // user has installed.
    const synthetic = getDefaultState();
    synthetic.installedPacks = PACKS.map((p) => p.id);
    const exp = explainBehavior(synthetic, intelInspectKey, 0);
    setIntelInspect(exp);
  }, [intelInspectKey, intelData]);

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
      if (alive) setSimPacks(drafts?.protocols ?? PACKS);
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
  // "Show all" expander for the behavior diff lists — by default we cap
  // at 8 each so a big diff doesn't dominate the screen, but an admin
  // reviewing a major migration needs to see *everything* about to ship.
  const [diffShowAll, setDiffShowAll] = useState(false);
  const diffAlive = useRef(true);
  useEffect(
    () => () => {
      diffAlive.current = false;
    },
    []
  );
  const refreshDiff = async () => {
    setDiffBusy(true);
    try {
      const [prev, next] = await Promise.all([
        getLatestPublishedBundle(),
        previewNextBundle(),
      ]);
      if (diffAlive.current) setDiff(diffBundles(prev, next));
    } catch {
      if (diffAlive.current) setDiff(null);
    } finally {
      if (diffAlive.current) setDiffBusy(false);
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
  // Drag-handle reorder state. dragIdx is the row currently being
  // dragged; overIdx is the row it's hovering over (so we can render an
  // insertion line). Persisted via setBehaviorOrder on drop.
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  // Multi-select for bulk operations on behaviors within a protocol.
  // Bulk supports publish/draft/archive — the most common chores when
  // grooming a pack. Selection clears whenever the open protocol
  // changes so a stray selection can't leak across packs.
  const [bulkSel, setBulkSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Flat all-behavior index for the command palette — lazy-loaded the
  // first time ⌘K opens so the admin can fuzzy-jump by behavior title,
  // not just by pack. Avoids paying the join cost when nobody's looking.
  const [allBeh, setAllBeh] = useState<AllBehaviorRow[] | null>(null);
  const loadCms = () => listCmsProtocols().then(setCmsP);
  useEffect(() => {
    if (
      !(
        gate === "ok" &&
        (tab === "content" || tab === "home" || tab === "simulate")
      )
    )
      return;
    let alive = true;
    listCmsProtocols().then((ps) => {
      if (alive) setCmsP(ps);
    });
    return () => {
      alive = false;
    };
  }, [gate, tab]);

  // CMS counts for the Home "Drafts in CMS" tile.
  const [cmsBehCount, setCmsBehCount] = useState<number | null>(null);
  useEffect(() => {
    if (gate !== "ok" || tab !== "home") return;
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
  // For each pending suggestion, cache the current entity + the set of
  // rejected fields. Default-include all proposed fields; admin can
  // uncheck the ones they don't want before approving.
  const [sugCurrent, setSugCurrent] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [sugRejected, setSugRejected] = useState<
    Record<string, Set<string>>
  >({});
  // Load current entity for any pending suggestion the user can see.
  useEffect(() => {
    if (!sugs.length) return;
    let alive = true;
    (async () => {
      const next: Record<string, Record<string, unknown>> = {};
      for (const s of sugs) {
        if (sugCurrent[s.id]) {
          next[s.id] = sugCurrent[s.id];
          continue;
        }
        if (s.entity_type === "protocol") {
          const p = cmsP.find((x) => x.id === s.entity_id);
          if (p) next[s.id] = p as unknown as Record<string, unknown>;
        } else if (s.entity_type === "behavior") {
          const b = await getBehaviorById(s.entity_id);
          if (b) next[s.id] = b as unknown as Record<string, unknown>;
        }
      }
      if (alive) setSugCurrent((m) => ({ ...m, ...next }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugs, cmsP]);
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
    if (
      !(
        gate === "ok" &&
        tab === "content" &&
        contentMode === "review"
      )
    )
      return;
    let alive = true;
    listSuggestions(sugStatus).then((s) => {
      if (alive) setSugs(s);
    });
    return () => {
      alive = false;
    };
  }, [gate, tab, contentMode, sugStatus]);
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
  // Baseline snapshot used to derive dirty state for the sticky save
  // bar. Stored as JSON strings keyed by behavior id — cheap to compare.
  const [edBBaseline, setEdBBaseline] = useState<Record<string, string>>(
    {}
  );
  const snapBehavior = (b: CmsBehavior) =>
    JSON.stringify({
      title: b.title,
      block: b.block,
      anchor: b.anchor,
      offset_min: b.offset_min,
      dose: b.dose ?? null,
      leverage: b.leverage,
      kind: b.kind,
      icon: b.icon ?? null,
      rationale: b.rationale ?? null,
      status: b.status,
    });
  const captureBaseline = (bs: CmsBehavior[]) =>
    setEdBBaseline(
      Object.fromEntries(bs.map((b) => [b.id, snapBehavior(b)]))
    );
  const isDirty = (b: CmsBehavior) =>
    edBBaseline[b.id] !== undefined &&
    snapBehavior(b) !== edBBaseline[b.id];
  const openProto = async (p: CmsProtocol) => {
    setEdP({ ...p });
    const bs = await getProtocolBehaviors(p.id);
    setEdB(bs);
    captureBaseline(bs);
    // A fresh protocol gets a clean selection — bulk picks shouldn't
    // carry over from a previous pack the admin had open.
    setBulkSel(new Set());
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const reopen = async () => {
    if (!edP) return;
    const bs = await getProtocolBehaviors(edP.id);
    setEdB(bs);
    captureBaseline(bs);
  };
  const [nbTitle, setNbTitle] = useState("");
  const [nbBlock, setNbBlock] = useState("morning");
  const [nbLev, setNbLev] = useState(2);

  // Create-protocol form (inline on the All-protocols list).
  const [newProtoOpen, setNewProtoOpen] = useState(false);
  const [newProtoName, setNewProtoName] = useState("");
  const [newProtoTagline, setNewProtoTagline] = useState("");
  const [newProtoGoal, setNewProtoGoal] = useState("");

  // ── Activity / Access / Config / Templates state ──────────────────
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditBusy, setAuditBusy] = useState(false);
  const loadAudit = async () => {
    setAuditBusy(true);
    try {
      setAuditRows(await listAuditLog(30));
    } finally {
      setAuditBusy(false);
    }
  };
  useEffect(() => {
    if (gate === "ok" && tab === "home" && auditOpen && auditRows.length === 0)
      loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, tab, auditOpen]);

  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  // Power-user fallback: paste a uuid directly when the email lookup
  // can't reach the user (e.g. you're inviting an account that hasn't
  // signed in yet, or the auth schema has been customized).
  const [newAdminId, setNewAdminId] = useState("");
  const [showAdminAdvanced, setShowAdminAdvanced] = useState(false);
  const refreshAdmins = () => listAdmins().then(setAdmins);
  useEffect(() => {
    if (gate === "ok" && tab === "engine" && engineSub === "access")
      refreshAdmins();
  }, [gate, tab, engineSub]);

  const [cfgRows, setCfgRows] = useState<ConfigOverrideRow[]>([]);
  const [cfgKey, setCfgKey] = useState("");
  const [cfgValue, setCfgValue] = useState("");
  const [cfgDesc, setCfgDesc] = useState("");
  const refreshCfg = () => listConfigOverrides().then(setCfgRows);
  useEffect(() => {
    if (gate === "ok" && tab === "engine" && engineSub === "config")
      refreshCfg();
  }, [gate, tab, engineSub]);
  // Per-key history (cms_revisions for entity_type='config'). Lazy:
  // only fetched when the user expands a row.
  const [cfgHistoryOpen, setCfgHistoryOpen] = useState<
    Record<string, boolean>
  >({});
  const [cfgHistoryBy, setCfgHistoryBy] = useState<
    Record<string, RevisionRow[]>
  >({});
  const toggleCfgHistory = async (key: string) => {
    const isOpen = !cfgHistoryOpen[key];
    setCfgHistoryOpen((s) => ({ ...s, [key]: isOpen }));
    if (isOpen && !cfgHistoryBy[key]) {
      const rows = await listRevisions("config", key, 12);
      setCfgHistoryBy((s) => ({ ...s, [key]: rows }));
    }
  };

  const [insTemplates, setInsTemplates] = useState<InsightTemplateRow[]>(
    []
  );
  const [recTemplates, setRecTemplates] = useState<RecTemplateRow[]>([]);
  const [newInsKind, setNewInsKind] = useState("");
  const [newInsTpl, setNewInsTpl] = useState("");
  const [newRecCtx, setNewRecCtx] = useState("");
  const [newRecCopy, setNewRecCopy] = useState("");
  const refreshTemplates = async () => {
    const [ins, rec] = await Promise.all([
      listInsightTemplates(),
      listRecTemplates(),
    ]);
    setInsTemplates(ins);
    setRecTemplates(rec);
  };
  useEffect(() => {
    if (gate === "ok" && tab === "engine" && engineSub === "intelligence")
      refreshTemplates();
  }, [gate, tab, engineSub]);

  // Adaptation rules editor.
  const [rules, setRules] = useState<AdaptationRuleRow[]>([]);
  const refreshRules = () => listAdaptationRules().then(setRules);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRulePriority, setNewRulePriority] = useState(50);
  // Rule body lives as parsed objects so the visual RuleEditor can edit
  // them directly. The Advanced JSON drawer inside RuleEditor keeps the
  // power-user escape hatch.
  const [newRuleTrigger, setNewRuleTrigger] = useState<unknown>({
    all: [{ metric: "recoveryProxy", op: "<", value: 45 }],
  });
  const [newRuleEffect, setNewRuleEffect] = useState<unknown>({
    setMode: "recovery",
  });
  useEffect(() => {
    if (gate === "ok" && tab === "engine" && engineSub === "rules")
      refreshRules();
  }, [gate, tab, engineSub]);

  // ── ⌘K command palette ────────────────────────────────────────────
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [paletteIdx, setPaletteIdx] = useState(0);
  useEffect(() => {
    if (gate !== "ok") return;
    const onKey = (e: KeyboardEvent) => {
      const cmdK =
        (e.metaKey || e.ctrlKey) &&
        (e.key === "k" || e.key === "K");
      if (cmdK) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        setPaletteQuery("");
        setPaletteIdx(0);
      } else if (e.key === "Escape" && paletteOpen) {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gate, paletteOpen]);

  // Lazy-fetch the flat behavior index the first time the palette opens.
  // The join is cheap but it's still a network round-trip; only paying
  // for it when the palette is actually used keeps the rest of the admin
  // page snappy.
  useEffect(() => {
    if (!paletteOpen || allBeh !== null) return;
    let alive = true;
    listAllCmsBehaviors().then((rows) => {
      if (alive) setAllBeh(rows);
    });
    return () => {
      alive = false;
    };
  }, [paletteOpen, allBeh]);

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
  // Track flash timers per-id so we (a) clear them on unmount to avoid
  // setState-after-unmount warnings, and (b) reset cleanly if the same
  // row flashes again before the first timer fires.
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {}
  );
  useEffect(
    () => () => {
      for (const t of Object.values(flashTimers.current))
        clearTimeout(t);
      flashTimers.current = {};
    },
    []
  );
  const flashSaved = (id: string) => {
    setSavedIds((s) => ({ ...s, [id]: true }));
    if (flashTimers.current[id]) clearTimeout(flashTimers.current[id]);
    flashTimers.current[id] = setTimeout(() => {
      delete flashTimers.current[id];
      setSavedIds((s) => {
        const n = { ...s };
        delete n[id];
        return n;
      });
    }, 1500);
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
            title={t.hint}
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
        {tab === "home" && (
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

        {tab === "home" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Live catalog</Eyebrow>
              <span
                className="t-caption"
                title="The bundle currently serving users. Edit drafts in Content; preview them in Simulate; ship them via Publish."
              >
                what users see right now
              </span>
            </div>
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

        {tab === "home" && (
          <div className={`${card} mt-3`} style={surf}>
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Recent admin activity</Eyebrow>
              <button
                onClick={() => {
                  setAuditOpen((v) => !v);
                  if (!auditOpen) loadAudit();
                }}
                title="Read-only view of cms_audit_log — every publish, rollback, suggestion approval, and verify lands here."
                className="press text-[11.5px] font-semibold text-[var(--readiness)]"
              >
                {auditOpen
                  ? "− Hide"
                  : auditBusy
                    ? "Loading…"
                    : "↻ Show"}
              </button>
            </div>
            {auditOpen && (
              <div className="mt-2 space-y-1.5">
                {auditRows.length === 0 && !auditBusy && (
                  <p className="t-caption">
                    No audit rows yet.
                  </p>
                )}
                {auditRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-baseline justify-between gap-2 text-[12px]"
                    title={
                      typeof r.diff === "object" && r.diff
                        ? JSON.stringify(r.diff).slice(0, 400)
                        : ""
                    }
                  >
                    <span className="grow truncate text-[var(--text-2)]">
                      <span className="font-semibold text-[var(--text-1)]">
                        {r.action}
                      </span>{" "}
                      · {r.entity_type}
                      {r.entity_id ? ` #${r.entity_id.slice(0, 8)}` : ""}
                    </span>
                    <span className="text-[10.5px] text-[var(--text-4)]">
                      {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "engine" && (
          <div className="mb-4 flex gap-1.5">
            {(
              [
                {
                  id: "rules",
                  label: "Rules",
                  hint: "Adaptation triggers, behavior rule sets (recovery, restraint, training, circadian).",
                },
                {
                  id: "config",
                  label: "Config",
                  hint: "Live constants gating trial behavior, free-tier caps, and intelligence thresholds.",
                },
                {
                  id: "intelligence",
                  label: "Intelligence",
                  hint: "The kinds of insights produced and the honesty gates each must clear. Edit insight + recommendation templates here.",
                },
                {
                  id: "access",
                  label: "Access",
                  hint: "Manage the admin allowlist (cms_admins). Adding here grants /admin access without SQL.",
                },
              ] as { id: EngineSub; label: string; hint: string }[]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setEngineSub(s.id)}
                title={s.hint}
                className="press tr-fast rounded-[var(--r-pill)] px-3.5 py-1.5 text-[12px] font-semibold"
                style={{
                  background:
                    engineSub === s.id
                      ? "var(--text-1)"
                      : "var(--surface-2)",
                  color:
                    engineSub === s.id ? "#08090B" : "var(--text-3)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tab === "engine" && engineSub === "rules" && (
          <div className="space-y-4">
            <p className="t-caption leading-relaxed">
              Read-only inspector of the rules currently baked into the
              engine (<code>adapt()</code> + <code>shapeTimeline()</code>).
              Each <b>Mode</b> shows what triggers it and what users see.
              Each <b>Rule set</b> lists the behavior keys grouped under a
              tag (promote / demote / restraint / training / circadian).
            </p>
            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow color="var(--readiness)">
                  CMS adaptation rules
                </Eyebrow>
                <span
                  className="t-caption"
                  title="adapt() runs the hardcoded baseline above, then any matching published rule overrides mode / headline / tone / reason by ascending priority."
                >
                  runtime live ?
                </span>
              </div>
              <div
                className={card}
                style={surf}
                title="The metrics you can reference in a trigger condition. Numbers compare with <, <=, >, >=, ==, !=; booleans only ==, !=."
              >
                <Eyebrow>Available metrics</Eyebrow>
                <div className="mt-2 space-y-1 text-[12px]">
                  {RULE_METRICS.map((m) => (
                    <div
                      key={m.name}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="shrink-0 font-mono text-[var(--text-2)]">
                        {m.name}
                      </span>
                      <span className="grow text-right text-[var(--text-3)]">
                        {m.description}
                      </span>
                      <span className="shrink-0 text-[10.5px] text-[var(--text-4)]">
                        {m.type}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="t-caption mt-2 leading-relaxed">
                  Use the visual editor below to compose conditions and
                  effects. Need raw JSON? Open the &ldquo;Advanced&rdquo;
                  drawer inside any rule. Only published rules apply at
                  runtime — drafts stay in the CMS until promoted.
                </p>
              </div>
              <div className="space-y-1.5">
                {rules.length === 0 && (
                  <p className="t-caption px-1">No rules yet.</p>
                )}
                {rules.map((r) => (
                  <div key={r.id} className={card} style={surf}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12.5px] font-semibold text-[var(--text-1)]">
                        {r.name}
                      </p>
                      <span className="t-caption">
                        priority {r.priority} · v{r.version}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input
                        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[12.5px] text-[var(--text-1)] outline-none"
                        value={r.name}
                        onChange={(e) =>
                          setRules((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? { ...x, name: e.target.value }
                                : x
                            )
                          )
                        }
                      />
                      <input
                        type="number"
                        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[12.5px] text-[var(--text-1)] outline-none"
                        value={r.priority}
                        onChange={(e) =>
                          setRules((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    priority: Number(e.target.value),
                                  }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                    <div className="mt-3">
                      <RuleEditor
                        trigger={r.trigger}
                        effect={r.effect}
                        onChange={(next) =>
                          setRules((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? {
                                    ...x,
                                    trigger: next.trigger,
                                    effect: next.effect,
                                  }
                                : x
                            )
                          )
                        }
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          setRules((rs) =>
                            rs.map((x) =>
                              x.id === r.id
                                ? { ...x, status: e.target.value }
                                : x
                            )
                          )
                        }
                        className="rounded-[var(--r-sm)] bg-[var(--surface-3)] px-2 py-1 text-[11.5px] text-[var(--text-1)] outline-none"
                      >
                        {["draft", "published", "archived"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          const result = await saveAdaptationRule(r);
                          setBusy(false);
                          setMsg(
                            result.ok
                              ? "Saved."
                              : result.reason ?? "Failed"
                          );
                          if (result.ok) refreshRules();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1 text-[11.5px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete the "${r.name}" rule?`
                            )
                          )
                            return;
                          setBusy(true);
                          const result = await deleteAdaptationRule(r.id);
                          setBusy(false);
                          setMsg(
                            result.ok
                              ? "Deleted."
                              : result.reason ?? "Failed"
                          );
                          if (result.ok) refreshRules();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-1 text-[11.5px] font-semibold text-[var(--alert)] disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={card} style={surf}>
                <Eyebrow>Add rule</Eyebrow>
                <div className="mt-2 space-y-2">
                  <Field label="Name" help="rule.name">
                    <input
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="e.g. soft-recovery"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <Field label="Priority" help="rule.priority">
                    <input
                      type="number"
                      value={newRulePriority}
                      onChange={(e) =>
                        setNewRulePriority(Number(e.target.value))
                      }
                      placeholder="lower = wins (baseline = 1000)"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <RuleEditor
                    trigger={newRuleTrigger}
                    effect={newRuleEffect}
                    onChange={(next) => {
                      setNewRuleTrigger(next.trigger);
                      setNewRuleEffect(next.effect);
                    }}
                  />
                  <button
                    disabled={busy || !newRuleName.trim()}
                    onClick={async () => {
                      setBusy(true);
                      const r = await saveAdaptationRule({
                        name: newRuleName,
                        priority: newRulePriority,
                        trigger: newRuleTrigger,
                        effect: newRuleEffect,
                      });
                      setBusy(false);
                      setMsg(r.ok ? "Added." : r.reason ?? "Failed");
                      if (r.ok) {
                        setNewRuleName("");
                        setNewRulePriority(50);
                        // Reset to sensible defaults so the next rule starts blank.
                        setNewRuleTrigger({
                          all: [
                            { metric: "recoveryProxy", op: "<", value: 45 },
                          ],
                        });
                        setNewRuleEffect({ setMode: "recovery" });
                        refreshRules();
                      }
                    }}
                    className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    Add rule (draft)
                  </button>
                </div>
              </div>
            </div>
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

        {tab === "engine" && engineSub === "config" && (
          <div className="space-y-2">
            <p className="t-caption leading-relaxed">
              Runtime tunables that gate trial behavior, free-tier
              caps, and intelligence thresholds. <b>Effective</b> is
              what the runtime is using right now; <b>fallback</b> is
              the value baked into the source — what runs when no
              override has been published (and what Delete reverts to).
              Author overrides below; they go live the moment you
              Publish.
            </p>
            {CONFIG_ROWS.map((c) => {
              const known = KNOWN_CONFIG_KEYS.find(
                (k) => k.key === c.key
              );
              const effective = known
                ? getCfgNumber(known.key, known.defaultValue)
                : null;
              const overridden =
                known &&
                effective != null &&
                effective !== known.defaultValue;
              const historyOpen = !!cfgHistoryOpen[c.key];
              const historyRows = cfgHistoryBy[c.key];
              return (
                <div
                  key={c.key}
                  className="rounded-[var(--r-md)] p-3.5"
                  style={surf}
                  title={`${c.key} — ${c.note}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--text-1)]">
                        {c.key}
                      </p>
                      <p className="t-caption mt-0.5">{c.note}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {known ? (
                        <>
                          {/* Effective is now the primary read — your eye
                              lands on the value the runtime is serving. */}
                          <p
                            className="text-[18px] font-bold leading-none"
                            style={{
                              color: overridden
                                ? "var(--readiness)"
                                : "var(--text-1)",
                            }}
                          >
                            {effective}
                          </p>
                          <p
                            className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{
                              color: overridden
                                ? "var(--readiness)"
                                : "var(--text-4)",
                            }}
                          >
                            effective{overridden ? " · live" : ""}
                          </p>
                          {effective !== known.defaultValue && (
                            <p className="mt-1 text-[10.5px] text-[var(--text-4)]">
                              fallback {known.defaultValue}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Documented-only rows (no runtime reader) —
                              fall back to the original simple layout. */}
                          <p className="text-[14px] font-bold text-[var(--text-1)]">
                            {c.value}
                          </p>
                          <p className="text-[10px] text-[var(--text-4)]">
                            {c.kind}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  {known && (
                    <>
                      <button
                        onClick={() => toggleCfgHistory(c.key)}
                        className="press tr-fast mt-2 text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text-2)]"
                        title="Recent changes to this override (cms_revisions)."
                      >
                        {historyOpen ? "− Hide history" : "↻ History"}
                      </button>
                      {historyOpen && (
                        <div
                          className="mt-2 rounded-[var(--r-sm)] p-2.5"
                          style={{ background: "var(--surface-3)" }}
                        >
                          {historyRows === undefined ? (
                            <p className="t-caption">Loading…</p>
                          ) : historyRows.length === 0 ? (
                            <p className="t-caption">
                              No changes yet — this key is on its{" "}
                              fallback.
                            </p>
                          ) : (
                            <div className="space-y-1 text-[11.5px]">
                              {historyRows.map((r) => {
                                const snap = r.snapshot as
                                  | Record<string, unknown>
                                  | undefined;
                                const v =
                                  snap && "value" in snap
                                    ? JSON.stringify(snap.value)
                                    : "—";
                                return (
                                  <div
                                    key={r.id}
                                    className="flex items-baseline justify-between gap-3"
                                  >
                                    <span className="font-mono text-[var(--text-1)]">
                                      → {v}
                                    </span>
                                    <span className="t-caption">
                                      {new Date(
                                        r.created_at
                                      ).toLocaleString()}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow color="var(--readiness)">CMS overrides</Eyebrow>
                <span
                  className="t-caption"
                  title="Stored in cms_intelligence_config. Live at runtime after Publish — the entitlement gates and engine constants read these via getCfg*."
                >
                  runtime live ?
                </span>
              </div>
              <p className="t-caption leading-relaxed">
                Override the keys the runtime actually reads. Pick a
                known key below to author one — those take effect on
                Publish. Unknown keys can be authored too (forward
                compat) but won&apos;t change behavior.
              </p>

              {/* Diagnostics — what the runtime is ACTUALLY serving
                  right now. If "active bundle" is v0 after a Publish,
                  the runtime didn't adopt; click Re-fetch. */}
              <div
                className={card}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--hairline-strong)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <Eyebrow>Runtime diagnostics</Eyebrow>
                  <button
                    onClick={async () => {
                      resetRefresh();
                      const ok = await fetchAndApplyPublished();
                      setMsg(
                        ok
                          ? "Runtime re-fetched from cloud."
                          : "Re-fetch did not apply (already on latest, or integrity check failed)."
                      );
                    }}
                    className="press text-[11.5px] font-semibold text-[var(--readiness)]"
                    title="Forces this admin session to read the latest published bundle from Supabase and adopt it."
                  >
                    ↻ Re-fetch from cloud
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-[11.5px]">
                  <p className="font-mono text-[var(--text-2)]">
                    active bundle: v{activeBundleVersion()}
                  </p>
                  <p className="font-mono text-[var(--text-2)]">
                    effective config:{" "}
                    <code className="text-[var(--text-1)]">
                      {JSON.stringify(
                        KNOWN_CONFIG_KEYS.reduce<Record<string, number>>(
                          (m, k) => {
                            m[k.key] = getCfgNumber(
                              k.key,
                              k.defaultValue
                            );
                            return m;
                          },
                          {}
                        )
                      )}
                    </code>
                  </p>
                  <p className="t-caption mt-1.5 leading-relaxed">
                    If "active bundle" is <b>v0</b> after Publish, the
                    runtime didn&apos;t adopt — hit Re-fetch. If it shows
                    a real version but the values look stale, hard-
                    refresh (Cmd-Shift-R) — your browser is on an old JS
                    bundle.
                  </p>
                </div>
              </div>

              {/* Effective-value panel: known keys, their default,
                  current override (if any), and the effective value
                  the runtime is using right now. */}
              <div className={card} style={surf}>
                <Eyebrow>Known keys (effective values)</Eyebrow>
                <div className="mt-2 space-y-1.5 text-[12.5px]">
                  {KNOWN_CONFIG_KEYS.map((k) => {
                    const override = cfgRows.find(
                      (r) => r.key === k.key
                    );
                    const effective = getCfgNumber(
                      k.key,
                      k.defaultValue
                    );
                    const overridden =
                      override !== undefined &&
                      effective !== k.defaultValue;
                    return (
                      <div
                        key={k.key}
                        className="flex items-baseline justify-between gap-3"
                        title={k.description}
                      >
                        <span className="font-mono text-[var(--text-2)]">
                          {k.key}
                        </span>
                        <span className="grow text-right text-[var(--text-3)]">
                          default {k.defaultValue}
                        </span>
                        <button
                          onClick={() => {
                            setCfgKey(k.key);
                            setCfgValue(
                              JSON.stringify(
                                override?.value ?? k.defaultValue
                              )
                            );
                            setCfgDesc(k.description);
                          }}
                          className="press shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: overridden
                              ? "rgba(111,168,245,.18)"
                              : "var(--surface-3)",
                            color: overridden
                              ? "var(--readiness)"
                              : "var(--text-2)",
                          }}
                          title={
                            overridden
                              ? "Override is live"
                              : "No override — click to author one"
                          }
                        >
                          effective {effective}
                          {overridden ? " · live" : ""}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                {cfgRows.length === 0 && (
                  <p className="t-caption px-1">No overrides yet.</p>
                )}
                {cfgRows.map((c) => (
                  <div
                    key={c.key}
                    className="flex items-start justify-between gap-3 rounded-[var(--r-md)] p-3"
                    style={surf}
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-1)]">
                        {c.key}
                      </p>
                      <p className="t-caption mt-0.5 break-all">
                        {JSON.stringify(c.value)}
                      </p>
                      {c.description && (
                        <p className="t-caption mt-0.5">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Delete the override "${c.key}"?`
                          )
                        )
                          return;
                        const r = await deleteConfigOverride(c.key);
                        if (!r.ok)
                          setMsg(r.reason ?? "Delete failed.");
                        refreshCfg();
                      }}
                      className="press text-[11px] font-semibold text-[var(--alert)]"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <div className={card} style={surf}>
                <Eyebrow>Add override</Eyebrow>
                <div className="mt-2 space-y-2">
                  <Field label="Key" help="config.key">
                    <input
                      value={cfgKey}
                      onChange={(e) => setCfgKey(e.target.value)}
                      list="known-config-keys"
                      placeholder="e.g. AHA_DAYS (pick from the known list above)"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <datalist id="known-config-keys">
                    {KNOWN_CONFIG_KEYS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.description}
                      </option>
                    ))}
                  </datalist>
                  <Field label="Value" help="config.value">
                    <input
                      value={cfgValue}
                      onChange={(e) => setCfgValue(e.target.value)}
                      placeholder='e.g. 14 or "evening" or true'
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <Field label="Description (optional)" help="config.description">
                    <input
                      value={cfgDesc}
                      onChange={(e) => setCfgDesc(e.target.value)}
                      placeholder="why this override exists"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <button
                    disabled={busy || !cfgKey.trim() || !cfgValue.trim()}
                    onClick={async () => {
                      let parsed: unknown = cfgValue;
                      try {
                        parsed = JSON.parse(cfgValue);
                      } catch {
                        /* keep as raw string */
                      }
                      setBusy(true);
                      const r = await upsertConfigOverride({
                        key: cfgKey,
                        value: parsed,
                        description: cfgDesc || undefined,
                      });
                      setBusy(false);
                      setMsg(
                        r.ok ? "Override saved." : r.reason ?? "Failed"
                      );
                      if (r.ok) {
                        setCfgKey("");
                        setCfgValue("");
                        setCfgDesc("");
                        refreshCfg();
                      }
                    }}
                    className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    {busy ? "…" : "Add / update"}
                  </button>
                  {msg && (
                    <p className="t-caption">{msg}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "engine" && engineSub === "intelligence" && (
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

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow color="var(--readiness)">
                  Insight templates
                </Eyebrow>
                <span
                  className="t-caption"
                  title="cms_insight_templates rows. The runtime adopts these in a follow-up; editing now stores them in the CMS."
                >
                  editor live · runtime adopts next ?
                </span>
              </div>
              <p className="t-caption leading-relaxed">
                Templated copy strings keyed by <i>kind</i> (e.g.{" "}
                <code>keystone</code>, <code>weekly</code>). Conditions
                (free JSON) gate when each fires.
              </p>
              <div className="space-y-1.5">
                {insTemplates.length === 0 && (
                  <p className="t-caption px-1">
                    No insight templates yet.
                  </p>
                )}
                {insTemplates.map((t) => (
                  <div key={t.id} className={card} style={surf}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12.5px] font-semibold text-[var(--text-1)]">
                        {t.kind}
                      </p>
                      <span className="t-caption">v{t.version}</span>
                    </div>
                    <textarea
                      className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[12.5px] text-[var(--text-1)] outline-none"
                      rows={2}
                      value={t.template}
                      onChange={(e) =>
                        setInsTemplates((rs) =>
                          rs.map((r) =>
                            r.id === t.id
                              ? { ...r, template: e.target.value }
                              : r
                          )
                        )
                      }
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={t.status}
                        onChange={(e) =>
                          setInsTemplates((rs) =>
                            rs.map((r) =>
                              r.id === t.id
                                ? { ...r, status: e.target.value }
                                : r
                            )
                          )
                        }
                        title="Only published templates flow into the bundle at publish time."
                        className="rounded-[var(--r-sm)] bg-[var(--surface-3)] px-2 py-1 text-[11.5px] text-[var(--text-1)] outline-none"
                      >
                        {["draft", "published", "archived"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          const r = await saveInsightTemplate(t);
                          setBusy(false);
                          setMsg(
                            r.ok ? "Saved." : r.reason ?? "Failed"
                          );
                          if (r.ok) refreshTemplates();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1.5 text-[11.5px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete the "${t.kind}" template?`
                            )
                          )
                            return;
                          setBusy(true);
                          const r = await deleteInsightTemplate(t.id);
                          setBusy(false);
                          setMsg(
                            r.ok ? "Deleted." : r.reason ?? "Failed"
                          );
                          if (r.ok) refreshTemplates();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-1.5 text-[11.5px] font-semibold text-[var(--alert)] disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={card} style={surf}>
                <Eyebrow>Add insight template</Eyebrow>
                <p className="t-caption mt-1 leading-relaxed">
                  Pick a known kind below — the runtime reads templates
                  by exact kind name, so an unknown kind is harmless but
                  has no effect.
                </p>
                {(() => {
                  const known = KNOWN_INSIGHT_KINDS.find(
                    (k) => k.kind === newInsKind.trim()
                  );
                  return (
                    <div className="mt-2 space-y-2">
                      <input
                        value={newInsKind}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNewInsKind(v);
                          const m = KNOWN_INSIGHT_KINDS.find(
                            (k) => k.kind === v.trim()
                          );
                          if (m && !newInsTpl)
                            setNewInsTpl(m.defaultCopy);
                        }}
                        list="known-insight-kinds"
                        placeholder="kind — pick or type"
                        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 font-mono text-[12.5px] text-[var(--text-1)] outline-none"
                      />
                      <datalist id="known-insight-kinds">
                        {KNOWN_INSIGHT_KINDS.map((k) => (
                          <option key={k.kind} value={k.kind}>
                            {k.group} · default: {k.defaultCopy.slice(0, 60)}
                          </option>
                        ))}
                      </datalist>
                      {known ? (
                        <p
                          className="rounded-[var(--r-sm)] px-3 py-2 text-[11.5px] leading-relaxed"
                          style={{
                            background: "rgba(111,168,245,.10)",
                            color: "var(--text-2)",
                          }}
                        >
                          <b>{known.group}</b>{" "}
                          {known.vars.length > 0 ? (
                            <>
                              · variables:{" "}
                              {known.vars.map((v) => (
                                <code key={v}>{`{${v}}`} </code>
                              ))}
                            </>
                          ) : (
                            "· no variables"
                          )}
                          <br />
                          <span className="text-[var(--text-3)]">
                            default: “{known.defaultCopy}”
                          </span>
                        </p>
                      ) : newInsKind.trim() ? (
                        <p
                          className="rounded-[var(--r-sm)] px-3 py-2 text-[11.5px] font-medium"
                          style={{
                            background: "rgba(232,201,155,.10)",
                            color: "var(--warm)",
                          }}
                        >
                          ⚠ This kind isn&apos;t one the runtime reads
                          today — authoring it is allowed but it
                          won&apos;t fire. Pick from the list to author
                          one that actually takes effect.
                        </p>
                      ) : null}
                      <textarea
                        value={newInsTpl}
                        onChange={(e) => setNewInsTpl(e.target.value)}
                        rows={2}
                        placeholder="template copy (use {variable} placeholders shown above)"
                        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                      />
                      <button
                        disabled={
                          busy ||
                          !newInsKind.trim() ||
                          !newInsTpl.trim()
                        }
                        onClick={async () => {
                          setBusy(true);
                          const r = await saveInsightTemplate({
                            kind: newInsKind,
                            template: newInsTpl,
                            status: "draft",
                          });
                          setBusy(false);
                          setMsg(
                            r.ok ? "Added (as draft)." : r.reason ?? "Failed"
                          );
                          if (r.ok) {
                            setNewInsKind("");
                            setNewInsTpl("");
                            refreshTemplates();
                          }
                        }}
                        className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Add template (draft)
                      </button>
                      <p className="t-caption">
                        New rows save as draft. Flip the status dropdown
                        to <b>published</b> + Save to make it live on the
                        next Publish.
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow color="var(--readiness)">
                  Recommendation templates
                </Eyebrow>
                <span
                  className="t-caption"
                  title="cms_recommendation_templates rows. Runtime adoption pending."
                >
                  editor live · runtime adopts next ?
                </span>
              </div>
              <div className="space-y-1.5">
                {recTemplates.length === 0 && (
                  <p className="t-caption px-1">
                    No recommendation templates yet.
                  </p>
                )}
                {recTemplates.map((t) => (
                  <div key={t.id} className={card} style={surf}>
                    <p className="text-[12.5px] font-semibold text-[var(--text-1)]">
                      {t.context}
                    </p>
                    <textarea
                      className="mt-2 w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[12.5px] text-[var(--text-1)] outline-none"
                      rows={2}
                      value={t.copy}
                      onChange={(e) =>
                        setRecTemplates((rs) =>
                          rs.map((r) =>
                            r.id === t.id
                              ? { ...r, copy: e.target.value }
                              : r
                          )
                        )
                      }
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <select
                        value={t.status}
                        onChange={(e) =>
                          setRecTemplates((rs) =>
                            rs.map((r) =>
                              r.id === t.id
                                ? { ...r, status: e.target.value }
                                : r
                            )
                          )
                        }
                        title="Promote to 'published' so this template flows into the bundle at publish time."
                        className="rounded-[var(--r-sm)] bg-[var(--surface-3)] px-2 py-1 text-[11.5px] text-[var(--text-1)] outline-none"
                      >
                        {["draft", "published", "archived"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          const r = await saveRecTemplate(t);
                          setBusy(false);
                          setMsg(
                            r.ok ? "Saved." : r.reason ?? "Failed"
                          );
                          if (r.ok) refreshTemplates();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1.5 text-[11.5px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        disabled={busy}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Delete the "${t.context}" template?`
                            )
                          )
                            return;
                          setBusy(true);
                          const r = await deleteRecTemplate(t.id);
                          setBusy(false);
                          setMsg(
                            r.ok ? "Deleted." : r.reason ?? "Failed"
                          );
                          if (r.ok) refreshTemplates();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-1.5 text-[11.5px] font-semibold text-[var(--alert)] disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className={card} style={surf}>
                <Eyebrow>Add recommendation template</Eyebrow>
                <div className="mt-2 space-y-2">
                  <Field label="Context" help="recTpl.context">
                    <input
                      value={newRecCtx}
                      onChange={(e) => setNewRecCtx(e.target.value)}
                      placeholder="e.g. low-recovery-morning"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <Field label="Copy" help="recTpl.copy">
                    <textarea
                      value={newRecCopy}
                      onChange={(e) => setNewRecCopy(e.target.value)}
                      rows={2}
                      placeholder="copy with optional {variable} placeholders"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <button
                    disabled={
                      busy || !newRecCtx.trim() || !newRecCopy.trim()
                    }
                    onClick={async () => {
                      setBusy(true);
                      const r = await saveRecTemplate({
                        context: newRecCtx,
                        copy: newRecCopy,
                      });
                      setBusy(false);
                      setMsg(
                        r.ok ? "Added." : r.reason ?? "Failed"
                      );
                      if (r.ok) {
                        setNewRecCtx("");
                        setNewRecCopy("");
                        refreshTemplates();
                      }
                    }}
                    className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                  >
                    Add template
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "engine" && engineSub === "access" && (
          <div className="space-y-3">
            <p className="t-caption leading-relaxed">
              Anyone you add here gets full <code>/admin</code> access —
              no sub-roles. Type their email; they need to have already
              signed up at <code>/auth</code>. (If they haven&apos;t,
              the lookup will tell you.)
            </p>
            <div className="space-y-1.5">
              {admins.length === 0 && (
                <p className="t-caption px-1">
                  No admins yet (you must already be one to see this).
                </p>
              )}
              {admins.map((a) => {
                const display = a.email ?? a.user_id;
                const sub = a.email ? a.user_id.slice(0, 8) + "…" : null;
                return (
                  <div
                    key={a.user_id}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-md)] p-3"
                    style={surf}
                    title={`Added ${new Date(a.added_at).toLocaleString()}\nUser id: ${a.user_id}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] text-[var(--text-1)]">
                        {display}
                      </p>
                      {sub && (
                        <p className="truncate font-mono text-[10.5px] text-[var(--text-4)]">
                          {sub}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={async () => {
                        if (
                          !window.confirm(
                            `Remove ${display} from the admin allowlist? They lose /admin access immediately.`
                          )
                        )
                          return;
                        const r = await removeAdmin(a.user_id);
                        setMsg(
                          r.ok ? "Removed." : r.reason ?? "Failed"
                        );
                        if (r.ok) refreshAdmins();
                      }}
                      className="press shrink-0 text-[11px] font-semibold text-[var(--alert)]"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
            <div className={card} style={surf}>
              <Eyebrow>Invite admin</Eyebrow>
              <div className="mt-2">
                <Field label="Email" help="admin.email">
                  <input
                    type="email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="teammate@example.com"
                    className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                  />
                </Field>
              </div>
              <button
                disabled={busy || !newAdminEmail.trim()}
                onClick={async () => {
                  setBusy(true);
                  const r = await addAdminByEmail(newAdminEmail);
                  setBusy(false);
                  setMsg(r.ok ? "Admin granted." : r.reason ?? "Failed");
                  if (r.ok) {
                    setNewAdminEmail("");
                    refreshAdmins();
                  }
                }}
                className="press tr-fast mt-2 w-full rounded-[var(--r-pill)] bg-[var(--text-1)] py-2 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
              >
                {busy ? "…" : "Grant admin"}
              </button>
              <button
                onClick={() => setShowAdminAdvanced((v) => !v)}
                className="press mt-2 text-[10.5px] text-[var(--text-4)] hover:text-[var(--text-3)]"
              >
                {showAdminAdvanced ? "Hide" : "Show"} advanced (paste
                user id instead)
              </button>
              {showAdminAdvanced && (
                <div
                  className="mt-2 rounded-[var(--r-sm)] p-2.5"
                  style={{ background: "var(--surface-3)" }}
                >
                  <Field label="User id" help="admin.userId">
                    <input
                      value={newAdminId}
                      onChange={(e) => setNewAdminId(e.target.value)}
                      placeholder="uuid — find under Supabase → Auth → Users"
                      className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3 py-2 text-[12.5px] font-mono text-[var(--text-1)] outline-none"
                    />
                  </Field>
                  <button
                    disabled={busy || !newAdminId.trim()}
                    onClick={async () => {
                      setBusy(true);
                      const r = await addAdmin(newAdminId);
                      setBusy(false);
                      setMsg(r.ok ? "Added." : r.reason ?? "Failed");
                      if (r.ok) {
                        setNewAdminId("");
                        refreshAdmins();
                      }
                    }}
                    className="press tr-fast mt-2 w-full rounded-[var(--r-pill)] bg-[var(--surface-2)] py-2 text-[11.5px] font-semibold text-[var(--text-1)] disabled:opacity-40"
                  >
                    {busy ? "…" : "Grant by user id"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "intelligence" && intelData && (
          <div className="space-y-5">
            {/* Inventory summary — at-a-glance health of the catalog */}
            <div className={card} style={surf}>
              <Eyebrow>Catalog inventory</Eyebrow>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Curated atoms",
                    value: intelData.inventory.totalCurated,
                  },
                  {
                    label: "Across packs",
                    value: intelData.inventory.totalPacks,
                  },
                  {
                    label: "Library standalones",
                    value: intelData.inventory.totalStandalones,
                  },
                  {
                    label: "With contraindications",
                    value: intelData.inventory.withContraindications,
                  },
                ].map((m) => (
                  <div
                    key={m.label}
                    className="rounded-[var(--r-sm)] p-3"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <p className="text-[22px] font-bold text-[var(--text-1)]">
                      {m.value}
                    </p>
                    <p className="t-caption mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["established", "emerging", "exploratory", "none"] as const).map(
                  (tier) => (
                    <div
                      key={tier}
                      className="rounded-[var(--r-sm)] p-3"
                      style={{
                        background:
                          tier === "exploratory"
                            ? "color-mix(in srgb, var(--alert) 12%, var(--surface-3))"
                            : tier === "emerging"
                            ? "color-mix(in srgb, var(--warm) 11%, var(--surface-3))"
                            : "var(--surface-3)",
                      }}
                    >
                      <p className="text-[18px] font-bold text-[var(--text-1)]">
                        {intelData.inventory.byEvidenceTier[tier] ?? 0}
                      </p>
                      <p className="t-caption mt-0.5 capitalize">
                        {tier === "none" ? "No evidence tier" : tier}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Ontology audit — any catalog-level issues */}
            <div className={card} style={surf}>
              <div className="flex items-center justify-between">
                <Eyebrow
                  color={
                    intelData.issues.some((i) => i.severity === "error")
                      ? "var(--alert)"
                      : intelData.issues.length > 0
                      ? "var(--warm)"
                      : "var(--vitality)"
                  }
                >
                  Ontology audit
                </Eyebrow>
                <span className="t-caption">
                  {intelData.issues.length === 0
                    ? "All checks pass"
                    : `${intelData.issues.filter((i) => i.severity === "error").length} errors · ${intelData.issues.filter((i) => i.severity === "warning").length} warnings`}
                </span>
              </div>
              {intelData.issues.length === 0 ? (
                <p className="mt-2 text-[13px] text-[var(--text-3)]">
                  Catalog passes every cross-cutting invariant (canonicalKey
                  shape, derivedFrom/targets reference real keys, no
                  duplicate titles across canonical atoms, every atom with
                  evidence text has an evidenceTier).
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {intelData.issues.slice(0, 20).map((issue, i) => (
                    <div
                      key={i}
                      className="rounded-[var(--r-sm)] p-3 text-[12.5px]"
                      style={{
                        background:
                          issue.severity === "error"
                            ? "color-mix(in srgb, var(--alert) 12%, var(--surface-3))"
                            : "color-mix(in srgb, var(--warm) 10%, var(--surface-3))",
                      }}
                    >
                      <p className="font-semibold text-[var(--text-1)]">
                        <span
                          className="mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase"
                          style={{
                            background:
                              issue.severity === "error"
                                ? "var(--alert)"
                                : "var(--warm)",
                            color: "#08090B",
                          }}
                        >
                          {issue.severity}
                        </span>
                        {issue.kind}
                      </p>
                      <p className="mt-1 text-[var(--text-2)]">
                        {issue.message}
                      </p>
                      {issue.canonicalKey && (
                        <button
                          onClick={() =>
                            setIntelInspectKey(issue.canonicalKey!)
                          }
                          className="press mt-1 text-[11.5px] underline-offset-2 hover:underline"
                          style={{ color: "var(--readiness)" }}
                        >
                          Inspect {issue.canonicalKey}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contraindication coverage */}
            <div className={card} style={surf}>
              <Eyebrow>Safety coverage</Eyebrow>
              <p className="mt-1 t-caption leading-relaxed">
                How many curated atoms declare each contraindication flag
                — the engine quietly suppresses these for users with the
                matching settings flag (not a clinical warning, just
                tailoring).
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(
                  intelData.inventory.contraindicationCounts
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([flag, n]) => (
                    <div
                      key={flag}
                      className="rounded-[var(--r-sm)] p-2.5"
                      style={{ background: "var(--surface-3)" }}
                    >
                      <p className="text-[15px] font-bold text-[var(--text-1)]">
                        {n}
                      </p>
                      <p className="t-caption mt-0.5">{flag}</p>
                    </div>
                  ))}
                {Object.keys(intelData.inventory.contraindicationCounts)
                  .length === 0 && (
                  <p className="t-caption">No contraindication metadata yet.</p>
                )}
              </div>
            </div>

            {/* Atom inventory — full registry with filter + drill-down */}
            <div className={card} style={surf}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Eyebrow>Atom registry</Eyebrow>
                <span className="t-caption">
                  Click any atom to inspect its provenance, merge state,
                  and governance metadata.
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={intelFilter}
                  onChange={(e) => setIntelFilter(e.target.value)}
                  placeholder="Search atoms by key, title, or pack…"
                  className="flex-1 min-w-[200px] rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2 text-[13px] text-[var(--text-1)] outline-none"
                />
                <div className="flex gap-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] p-0.5">
                  {(
                    [
                      "all",
                      "established",
                      "emerging",
                      "exploratory",
                      "untiered",
                    ] as const
                  ).map((t) => (
                    <button
                      key={t}
                      onClick={() => setIntelTierFilter(t)}
                      className="press tr-fast rounded-[var(--r-pill)] px-2.5 py-1 text-[10.5px] font-semibold capitalize"
                      style={{
                        background:
                          intelTierFilter === t
                            ? "var(--text-1)"
                            : "transparent",
                        color:
                          intelTierFilter === t ? "#08090B" : "var(--text-3)",
                      }}
                    >
                      {t === "untiered" ? "no tier" : t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 max-h-[480px] space-y-1 overflow-y-auto">
                {(() => {
                  const q = intelFilter.trim().toLowerCase();
                  const rows = [...intelData.registry.values()]
                    .filter((a) => {
                      if (intelTierFilter === "untiered")
                        return !a.evidenceTier;
                      if (intelTierFilter !== "all")
                        return a.evidenceTier === intelTierFilter;
                      return true;
                    })
                    .filter((a) => {
                      if (!q) return true;
                      return (
                        a.canonicalKey.toLowerCase().includes(q) ||
                        a.title.toLowerCase().includes(q) ||
                        a.fromPacks.some((p) =>
                          p.toLowerCase().includes(q)
                        )
                      );
                    })
                    .sort((a, b) => a.title.localeCompare(b.title));
                  if (rows.length === 0)
                    return (
                      <p className="px-3 py-4 text-[12.5px] text-[var(--text-3)]">
                        No atoms match the current filter.
                      </p>
                    );
                  return rows.map((a) => (
                    <button
                      key={a.canonicalKey}
                      onClick={() => setIntelInspectKey(a.canonicalKey)}
                      className="press tr-fast flex w-full items-start gap-3 rounded-[var(--r-sm)] p-2.5 text-left"
                      style={{
                        background:
                          intelInspectKey === a.canonicalKey
                            ? "var(--surface-3)"
                            : "transparent",
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--text-1)]">
                          {a.title}
                          {a.contraindications.length > 0 && (
                            <span
                              className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{
                                background:
                                  "color-mix(in srgb, var(--alert) 18%, var(--surface-3))",
                                color: "var(--alert)",
                              }}
                            >
                              {a.contraindications.length} contra
                            </span>
                          )}
                        </span>
                        <span className="t-caption mt-0.5 flex flex-wrap items-center gap-1.5">
                          <code>{a.canonicalKey}</code>
                          <span>·</span>
                          <span className="capitalize">{a.block}</span>
                          <span>·</span>
                          <span>L{a.leverage}</span>
                          {a.evidenceTier && (
                            <>
                              <span>·</span>
                              <span
                                className="rounded-full px-1.5 py-0 text-[9.5px] font-semibold uppercase"
                                style={{
                                  background:
                                    a.evidenceTier === "exploratory"
                                      ? "color-mix(in srgb, var(--alert) 16%, var(--surface-3))"
                                      : a.evidenceTier === "emerging"
                                      ? "color-mix(in srgb, var(--warm) 16%, var(--surface-3))"
                                      : "color-mix(in srgb, var(--vitality) 16%, var(--surface-3))",
                                  color:
                                    a.evidenceTier === "exploratory"
                                      ? "var(--alert)"
                                      : a.evidenceTier === "emerging"
                                      ? "var(--warm)"
                                      : "var(--vitality)",
                                }}
                              >
                                {a.evidenceTier}
                              </span>
                            </>
                          )}
                          {a.isStandalone && (
                            <>
                              <span>·</span>
                              <span>standalone</span>
                            </>
                          )}
                          {a.fromPacks.length > 0 && (
                            <>
                              <span>·</span>
                              <span>
                                {a.fromPacks.length} pack
                                {a.fromPacks.length === 1 ? "" : "s"}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                    </button>
                  ));
                })()}
              </div>
            </div>

            {/* Behavior provenance inspector */}
            {intelInspect && (
              <div className={card} style={surf}>
                <div className="flex items-center justify-between">
                  <Eyebrow color="var(--readiness)">Inspector</Eyebrow>
                  <button
                    onClick={() => {
                      setIntelInspect(null);
                      setIntelInspectKey(null);
                    }}
                    className="press text-[11.5px] text-[var(--text-3)] hover:text-[var(--text-2)]"
                  >
                    Close
                  </button>
                </div>
                <p className="mt-2 text-[18px] font-bold text-[var(--text-1)]">
                  {intelInspect.title}
                </p>
                <p className="t-caption mt-0.5">
                  <code>{intelInspect.canonicalKey}</code>
                  {intelInspect.derivedFrom && (
                    <>
                      {" "}
                      derived from <code>{intelInspect.derivedFrom}</code>
                    </>
                  )}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div
                    className="rounded-[var(--r-sm)] p-2.5"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <p className="t-caption">Trust tier</p>
                    <p className="mt-1 text-[13.5px] font-bold capitalize text-[var(--text-1)]">
                      {intelInspect.trustTier}
                    </p>
                  </div>
                  <div
                    className="rounded-[var(--r-sm)] p-2.5"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <p className="t-caption">Recommendation eligible</p>
                    <p className="mt-1 text-[13.5px] font-bold text-[var(--text-1)]">
                      {intelInspect.recommendationEligible ? "Yes" : "No"}
                    </p>
                  </div>
                  <div
                    className="rounded-[var(--r-sm)] p-2.5"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <p className="t-caption">Keystone eligible</p>
                    <p className="mt-1 text-[13.5px] font-bold text-[var(--text-1)]">
                      {intelInspect.keystoneEligible ? "Yes" : "No"}
                    </p>
                  </div>
                  <div
                    className="rounded-[var(--r-sm)] p-2.5"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <p className="t-caption">Current state</p>
                    <p className="mt-1 text-[13.5px] font-bold text-[var(--text-1)]">
                      {intelInspect.muted ? "Muted" : "Visible"}
                    </p>
                  </div>
                </div>

                {intelInspect.muteReason && (
                  <div
                    className="mt-3 rounded-[var(--r-sm)] p-3 text-[12.5px]"
                    style={{
                      background:
                        "color-mix(in srgb, var(--warm) 12%, var(--surface-3))",
                      color: "var(--text-2)",
                    }}
                  >
                    <span className="font-semibold text-[var(--text-1)]">
                      Suppression reason:
                    </span>{" "}
                    {intelInspect.muteReason}
                  </div>
                )}

                {intelInspect.fromPacks.length > 0 && (
                  <div className="mt-3">
                    <p className="t-caption">Source packs</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {intelInspect.fromPacks.map((p) => (
                        <span
                          key={p}
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background: "var(--surface-3)",
                            color: "var(--text-2)",
                          }}
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                    {intelInspect.mergedFromMultiple && (
                      <p className="t-caption mt-1.5">
                        Merged from multiple packs — single row in the
                        timeline.
                      </p>
                    )}
                  </div>
                )}

                {intelInspect.contraindications.length > 0 && (
                  <div className="mt-3">
                    <p className="t-caption">Contraindications</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {intelInspect.contraindications.map((c) => (
                        <span
                          key={c}
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, var(--alert) 18%, var(--surface-3))",
                            color: "var(--alert)",
                          }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {intelInspect.mutesByConflictPair.length > 0 && (
                  <div className="mt-3">
                    <p className="t-caption">
                      Mutes (when this is active)
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {intelInspect.mutesByConflictPair.map((k) => (
                        <button
                          key={k}
                          onClick={() => setIntelInspectKey(k)}
                          className="press rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, var(--warm) 12%, var(--surface-3))",
                            color: "var(--warm)",
                          }}
                        >
                          → {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {intelInspect.mutedByRestraints.length > 0 && (
                  <div className="mt-3">
                    <p className="t-caption">Muted by</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {intelInspect.mutedByRestraints.map((k) => (
                        <button
                          key={k}
                          onClick={() => setIntelInspectKey(k)}
                          className="press rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            background:
                              "color-mix(in srgb, var(--warm) 12%, var(--surface-3))",
                            color: "var(--warm)",
                          }}
                        >
                          ← {k}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {intelInspect.notes.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {intelInspect.notes.map((n, i) => (
                      <p
                        key={i}
                        className="rounded-[var(--r-sm)] p-2.5 text-[12.5px] leading-relaxed text-[var(--text-2)]"
                        style={{ background: "var(--surface-3)" }}
                      >
                        {n}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "simulate" && (
          <div className="space-y-4">
            <div className={card} style={surf}>
              <div className="flex items-center gap-1.5">
                <Eyebrow>Source</Eyebrow>
                <Hint k="simulate.source" />
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
                    helpKey: "simulate.sleep",
                    val: sleepQ,
                    set: setSleepQ,
                    opts: [2, 3, 5],
                  },
                  {
                    label: "Energy",
                    helpKey: "simulate.energy",
                    val: energy,
                    set: setEnergy,
                    opts: [2, 3, 5],
                  },
                  {
                    label: "Gap days",
                    helpKey: "simulate.gapDays",
                    val: gap,
                    set: setGap,
                    opts: [0, 1, 2, 4],
                  },
                ].map((g) => (
                  <div key={g.label}>
                    <p className="t-caption mb-1 flex items-center gap-1">
                      {g.label}
                      <Hint k={g.helpKey} />
                    </p>
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
        {tab === "content" && (
          <div className="mb-4 flex gap-1.5">
            {(
              [
                {
                  id: "author",
                  label: "Authoring",
                  hint: "Edit protocols, behaviors, evidence, explanations. The AI drafter lives here.",
                },
                {
                  id: "review",
                  label: "AI Review",
                  hint: "Pending / Approved / Rejected proposals. AI never auto-applies — every change is approved.",
                },
              ] as { id: ContentMode; label: string; hint: string }[]
            ).map((s) => (
              <button
                key={s.id}
                onClick={() => setContentMode(s.id)}
                title={s.hint}
                className="press tr-fast rounded-[var(--r-pill)] px-3.5 py-1.5 text-[12px] font-semibold"
                style={{
                  background:
                    contentMode === s.id
                      ? "var(--text-1)"
                      : "var(--surface-2)",
                  color:
                    contentMode === s.id ? "#08090B" : "var(--text-3)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tab === "content" && contentMode === "author" &&
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
                                      disabled={aiIdeaBusy}
                                      onClick={async () => {
                                        // Guard against double-click /
                                        // racing a second suggestion
                                        // before openProto resolves —
                                        // the second click would leave
                                        // edP from suggestion A and
                                        // aiDraft from suggestion B.
                                        if (aiIdeaBusy) return;
                                        setAiIdeaBusy(true);
                                        try {
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
                                        } finally {
                                          setAiIdeaBusy(false);
                                        }
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

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Eyebrow>Behaviors</Eyebrow>
                  {edB.length > 1 && (
                    <span className="t-caption">
                      Drag <span className="font-mono">⋮⋮</span> to reorder ·
                      Check to multi-select
                    </span>
                  )}
                </div>
                {bulkSel.size > 0 && (
                  <div
                    className="flex flex-wrap items-center gap-2 rounded-[var(--r-md)] p-3"
                    style={{
                      background:
                        "color-mix(in srgb, var(--readiness) 9%, var(--surface-2))",
                    }}
                  >
                    <span className="text-[12.5px] font-semibold text-[var(--text-1)]">
                      {bulkSel.size} selected
                    </span>
                    <span className="t-caption">·</span>
                    {(["draft", "published", "archived"] as const).map((s) => (
                      <button
                        key={s}
                        disabled={bulkBusy}
                        onClick={async () => {
                          setBulkBusy(true);
                          const r = await bulkSetBehaviorStatus(
                            [...bulkSel],
                            s
                          );
                          setBulkBusy(false);
                          if (r.ok) {
                            setMsg(
                              `${r.affected} behavior${
                                r.affected === 1 ? "" : "s"
                              } → ${s}`
                            );
                            setBulkSel(new Set());
                            reopen();
                          } else {
                            setMsg(r.reason ?? "Bulk update failed");
                          }
                        }}
                        className="press tr-fast rounded-[var(--r-pill)] px-3 py-1 text-[11.5px] font-semibold disabled:opacity-40"
                        style={{
                          background: "var(--surface-3)",
                          color: "var(--text-1)",
                        }}
                        title={`Set status of every selected behavior to "${s}".`}
                      >
                        Set status: {s}
                      </button>
                    ))}
                    <button
                      onClick={() => setBulkSel(new Set())}
                      className="press ml-auto text-[11px] text-[var(--text-3)]"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {edB.map((b, idx) => (
                  <div
                    key={b.id}
                    className={card}
                    style={{
                      ...surf,
                      opacity: dragIdx === idx ? 0.45 : 1,
                      // Insertion line: a soft warm border on the edge
                      // the dragged row would land against. Far less
                      // disruptive than reflowing the layout mid-drag.
                      borderTop:
                        dragIdx != null &&
                        dragOverIdx === idx &&
                        dragOverIdx < dragIdx
                          ? "2px solid var(--warm)"
                          : "1px solid transparent",
                      borderBottom:
                        dragIdx != null &&
                        dragOverIdx === idx &&
                        dragOverIdx > dragIdx
                          ? "2px solid var(--warm)"
                          : "1px solid transparent",
                      transition:
                        "opacity 120ms ease, border-color 120ms ease",
                    }}
                    onDragOver={(e) => {
                      if (dragIdx === null) return;
                      e.preventDefault();
                      if (dragOverIdx !== idx) setDragOverIdx(idx);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      const from = dragIdx;
                      const to = idx;
                      setDragIdx(null);
                      setDragOverIdx(null);
                      if (from === null || from === to) return;
                      // Optimistic reorder so the admin sees it move
                      // instantly; persist in the background. If the
                      // RPC fails we reopen() to snap back to truth.
                      const next = [...edB];
                      const [moved] = next.splice(from, 1);
                      next.splice(to, 0, moved);
                      setEdB(next);
                      if (!edP) return;
                      const r = await setBehaviorOrder(
                        edP.id,
                        next.map((x) => x.id)
                      );
                      if (!r.ok) {
                        setMsg(r.reason ?? "Reorder failed");
                        reopen();
                      }
                    }}>
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
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        {/* Drag handle — the row itself isn't draggable
                            so admins can still select text in the
                            fields. Only this little grip starts a drag. */}
                        <span
                          role="button"
                          tabIndex={-1}
                          aria-label="Drag to reorder"
                          title="Drag to reorder · arrows for one-at-a-time fallback"
                          draggable
                          onDragStart={(e) => {
                            setDragIdx(idx);
                            setDragOverIdx(idx);
                            // dragImage on the handle is too small to
                            // identify; set it on the parent card.
                            const card = (
                              e.currentTarget as HTMLElement
                            ).closest("div[draggable], div");
                            if (card)
                              e.dataTransfer.setDragImage(
                                card as Element,
                                10,
                                10
                              );
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDragIdx(null);
                            setDragOverIdx(null);
                          }}
                          className="grid h-7 w-7 cursor-grab place-items-center rounded-[var(--r-sm)] text-[var(--text-3)] active:cursor-grabbing"
                          style={{ background: "var(--surface-3)" }}
                        >
                          <span className="font-mono text-[12px] leading-none">
                            ⋮⋮
                          </span>
                        </span>
                        {/* Multi-select for bulk operations. Kept
                            next to the handle so the leading area of
                            every row is "manipulate this row" affordances
                            and the trailing area stays focused on the
                            content. */}
                        <input
                          type="checkbox"
                          aria-label={`Select ${b.title}`}
                          title="Select for bulk status change"
                          checked={bulkSel.has(b.id)}
                          onChange={(e) => {
                            const next = new Set(bulkSel);
                            if (e.target.checked) next.add(b.id);
                            else next.delete(b.id);
                            setBulkSel(next);
                          }}
                          className="h-4 w-4 cursor-pointer accent-[var(--readiness)]"
                        />
                        <span className="t-caption flex items-center gap-1.5">
                          #{idx + 1}
                          {isDirty(b) && (
                            <span
                              title="Unsaved changes on this behavior."
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ background: "var(--warm)" }}
                            />
                          )}
                        </span>
                      </span>
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
                            title="Move one slot — drag the handle for cross-list moves."
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
                      placeholder="Title — short name users see"
                      title={HELP["behavior.title"]?.summary}
                    />
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
                          Block <Hint k="behavior.block" />
                        </span>
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
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
                          Leverage <Hint k="behavior.leverage" />
                        </span>
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
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
                          Status <Hint k="behavior.status" />
                        </span>
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
                      </label>
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
                      placeholder="Dose (e.g. 300 mg) — blank if none"
                      title={HELP["behavior.dose"]?.summary}
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
                      placeholder="Rationale — one calm sentence users see"
                      title={HELP["behavior.rationale"]?.summary}
                    />
                    <button
                      disabled={savingIds[b.id]}
                      onClick={async () => {
                        markSavingStart(b.id);
                        const r = await saveBehavior(b);
                        markSavingEnd(b.id);
                        if (r.ok) {
                          flashSaved(b.id);
                          // Update baseline so this row stops showing
                          // as dirty in the sticky bar / per-row dot.
                          setEdBBaseline((m) => ({
                            ...m,
                            [b.id]: snapBehavior(b),
                          }));
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

                {(() => {
                  const dirtyList = edB.filter(isDirty);
                  if (dirtyList.length === 0) return null;
                  return (
                    <div
                      className="glass fixed bottom-4 left-1/2 z-[120] flex -translate-x-1/2 items-center gap-3 rounded-[var(--r-pill)] border border-[var(--hairline-strong)] px-4 py-2.5"
                      style={{ minWidth: 320 }}
                    >
                      <span className="text-[12.5px] font-semibold text-[var(--text-1)]">
                        {dirtyList.length} unsaved
                      </span>
                      <button
                        disabled={dirtyList.some(
                          (b) => savingIds[b.id]
                        )}
                        onClick={async () => {
                          // Continue past failures so a single bad row
                          // doesn't leave the rest stuck dirty + silent.
                          const failed: string[] = [];
                          for (const b of dirtyList) {
                            markSavingStart(b.id);
                            const r = await saveBehavior(b);
                            markSavingEnd(b.id);
                            if (r.ok) {
                              flashSaved(b.id);
                              setEdBBaseline((m) => ({
                                ...m,
                                [b.id]: snapBehavior(b),
                              }));
                            } else {
                              failed.push(
                                `${b.title}: ${r.reason ?? "failed"}`
                              );
                            }
                          }
                          if (failed.length === 0) setMsg(null);
                          else
                            setMsg(
                              `Saved ${dirtyList.length - failed.length}/${dirtyList.length}. Failed: ${failed.join(" · ")}`
                            );
                        }}
                        className="press tr-fast rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                      >
                        Save all
                      </button>
                      <button
                        disabled={dirtyList.some(
                          (b) => savingIds[b.id]
                        )}
                        onClick={async () => {
                          const yes = window.confirm(
                            `Discard unsaved changes on ${dirtyList.length} behavior${dirtyList.length === 1 ? "" : "s"}? Field edits will be lost.`
                          );
                          if (!yes) return;
                          await reopen();
                        }}
                        className="press rounded-[var(--r-pill)] bg-[var(--surface-3)] px-4 py-1.5 text-[12px] font-semibold text-[var(--text-2)] disabled:opacity-40"
                      >
                        Discard
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

        {tab === "content" && contentMode === "review" &&
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
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                          Entity type
                        </span>
                        <Hint k="sug.entityType" />
                      </div>
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
                      <div className="flex items-end gap-2">
                        <Field label="Field" help="sug.field">
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
                        </Field>
                        <div className="grow">
                          <Field label="Proposed value" help="sug.value">
                            <input
                              className={inp}
                              value={dValue}
                              onChange={(e) => setDValue(e.target.value)}
                              placeholder="new value"
                            />
                          </Field>
                        </div>
                      </div>
                      <Field label="Rationale" help="sug.rationale">
                        <input
                          className={inp}
                          value={dWhy}
                          onChange={(e) => setDWhy(e.target.value)}
                          placeholder="why this change"
                        />
                      </Field>
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
                    {sugs.map((s) => {
                      const proposedKeys = Object.keys(s.proposed ?? {});
                      const rejected = sugRejected[s.id] ?? new Set();
                      const accepted = proposedKeys.filter(
                        (k) => !rejected.has(k)
                      );
                      const current = sugCurrent[s.id] ?? {};
                      const fmt = (v: unknown) =>
                        v == null || v === ""
                          ? "—"
                          : typeof v === "string"
                            ? v
                            : JSON.stringify(v);
                      const toggleField = (k: string) =>
                        setSugRejected((m) => {
                          const cur = new Set(m[s.id] ?? []);
                          if (cur.has(k)) cur.delete(k);
                          else cur.add(k);
                          return { ...m, [s.id]: cur };
                        });
                      return (
                        <div key={s.id} className={card} style={surf}>
                          <p className="text-[12px] text-[var(--text-3)]">
                            {s.entity_type} · {s.model ?? "—"}
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {proposedKeys.length === 0 && (
                              <p className="t-caption">
                                Empty proposal — nothing to apply.
                              </p>
                            )}
                            {proposedKeys.map((k) => {
                              const isOn = !rejected.has(k);
                              const cur = current[k];
                              const next = (
                                s.proposed as Record<string, unknown>
                              )[k];
                              const isPending = sugStatus === "pending";
                              return (
                                <div
                                  key={k}
                                  className="rounded-[var(--r-sm)] p-2"
                                  style={{
                                    background: "var(--surface-3)",
                                    opacity: isOn ? 1 : 0.45,
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                                      {k}
                                    </span>
                                    {isPending && (
                                      <button
                                        onClick={() => toggleField(k)}
                                        title="Toggle whether this field will be applied on Approve."
                                        className="press text-[10.5px] font-semibold"
                                        style={{
                                          color: isOn
                                            ? "var(--vitality)"
                                            : "var(--text-3)",
                                        }}
                                      >
                                        {isOn ? "✓ Accept" : "Rejected"}
                                      </button>
                                    )}
                                  </div>
                                  <p className="mt-1 text-[12px] text-[var(--text-3)]">
                                    Current:{" "}
                                    <span className="text-[var(--text-2)]">
                                      {fmt(cur)}
                                    </span>
                                  </p>
                                  <p className="text-[12.5px] text-[var(--text-1)]">
                                    →{" "}
                                    <span className="font-semibold">
                                      {fmt(next)}
                                    </span>
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          {s.rationale && (
                            <p className="mt-2 text-[12px] text-[var(--text-2)]">
                              <i>{s.rationale}</i>
                            </p>
                          )}
                          {sugStatus === "pending" && (
                            <div className="mt-3 flex gap-2">
                              <button
                                disabled={busy || accepted.length === 0}
                                onClick={async () => {
                                  setBusy(true);
                                  // Build a filtered suggestion with only
                                  // the accepted fields. approveSuggestion
                                  // merges those into the draft entity.
                                  const filtered = {
                                    ...s,
                                    proposed: Object.fromEntries(
                                      accepted.map((k) => [
                                        k,
                                        (
                                          s.proposed as Record<
                                            string,
                                            unknown
                                          >
                                        )[k],
                                      ])
                                    ),
                                  };
                                  const r =
                                    await approveSuggestion(filtered);
                                  setBusy(false);
                                  setMsg(
                                    r.ok
                                      ? `Applied ${accepted.length}/${proposedKeys.length} field${proposedKeys.length === 1 ? "" : "s"} → draft (not live)`
                                      : r.reason ?? "Failed"
                                  );
                                  if (r.ok) {
                                    setSugRejected((m) => {
                                      const n = { ...m };
                                      delete n[s.id];
                                      return n;
                                    });
                                    loadSugs();
                                  }
                                }}
                                title={
                                  accepted.length === 0
                                    ? "All fields rejected — nothing to apply. Reject the whole suggestion instead."
                                    : `Apply only the ${accepted.length} accepted field${accepted.length === 1 ? "" : "s"} as a draft.`
                                }
                                className="press rounded-[var(--r-pill)] bg-[var(--text-1)] px-4 py-1.5 text-[12px] font-semibold text-[#08090B] disabled:opacity-40"
                              >
                                {accepted.length === proposedKeys.length
                                  ? "Approve all → draft"
                                  : `Approve ${accepted.length} → draft`}
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
                                Reject all
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
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
                    title="Counts of every change between the latest published bundle and what would ship if you Publish now."
                  >
                    {[
                      diff.behaviorsAdded.length &&
                        `${diff.behaviorsAdded.length} behaviors added`,
                      diff.behaviorsChanged.length &&
                        `${diff.behaviorsChanged.length} edited`,
                      diff.behaviorsRemoved.length &&
                        `${diff.behaviorsRemoved.length} removed`,
                      diff.protocolsAdded.length &&
                        `${diff.protocolsAdded.length} new protocol${diff.protocolsAdded.length === 1 ? "" : "s"}`,
                      diff.protocolsRemoved.length &&
                        `${diff.protocolsRemoved.length} protocol${diff.protocolsRemoved.length === 1 ? "" : "s"} removed`,
                      diff.configAdded.length +
                        diff.configChanged.length +
                        diff.configRemoved.length &&
                        `${diff.configAdded.length + diff.configChanged.length + diff.configRemoved.length} config`,
                      diff.templatesAdded.length +
                        diff.templatesChanged.length +
                        diff.templatesRemoved.length &&
                        `${diff.templatesAdded.length + diff.templatesChanged.length + diff.templatesRemoved.length} templates`,
                      diff.rulesAdded.length +
                        diff.rulesChanged.length +
                        diff.rulesRemoved.length &&
                        `${diff.rulesAdded.length + diff.rulesChanged.length + diff.rulesRemoved.length} rules`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    · {diff.unchanged} unchanged
                  </p>
                  {(diffShowAll
                    ? diff.behaviorsAdded
                    : diff.behaviorsAdded.slice(0, 8)
                  ).map((b) => (
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
                  {(diffShowAll
                    ? diff.behaviorsChanged
                    : diff.behaviorsChanged.slice(0, 8)
                  ).map((b) => (
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
                  {(diffShowAll
                    ? diff.behaviorsRemoved
                    : diff.behaviorsRemoved.slice(0, 8)
                  ).map((b) => (
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
                  {/* Config overrides */}
                  {diff.configAdded.map((c) => (
                    <p
                      key={`cfg+${c.key}`}
                      className="text-[var(--vitality)]"
                    >
                      + config <b>{c.key}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        → {JSON.stringify(c.next)}
                      </span>
                    </p>
                  ))}
                  {diff.configChanged.map((c) => (
                    <p
                      key={`cfg~${c.key}`}
                      className="text-[var(--warm)]"
                    >
                      ~ config <b>{c.key}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        {JSON.stringify(c.prev)} → {JSON.stringify(c.next)}
                      </span>
                    </p>
                  ))}
                  {diff.configRemoved.map((c) => (
                    <p
                      key={`cfg-${c.key}`}
                      className="text-[var(--alert)]"
                    >
                      − config <b>{c.key}</b>{" "}
                      <span className="text-[var(--text-3)]">
                        (was {JSON.stringify(c.prev)})
                      </span>
                    </p>
                  ))}
                  {/* Insight templates */}
                  {diff.templatesAdded.map((t) => (
                    <p
                      key={`tpl+${t.kind}`}
                      className="text-[var(--vitality)]"
                    >
                      + template <b>{t.kind}</b>
                    </p>
                  ))}
                  {diff.templatesChanged.map((t) => (
                    <p
                      key={`tpl~${t.kind}`}
                      className="text-[var(--warm)]"
                    >
                      ~ template <b>{t.kind}</b>
                    </p>
                  ))}
                  {diff.templatesRemoved.map((t) => (
                    <p
                      key={`tpl-${t.kind}`}
                      className="text-[var(--alert)]"
                    >
                      − template <b>{t.kind}</b>
                    </p>
                  ))}
                  {/* Adaptation rules */}
                  {diff.rulesAdded.map((r) => (
                    <p
                      key={`rule+${r.name}`}
                      className="text-[var(--vitality)]"
                    >
                      + rule <b>{r.name}</b>
                    </p>
                  ))}
                  {diff.rulesChanged.map((r) => (
                    <p
                      key={`rule~${r.name}`}
                      className="text-[var(--warm)]"
                    >
                      ~ rule <b>{r.name}</b>
                    </p>
                  ))}
                  {diff.rulesRemoved.map((r) => (
                    <p
                      key={`rule-${r.name}`}
                      className="text-[var(--alert)]"
                    >
                      − rule <b>{r.name}</b>
                    </p>
                  ))}
                  {diff.behaviorsAdded.length +
                    diff.behaviorsChanged.length +
                    diff.behaviorsRemoved.length >
                    24 && (
                    <button
                      onClick={() => setDiffShowAll((v) => !v)}
                      className="press t-caption underline-offset-2 hover:underline"
                      title={
                        diffShowAll
                          ? "Cap each behavior list back to 8 rows"
                          : "Expand all behavior changes — useful for big migrations you want to fully eyeball before shipping"
                      }
                    >
                      {diffShowAll
                        ? "Show fewer (cap at 8 each)"
                        : `Show all ${
                            diff.behaviorsAdded.length +
                            diff.behaviorsChanged.length +
                            diff.behaviorsRemoved.length
                          } behavior changes`}
                    </button>
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
              <div className="mt-3">
                <Field label="Change note" help="publish.note">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="what changed & why"
                    className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[13px] text-[var(--text-1)] outline-none"
                  />
                </Field>
              </div>
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg(null);
                  const r = await publishBundle(note.trim());
                  setBusy(false);
                  if (r.ok) {
                    // fetchAndApplyPublished is one-shot per session;
                    // reset it so this admin session adopts the bundle
                    // they just published without forcing a full page
                    // reload. Future-runtime sessions pick it up on
                    // first load as before.
                    resetRefresh();
                    await fetchAndApplyPublished();
                    setMsg(
                      `Published v${r.version} (${r.checksum}) — runtime adopted.`
                    );
                    setNote("");
                    refreshPubs();
                    refreshDiff();
                  } else {
                    setMsg(r.reason);
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
                            `Roll back to v${p.version}? This creates a NEW published version on top of history (nothing is deleted) and the runtime adopts it immediately for you.`
                          );
                          if (!yes) return;
                          setBusy(true);
                          setMsg(null);
                          const r = await rollbackTo(p.version);
                          setBusy(false);
                          if (r.ok) {
                            resetRefresh();
                            await fetchAndApplyPublished();
                            setMsg(
                              `Rolled back → v${r.version} — runtime adopted.`
                            );
                            refreshPubs();
                            refreshDiff();
                          } else {
                            setMsg(r.reason);
                          }
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
        {process.env.NEXT_PUBLIC_BUILD ?? "dev"} ·{" "}
        <button
          onClick={() => setPaletteOpen(true)}
          className="press text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]"
          title="Open the command palette (⌘K / Ctrl-K)"
        >
          ⌘K
        </button>
      </p>

      {paletteOpen &&
        (() => {
          // Commands are built fresh per open — cheap because the lists
          // are small and this keeps the palette in sync with state
          // without an effect dependency war.
          type Cmd = {
            id: string;
            group: string;
            label: string;
            hint?: string;
            run: () => void;
          };
          const cmds: Cmd[] = [
            ...TABS.map(
              (t): Cmd => ({
                id: `nav:${t.id}`,
                group: "Navigate",
                label: `Go to ${t.label}`,
                hint: t.hint,
                run: () => setTab(t.id),
              })
            ),
            {
              id: "nav:content:author",
              group: "Navigate",
              label: "Open Content · Authoring",
              run: () => {
                setTab("content");
                setContentMode("author");
              },
            },
            {
              id: "nav:content:review",
              group: "Navigate",
              label: "Open Content · AI Review",
              run: () => {
                setTab("content");
                setContentMode("review");
              },
            },
            {
              id: "nav:engine:rules",
              group: "Navigate",
              label: "Open Engine · Rules",
              run: () => {
                setTab("engine");
                setEngineSub("rules");
              },
            },
            {
              id: "nav:engine:config",
              group: "Navigate",
              label: "Open Engine · Config",
              run: () => {
                setTab("engine");
                setEngineSub("config");
              },
            },
            {
              id: "nav:engine:intelligence",
              group: "Navigate",
              label: "Open Engine · Intelligence",
              run: () => {
                setTab("engine");
                setEngineSub("intelligence");
              },
            },
            {
              id: "act:publish",
              group: "Action",
              label: "Publish current catalog",
              hint: "Snapshot all drafts into a new immutable bundle.",
              run: () => setTab("publish"),
            },
            {
              id: "act:diff",
              group: "Action",
              label: "Refresh publish diff",
              hint: "Re-assemble next bundle and re-diff vs latest live.",
              run: () => {
                setTab("publish");
                refreshDiff();
              },
            },
            {
              id: "act:seed",
              group: "Action",
              label: "Seed CMS from built-in catalog",
              hint: "Idempotent — mirrors built-in packs/behaviors into the CMS tables.",
              run: async () => {
                setBusy(true);
                const r = await importBuiltin();
                setBusy(false);
                setMsg(r.ok ? "Seeded." : r.reason ?? "Failed");
                if (r.ok) {
                  setTab("content");
                  setContentMode("author");
                  loadCms();
                }
              },
            },
            {
              id: "act:new-protocol",
              group: "Action",
              label: "Create new protocol",
              run: () => {
                setTab("content");
                setContentMode("author");
                setEdP(null);
                setEdB([]);
                setNewProtoOpen(true);
              },
            },
            ...cmsP.map(
              (p): Cmd => ({
                id: `proto:${p.id}`,
                group: "Protocols",
                label: `Open ${p.name}`,
                hint: `${p.status} · v${p.version}`,
                run: async () => {
                  setTab("content");
                  setContentMode("author");
                  await openProto(p);
                },
              })
            ),
            // Behavior-level jumps. Only surface when the admin has typed
            // *something* so a fresh ⌘K open isn't drowned by hundreds of
            // behavior rows. Once they type, fuzzy-match by title, dose,
            // canonical key, or protocol name and jump straight to the
            // owning protocol's edit view.
            ...(paletteQuery.trim().length >= 2 && allBeh
              ? allBeh.map(
                  (r): Cmd => ({
                    id: `beh:${r.protocolId}/${r.behavior.canonical_key}`,
                    group: "Behaviors",
                    label: r.behavior.title,
                    hint: `${r.protocolName} · ${r.behavior.block}${
                      r.behavior.dose ? ` · ${r.behavior.dose}` : ""
                    }`,
                    run: async () => {
                      setTab("content");
                      setContentMode("author");
                      const target = cmsP.find(
                        (p) => p.id === r.protocolId
                      );
                      if (target) await openProto(target);
                    },
                  })
                )
              : []),
          ];

          const q = paletteQuery.trim().toLowerCase();
          const filtered = q
            ? cmds.filter(
                (c) =>
                  c.label.toLowerCase().includes(q) ||
                  (c.hint?.toLowerCase().includes(q) ?? false) ||
                  c.group.toLowerCase().includes(q)
              )
            : cmds;
          const safeIdx = Math.min(
            Math.max(0, paletteIdx),
            Math.max(0, filtered.length - 1)
          );
          // Group filtered by group preserving order
          const groups: { name: string; items: Cmd[] }[] = [];
          for (const c of filtered) {
            const last = groups[groups.length - 1];
            if (last && last.name === c.group) last.items.push(c);
            else groups.push({ name: c.group, items: [c] });
          }
          // Flat index → cmd
          const flatItem = filtered[safeIdx];

          return (
            <div
              className="anim-fade fixed inset-0 z-[150] flex items-start justify-center px-6 pt-[12vh]"
              style={{ background: "rgba(8,9,11,0.66)" }}
              onClick={() => setPaletteOpen(false)}
              role="dialog"
              aria-label="Command palette"
            >
              <div
                className="glass max-h-[70vh] w-full max-w-[560px] overflow-hidden rounded-[var(--r-lg)] border border-[var(--hairline-strong)]"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={paletteQuery}
                  onChange={(e) => {
                    setPaletteQuery(e.target.value);
                    setPaletteIdx(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setPaletteIdx((i) =>
                        Math.min(i + 1, filtered.length - 1)
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setPaletteIdx((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      if (flatItem) {
                        setPaletteOpen(false);
                        flatItem.run();
                      }
                    }
                  }}
                  placeholder="Jump to a tab, protocol, or action…"
                  className="w-full bg-transparent px-5 py-4 text-[14px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
                />
                <div className="max-h-[55vh] overflow-y-auto border-t border-[var(--hairline)]">
                  {filtered.length === 0 && (
                    <p className="px-5 py-6 text-center text-[12.5px] text-[var(--text-3)]">
                      No matches.
                    </p>
                  )}
                  {groups.map((g) => (
                    <div key={g.name}>
                      <p className="px-5 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-4)]">
                        {g.name}
                      </p>
                      {g.items.map((c) => {
                        const i = filtered.indexOf(c);
                        const active = i === safeIdx;
                        return (
                          <button
                            key={c.id}
                            onMouseEnter={() => setPaletteIdx(i)}
                            onClick={() => {
                              setPaletteOpen(false);
                              c.run();
                            }}
                            className="press flex w-full items-center gap-3 px-5 py-2.5 text-left"
                            style={{
                              background: active
                                ? "var(--surface-3)"
                                : "transparent",
                            }}
                          >
                            <span className="grow">
                              <span className="block text-[13px] font-medium text-[var(--text-1)]">
                                {c.label}
                              </span>
                              {c.hint && (
                                <span className="t-caption mt-0.5 block">
                                  {c.hint}
                                </span>
                              )}
                            </span>
                            {active && (
                              <span className="text-[10px] text-[var(--text-3)]">
                                ↵
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-[var(--hairline)] px-5 py-2 text-[10.5px] text-[var(--text-4)]">
                  <span>↑↓ navigate · ↵ select · esc close</span>
                  <span>⌘K</span>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
