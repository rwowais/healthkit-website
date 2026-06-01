"use client";

/**
 * PersonalRecords — quiet "bests to beat": longest streak, best 7-day window,
 * and the habit you've kept most. Computed by analytics.personalRecords from
 * the full log history. Pure + presentational; self-gates until there's
 * something worth celebrating.
 */
import { useMemo } from "react";
import type { AppState } from "@/lib/types";
import { personalRecords } from "@/lib/analytics";
import { Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

function Tile({
  icon,
  color,
  value,
  label,
}: {
  icon: IconName;
  color: string;
  value: string;
  label: string;
}) {
  return (
    <div className="well flex flex-col gap-1 p-4">
      <span
        className="grid h-8 w-8 place-items-center rounded-full"
        style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface-3))`, color }}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="mt-1 text-[22px] font-bold leading-none text-[var(--text-1)]">
        {value}
      </span>
      <span className="text-[12px] leading-snug text-[var(--text-3)]">
        {label}
      </span>
    </div>
  );
}

export default function PersonalRecords({ state }: { state: AppState }) {
  const r = useMemo(() => personalRecords(state), [state]);

  if (r.longestStreak < 3 && r.totalCompletions < 5) return null;

  return (
    <div>
      <Eyebrow color="var(--warm)">Your records</Eyebrow>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Tile
          icon="flame"
          color="var(--warm)"
          value={`${r.longestStreak}`}
          label={r.longestStreak === 1 ? "day — longest streak" : "days — longest streak"}
        />
        <Tile
          icon="check"
          color="var(--vitality)"
          value={`${r.bestWeek}/7`}
          label="best week (active days)"
        />
      </div>
      {r.topBehavior && (
        <div className="well mt-2.5 flex items-center gap-3.5 p-4">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
            style={{
              background: "color-mix(in srgb, var(--readiness) 16%, var(--surface-3))",
              color: "var(--readiness)",
            }}
          >
            <Icon name="sparkle" size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-[var(--text-1)]">
              {r.topBehavior.title}
            </p>
            <p className="text-[12px] text-[var(--text-3)]">
              your most-kept habit — {r.topBehavior.count} times
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
