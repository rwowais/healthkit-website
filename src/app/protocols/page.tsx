"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { packById } from "@/lib/packs";
import { compileTimeline, blockLabel } from "@/lib/engine";
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
  } = useAppState();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
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

  const saveCustom = () => {
    if (!draft.name.trim() || draft.behaviors.length === 0) {
      toast.show("Add a name and at least one behavior");
      return;
    }
    const pack: ProtocolPack = {
      id: `custom-${Date.now()}`,
      name: draft.name.trim(),
      tagline: draft.tagline.trim() || "Custom protocol",
      goal: "custom",
      accent: "var(--readiness)",
      icon: "sparkle",
      source: "custom",
      durationLabel: "Custom",
      behaviors: draft.behaviors,
    };
    upsertCustomPack(pack);
    setCreating(false);
    setDraft({ name: "", tagline: "", behaviors: [] });
    toast.show("Protocol created & installed");
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
            onClick={() => setCreating(true)}
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
            {installed.map((pack) => (
              <motion.div
                key={pack.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="panel relative overflow-hidden p-5"
              >
                <span
                  className="ambient"
                  style={{
                    background: `radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, ${pack.accent} 20%, transparent), transparent 60%)`,
                  }}
                />
                <div className="relative flex items-start gap-3.5">
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
                    <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
                      {pack.tagline}
                    </p>
                    <p className="t-caption mt-2">
                      {pack.behaviors.length} behaviors ·{" "}
                      {pack.durationLabel ?? "Ongoing"}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (pack.source === "custom") deleteCustomPack(pack.id);
                      else uninstallPack(pack.id);
                      toast.show(`${pack.name} removed`);
                    }}
                    className="press rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-3)]"
                    style={{ background: "var(--surface-3)" }}
                  >
                    {pack.source === "custom" ? "Delete" : "Remove"}
                  </button>
                </div>
              </motion.div>
            ))}
            <Link
              href="/library"
              className="press tr-fast flex items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--hairline-strong)] py-4 text-[14px] font-semibold text-[var(--text-2)]"
            >
              <Icon name="plus" size={16} /> Add from Library
            </Link>
          </div>
        </section>

        {/* Merged behavior system */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="t-eyebrow">Merged Behaviors</p>
            <span className="t-caption">{timeline.length} total</span>
          </div>
          <p className="t-caption mb-4 px-1 leading-relaxed">
            Overlapping behaviors across your installed protocols are
            intelligently combined — no duplicates.
          </p>
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
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-[var(--text-1)]">
                              {it.title}
                            </p>
                            <p className="mt-0.5 truncate text-[12px] text-[var(--text-3)]">
                              {it.fromPacks.length > 1 ? (
                                <span className="text-[var(--readiness)]">
                                  Merged · {it.fromPacks.join(" + ")}
                                </span>
                              ) : (
                                it.fromPacks[0]
                              )}
                            </p>
                          </div>
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
                            aria-label={disabled ? "Enable" : "Disable"}
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
        onClose={() => setCreating(false)}
        title="Build a protocol"
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
            Create & install
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
