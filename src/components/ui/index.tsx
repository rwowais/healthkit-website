"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  id,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  /** Optional DOM id — useful for in-page anchor links like
   * `/profile#break` to scroll to the vacation toggle directly. */
  id?: string;
}) {
  return (
    <div
      id={id}
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
    "press tr-fast inline-flex items-center justify-center gap-2 rounded-[var(--r-pill)] text-[14px] font-semibold";
  const styles = disabled
    ? "border border-[var(--hairline)] !bg-transparent text-[var(--text-4)] px-6 py-3.5 cursor-not-allowed"
    : variant === "primary"
    ? "bg-[var(--text-1)] text-[var(--bg)] px-6 py-3.5"
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
  const panelRef = useRef<HTMLDivElement>(null);
  // Stable onClose ref. Callers pass inline arrows
  // (`onClose={() => setX(null)}`), which become a new function identity
  // on every parent render. Putting `onClose` in the effect deps would
  // re-run the effect on every keystroke in any child input, which
  // calls panelRef.current?.focus() and yanks focus off the input the
  // user is actively typing in. Holding onClose in a ref lets the
  // Escape handler stay current without retriggering the effect.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Swipe-down-to-dismiss state. Native-feel: finger follows the
  // sheet, releases below threshold → snaps back, above threshold →
  // closes. Tracked in transient state so we don't re-render the
  // children on every frame; the wrapper div's transform updates
  // directly via inline style.
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<{ y: number; t: number } | null>(null);
  const closingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Focus trap: keep Tab cycling within the dialog so keyboard and
      // screen-reader users can't tab out into the inert page behind it
      // (and silently act on controls they can't see).
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = Array.from(
          panel.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);
        if (focusables.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || active === panel || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          active === last ||
          active === panel ||
          !panel.contains(active)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
      // Reset drag state for next open.
      setDragY(0);
      setDragging(false);
      closingRef.current = false;
    };
  }, [open]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only start a drag from the handle area or the panel itself,
    // not from interactive children (buttons, inputs). The hit-test
    // is "if the target is inside a scrollable region with scrollTop
    // > 0, treat as scroll, not drag" — otherwise dragging interferes
    // with content scrolling.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const panel = panelRef.current;
    if (!panel) return;
    // If the user is touching scrolled-down content, let them scroll.
    if (panel.scrollTop > 0) return;
    dragStartRef.current = { y: e.clientY, t: Date.now() };
    setDragging(true);
    panel.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) return;
    const dy = e.clientY - dragStartRef.current.y;
    // Only allow downward drag; no rubber-band up.
    setDragY(Math.max(0, dy));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !dragStartRef.current) {
      setDragging(false);
      return;
    }
    const start = dragStartRef.current;
    const dy = Math.max(0, e.clientY - start.y);
    const dt = Math.max(1, Date.now() - start.t);
    const velocity = dy / dt; // px / ms
    const panelH = panelRef.current?.offsetHeight ?? 400;
    // Dismiss on either: dragged > 35% of sheet height, OR a fast
    // flick (>0.7 px/ms downward). Matches iOS / Android native feel.
    const shouldDismiss = dy > panelH * 0.35 || velocity > 0.7;
    setDragging(false);
    dragStartRef.current = null;
    if (shouldDismiss && !closingRef.current) {
      closingRef.current = true;
      // Snap the rest of the way off-screen for a frame so the
      // dismissal animation reads cleanly, then close.
      setDragY(panelH);
      setTimeout(() => onCloseRef.current(), 160);
    } else {
      setDragY(0);
    }
  };

  if (!open) return null;
  return (
    <div
      className="anim-fade fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      style={{
        background: `rgba(0,0,0,${
          dragging ? Math.max(0.2, 0.6 - dragY / 800) : 0.6
        })`,
        transition: dragging ? "none" : "background 160ms ease",
      }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title ?? "Dialog"}
        tabIndex={-1}
        className="anim-sheet glass no-scrollbar max-h-[88vh] w-full max-w-[480px] overflow-y-auto rounded-t-[var(--r-xl)] border-t border-[var(--hairline-strong)] p-6 pb-[max(24px,env(safe-area-inset-bottom))] outline-none sm:max-h-[85vh] sm:rounded-[var(--r-xl)] sm:border touch-pan-y"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging
            ? "none"
            : "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)",
          willChange: dragging ? "transform" : undefined,
        }}
      >
        <div
          className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--text-4)] sm:hidden"
          aria-hidden="true"
        />
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
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 2600);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Surface save/sync failures globally instead of swallowing them.
  useEffect(() => {
    const onSaveError = (e: Event) => {
      const where = (e as CustomEvent).detail;
      show(
        where === "local"
          ? "This device's storage is full — data isn't being saved. Export a backup."
          : where === "cloud-clear"
          ? "Couldn't clear cloud data — will retry when you're back online."
          : "Offline — changes are saved on this device and will sync later."
      );
    };
    window.addEventListener("pz:save-error", onSaveError);
    return () => window.removeEventListener("pz:save-error", onSaveError);
  }, [show]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg && (
        // Outer wrapper owns the centering (static -translate-x-1/2) so it
        // survives prefers-reduced-motion, which neutralizes .anim-toast's
        // transform — previously centering lived in the keyframe, so
        // reduced-motion users got the toast shoved off the right edge.
        // role=status + aria-live announces it to screen readers (the
        // toast is the only channel for storage-full / save-error msgs).
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-28 left-1/2 z-[200] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2"
        >
          <div className="anim-toast glass rounded-[var(--r-pill)] border border-[var(--hairline-strong)] px-5 py-3">
            <p className="text-[13px] font-medium text-[var(--text-1)]">{msg}</p>
          </div>
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
