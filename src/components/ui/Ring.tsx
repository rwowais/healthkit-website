"use client";

/**
 * Premium circular score visualizations — Oura/Whoop-grade.
 */

interface RingProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
  big?: boolean;
}

export function RingScore({
  value,
  size = 220,
  stroke = 14,
  color = "var(--readiness)",
  trackColor = "rgba(255,255,255,0.05)",
  label,
  sublabel,
  big = true,
}: RingProps) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(value, 100)) / 100;
  const off = circ * (1 - pct);
  const gid = `ring-${label ?? "x"}-${Math.round(value)}`;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.65" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          className="anim-ring"
          style={
            {
              "--ring-circ": circ,
              "--ring-off": off,
              filter: `drop-shadow(0 0 10px ${color}40)`,
            } as React.CSSProperties
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={big ? "t-metric" : "text-[34px] font-bold"}
          style={{ color: "var(--text-1)" }}
        >
          {Math.round(value)}
        </span>
        {label && (
          <span className="t-eyebrow mt-2" style={{ color }}>
            {label}
          </span>
        )}
        {sublabel && (
          <span className="t-caption mt-1">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

export function MiniRing({
  value,
  color = "var(--readiness)",
  size = 64,
  stroke = 5,
  icon,
}: {
  value: number;
  color?: string;
  size?: number;
  stroke?: number;
  icon?: string;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(value, 100)) / 100);

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={off}
          className="anim-ring"
          style={
            { "--ring-circ": circ, "--ring-off": off } as React.CSSProperties
          }
        />
      </svg>
      {icon && (
        <span className="absolute text-[20px]" style={{ lineHeight: 1 }}>
          {icon}
        </span>
      )}
    </div>
  );
}

export function ArcGauge({
  value,
  color = "var(--sleep)",
  size = 260,
}: {
  value: number;
  color?: string;
  size?: number;
}) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  // 270° arc
  const circ = 2 * Math.PI * r;
  const arc = circ * 0.75;
  const off = arc * (1 - Math.max(0, Math.min(value, 100)) / 100);

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size * 0.78 }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: "rotate(135deg)" }}
        className="absolute top-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circ}`}
          strokeDashoffset={off}
          className="anim-ring"
          style={
            { "--ring-circ": arc, "--ring-off": off } as React.CSSProperties
          }
        />
      </svg>
    </div>
  );
}
