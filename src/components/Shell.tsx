"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "◻" },
  { href: "/programs", label: "Programs", icon: "▶" },
  { href: "/protocols", label: "Protocols", icon: "◎" },
  { href: "/meals", label: "Meals", icon: "◇" },
  { href: "/tracker", label: "Tracker", icon: "✓" },
  { href: "/workout", label: "Workout", icon: "↑" },
  { href: "/progress", label: "Progress", icon: "◈" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-[#d2d2d7]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <Link href="/dashboard" className="flex items-center gap-2">
              <span className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
                HealthKit
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-apple ${
                      active
                        ? "bg-[#1d1d1f] text-white"
                        : "text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-[#f5f5f7] text-[#86868b]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <nav className="lg:hidden border-t border-[#d2d2d7]/60 px-4 py-3 bg-white">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-[15px] font-medium ${
                    active ? "bg-[#f5f5f7] text-[#1d1d1f]" : "text-[#86868b]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      {/* Main */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-[#d2d2d7]/60 z-50 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-1.5">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center py-1 px-2 text-[10px] font-medium transition-apple ${
                  active ? "text-[#0071e3]" : "text-[#86868b]"
                }`}
              >
                <span className="text-[16px] mb-0.5">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Spacer for mobile bottom nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
}
