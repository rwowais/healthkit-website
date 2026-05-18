"use client";

/**
 * Thin-stroke icon system — Lucide / SF Symbols sensibility.
 * 24px grid, 1.6 stroke, round caps. No fills, no emoji.
 */

import type { Pillar, ProtocolItem } from "@/lib/types";

export type IconName =
  | "sun"
  | "snowflake"
  | "coffee"
  | "moon"
  | "screen"
  | "thermometer"
  | "pill"
  | "wind"
  | "clock"
  | "utensils"
  | "footprints"
  | "pulse"
  | "dumbbell"
  | "stretch"
  | "hand"
  | "balance"
  | "ban"
  | "droplet"
  | "leaf"
  | "fish"
  | "wine"
  | "cube"
  | "protein"
  | "flask"
  | "shield"
  | "sparkle"
  | "check"
  | "chevron"
  | "plus"
  | "info"
  | "lungs"
  | "bed"
  | "home"
  | "layers"
  | "compass"
  | "user"
  | "bulb"
  | "flame"
  | "arrowRight";

const P: Record<IconName, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  snowflake: (
    <>
      <path d="M12 3v18M5 7l14 10M19 7L5 17" />
      <path d="M12 6l-2.2-2M12 6l2.2-2M12 18l-2.2 2M12 18l2.2 2M6.5 9l-3 .3M6.5 15l-3-.3M17.5 9l3 .3M17.5 15l3-.3" />
    </>
  ),
  coffee: (
    <>
      <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
      <path d="M16 10h2a2 2 0 0 1 0 4h-2" />
      <path d="M8.5 3.5c-.5.7-.5 1.3 0 2M11.5 3.5c-.5.7-.5 1.3 0 2" />
    </>
  ),
  moon: <path d="M20 13.2A8 8 0 1 1 10.8 4a6.3 6.3 0 0 0 9.2 9.2z" />,
  bed: (
    <>
      <path d="M3 8v11M3 13h18v6M21 19v-5a3 3 0 0 0-3-3H9" />
      <circle cx="6.5" cy="10.5" r="1.6" />
    </>
  ),
  screen: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
      <path d="M4 4l16 16" />
    </>
  ),
  thermometer: (
    <>
      <path d="M12 4a2 2 0 0 0-2 2v8.5a3.5 3.5 0 1 0 4 0V6a2 2 0 0 0-2-2z" />
      <path d="M12 11v4" />
    </>
  ),
  pill: (
    <>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-40 12 12)" />
      <path d="M9.5 6.5l5.6 5.6" />
    </>
  ),
  wind: (
    <path d="M3 8h9a2.5 2.5 0 1 0-2.5-2.5M3 12h13a2.5 2.5 0 1 1-2.5 2.5M3 16h7a2 2 0 1 1-2 2" />
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  utensils: (
    <>
      <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
      <path d="M16 3c-1.7 0-3 2-3 4.5S14 12 16 12v9" />
    </>
  ),
  footprints: (
    <>
      <path d="M5 14c-1 0-2-1-2-3s.8-5 2.3-5S7 8 7 10s-1 4-2 4zM5 14v3a2 2 0 0 0 4 0v-2" />
      <path d="M17 19c1 0 2-1 2-3s-.8-5-2.3-5S14 13 14 15s1 4 2 4zM17 19v-1" />
    </>
  ),
  pulse: (
    <path d="M3 12h3.5l2-6 4 12 2.5-7 1.5 3H21" />
  ),
  dumbbell: (
    <>
      <path d="M6.5 8v8M4 9.5v5M17.5 8v8M20 9.5v5M6.5 12h11" />
    </>
  ),
  stretch: (
    <>
      <circle cx="13" cy="5" r="1.8" />
      <path d="M13 8v5l4 3M13 11l-4 1-3 5M13 13l-1 8" />
    </>
  ),
  hand: (
    <path d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11m0 0V5a1.5 1.5 0 0 1 3 0v6m0 0V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1a5 5 0 0 1-4.3-2.5L5 16c-.6-1 .2-2.2 1.3-2l1.7.5" />
  ),
  balance: (
    <>
      <path d="M12 4v16M6 20h12" />
      <path d="M12 6l-7 3 7 3 7-3-7-3z" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  droplet: (
    <path d="M12 3.5c3 3.8 5.5 6.8 5.5 9.8a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-9.8z" />
  ),
  leaf: (
    <>
      <path d="M5 19c0-7 4-12 14-13 0 9-5 13-11 13-1 0-3 0-3 0z" />
      <path d="M5 19c2-4 4-6 8-8" />
    </>
  ),
  fish: (
    <>
      <path d="M3 12c3-4 7-5 11-5 3 0 5 2 7 5-2 3-4 5-7 5-4 0-8-1-11-5z" />
      <path d="M3 12c-.5-1.5-.5-3 0-4M3 12c-.5 1.5-.5 3 0 4" />
      <circle cx="16" cy="11" r="1" />
    </>
  ),
  wine: (
    <>
      <path d="M8 3h8c0 5-2 8-4 8s-4-3-4-8z" />
      <path d="M12 11v7M9 21h6" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3l7 4v8l-7 4-7-4V7l7-4z" />
      <path d="M12 3v8l7 4M12 11L5 15" />
    </>
  ),
  protein: (
    <>
      <path d="M14 4c3 0 5 2 5 5 0 4-3 7-3 7s-3-1-5-3-3-5-3-5 1-2 3-2" />
      <path d="M9 15l-4 4M7 13l-3 3" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v6l-4.5 8a2 2 0 0 0 1.8 3h9.4a2 2 0 0 0 1.8-3L14 9V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  sparkle: (
    <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
  ),
  lungs: (
    <path d="M12 3v9M9 12c0-2-3-2-4 1s-1 7 1 7 3-1 3-4v-4zM15 12c0-2 3-2 4 1s1 7-1 7-3-1-3-4v-4z" />
  ),
  home: (
    <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5M10 20v-5h4v5" />
  ),
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5M3 17l9 5 9-5" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="9" r="3.4" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 17h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2h5c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
    </>
  ),
  flame: (
    <path d="M12 3c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.6.8-2.8 1.6-3.6C9.4 9 9 7 12 3z" />
  ),
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  stroke = 1.6,
  className = "",
}: {
  name: IconName;
  size?: number;
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {P[name]}
    </svg>
  );
}

