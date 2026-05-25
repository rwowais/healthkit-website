"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccess } from "@/lib/entitlements";
import Link from "next/link";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import {
  packById,
  listBehaviorAtoms,
  customCanonicalKey,
  type BehaviorAtom,
} from "@/lib/packs";
import { activePacks } from "@/lib/knowledge";
import { getFreePacks } from "@/lib/entitlements";
import {
  compileTimeline,
  blockLabel,
  adapt,
  shapeTimeline,
  type TimelineItem,
} from "@/lib/engine";
import BehaviorSheet from "@/components/BehaviorSheet";
import {
  Eyebrow,
  Skeleton,
  Sheet,
  Button,
  useToast,
} from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { ProtocolPack, TimeBlock, BehaviorDef } from "@/lib/types";

const BLOCKS: TimeBlock[] = ["morning", "afternoon", "evening", "anytime"];

export default function ProtocolsPage() {
  const {
    state,
    loading,
    installPack,
    uninstallPack,
    setBehaviorOverride,
    upsertCustomPack,
    deleteCustomPack,
    duplicatePack,
    setPackPaused,
  } = useAppState();
  const router = useRouter();
  const access = getAccess(state);
  const toast = useToast();
  const [detail, setDetail] = useState<TimelineItem | null>(null);
  const [packSheet, setPackSheet] = useState<ProtocolPack | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  // Library + Protocols merged. "yours" shows the installed system (the
  // original Protocols page); "discover" shows the catalog of every
  // available protocol pack (what used to be /library). One mental
  // model: this tab is your relationship with the catalog — what you
  // run, and what's available to add.
  const [viewMode, setViewMode] = useState<"yours" | "discover">("yours");
  const [discoverOpen, setDiscoverOpen] = useState<ProtocolPack | null>(null);
  // Hash routing: /protocols#discover opens the catalog directly. Lets
  // the old /library route redirect here while landing on the right
  // segment, and lets onboarding deep-link "browse more protocols"
  // into the right view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h === "discover") setViewMode("discover");
      else if (h === "yours") setViewMode("yours");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHash = viewMode === "discover" ? "#discover" : "";
    if (window.location.hash !== nextHash) {
      // replaceState avoids polluting history with a back-button entry
      // for every segment toggle.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + nextHash
      );
    }
  }, [viewMode]);
  const [draft, setDraft] = useState<{
    name: string;
    tagline: string;
    behaviors: BehaviorDef[];
  }>({ name: "", tagline: "", behaviors: [] });
  const [bDraft, setBDraft] = useState({
    title: "",
    block: "morning" as TimeBlock,
    dose: "",
    rationale: "",
    timingReason: "",
  });
  // 2B atom-library picker — two modes for the "Add behavior" panel:
  //   "library" (default): search a flat list of curated atoms, pick one,
  //                        the new behavior inherits the curated identity
  //                        via derivedFrom for intelligence purposes.
  //   "custom":  free-text fallback (the original path) for behaviors
  //              we don't have curated.
  const [addMode, setAddMode] = useState<"library" | "custom">("library");
  const [atomQuery, setAtomQuery] = useState("");
  const atoms = useMemo(() => listBehaviorAtoms(), []);
  const filteredAtoms = useMemo(() => {
    const q = atomQuery.trim().toLowerCase();
    // Filter out atoms already in the draft so the picker never shows
    // a duplicate of something the user just added.
    const alreadyAdded = new Set(
      draft.behaviors
        .map((b) => b.derivedFrom)
        .filter((k): k is string => !!k)
    );
    const usable = atoms.filter((a) => !alreadyAdded.has(a.canonicalKey));
    if (!q) return usable;
    return usable.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.fromOfficialPacks.some((p) => p.toLowerCase().includes(q)) ||
        a.rationale.toLowerCase().includes(q) ||
        a.timingReason?.toLowerCase().includes(q)
    );
  }, [atoms, atomQuery, draft.behaviors]);

  const installed = useMemo(() => {
    const ids = state?.installedPacks ?? [];
    return ids
      .map((id) => packById(id) ?? state.customPacks.find((p) => p.id === id))
      .filter((p): p is ProtocolPack => !!p);
  }, [state]);

  // Live catalog from the same chokepoint Library used to read. The
  // merge in activePacks() guarantees newly-shipped built-in packs
  // (e.g., Jetlag Recovery) appear here even when an older CMS bundle
  // is live — they're appended after the bundle's own protocols.
  const catalog = useMemo(() => activePacks(), []);
  const installedSet = useMemo(
    () => new Set(state?.installedPacks ?? []),
    [state]
  );
  const officialPackIds = useMemo(
    () =>
      new Set(
        catalog.filter((p) => p.source === "official").map((p) => p.id)
      ),
    [catalog]
  );
  const officialInstalledCount = useMemo(
    () =>
      (state?.installedPacks ?? []).filter((id) =>
        officialPackIds.has(id)
      ).length,
    [state, officialPackIds]
  );
  const atFreeCap =
    !access.premium && officialInstalledCount >= getFreePacks();

  const timeline = useMemo(
    () => (state ? compileTimeline(state, 0) : []),
    [state]
  );
  const adaptation = useMemo(() => adapt(state), [state]);
  const easedSet = useMemo(
    () =>
      new Set(
        shapeTimeline(timeline, adaptation.mode)
          .filter((i) => i.muted)
          .map((i) => i.canonicalKey)
      ),
    [timeline, adaptation.mode]
  );
  const sysStats = useMemo(() => {
    const protocols = new Set(timeline.flatMap((i) => i.fromPacks)).size;
    return {
      behaviors: timeline.length,
      protocols,
      merged: timeline.filter((i) => i.fromPacks.length > 1).length,
      retimed: timeline.filter((i) => i.retimed).length,
      eased: easedSet.size,
    };
  }, [timeline, easedSet]);
  const paused = new Set(state?.pausedPacks ?? []);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-32 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  const overrides = state.behaviorOverrides ?? {};

  const closeBuilder = () => {
    setCreating(false);
    setEditingId(null);
    setDraft({ name: "", tagline: "", behaviors: [] });
  };

  const openEdit = (pack: ProtocolPack) => {
    setEditingId(pack.id);
    setDraft({
      name: pack.name,
      tagline: pack.tagline,
      behaviors: pack.behaviors.map((b) => ({ ...b })),
    });
    setPackSheet(null);
    setCreating(true);
  };

  const removeDraftBehavior = (i: number) =>
    setDraft((d) => ({
      ...d,
      behaviors: d.behaviors.filter((_, idx) => idx !== i),
    }));

  const saveCustom = () => {
    if (!draft.name.trim() || draft.behaviors.length === 0) {
      toast.show("Add a name and at least one behavior");
      return;
    }
    const existing = editingId
      ? state.customPacks.find((p) => p.id === editingId)
      : undefined;
    const pack: ProtocolPack = {
      id: editingId ?? `custom-${Date.now()}`,
      name: draft.name.trim(),
      tagline: draft.tagline.trim() || "Custom protocol",
      goal: existing?.goal ?? "custom",
      accent: existing?.accent ?? "var(--readiness)",
      icon: existing?.icon ?? "sparkle",
      source: "custom",
      durationLabel: existing?.durationLabel ?? "Custom",
      behaviors: draft.behaviors,
    };
    upsertCustomPack(pack);
    const wasEditing = !!editingId;
    closeBuilder();
    toast.show(
      wasEditing ? "Protocol updated" : "Protocol created & installed"
    );
  };

  /**
   * Free-text custom path. Generates a user-namespaced canonicalKey
   * (`custom:<packId>:<base>-<rand>`) so it can NEVER collide with a
   * curated atom or another user's behavior. No `derivedFrom` is set —
   * this behavior is opaque to the intelligence layer by design (the
   * 2B "escape hatch" path). The atom-library picker is the
   * recommended path; this is for genuinely novel behaviors only.
   */
  const addBehaviorToDraft = () => {
    if (!bDraft.title.trim()) return;
    const packId = editingId ?? "draft";
    setDraft((d) => ({
      ...d,
      behaviors: [
        ...d.behaviors,
        {
          canonicalKey: customCanonicalKey(packId, bDraft.title),
          title: bDraft.title.trim(),
          block: bDraft.block,
          anchor: bDraft.block === "evening" ? "bed" : "wake",
          offsetMin: 0,
          dose: bDraft.dose.trim() || undefined,
          rationale: bDraft.rationale.trim() || "Custom behavior.",
          timingReason: bDraft.timingReason.trim() || undefined,
          icon: "sparkle",
          leverage: 2,
          kind: "action",
        },
      ],
    }));
    setBDraft({
      title: "",
      block: "morning",
      dose: "",
      rationale: "",
      timingReason: "",
    });
  };

  /**
   * 2B atom-library pick path. Deep-copies the curated atom so the
   * user can tweak dose / time / days without mutating the canonical
   * module-level definition, but stamps `derivedFrom` so the engine's
   * intelligence-layer hooks (CONFLICT_PAIRS, RECOVERY_DEMOTE,
   * CIRCADIAN, KEY_MESSAGE) still match via effectiveKey().
   */
  const pickAtomToDraft = (atom: BehaviorAtom) => {
    const packId = editingId ?? "draft";
    setDraft((d) => ({
      ...d,
      behaviors: [
        ...d.behaviors,
        {
          ...atom,
          canonicalKey: customCanonicalKey(packId, atom.title),
          derivedFrom: atom.canonicalKey,
          // Strip the atom's `fromOfficialPacks` metadata — that's
          // picker UI scaffolding, not part of the BehaviorDef shape.
          fromOfficialPacks: undefined as never,
        } as BehaviorDef,
      ],
    }));
    setAtomQuery("");
  };

  const inputCls =
    "w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none";

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow color={viewMode === "discover" ? "var(--vitality)" : undefined}>
              {viewMode === "discover" ? "Discover" : "Your system"}
            </Eyebrow>
            <h1 className="t-title mt-2 text-[var(--text-1)]">Protocols</h1>
          </div>
          <button
            onClick={() =>
              access.premium ? setCreating(true) : router.push("/upgrade")
            }
            aria-label="Create protocol"
            className="press grid h-10 w-10 place-items-center rounded-full"
            style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>

        {/* Segmented control: yours / discover. Lives at the top of
            the page so the user always knows which half of the
            relationship-with-the-catalog they're looking at. */}
        <div className="flex gap-1 rounded-[var(--r-pill)] bg-[var(--surface-2)] p-1">
          {(
            [
              { id: "yours", label: "Your system" },
              {
                id: "discover",
                label: `Discover · ${
                  catalog.filter((p) => !installedSet.has(p.id)).length
                }`,
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className="press tr-fast flex-1 rounded-[var(--r-pill)] py-2 text-[12.5px] font-semibold"
              style={{
                background: viewMode === m.id ? "var(--text-1)" : "transparent",
                color: viewMode === m.id ? "#08090B" : "var(--text-3)",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {viewMode === "discover" && (
          <section>
            <p className="t-caption px-1 leading-relaxed">
              Research-backed protocol systems. Install any combination —
              overlapping behaviors merge automatically.
            </p>
            <div className="mt-4 flex flex-col gap-4">
              {catalog.map((pack, i) => {
                const isInstalled = installedSet.has(pack.id);
                return (
                  <motion.button
                    key={pack.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.4 }}
                    onClick={() => setDiscoverOpen(pack)}
                    className="panel relative overflow-hidden p-6 text-left"
                  >
                    <span
                      className="ambient"
                      style={{
                        background: `radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, ${pack.accent} 26%, transparent), transparent 60%)`,
                      }}
                    />
                    <div className="relative">
                      <div className="flex items-start justify-between">
                        <span
                          className="chip h-12 w-12"
                          style={{
                            background: `color-mix(in srgb, ${pack.accent} 20%, var(--surface-3))`,
                            color: pack.accent,
                          }}
                        >
                          <Icon name={pack.icon as IconName} size={22} />
                        </span>
                        {isInstalled && (
                          <span
                            className="flex items-center gap-1.5 rounded-[var(--r-pill)] px-3 py-1.5 text-[11px] font-bold"
                            style={{
                              background: "var(--surface-3)",
                              color: pack.accent,
                            }}
                          >
                            <Icon name="check" size={12} /> Installed
                          </span>
                        )}
                      </div>
                      <p className="mt-4 text-[19px] font-bold text-[var(--text-1)]">
                        {pack.name}
                      </p>
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--text-2)]">
                        {pack.tagline}
                      </p>
                      <div className="mt-4 flex items-center gap-2">
                        {pack.behaviors.slice(0, 5).map((b) => (
                          <span
                            key={b.canonicalKey}
                            className="grid h-8 w-8 place-items-center rounded-[10px]"
                            style={{
                              background: "var(--surface-2)",
                              color: "var(--text-3)",
                            }}
                          >
                            <Icon name={b.icon as IconName} size={15} />
                          </span>
                        ))}
                        <span className="ml-1 t-caption">
                          {pack.behaviors.length} behaviors ·{" "}
                          {pack.durationLabel}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        {/* Installed packs */}
        {viewMode === "yours" && (
        <>
        <section>
          <p className="t-eyebrow mb-3 px-1">Installed</p>
          <div className="flex flex-col gap-3">
            {installed.map((pack, i) => {
              const isPaused = paused.has(pack.id);
              const contributes = pack.behaviors.filter((b) =>
                timeline.some((t) => t.canonicalKey === b.canonicalKey)
              ).length;
              return (
                <motion.button
                  key={pack.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.4 }}
                  onClick={() => setPackSheet(pack)}
                  className="press panel relative overflow-hidden p-5 text-left"
                  style={{ opacity: isPaused ? 0.6 : 1 }}
                >
                  <span
                    className="ambient"
                    style={{
                      background: `radial-gradient(130% 90% at 0% 0%, color-mix(in srgb, ${pack.accent} ${
                        isPaused ? 6 : 18
                      }%, transparent), transparent 62%)`,
                    }}
                  />
                  <div className="relative flex items-center gap-3.5">
                    <span
                      className="chip h-12 w-12 shrink-0"
                      style={{
                        background: `color-mix(in srgb, ${pack.accent} 18%, var(--surface-3))`,
                        color: pack.accent,
                      }}
                    >
                      <Icon name={pack.icon as IconName} size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-bold text-[var(--text-1)]">
                        {pack.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--text-2)]">
                        {pack.tagline}
                      </p>
                      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] font-medium">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: isPaused
                              ? "var(--text-4)"
                              : pack.accent,
                          }}
                        />
                        <span
                          style={{
                            color: isPaused
                              ? "var(--text-4)"
                              : "var(--text-3)",
                          }}
                        >
                          {isPaused
                            ? "Paused"
                            : `Active · contributing ${contributes} ${
                                contributes === 1 ? "behavior" : "behaviors"
                              }`}
                        </span>
                      </p>
                    </div>
                    <Icon
                      name="chevron"
                      size={16}
                      className="shrink-0 text-[var(--text-4)]"
                    />
                  </div>
                </motion.button>
              );
            })}
            <button
              onClick={() => setViewMode("discover")}
              className="press tr-fast flex items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--hairline-strong)] py-4 text-[14px] font-semibold text-[var(--text-2)]"
            >
              <Icon name="plus" size={16} /> Discover more protocols
            </button>
          </div>
        </section>

        {/* Orchestrated system — the intelligence layer */}
        <section>
          <p className="t-eyebrow mb-3 px-1">Your orchestrated system</p>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="panel relative mb-5 overflow-hidden p-5"
          >
            <span
              className="ambient"
              style={{
                background:
                  "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--readiness) 16%, transparent), transparent 60%)",
              }}
            />
            <p className="relative text-[14px] leading-relaxed text-[var(--text-1)]">
              {sysStats.protocols}{" "}
              {sysStats.protocols === 1 ? "protocol" : "protocols"} resolved
              into{" "}
              <span className="font-semibold">
                {sysStats.behaviors} clear behaviors
              </span>
              {sysStats.merged > 0 && (
                <>
                  {" "}
                  — {sysStats.merged} overlapping{" "}
                  {sysStats.merged === 1 ? "behavior" : "behaviors"} merged so
                  you only do {sysStats.merged === 1 ? "it" : "them"} once
                </>
              )}
              .
            </p>
            {(sysStats.retimed > 0 || sysStats.eased > 0) && (
              <p className="relative mt-2 text-[12.5px] leading-relaxed text-[var(--text-3)]">
                {sysStats.retimed > 0 &&
                  `${sysStats.retimed} retimed to fit you`}
                {sysStats.retimed > 0 && sysStats.eased > 0 && " · "}
                {sysStats.eased > 0 &&
                  `${sysStats.eased} eased today (${adaptation.headline.toLowerCase()})`}
                .
              </p>
            )}
            {sysStats.behaviors >= 16 && (
              <p className="relative mt-3 flex items-start gap-2 rounded-[var(--r-md)] bg-[var(--surface-2)] p-3 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                <Icon
                  name="info"
                  size={13}
                  className="mt-0.5 shrink-0 text-[var(--warm)]"
                />
                Your system is dense. Consistency beats volume — consider
                pausing a protocol or letting low-energy days simplify
                automatically. Nothing here is mandatory.
              </p>
            )}
          </motion.div>
          <div className="flex flex-col gap-6">
            {BLOCKS.map((block) => {
              const items = timeline.filter((i) => i.block === block);
              if (items.length === 0) return null;
              return (
                <div key={block}>
                  <Eyebrow>{blockLabel(block)}</Eyebrow>
                  <div className="well mt-3 space-y-1.5 p-1.5">
                    {items.map((it) => {
                      const disabled = overrides[it.canonicalKey]?.disabled;
                      return (
                        <div
                          key={it.canonicalKey}
                          className="row flex items-center gap-3.5 px-3.5 py-3"
                          style={{ opacity: disabled ? 0.4 : 1 }}
                        >
                          <span
                            className="chip h-9 w-9 shrink-0"
                            style={{
                              background: "var(--surface-3)",
                              color: "var(--text-2)",
                            }}
                          >
                            <Icon
                              name={it.icon as IconName}
                              size={17}
                              stroke={1.7}
                            />
                          </span>
                          <button
                            onClick={() => setDetail(it)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-[var(--text-1)]">
                              {it.title}
                            </p>
                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--text-3)]">
                              {easedSet.has(it.canonicalKey) && (
                                <span style={{ color: "var(--warm)" }}>
                                  Eased today
                                </span>
                              )}
                              {it.fromPacks.length > 1 ? (
                                <span style={{ color: "var(--readiness)" }}>
                                  Merged from {it.fromPacks.length} protocols
                                </span>
                              ) : (
                                <span>{it.fromPacks[0]}</span>
                              )}
                              {it.retimed && (
                                <span style={{ color: "var(--readiness)" }}>
                                  · Retimed to fit you
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              setBehaviorOverride(it.canonicalKey, {
                                ...overrides[it.canonicalKey],
                                disabled: !disabled,
                              })
                            }
                            className="press tr-fast h-[26px] w-[44px] shrink-0 rounded-full p-[3px]"
                            style={{
                              background: disabled
                                ? "var(--surface-3)"
                                : "var(--readiness)",
                            }}
                            role="switch"
                            aria-checked={!disabled}
                            aria-label={`${it.title} — ${
                              disabled ? "disabled" : "enabled"
                            }`}
                          >
                            <span
                              className="block h-5 w-5 rounded-full bg-white tr"
                              style={{
                                transform: disabled
                                  ? "translateX(0)"
                                  : "translateX(18px)",
                              }}
                            />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        </>
        )}
      </div>

      {/* Discover-pack sheet — install/uninstall, free-cap context.
          The same merge-overlap toast the old Library used to show is
          retained so the install-feel-magic moment isn't lost. */}
      <Sheet
        open={!!discoverOpen}
        onClose={() => setDiscoverOpen(null)}
        title={discoverOpen?.name}
      >
        {discoverOpen && (
          <div>
            <span
              className="chip h-14 w-14"
              style={{
                background: `color-mix(in srgb, ${discoverOpen.accent} 20%, var(--surface-3))`,
                color: discoverOpen.accent,
              }}
            >
              <Icon name={discoverOpen.icon as IconName} size={26} />
            </span>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
              {discoverOpen.tagline}
            </p>
            <div className="mt-6 space-y-1.5">
              {discoverOpen.behaviors.map((b) => (
                <div
                  key={b.canonicalKey}
                  className="flex items-center gap-3 rounded-[var(--r-md)] px-3.5 py-3"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="chip h-9 w-9 shrink-0"
                    style={{
                      background: "var(--surface-3)",
                      color: discoverOpen.accent,
                    }}
                  >
                    <Icon name={b.icon as IconName} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-[var(--text-1)]">
                      {b.title}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--text-3)]">
                      {b.dose ?? b.rationale}
                    </p>
                  </div>
                  <span className="t-caption capitalize">{b.block}</span>
                </div>
              ))}
            </div>
            <div className="mt-6">
              {installedSet.has(discoverOpen.id) ? (
                <Button
                  full
                  variant="ghost"
                  onClick={() => {
                    uninstallPack(discoverOpen.id);
                    toast.show(`${discoverOpen.name} removed`);
                    setDiscoverOpen(null);
                  }}
                >
                  Remove protocol
                </Button>
              ) : (
                <>
                  {atFreeCap && (
                    <p
                      className="rounded-[var(--r-sm)] px-3 py-2.5 text-[12.5px] leading-relaxed"
                      style={{
                        background:
                          "color-mix(in srgb, var(--readiness) 9%, var(--surface-2))",
                        color: "var(--text-2)",
                      }}
                    >
                      You have {getFreePacks()} of {getFreePacks()} free
                      protocols installed. Premium unlocks unlimited — or
                      remove one in your installed list to swap.
                    </p>
                  )}
                  <Button
                    full
                    onClick={() => {
                      if (atFreeCap) {
                        setDiscoverOpen(null);
                        router.push("/upgrade");
                        return;
                      }
                      const activeKeys = new Set(
                        timeline.map((i) => i.canonicalKey)
                      );
                      const overlap = discoverOpen.behaviors.filter((b) =>
                        activeKeys.has(b.canonicalKey)
                      );
                      installPack(discoverOpen.id);
                      const name = discoverOpen.name;
                      setDiscoverOpen(null);
                      if (overlap.length === 1) {
                        toast.show(
                          `${name} added — "${overlap[0].title}" merged with your system, you'll do it once`
                        );
                      } else if (overlap.length > 1) {
                        toast.show(
                          `${name} added — ${overlap.length} overlapping behaviors merged, no doubling up`
                        );
                      } else {
                        toast.show(`${name} installed`);
                      }
                    }}
                  >
                    {atFreeCap ? "Unlock more with Premium" : "Install protocol"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={creating}
        onClose={closeBuilder}
        title={editingId ? "Edit protocol" : "Build a protocol"}
      >
        <div className="space-y-4">
          <input
            autoFocus
            value={draft.name}
            onChange={(e) =>
              setDraft((d) => ({ ...d, name: e.target.value }))
            }
            placeholder="Protocol name"
            className={inputCls}
          />
          <input
            value={draft.tagline}
            onChange={(e) =>
              setDraft((d) => ({ ...d, tagline: e.target.value }))
            }
            placeholder="One-line description"
            className={inputCls}
          />

          {draft.behaviors.length > 0 && (
            <div className="space-y-1.5">
              {draft.behaviors.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-[var(--r-sm)] px-3 py-2.5"
                  style={{ background: "var(--surface-2)" }}
                >
                  <Icon
                    name="sparkle"
                    size={15}
                    className="text-[var(--text-3)]"
                  />
                  <span className="flex-1 text-[13px] text-[var(--text-1)]">
                    {b.title}
                  </span>
                  <span className="t-caption capitalize">{b.block}</span>
                  <button
                    onClick={() => removeDraftBehavior(i)}
                    aria-label={`Remove ${b.title}`}
                    className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-4)] hover:text-[var(--alert)]"
                  >
                    <Icon name="ban" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div
            className="space-y-3 rounded-[var(--r-md)] p-3.5"
            style={{ background: "var(--surface-2)" }}
          >
            <div className="flex items-center justify-between gap-2">
              <Eyebrow>Add behavior</Eyebrow>
              {/* Mode toggle. Default is Library (the recommended path
                  — atoms participate in the intelligence layer). Custom
                  is the escape hatch for genuinely novel behaviors not
                  in the catalog. */}
              <div className="flex gap-1 rounded-[var(--r-pill)] bg-[var(--surface-3)] p-0.5">
                {(["library", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAddMode(m)}
                    className="press tr-fast rounded-[var(--r-pill)] px-3 py-1 text-[11px] font-semibold capitalize"
                    style={{
                      background:
                        addMode === m
                          ? "var(--text-1)"
                          : "transparent",
                      color: addMode === m ? "#08090B" : "var(--text-3)",
                    }}
                  >
                    {m === "library" ? "From library" : "Custom"}
                  </button>
                ))}
              </div>
            </div>

            {addMode === "library" ? (
              <>
                <input
                  value={atomQuery}
                  onChange={(e) => setAtomQuery(e.target.value)}
                  placeholder="Search the library — magnesium, sunlight, cold…"
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[14px] text-[var(--text-1)] outline-none"
                />
                <p className="t-caption leading-relaxed">
                  Picking from the library makes this behavior
                  intelligent — it merges with the same behavior from
                  any other protocol you install, inherits the science
                  behind its timing, and participates in the adaptive
                  engine. You can still customize dose, days, and time
                  after picking.
                </p>
                <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
                  {filteredAtoms.length === 0 && (
                    <p className="px-3 py-3 text-[12.5px] text-[var(--text-3)]">
                      {atomQuery.trim()
                        ? "Nothing matches in our library yet."
                        : "Every curated behavior is already in this draft."}{" "}
                      Try{" "}
                      <button
                        onClick={() => {
                          setAddMode("custom");
                          if (atomQuery.trim())
                            setBDraft((b) => ({ ...b, title: atomQuery }));
                        }}
                        className="press underline-offset-2 hover:underline"
                        style={{ color: "var(--readiness)" }}
                      >
                        adding it as custom
                      </button>{" "}
                      — it won't participate in the cross-protocol
                      intelligence, but the basics still work.
                    </p>
                  )}
                  {filteredAtoms.map((a) => (
                    <button
                      key={a.canonicalKey}
                      onClick={() => pickAtomToDraft(a)}
                      className="press tr-fast flex w-full items-start gap-3 rounded-[var(--r-sm)] p-3 text-left"
                      style={{ background: "var(--surface-3)" }}
                    >
                      <span
                        className="chip h-9 w-9 shrink-0"
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--text-2)",
                        }}
                      >
                        <Icon
                          name={a.icon as IconName}
                          size={16}
                          stroke={1.7}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13.5px] font-semibold text-[var(--text-1)]">
                          {a.title}
                        </span>
                        <span className="t-caption mt-0.5 block leading-snug">
                          {a.dose ?? a.rationale}
                        </span>
                        <span
                          className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize"
                          style={{
                            background: "var(--surface-2)",
                            color: "var(--text-3)",
                          }}
                        >
                          {a.block}
                          {a.fromOfficialPacks.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="normal-case">
                                from {a.fromOfficialPacks[0]}
                                {a.fromOfficialPacks.length > 1
                                  ? ` +${a.fromOfficialPacks.length - 1}`
                                  : ""}
                              </span>
                            </>
                          )}
                        </span>
                      </span>
                      <Icon
                        name="plus"
                        size={16}
                        className="mt-1 shrink-0 text-[var(--text-3)]"
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <input
                  value={bDraft.title}
                  onChange={(e) =>
                    setBDraft((b) => ({ ...b, title: e.target.value }))
                  }
                  placeholder="Behavior title"
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[14px] text-[var(--text-1)] outline-none"
                />
                <div className="flex gap-1 rounded-[10px] bg-[var(--surface-3)] p-1">
                  {BLOCKS.map((bl) => (
                    <button
                      key={bl}
                      onClick={() =>
                        setBDraft((b) => ({ ...b, block: bl }))
                      }
                      className="flex-1 rounded-[7px] py-1.5 text-[11px] font-semibold capitalize tr-fast"
                      style={{
                        background:
                          bDraft.block === bl
                            ? "var(--readiness)"
                            : "transparent",
                        color:
                          bDraft.block === bl ? "#08090B" : "var(--text-3)",
                      }}
                    >
                      {bl}
                    </button>
                  ))}
                </div>
                <input
                  value={bDraft.rationale}
                  onChange={(e) =>
                    setBDraft((b) => ({ ...b, rationale: e.target.value }))
                  }
                  placeholder="Why it matters (optional)"
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[14px] text-[var(--text-1)] outline-none"
                />
                {/* timingReason field — fills the cross-block warning
                    sheet with this behavior's own scientific voice when
                    the user later drags it to a different time of day.
                    Without it, the warning falls back to generic
                    block-level copy. Optional but high-payoff. */}
                <input
                  value={bDraft.timingReason}
                  onChange={(e) =>
                    setBDraft((b) => ({
                      ...b,
                      timingReason: e.target.value,
                    }))
                  }
                  placeholder="Why this time of day matters (optional)"
                  className="w-full rounded-[var(--r-sm)] bg-[var(--surface-3)] px-3 py-2.5 text-[14px] text-[var(--text-1)] outline-none"
                />
                <p className="t-caption leading-relaxed">
                  Custom behaviors work, but they sit outside the
                  cross-protocol intelligence (no merging, no adaptive
                  mute, no scientific timing copy). Use this for things
                  the library doesn&apos;t cover.
                </p>
                <button
                  onClick={addBehaviorToDraft}
                  className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--surface-3)] py-2.5 text-[13px] font-semibold text-[var(--text-1)]"
                >
                  + Add custom behavior
                </button>
              </>
            )}
          </div>

          <Button full onClick={saveCustom}>
            {editingId ? "Save changes" : "Create & install"}
          </Button>
        </div>
      </Sheet>

      {/* Pack sheet — calm system view, soft embedded actions */}
      <Sheet
        open={!!packSheet}
        onClose={() => setPackSheet(null)}
        title={packSheet?.name}
      >
        {packSheet &&
          (() => {
            const p = packSheet;
            const isPaused = paused.has(p.id);
            return (
              <div className="space-y-6">
                <div className="flex items-start gap-3.5">
                  <span
                    className="chip h-12 w-12 shrink-0"
                    style={{
                      background: `color-mix(in srgb, ${p.accent} 18%, var(--surface-3))`,
                      color: p.accent,
                    }}
                  >
                    <Icon name={p.icon as IconName} size={22} />
                  </span>
                  <p className="t-body leading-relaxed text-[var(--text-1)]">
                    {p.tagline}
                  </p>
                </div>

                <div>
                  <Eyebrow>What it contributes</Eyebrow>
                  <div className="mt-3 space-y-1.5">
                    {p.behaviors.map((b) => {
                      const t = timeline.find(
                        (x) => x.canonicalKey === b.canonicalKey
                      );
                      const merged = (t?.fromPacks.length ?? 0) > 1;
                      return (
                        <button
                          key={b.canonicalKey}
                          onClick={() => {
                            if (t) {
                              setPackSheet(null);
                              setDetail(t);
                            }
                          }}
                          className="row flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                          style={{ opacity: t ? 1 : 0.5 }}
                        >
                          <span
                            className="chip h-8 w-8 shrink-0"
                            style={{
                              background: "var(--surface-3)",
                              color: "var(--text-2)",
                            }}
                          >
                            <Icon
                              name={b.icon as IconName}
                              size={15}
                              stroke={1.7}
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-semibold text-[var(--text-1)]">
                              {b.title}
                            </span>
                            {merged && (
                              <span className="text-[11px] text-[var(--readiness)]">
                                Merged across {t!.fromPacks.length} protocols
                              </span>
                            )}
                          </span>
                          {t && (
                            <Icon
                              name="chevron"
                              size={13}
                              className="shrink-0 text-[var(--text-4)]"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2.5">
                  {p.source === "custom" && (
                    <button
                      onClick={() => openEdit(p)}
                      className="press tr-fast w-full rounded-[var(--r-pill)] py-3.5 text-[14px] font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, var(--readiness) 16%, var(--surface-3))",
                        color: "var(--readiness)",
                      }}
                    >
                      Edit protocol
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setPackPaused(p.id, !isPaused);
                      toast.show(
                        isPaused
                          ? `${p.name} resumed`
                          : `${p.name} paused — nothing lost, resume anytime`
                      );
                      setPackSheet(null);
                    }}
                    className="press tr-fast w-full rounded-[var(--r-pill)] py-3.5 text-[14px] font-semibold"
                    style={{
                      background: "var(--surface-3)",
                      color: "var(--text-1)",
                    }}
                  >
                    {isPaused ? "Resume protocol" : "Pause protocol"}
                  </button>
                  {p.source !== "custom" && (
                    <button
                      onClick={() => {
                        if (!access.premium) {
                          setPackSheet(null);
                          router.push("/upgrade");
                          return;
                        }
                        duplicatePack(p);
                        toast.show(
                          `Editable copy added — open “${p.name} (yours)” to edit`
                        );
                        setPackSheet(null);
                      }}
                      className="press tr-fast w-full rounded-[var(--r-pill)] py-3.5 text-[14px] font-semibold"
                      style={{
                        background:
                          "color-mix(in srgb, var(--readiness) 14%, var(--surface-3))",
                        color: "var(--readiness)",
                      }}
                    >
                      Make it editable
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (p.source === "custom") deleteCustomPack(p.id);
                      else uninstallPack(p.id);
                      toast.show(`${p.name} removed from your system`);
                      setPackSheet(null);
                    }}
                    className="press tr-fast w-full py-2 text-center text-[13px] font-medium text-[var(--text-3)]"
                  >
                    Remove from system
                  </button>
                </div>
              </div>
            );
          })()}
      </Sheet>

      <BehaviorSheet
        item={detail}
        override={
          detail ? state.behaviorOverrides?.[detail.canonicalKey] : undefined
        }
        color="var(--readiness)"
        onClose={() => setDetail(null)}
        onChange={(next) => {
          if (detail) setBehaviorOverride(detail.canonicalKey, next);
        }}
        onToggleEnabled={
          detail
            ? () => {
                const cur =
                  state.behaviorOverrides?.[detail.canonicalKey] ?? {};
                setBehaviorOverride(detail.canonicalKey, {
                  ...cur,
                  disabled: !cur.disabled,
                });
                setDetail(null);
              }
            : undefined
        }
        isEnabled={
          detail
            ? !state.behaviorOverrides?.[detail.canonicalKey]?.disabled
            : true
        }
      />
    </Shell>
  );
}
