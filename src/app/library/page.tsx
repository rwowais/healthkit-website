"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { getAccess, getFreePacks } from "@/lib/entitlements";
import { activePacks } from "@/lib/knowledge";
import { compileTimeline } from "@/lib/engine";
import { Eyebrow, Skeleton, Button, Sheet, useToast } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import type { ProtocolPack } from "@/lib/types";

export default function LibraryPage() {
  const { state, loading, installPack, uninstallPack } = useAppState();
  const router = useRouter();
  const access = getAccess(state);
  const toast = useToast();
  const [open, setOpen] = useState<ProtocolPack | null>(null);

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-44 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-44 w-full" rounded="rounded-[var(--r-xl)]" />
        </div>
      </Shell>
    );
  }

  const installedSet = new Set(state.installedPacks ?? []);
  // Live catalog — built-in unless a newer CMS-published bundle has
  // been adopted this session. Listing this (not the frozen PACKS) is
  // what makes admin-authored protocols visible to users.
  const liveCatalog = activePacks();
  // Free cap applies to "official" packs in the live catalog only —
  // CMS-authored 'custom' packs and user-forked copies shouldn't burn
  // a slot for a free user.
  const officialPackIds = new Set(
    liveCatalog.filter((p) => p.source === "official").map((p) => p.id)
  );
  const officialInstalledCount = (state.installedPacks ?? []).filter((id) =>
    officialPackIds.has(id)
  ).length;
  const atFreeCap =
    !access.premium && officialInstalledCount >= getFreePacks();

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div>
          <Eyebrow color="var(--vitality)">Discover</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">Library</h1>
          <p className="t-caption mt-2 leading-relaxed">
            Expert-designed protocol systems. Install any combination —
            overlapping behaviors merge automatically.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {liveCatalog.map((pack, i) => {
            const installed = installedSet.has(pack.id);
            return (
              <motion.button
                key={pack.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.4 }}
                onClick={() => setOpen(pack)}
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
                    {installed && (
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
      </div>

      <Sheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
      >
        {open && (
          <div>
            <span
              className="chip h-14 w-14"
              style={{
                background: `color-mix(in srgb, ${open.accent} 20%, var(--surface-3))`,
                color: open.accent,
              }}
            >
              <Icon name={open.icon as IconName} size={26} />
            </span>
            <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">
              {open.tagline}
            </p>

            <div className="mt-6 space-y-1.5">
              {open.behaviors.map((b) => (
                <div
                  key={b.canonicalKey}
                  className="flex items-center gap-3 rounded-[var(--r-md)] px-3.5 py-3"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span
                    className="chip h-9 w-9 shrink-0"
                    style={{
                      background: "var(--surface-3)",
                      color: open.accent,
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
              {installedSet.has(open.id) ? (
                <Button
                  full
                  variant="ghost"
                  onClick={() => {
                    uninstallPack(open.id);
                    toast.show(`${open.name} removed`);
                    setOpen(null);
                  }}
                >
                  Remove protocol
                </Button>
              ) : (
                <Button
                  full
                  onClick={() => {
                    if (atFreeCap && !installedSet.has(open.id)) {
                      setOpen(null);
                      router.push("/upgrade");
                      return;
                    }
                    // Make the orchestration *felt*: if this pack
                    // overlaps behaviors already in the system, say so
                    // specifically — that merge is the one thing no
                    // other app does.
                    const activeKeys = new Set(
                      compileTimeline(state, 0).map((i) => i.canonicalKey)
                    );
                    const overlap = open.behaviors.filter((b) =>
                      activeKeys.has(b.canonicalKey)
                    );
                    installPack(open.id);
                    setOpen(null);
                    if (overlap.length === 1) {
                      toast.show(
                        `${open.name} added — “${overlap[0].title}” merged with your system, you'll do it once`
                      );
                    } else if (overlap.length > 1) {
                      toast.show(
                        `${open.name} added — ${overlap.length} overlapping behaviors merged, no doubling up`
                      );
                    } else {
                      toast.show(`${open.name} installed`);
                    }
                  }}
                >
                  {atFreeCap && !installedSet.has(open.id)
                    ? "Unlock more with Premium"
                    : "Install protocol"}
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </Shell>
  );
}
