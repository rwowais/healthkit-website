"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/* ════════════════════════════════════════════════════════════════
   Premium primitives — calm, spacious, intentional.
   ════════════════════════════════════════════════════════════════ */

// ── Card ──────────────────────────────────────────────────────────
export function Card({
  children,
  className = "",
  pad = "p-6",
  onClick,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={style}
      className={`card inset ${pad} ${
        onClick ? "press cursor-pointer" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Eyebrow / Section header ──────────────────────────────────────
export function Eyebrow({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <p className="t-eyebrow" style={color ? { color } : undefined}>
      {children}
    </p>
  );
}

export function SectionHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-4 flex items-end justify-between">
      <h2 className="t-section text-[var(--text-1)]">{title}</h2>
      {action && (
        <button
          onClick={onAction}
          className="t-caption tr-fast text-[var(--readiness)] hover:opacity-70"
        >
          {action}
        </button>
      )}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────────
export function Button({
  children,
  variant = "primary",
  onClick,
  full,
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "soft";
  onClick?: () => void;
  full?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const base =
    "press tr-fast inline-flex items-center justify-center gap-2 rounded-[var(--r-pill)] text-[14px] font-semibold disabled:opacity-40";
  const styles =
    variant === "primary"
      ? "bg-[var(--text-1)] text-[#0A0B0D] px-6 py-3.5"
      : variant === "soft"
      ? "bg-[var(--surface-3)] text-[var(--text-1)] px-6 py-3.5"
      : "border border-[var(--hairline-strong)] text-[var(--text-1)] px-6 py-3.5";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

// ── Stat ──────────────────────────────────────────────────────────
export function Stat({
  label,
  value,
  unit,
  accent = "var(--text-1)",
  trend,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: string;
  trend?: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <p className="t-eyebrow mb-2.5">{label}</p>
      <div className="flex items-baseline gap-1">
        <span
          className="text-[28px] font-bold tracking-tight"
          style={{ color: accent, fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
        {unit && (
          <span className="text-[13px] font-medium text-[var(--text-3)]">
            {unit}
          </span>
        )}
      </div>
      {trend && <div className="mt-2">{trend}</div>}
    </div>
  );
}

// ── Segmented control ─────────────────────────────────────────────
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-[var(--r-pill)] bg-[var(--surface-2)] p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`tr-fast flex-1 rounded-[var(--r-pill)] py-2 text-[13px] font-semibold ${
              active
                ? "bg-[var(--surface-3)] text-[var(--text-1)]"
                : "text-[var(--text-3)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────
export function Divider() {
  return <div className="h-px w-full bg-[var(--hairline)]" />;
}

// ── Skeleton ──────────────────────────────────────────────────────
export function Skeleton({
  className = "",
  rounded = "rounded-[var(--r-md)]",
}: {
  className?: string;
  rounded?: string;
}) {
  return <div className={`skeleton ${rounded} ${className}`} />;
}

// ── Bottom Sheet / Modal ──────────────────────────────────────────
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="anim-fade fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="anim-sheet glass w-full max-w-[480px] rounded-t-[var(--r-xl)] border-t border-[var(--hairline-strong)] p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-[var(--r-xl)] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--text-4)] sm:hidden" />
        {title && (
          <h3 className="t-section mb-5 text-[var(--text-1)]">{title}</h3>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Toast system ──────────────────────────────────────────────────
interface ToastCtx {
  show: (msg: string) => void;
}
const ToastContext = createContext<ToastCtx>({ show: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout((show as unknown as { _t?: number })._t);
    (show as unknown as { _t?: number })._t = window.setTimeout(
      () => setMsg(null),
      2600
    );
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg && (
        <div className="anim-toast glass fixed bottom-28 left-1/2 z-[200] rounded-[var(--r-pill)] border border-[var(--hairline-strong)] px-5 py-3">
          <p className="text-[13px] font-medium text-[var(--text-1)]">{msg}</p>
        </div>
      )}
    </ToastContext.Provider>
  );
}

// ── Empty / cold-start state ──────────────────────────────────────
export function EmptyState({
  icon,
  title,
  body,
  cta,
  onCta,
}: {
  icon?: React.ReactNode;
  title: string;
  body: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && (
        <span
          className="chip mb-5 h-14 w-14"
          style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
        >
          {icon}
        </span>
      )}
      <p className="t-section text-[var(--text-1)]">{title}</p>
      <p className="t-caption mt-2 max-w-[260px] leading-relaxed">{body}</p>
      {cta && (
        <button
          onClick={onCta}
          className="press tr-fast mt-5 rounded-[var(--r-pill)] bg-[var(--surface-3)] px-5 py-2.5 text-[13px] font-semibold text-[var(--text-1)]"
        >
          {cta}
        </button>
      )}
    </div>
  );
}

/** A dash placeholder for a metric with no data yet. */
export function NoData({ size = 28 }: { size?: number }) {
  return (
    <span
      className="font-bold text-[var(--text-4)]"
      style={{ fontSize: size }}
    >
      —
    </span>
  );
}

// ── Score helpers ─────────────────────────────────────────────────
export function scoreColor(s: number): string {
  if (s >= 80) return "var(--vitality)";
  if (s >= 55) return "var(--readiness)";
  if (s >= 30) return "var(--warm)";
  if (s > 0) return "var(--alert)";
  return "var(--text-3)";
}

export function scoreWord(s: number): string {
  if (s >= 85) return "Optimal";
  if (s >= 70) return "Strong";
  if (s >= 50) return "Fair";
  if (s > 0) return "Needs Focus";
  return "No Data";
}
