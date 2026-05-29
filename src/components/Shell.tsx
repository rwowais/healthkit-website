"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ToastProvider } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";
import Reminders from "@/components/Reminders";
import SyncIndicator from "@/components/SyncIndicator";
import { useAppState } from "@/hooks/useAppState";

// Library + Protocols merged into a single hub. Discovery (browse + install
// curated packs) and management (installed system) are one workflow, not
// two — splitting them across tabs created a confusing "I added it, now
// where do I find it?" loop.
const ALL_NAV: {
  href: string;
  label: string;
  icon: IconName;
  /**
   * Optional tag a tab can carry so Shell can hide it based on the
   * user's settings. "supplements" lets users opt out of the
   * Supplements tab when they don't take any (Profile → toggle).
   */
  tag?: "supplements";
}[] = [
  { href: "/today", label: "Today", icon: "home" },
  { href: "/protocols", label: "Protocols", icon: "layers" },
  {
    href: "/supplements",
    label: "Supplements",
    icon: "pill",
    tag: "supplements",
  },
  { href: "/insights", label: "Insights", icon: "bulb" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const { state } = useAppState();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");
  // Filter tabs based on user settings. The supplements tab is
  // visible by default; the user can hide it in Profile if they
  // don't track any. `/supplements` is still reachable via the
  // Manage link inside SupplementBlockCard, so hiding never strands.
  const NAV = ALL_NAV.filter((n) => {
    if (n.tag === "supplements" && state.settings?.hideSupplementsTab)
      return false;
    return true;
  });

  return (
    <ToastProvider>
      <Reminders />
      <div className="min-h-screen">
        <header className="glass sticky top-0 z-50 border-b border-[var(--hairline)]">
          <div className="mx-auto flex h-16 max-w-[600px] items-center justify-between px-6">
            <div className="flex items-center gap-2.5">
              <Link href="/today" className="flex items-center gap-2.5">
                <span
                  className="grid h-7 w-7 place-items-center rounded-[9px]"
                  style={{
                    background:
                      "linear-gradient(145deg, var(--sleep), var(--readiness))",
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-[#08090B]" />
                </span>
                <span className="text-[16px] font-bold tracking-tight text-[var(--text-1)]">
                  Protocolize
                </span>
              </Link>
              {/* Sync status pill — calm, peripheral, never alarming.
                  A sibling of the logo link (not nested inside it): an
                  aria-live status region inside an <a> folds into the
                  link's accessible name and re-announces as part of it. */}
              <SyncIndicator />
            </div>
            <nav className="hidden items-center gap-1 lg:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`tr-fast rounded-[var(--r-pill)] px-4 py-2 text-[13px] font-medium ${
                    isActive(n.href)
                      ? "bg-[var(--surface-3)] text-[var(--text-1)]"
                      : "text-[var(--text-3)] hover:text-[var(--text-1)]"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[600px] px-5 pb-32 pt-6 lg:pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-[var(--hairline)] pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="mx-auto flex h-[68px] max-w-[600px] items-center justify-around px-2">
            {NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="press relative flex min-w-[58px] flex-col items-center gap-1.5 py-1"
                  style={{
                    color: active ? "var(--text-1)" : "var(--text-3)",
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-dot"
                      className="absolute -top-px h-[3px] w-7 rounded-full"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--sleep), var(--readiness))",
                      }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                  <Icon
                    name={n.icon}
                    size={22}
                    stroke={active ? 2 : 1.6}
                  />
                  <span
                    className="text-[10px] font-medium tracking-tight"
                    style={{ opacity: active ? 1 : 0.7 }}
                  >
                    {n.label}
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
