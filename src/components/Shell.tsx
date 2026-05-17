"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface ShellProps {
  children: React.ReactNode;
}

// ── Icon Components ─────────────────────────────────────────────

function TodayIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" fill={active ? "currentColor" : "none"} />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M6.34 17.66l-1.41 1.41" />
      <path d="M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function SleepIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ExerciseIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function NutritionIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 17 3.5s1.5 2.5-.5 6c-1.3 2.3-3.4 3.5-5.5 4.5" />
      <path d="M11 20v-10" stroke="currentColor" strokeWidth="1.8" fill="none" />
    </svg>
  );
}

function SupplementsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="4.5"
        y="9"
        width="15"
        height="6"
        rx="3"
        transform="rotate(-45 12 12)"
        fill={active ? "currentColor" : "none"}
      />
      <line
        x1="12"
        y1="5.5"
        x2="12"
        y2="18.5"
        transform="rotate(-45 12 12)"
        strokeWidth="1.5"
        stroke={active ? "#ffffff" : "currentColor"}
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChartIcon({ active: _active }: { active?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

// ── Nav items ───────────────────────────────────────────────────

const navItems = [
  { href: "/today", label: "Home", Icon: TodayIcon },
  { href: "/track", label: "Track", Icon: ExerciseIcon },
  { href: "/progress", label: "Progress", Icon: ChartIcon },
] as const;

// ── Shell ───────────────────────────────────────────────────────

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#ffffff]">
      {/* ── Sticky Glass Header ─────────────────────────────── */}
      <header className="glass sticky top-0 z-50 border-b border-[#d2d2d7]/30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/today"
            className="text-[17px] font-semibold text-[#1d1d1f] tracking-tight"
          >
            Protocolize
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-apple ${
                    isActive
                      ? "bg-[#1d1d1f] text-white"
                      : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/progress"
              className={`p-2 rounded-full transition-apple ${
                pathname === "/progress"
                  ? "text-[#0071e3]"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              aria-label="Progress"
            >
              <ChartIcon />
            </Link>
            <Link
              href="/settings"
              className={`p-2 rounded-full transition-apple ${
                pathname === "/settings"
                  ? "text-[#0071e3]"
                  : "text-[#86868b] hover:text-[#1d1d1f]"
              }`}
              aria-label="Settings"
            >
              <SettingsIcon />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content ────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>

      {/* ── Mobile Bottom Spacer ────────────────────────────── */}
      <div className="h-24 lg:hidden" />

      {/* ── Mobile Bottom Nav ───────────────────────────────── */}
      <nav className="fixed bottom-0 inset-x-0 z-50 glass border-t border-[#d2d2d7]/30 lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto px-2">
          {navItems.map(({ href, label, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 transition-apple ${
                  isActive ? "text-[#0071e3]" : "text-[#86868b]"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon active={isActive} />
                <span className="text-[10px] font-medium leading-tight">
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
