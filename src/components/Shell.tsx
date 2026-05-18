"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ToastProvider } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: "/today", label: "Today", icon: "home" },
  { href: "/protocols", label: "Protocols", icon: "layers" },
  { href: "/insights", label: "Insights", icon: "bulb" },
  { href: "/library", label: "Library", icon: "compass" },
  { href: "/profile", label: "Profile", icon: "user" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <ToastProvider>
      <div className="min-h-screen">
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
                <span className="h-2 w-2 rounded-full bg-[#08090B]" />
              </span>
              <span className="text-[16px] font-bold tracking-tight text-[var(--text-1)]">
                Protocolize
              </span>
            </Link>
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
