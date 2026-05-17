"use client";

/**
 * Minimal, elegant data viz — soft gridlines, restrained labels.
 */

interface Point {
  label: string;
  value: number; // 0-100 (or arbitrary, normalized internally)
}

export function TrendArea({
  data,
  color = "var(--sleep)",
  height = 160,
  unit = "",
  max,
}: {
  data: Point[];
  color?: string;
  height?: number;
  unit?: string;
  max?: number;
}) {
  const W = 320;
  const H = height;
  const pad = 8;
  const top = 16;
  const peak = max ?? Math.max(...data.map((d) => d.value), 1);
  const n = data.length;

  const x = (i: number) => pad + (i * (W - pad * 2)) / Math.max(n - 1, 1);
  const y = (v: number) => top + (1 - v / peak) * (H - top - 24);

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`)
    .join(" ");
  const area = `${line} L${x(n - 1)},${H - 24} L${x(0)},${H - 24} Z`;
  const gid = `area-${color.replace(/[^a-z]/gi, "")}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full anim-fade"
      preserveAspectRatio="none"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* soft gridlines */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={pad}
          x2={W - pad}
          y1={top + g * (H - top - 24)}
          y2={top + g * (H - top - 24)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(d.value)}
          r={i === n - 1 ? 4 : 0}
          fill={color}
        />
      ))}
      {data.map((d, i) => (
        <text
          key={`l${i}`}
          x={x(i)}
          y={H - 6}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-3)"
        >
          {d.label}
        </text>
      ))}
      {unit && (
        <text x={pad} y={12} fontSize="9" fill="var(--text-3)">
          {Math.round(peak)}
          {unit}
        </text>
      )}
    </svg>
  );
}

export function BarWeek({
  data,
  height = 132,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
}) {
  const colorFor = (v: number) => {
    if (v >= 80) return "var(--vitality)";
    if (v >= 55) return "var(--readiness)";
    if (v > 0) return "var(--warm)";
    return "rgba(255,255,255,0.07)";
  };
  return (
    <div className="flex items-end justify-between gap-2.5" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(6, (d.value / 100) * (height - 26));
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-full tr"
                style={{
                  height: `${h}px`,
                  background: colorFor(d.value),
                  opacity: d.highlight ? 1 : 0.55,
                  boxShadow: d.highlight
                    ? `0 0 12px ${colorFor(d.value)}55`
                    : "none",
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium"
              style={{
                color: d.highlight ? "var(--text-1)" : "var(--text-3)",
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({
  data,
  color = "var(--recovery)",
  width = 90,
  height = 32,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) {
    return <div style={{ width, height }} />;
  }
  const peak = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = peak - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i * width) / (data.length - 1);
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <path
        d={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function HeatStrip({
  values,
}: {
  values: { date: string; score: number }[];
}) {
  const tone = (s: number) => {
    if (s === 0) return "rgba(255,255,255,0.04)";
    if (s >= 80) return "var(--vitality)";
    if (s >= 55) return "var(--readiness)";
    if (s >= 30) return "var(--warm)";
    return "var(--alert)";
  };
  return (
    <div className="grid grid-cols-[repeat(15,1fr)] gap-1.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="aspect-square rounded-[5px] tr-fast"
          style={{
            background: tone(v.score),
            opacity: v.score === 0 ? 1 : 0.4 + (v.score / 100) * 0.6,
          }}
          title={`${v.date}: ${v.score}`}
        />
      ))}
    </div>
  );
}
