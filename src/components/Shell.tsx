"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui";

interface ShellProps {
  children: React.ReactNode;
}

// ── Icons (thin, calm line work) ────────────────────────────────

type IconProps = { active: boolean };

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M3.5 10.5L12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19v-8.5z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
      />
    </svg>
  );
}

function SleepIcon({ active }: IconProps) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 13.2A8 8 0 1 1 10.8 4a6.3 6.3 0 0 0 9.2 9.2z"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        strokeLinejoin="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
      />
    </svg>
  );
}

function RecoveryIcon({ active }: IconProps) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 13h3l2.5-6 4 12 2.5-6H21"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrackIcon({ active }: IconProps) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth={active ? 2 : 1.6}
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.16 : 0}
      />
      <path
        d="M8.5 12l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendsIcon({ active }: IconProps) {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 16l5-5 3.5 3.5L20 7"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 7h5v5"
        stroke="currentColor"
        strokeWidth={active ? 2.2 : 1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4L17 17M7 7L5.6 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV = [
  { href: "/today", label: "Home", Icon: HomeIcon },
  { href: "/sleep", label: "Sleep", Icon: SleepIcon },
  { href: "/recovery", label: "Recovery", Icon: RecoveryIcon },
  { href: "/track", label: "Protocols", Icon: TrackIcon },
  { href: "/progress", label: "Trends", Icon: TrendsIcon },
] as const;

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <ToastProvider>
      <div className="min-h-screen">
        {/* ── Header ──────────────────────────────────────────── */}
        <header className="glass sticky top-0 z-50 border-b border-[var(--hairline)]">
          <div className="mx-auto flex h-16 max-w-[600px] items-center justify-between px-6">
            <Link href="/today" className="flex items-center gap-2.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-[9px]"
                style={{
                  background:
                    "linear-gradient(145deg, var(--sleep), var(--readiness))",
                }}
              >
                <span className="h-2 w-2 rounded-full bg-[#0A0B0D]" />
              </span>
              <span className="text-[16px] font-bold tracking-tight text-[var(--text-1)]">
                Protocolize
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-medium ${
                    isActive(href)
                      ? "bg-[var(--surface-3)] text-[var(--text-1)]"
                      : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <Link
              href="/settings"
              aria-label="Settings"
              className={`press tr-fast rounded-full p-2 ${
                isActive("/settings")
                  ? "text-[var(--text-1)]"
                  : "text-[var(--text-3)] hover:text-[var(--text-1)]"
              }`}
            >
              <GearIcon />
            </Link>
          </div>
        </header>

        {/* ── Main ────────────────────────────────────────────── */}
        <main className="mx-auto max-w-[600px] px-5 pb-32 pt-6 lg:pb-12">
          {children}
        </main>

        {/* ── Mobile bottom nav ───────────────────────────────── */}
        <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-[var(--hairline)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex h-[68px] max-w-[600px] items-center justify-around px-2">
            {NAV.map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className="press flex min-w-[58px] flex-col items-center gap-1.5 py-1"
                  style={{
                    color: active ? "var(--text-1)" : "var(--text-3)",
                  }}
                >
                  <Icon active={active} />
                  <span
                    className="text-[10px] font-medium tracking-tight"
                    style={{ opacity: active ? 1 : 0.7 }}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </ToastProvider>
  );
}
