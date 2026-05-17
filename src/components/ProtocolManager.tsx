"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { PILLAR_META } from "@/lib/constants";
import {
  Card,
  Eyebrow,
  Skeleton,
  Sheet,
  Button,
  useToast,
} from "@/components/ui";
import type { Pillar, ProtocolItem } from "@/lib/types";

const COLOR: Record<string, string> = {
  sleep: "var(--sleep)",
  exercise: "var(--readiness)",
  nutrition: "var(--vitality)",
  supplements: "var(--warm)",
};

export default function ProtocolManager({ pillar }: { pillar: Pillar }) {
  const { state, loading, updateProtocols } = useAppState();
  const toast = useToast();
  const [detail, setDetail] = useState<ProtocolItem | null>(null);
  const color = COLOR[pillar];
  const meta = PILLAR_META[pillar];
  const items = state.protocols[pillar] ?? [];

  const toggle = (id: string) => {
    updateProtocols(
      pillar,
      items.map((i) =>
        i.id === id ? { ...i, isEnabled: !i.isEnabled } : i
      )
    );
  };

  const tasks = items.filter((i) => i.itemType === "task");
  const reminders = items.filter((i) => i.itemType === "reminder");
  const enabledCount = items.filter((i) => i.isEnabled).length;

  if (loading) {
    return (
      <Shell>
        <div className="space-y-5">
          <Skeleton className="h-6 w-40" rounded="rounded-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Shell>
    );
  }

  const renderItem = (it: ProtocolItem) => (
    <div
      key={it.id}
      className="tr-fast flex items-center gap-3.5 rounded-[var(--r-md)] border p-4"
      style={{
        borderColor: it.isEnabled ? "var(--hairline-strong)" : "var(--hairline)",
        background: it.isEnabled ? "var(--surface-2)" : "var(--surface-1)",
        opacity: it.isEnabled ? 1 : 0.55,
      }}
    >
      <button
        onClick={() => setDetail(it)}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-[15px] font-medium text-[var(--text-1)]">
          {it.icon} {it.name}
        </p>
        <p className="t-caption mt-1 line-clamp-1">{it.description}</p>
      </button>
      <button
        onClick={() => toggle(it.id)}
        className="tr-fast h-7 w-12 shrink-0 rounded-full p-1"
        style={{
          background: it.isEnabled ? color : "var(--surface-3)",
        }}
        aria-label={it.isEnabled ? "Disable" : "Enable"}
      >
        <div
          className="tr-fast h-5 w-5 rounded-full bg-white"
          style={{
            transform: it.isEnabled ? "translateX(20px)" : "translateX(0)",
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

        <Card className="anim-rise d1">
          <div className="flex items-center justify-between">
            <div>
              <p className="t-eyebrow">Enabled</p>
              <p
                className="mt-2 text-[34px] font-bold"
                style={{ color, fontVariantNumeric: "tabular-nums" }}
              >
                {enabledCount}
                <span className="ml-1.5 text-[14px] font-medium text-[var(--text-3)]">
                  / {items.length}
                </span>
              </p>
            </div>
            <span className="text-[40px] opacity-80">{meta.icon}</span>
          </div>
          <p className="t-caption mt-3">{meta.description}</p>
        </Card>

        {tasks.length > 0 && (
          <div className="anim-rise d2 space-y-2.5">
            <Eyebrow>Active Protocols</Eyebrow>
            {tasks.map(renderItem)}
          </div>
        )}

        {reminders.length > 0 && (
          <div className="anim-rise d3 space-y-2.5">
            <Eyebrow>Guidelines</Eyebrow>
            {reminders.map(renderItem)}
          </div>
        )}
      </div>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.icon} ${detail.name}` : ""}
      >
        {detail && (
          <div className="space-y-5">
            <p className="t-body leading-relaxed text-[var(--text-1)]">
              {detail.description}
            </p>
            {detail.evidenceNote && (
              <div className="rounded-[var(--r-md)] bg-[var(--surface-2)] p-4">
                <Eyebrow color={color}>Evidence</Eyebrow>
                <p className="t-caption mt-2.5 leading-relaxed">
                  {detail.evidenceNote}
                </p>
              </div>
            )}
            {detail.recommendedBy && detail.recommendedBy.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.recommendedBy.map((r) => (
                  <span
                    key={r}
                    className="rounded-[var(--r-pill)] bg-[var(--surface-3)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-2)]"
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
