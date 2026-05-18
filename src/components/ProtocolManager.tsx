"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { PILLAR_META } from "@/lib/constants";
import { Eyebrow, Skeleton, Sheet, Button, useToast } from "@/components/ui";
import { Icon, iconForItem, type IconName } from "@/components/ui/icons";
import ProtocolDetailSheet from "@/components/ProtocolDetailSheet";
import type { Pillar, ProtocolItem, ItemType } from "@/lib/types";

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
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    description: "",
    itemType: "task" as ItemType,
    timingAnchor: "wake" as "wake" | "bed",
  });
  const color = C[pillar];
  const meta = PILLAR_META[pillar];
  const items = state.protocols[pillar] ?? [];

  const commit = (list: ProtocolItem[]) => updateProtocols(pillar, list);
  const toggle = (id: string) =>
    commit(
      items.map((i) => (i.id === id ? { ...i, isEnabled: !i.isEnabled } : i))
    );
  const setSchedule = (item: ProtocolItem, days: boolean[]) => {
    commit(items.map((i) => (i.id === item.id ? { ...i, daysActive: days } : i)));
    setDetail({ ...item, daysActive: days });
  };
  const remove = (item: ProtocolItem) => {
    commit(items.filter((i) => i.id !== item.id));
    setDetail(null);
    toast.show("Protocol removed");
  };
  const addCustom = () => {
    if (!draft.name.trim()) return;
    const item: ProtocolItem = {
      id: `${pillar}-custom-${Date.now()}`,
      pillar,
      name: draft.name.trim(),
      description: draft.description.trim() || "Custom protocol",
      source: "custom",
      itemType: draft.itemType,
      timingAnchor: draft.timingAnchor,
      timingOffsetMinutes: 0,
      timeOfDay: draft.timingAnchor === "bed" ? "night" : "morning",
      daysActive: [true, true, true, true, true, true, true],
      sortOrder: items.length + 1,
      isEnabled: true,
      icon: "•",
      createdAt: new Date().toISOString(),
    };
    commit([...items, item]);
    setAdding(false);
    setDraft({
      name: "",
      description: "",
      itemType: "task",
      timingAnchor: "wake",
    });
    toast.show("Protocol added");
  };

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

  const inputCls =
    "w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none";

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
            {it.source === "custom" && (
              <span className="ml-2 text-[10px] font-medium text-[var(--text-4)]">
                CUSTOM
              </span>
            )}
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
        <div className="anim-rise flex items-end justify-between">
          <div>
            <Eyebrow color={color}>{meta.label}</Eyebrow>
            <h1 className="t-title mt-2 text-[var(--text-1)]">
              {meta.label} Protocols
            </h1>
          </div>
          <button
            onClick={() => setAdding(true)}
            aria-label="Add protocol"
            className="press grid h-10 w-10 place-items-center rounded-full"
            style={{ background: "var(--surface-2)", color: "var(--text-1)" }}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>

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
            <div className="well space-y-1.5 p-1.5">{tasks.map(renderItem)}</div>
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

      <ProtocolDetailSheet
        item={detail}
        color={color}
        onClose={() => setDetail(null)}
        onScheduleChange={
          detail ? (days) => setSchedule(detail, days) : undefined
        }
        onToggleEnabled={
          detail
            ? () => {
                toggle(detail.id);
                toast.show(
                  detail.isEnabled ? "Protocol disabled" : "Protocol enabled"
                );
                setDetail(null);
              }
            : undefined
        }
        onDelete={detail ? () => remove(detail) : undefined}
      />

      <Sheet
        open={adding}
        onClose={() => setAdding(false)}
        title="New Protocol"
      >
        <div className="space-y-4">
          <div>
            <Eyebrow>Name</Eyebrow>
            <input
              autoFocus
              value={draft.name}
              onChange={(e) =>
                setDraft((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="e.g. Zone 2 cardio"
              className={`mt-2 ${inputCls}`}
            />
          </div>
          <div>
            <Eyebrow>Description</Eyebrow>
            <input
              value={draft.description}
              onChange={(e) =>
                setDraft((d) => ({ ...d, description: e.target.value }))
              }
              placeholder="Optional detail"
              className={`mt-2 ${inputCls}`}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <Eyebrow>Type</Eyebrow>
              <div
                className="mt-2 flex rounded-[11px] p-1"
                style={{ background: "var(--surface-2)" }}
              >
                {(["task", "reminder"] as ItemType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDraft((d) => ({ ...d, itemType: t }))}
                    className="flex-1 rounded-[8px] py-2 text-[13px] font-semibold capitalize tr-fast"
                    style={{
                      background:
                        draft.itemType === t ? color : "transparent",
                      color:
                        draft.itemType === t ? "#08090B" : "var(--text-3)",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <Eyebrow>When</Eyebrow>
              <div
                className="mt-2 flex rounded-[11px] p-1"
                style={{ background: "var(--surface-2)" }}
              >
                {(["wake", "bed"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      setDraft((d) => ({ ...d, timingAnchor: t }))
                    }
                    className="flex-1 rounded-[8px] py-2 text-[13px] font-semibold tr-fast"
                    style={{
                      background:
                        draft.timingAnchor === t ? color : "transparent",
                      color:
                        draft.timingAnchor === t
                          ? "#08090B"
                          : "var(--text-3)",
                    }}
                  >
                    {t === "wake" ? "Morning" : "Evening"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <Button full onClick={addCustom}>
            Add protocol
          </Button>
        </div>
      </Sheet>
    </Shell>
  );
}
