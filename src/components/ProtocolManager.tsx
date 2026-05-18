"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { PILLAR_META } from "@/lib/constants";
import { Eyebrow, Skeleton, Sheet, Button, useToast } from "@/components/ui";
import { Icon, iconForItem, type IconName } from "@/components/ui/icons";
import type { Pillar, ProtocolItem } from "@/lib/types";

const C: Record<Pillar, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};
const RAIL: Record<Pillar, IconName> = {
  sleep: "moon",
  exercise: "pulse",
  nutrition: "leaf",
  supplements: "pill",
};

export default function ProtocolManager({ pillar }: { pillar: Pillar }) {
  const { state, loading, updateProtocols } = useAppState();
  const toast = useToast();
  const [detail, setDetail] = useState<ProtocolItem | null>(null);
  const color = C[pillar];
  const meta = PILLAR_META[pillar];
  const items = state.protocols[pillar] ?? [];

  const toggle = (id: string) =>
    updateProtocols(
      pillar,
      items.map((i) => (i.id === id ? { ...i, isEnabled: !i.isEnabled } : i))
    );

  const tasks = items.filter((i) => i.itemType === "task");
  const reminders = items.filter((i) => i.itemType === "reminder");
  const enabledCount = items.filter((i) => i.isEnabled).length;

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-32 w-full" rounded="rounded-[var(--r-xl)]" />
          <Skeleton className="h-64 w-full" rounded="rounded-[var(--r-lg)]" />
        </div>
      </Shell>
    );
  }

  const renderItem = (it: ProtocolItem) => (
    <div
      key={it.id}
      className="row row-tap flex items-center gap-3.5 px-3.5 py-3"
      style={{ opacity: it.isEnabled ? 1 : 0.5 }}
    >
      <button
        onClick={() => setDetail(it)}
        className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
      >
        <span
          className="chip h-10 w-10 shrink-0"
          style={{
            background: it.isEnabled
              ? `color-mix(in srgb, ${color} 16%, var(--surface-3))`
              : "var(--surface-3)",
            color: it.isEnabled ? color : "var(--text-3)",
          }}
        >
          <Icon name={iconForItem(it)} size={19} stroke={1.7} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-[var(--text-1)]">
            {it.name}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-[var(--text-3)]">
            {it.description}
          </span>
        </span>
      </button>
      <button
        onClick={() => toggle(it.id)}
        className="press tr-fast h-[26px] w-[44px] shrink-0 rounded-full p-[3px]"
        style={{ background: it.isEnabled ? color : "var(--surface-3)" }}
        aria-label={it.isEnabled ? "Disable" : "Enable"}
      >
        <span
          className="block h-5 w-5 rounded-full bg-white tr"
          style={{
            transform: it.isEnabled ? "translateX(18px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );

  return (
    <Shell>
      <div className="flex flex-col gap-7">
        <div className="anim-rise">
          <Eyebrow color={color}>{meta.label}</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            {meta.label} Protocols
          </h1>
        </div>

        {/* Summary — hero, not a generic card */}
        <div className="panel anim-rise d1 relative overflow-hidden p-6">
          <span
            className="ambient"
            style={{
              background: `radial-gradient(120% 80% at 100% 0%, ${color}1f, transparent 60%)`,
            }}
          />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="t-eyebrow">Enabled</p>
              <p
                className="mt-2.5 text-[44px] font-bold leading-none"
                style={{ color, fontVariantNumeric: "tabular-nums" }}
              >
                {enabledCount}
                <span className="ml-2 text-[15px] font-medium text-[var(--text-3)]">
                  of {items.length}
                </span>
              </p>
            </div>
            <span
              className="chip h-16 w-16"
              style={{
                background: `color-mix(in srgb, ${color} 14%, var(--surface-2))`,
                color,
              }}
            >
              <Icon name={RAIL[pillar]} size={30} stroke={1.6} />
            </span>
          </div>
          <p className="relative mt-4 max-w-[300px] text-[13px] leading-relaxed text-[var(--text-2)]">
            {meta.description}
          </p>
        </div>

        {tasks.length > 0 && (
          <section className="anim-rise d2">
            <p className="t-eyebrow mb-3 px-1">Active Protocols</p>
            <div className="well space-y-1.5 p-1.5">
              {tasks.map(renderItem)}
            </div>
          </section>
        )}

        {reminders.length > 0 && (
          <section className="anim-rise d3">
            <p className="t-eyebrow mb-3 px-1">Guidelines</p>
            <div className="well space-y-1.5 p-1.5">
              {reminders.map(renderItem)}
            </div>
          </section>
        )}
      </div>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="chip h-12 w-12"
                style={{
                  background: `color-mix(in srgb, ${color} 16%, var(--surface-3))`,
                  color,
                }}
              >
                <Icon name={iconForItem(detail)} size={22} />
              </span>
              <p className="t-body leading-relaxed text-[var(--text-1)]">
                {detail.description}
              </p>
            </div>
            {detail.evidenceNote && (
              <div
                className="rounded-[var(--r-md)] p-4"
                style={{ background: "var(--surface-2)" }}
              >
                <Eyebrow color={color}>Evidence</Eyebrow>
                <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-2)]">
                  {detail.evidenceNote}
                </p>
              </div>
            )}
            {detail.recommendedBy && detail.recommendedBy.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.recommendedBy.map((r) => (
                  <span
                    key={r}
                    className="rounded-full px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)]"
                    style={{ background: "var(--surface-3)" }}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
            <Button
              full
              onClick={() => {
                toggle(detail.id);
                toast.show(
                  detail.isEnabled ? "Protocol disabled" : "Protocol enabled"
                );
                setDetail(null);
              }}
            >
              {detail.isEnabled ? "Disable protocol" : "Enable protocol"}
            </Button>
          </div>
        )}
      </Sheet>
    </Shell>
  );
}
