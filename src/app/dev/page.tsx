"use client";

/**
 * /dev — development-only persona loader for repeatable UX testing. Gated to
 * NODE_ENV !== "production" (renders nothing useful in prod). One click loads a
 * lifecycle persona into local state; your real data is backed up once and
 * restorable. Local-storage only — intended for `next dev` / preview.
 */
import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/constants";
import { PERSONAS, buildPersona, type PersonaKind } from "@/lib/dev/personas";

const BACKUP_KEY = `${STORAGE_KEY}__dev_backup`;
const THEME_KEY = "protocolize-theme";

export default function DevPage() {
  const isDev = process.env.NODE_ENV !== "production";
  const [summary, setSummary] = useState("…");
  const [hasBackup, setHasBackup] = useState(false);

  useEffect(() => {
    if (!isDev || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const s = raw ? JSON.parse(raw) : null;
      setSummary(
        s
          ? `${(s.dailyLogs || []).length} logs · ${s.settings?.tier ?? "—"} · ${
              (s.installedPacks || []).length
            } packs · ${s.settings?.vacationMode ? "on break" : "active"}`
          : "no saved state"
      );
      setHasBackup(!!localStorage.getItem(BACKUP_KEY));
    } catch {
      setSummary("unreadable");
    }
  }, [isDev]);

  if (!isDev) {
    return (
      <main className="grid min-h-screen place-items-center p-10 text-[var(--text-3)]">
        Not available in production.
      </main>
    );
  }

  const apply = (kind: PersonaKind) => {
    try {
      const cur = localStorage.getItem(STORAGE_KEY);
      if (cur && !localStorage.getItem(BACKUP_KEY)) {
        localStorage.setItem(BACKUP_KEY, cur); // back up real data once
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersona(kind)));
      window.location.assign("/today");
    } catch {
      /* ignore */
    }
  };

  const restore = () => {
    const b = localStorage.getItem(BACKUP_KEY);
    if (!b) return;
    localStorage.setItem(STORAGE_KEY, b);
    localStorage.removeItem(BACKUP_KEY);
    window.location.assign("/today");
  };

  const setTheme = (t: "light" | "dark" | "system") => {
    localStorage.setItem(THEME_KEY, t);
    const resolved =
      t === "system"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : t;
    document.documentElement.setAttribute("data-theme", resolved);
  };

  return (
    <main className="mx-auto max-w-[600px] px-5 py-10">
      <p className="t-eyebrow" style={{ color: "var(--alert)" }}>
        Developer tools
      </p>
      <h1 className="t-title mt-2 text-[var(--text-1)]">Personas</h1>
      <p className="t-caption mt-2 leading-relaxed">
        Load a lifecycle state for UX testing. Your real data is backed up once
        and restorable below. Dev-only · local storage · not shipped to users.
      </p>
      <p className="mt-3 text-[12px] text-[var(--text-3)]">
        Current: <span className="font-semibold text-[var(--text-2)]">{summary}</span>
      </p>

      <div className="mt-5 flex flex-col gap-2.5">
        {PERSONAS.map((p) => (
          <button
            key={p.kind}
            onClick={() => apply(p.kind)}
            className="press tr-fast card p-4 text-left"
          >
            <p className="text-[15px] font-bold text-[var(--text-1)]">{p.label}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-3)]">
              {p.blurb}
            </p>
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2.5">
        <button
          onClick={restore}
          disabled={!hasBackup}
          className="press tr-fast rounded-[var(--r-pill)] px-4 py-2.5 text-[13px] font-semibold disabled:opacity-40"
          style={{ background: "var(--surface-3)", color: "var(--text-1)" }}
        >
          {hasBackup ? "Restore my real data" : "No backup yet"}
        </button>
        <span className="text-[12px] text-[var(--text-4)]">
          Theme:
        </span>
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className="press tr-fast rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold capitalize"
            style={{ background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {t}
          </button>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed text-[var(--text-4)]">
        Tip: resize to mobile (375px) for the real form factor. Loading a persona
        navigates to Today; use the bottom nav to tour Insights, Protocols,
        Supplements, Profile.
      </p>
    </main>
  );
}