// ── Resolver: protocol item → icon ────────────────────────────────

const FALLBACK: Record<Pillar, IconName> = {
  sleep: "moon",
  exercise: "pulse",
  nutrition: "leaf",
  supplements: "pill",
};

const RULES: [RegExp, IconName][] = [
  [/sunlight|morning sun|light exposure/i, "sun"],
  [/cold|ice|cryo/i, "snowflake"],
  [/caffeine|coffee/i, "coffee"],
  [/dim|lights out|darkness/i, "moon"],
  [/screen|device|phone|blue light/i, "screen"],
  [/cool|temperature|bedroom temp|thermo/i, "thermometer"],
  [/wind-?down|relax|breath|medit/i, "wind"],
  [/cutoff|window|timing|fasting/i, "clock"],
  [/last meal|dinner|eating/i, "utensils"],
  [/walk|steps|zone 2 walk/i, "footprints"],
  [/zone 2|cardio|heart rate|hrv|hiit interval/i, "pulse"],
  [/vo2|interval|sprint/i, "lungs"],
  [/strength|resistance|lift|weight train/i, "dumbbell"],
  [/mobility|stretch|flexib|yoga/i, "stretch"],
  [/grip|carry|farmer/i, "hand"],
  [/balance|stability|proprio/i, "balance"],
  [/no intense|avoid|minimize|limit|reduce/i, "ban"],
  [/hydrat|water|electrolyte/i, "droplet"],
  [/fiber|vegetable|veggie|greens|salad/i, "leaf"],
  [/omega|fish oil|epa|dha/i, "fish"],
  [/alcohol|wine|drink/i, "wine"],
  [/sugar|processed|sweet/i, "cube"],
  [/protein|breakfast|amino|leucine/i, "protein"],
  [/creatine|powder/i, "flask"],
  [/vitamin d|d3/i, "sun"],
  [/k2|mk-7|bone/i, "shield"],
  [/ag1|athletic greens|multivit/i, "leaf"],
  [/magnesium|threonate|glycinate/i, "moon"],
  [/theanine|apigenin|glycine|melatonin/i, "sparkle"],
  [/sleep|bed|nap/i, "bed"],
];

export function iconForItem(item: ProtocolItem): IconName {
  const hay = `${item.name} ${item.description ?? ""}`;
  for (const [re, name] of RULES) {
    if (re.test(hay)) return name;
  }
  return FALLBACK[item.pillar];
}
