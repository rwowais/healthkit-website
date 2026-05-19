"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccess } from "@/lib/entitlements";
import Link from "next/link";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { packById } from "@/lib/packs";
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
  });

  const installed = useMemo(() => {
    const ids = state?.installedPacks ?? [];
    return ids
      .map((id) => packById(id) ?? state.customPacks.find((p) => p.id === id))
      .filter((p): p is ProtocolPack => !!p);
  }, [state]);

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

  const addBehaviorToDraft = () => {
    if (!bDraft.title.trim()) return;
    const key = bDraft.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40);
    setDraft((d) => ({
      ...d,
      behaviors: [
        ...d.behaviors,
        {
          canonicalKey: `${key}-${d.behaviors.length}`,
          title: bDraft.title.trim(),
          block: bDraft.block,
          anchor: bDraft.block === "evening" ? "bed" : "wake",
          offsetMin: 0,
          dose: bDraft.dose.trim() || undefined,
          rationale: bDraft.rationale.trim() || "Custom behavior.",
          icon: "sparkle",
          leverage: 2,
          kind: "action",
        },
      ],
    }));
    setBDraft({ title: "", block: "morning", dose: "", rationale: "" });
  };

  const inputCls =
    "w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none";

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="flex items-end justify-between">
          <div>
            <Eyebrow>Your System</Eyebrow>
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

        {/* Installed packs */}
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
            <Link
              href="/library"
              className="press tr-fast flex items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--hairline-strong)] py-4 text-[14px] font-semibold text-[var(--text-2)]"
            >
              <Icon name="plus" size={16} /> Add from Library
            </Link>
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
      </div>

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
            <Eyebrow>Add behavior</Eyebrow>
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
                  onClick={() => setBDraft((b) => ({ ...b, block: bl }))}
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
            <button
              onClick={addBehaviorToDraft}
              className="press tr-fast w-full rounded-[var(--r-pill)] bg-[var(--surface-3)] py-2.5 text-[13px] font-semibold text-[var(--text-1)]"
            >
              + Add behavior
            </button>
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
