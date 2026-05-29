/**
 * theme.ts — appearance preference (device-local, not synced).
 *
 * Theme is a per-device choice (your phone vs your laptop may differ), so
 * it lives in its own localStorage key rather than the synced AppState.
 * The source of truth for first paint is the inline script in layout.tsx,
 * which reads this same key BEFORE React hydrates to avoid a flash of the
 * wrong theme. These helpers keep the runtime in sync after the user
 * changes it. Dark is the default — the brand's signature look.
 */
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "protocolize-theme";

const THEME_COLORS = { light: "#F6F7F9", dark: "#08090B" } as const;
// Dark remains fully supported and is one tap away in Profile → Appearance;
// only the *default* (used when nothing is stored) changed to light.

export function getThemePref(): ThemePref {
  if (typeof localStorage === "undefined") return "light";
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "system" || v === "dark" ? v : "light";
}

/** Resolve a preference to a concrete theme (system → OS setting). */
export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

/** Apply a resolved theme to the document (data-theme + browser chrome). */
export function applyTheme(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[resolved]);
}

/** Persist a preference and apply it immediately. */
export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* private mode / quota — runtime apply still works for this session */
  }
  applyTheme(pref);
}

/**
 * The pre-hydration script, stringified for inline injection in <body>.
 * Mirrors getThemePref + applyTheme but self-contained (runs before any
 * module loads). Kept tiny and defensive — any failure leaves the dark
 * default intact.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_KEY
)};var p=localStorage.getItem(k)||"light";var d=p==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):(p==="light"?"light":"dark");document.documentElement.setAttribute("data-theme",d);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d==="light"?"#F6F7F9":"#08090B");}catch(e){}})();`;
