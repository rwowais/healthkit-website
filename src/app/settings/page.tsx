"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { useAppState } from "@/hooks/useAppState";
import { formatDisplayTime, timeStringToMinutes } from "@/lib/timing";
import { PILLAR_META, PILLARS, TRIAL_DURATION_DAYS } from "@/lib/constants";

// ── Main Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const { state, loading, updateSettings } = useAppState();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const settings = state.settings;

  // Calculate trial days remaining
  const trialDaysLeft = (() => {
    if (settings.subscriptionStatus !== "trial") return null;
    const start = new Date(settings.trialStartDate);
    const now = new Date();
    const elapsed = Math.floor(
      (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, TRIAL_DURATION_DAYS - elapsed);
  })();

  // Sleep duration display
  const sleepDuration = (() => {
    const bedMin = timeStringToMinutes(settings.bedtime);
    const wakeMin = timeStringToMinutes(settings.wakeTime);
    let diff = wakeMin - bedMin;
    if (diff <= 0) diff += 1440;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  })();

  // Protocol counts
  const protocolCounts = PILLARS.map((p) => ({
    pillar: p,
    label: PILLAR_META[p].label,
    icon: PILLAR_META[p].icon,
    enabled: state.protocols[p].filter((i) => i.isEnabled).length,
    total: state.protocols[p].length,
  }));

  const totalEnabled = protocolCounts.reduce((s, p) => s + p.enabled, 0);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleReset() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("protocolize-v2");
      window.location.href = "/";
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="space-y-6 animate-pulse">
          <div className="h-9 w-32 bg-[#f5f5f7] rounded-xl" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#f5f5f7] rounded-2xl" />
          ))}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="space-y-8 pb-4">
        {/* Header */}
        <div>
          <h1 className="text-[32px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
            Settings
          </h1>
          <p className="text-[15px] text-[#86868b] mt-1">
            Manage your profile and preferences
          </p>
        </div>

        {/* Profile */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">
              Profile
            </p>

            {/* Name */}
            <div className="flex items-center justify-between py-3 border-b border-[#d2d2d7]/20">
              <span className="text-[15px] text-[#1d1d1f]">Name</span>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => updateSettings({ name: e.target.value })}
                className="text-[15px] text-[#86868b] text-right bg-transparent outline-none w-40 focus:text-[#1d1d1f] transition-apple"
                placeholder="Your name"
              />
            </div>

            {/* Subscription */}
            <div className="flex items-center justify-between py-3">
              <span className="text-[15px] text-[#1d1d1f]">Plan</span>
              <div className="flex items-center gap-2">
                <span
                  className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor:
                      settings.subscriptionStatus === "trial"
                        ? "rgba(0, 113, 227, 0.1)"
                        : settings.subscriptionStatus === "active"
                        ? "rgba(48, 209, 88, 0.1)"
                        : "rgba(255, 59, 48, 0.1)",
                    color:
                      settings.subscriptionStatus === "trial"
                        ? "#0071e3"
                        : settings.subscriptionStatus === "active"
                        ? "#30d158"
                        : "#ff3b30",
                  }}
                >
                  {settings.subscriptionStatus === "trial"
                    ? `Trial (${trialDaysLeft}d left)`
                    : settings.subscriptionStatus === "active"
                    ? "Premium"
                    : "Expired"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sleep Schedule */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">
              Sleep Schedule
            </p>

            <div className="flex items-center justify-between py-3 border-b border-[#d2d2d7]/20">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">🌙</span>
                <span className="text-[15px] text-[#1d1d1f]">Bedtime</span>
              </div>
              <input
                type="time"
                value={settings.bedtime}
                onChange={(e) => {
                  updateSettings({ bedtime: e.target.value });
                  showToast("Schedule updated — all times recalculated");
                }}
                className="text-[15px] text-[#86868b] bg-transparent outline-none focus:text-[#1d1d1f] transition-apple"
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-[#d2d2d7]/20">
              <div className="flex items-center gap-2">
                <span className="text-[16px]">☀️</span>
                <span className="text-[15px] text-[#1d1d1f]">Wake Time</span>
              </div>
              <input
                type="time"
                value={settings.wakeTime}
                onChange={(e) => {
                  updateSettings({ wakeTime: e.target.value });
                  showToast("Schedule updated — all times recalculated");
                }}
                className="text-[15px] text-[#86868b] bg-transparent outline-none focus:text-[#1d1d1f] transition-apple"
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-[15px] text-[#1d1d1f]">
                Sleep Duration
              </span>
              <span className="text-[15px] font-medium text-[#5e5ce6]">
                {sleepDuration}
              </span>
            </div>
          </div>
        </div>

        {/* Protocol Overview */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">
                Active Protocols
              </p>
              <span className="text-[13px] font-semibold text-[#0071e3]">
                {totalEnabled} items
              </span>
            </div>

            <div className="space-y-0">
              {protocolCounts.map((p, i) => (
                <div
                  key={p.pillar}
                  className={`flex items-center justify-between py-3 ${
                    i < protocolCounts.length - 1
                      ? "border-b border-[#d2d2d7]/20"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[16px]">{p.icon}</span>
                    <span className="text-[15px] text-[#1d1d1f]">
                      {p.label}
                    </span>
                  </div>
                  <span className="text-[13px] text-[#86868b]">
                    {p.enabled} of {p.total}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">
              Preferences
            </p>

            <div className="flex items-center justify-between py-3 border-b border-[#d2d2d7]/20">
              <span className="text-[15px] text-[#1d1d1f]">
                Week starts on
              </span>
              <button
                onClick={() => {
                  updateSettings({
                    weekStartsOn: settings.weekStartsOn === 1 ? 0 : 1,
                  });
                }}
                className="text-[15px] text-[#0071e3] font-medium"
              >
                {settings.weekStartsOn === 1 ? "Monday" : "Sunday"}
              </button>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-[15px] text-[#1d1d1f]">Timezone</span>
              <span className="text-[13px] text-[#86868b]">
                {settings.timezone}
              </span>
            </div>
          </div>
        </div>

        {/* Data */}
        <div className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-4">
              Data
            </p>

            <div className="flex items-center justify-between py-3 border-b border-[#d2d2d7]/20">
              <span className="text-[15px] text-[#1d1d1f]">Daily Logs</span>
              <span className="text-[13px] text-[#86868b]">
                {state.dailyLogs.length} days
              </span>
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-[15px] text-[#1d1d1f]">Storage</span>
              <span className="text-[13px] text-[#86868b]">
                Browser (localStorage)
              </span>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-white border border-[#ff3b30]/20 rounded-2xl overflow-hidden">
          <div className="p-5">
            <p className="text-[11px] font-semibold text-[#ff3b30] uppercase tracking-wide mb-4">
              Danger Zone
            </p>

            {!showResetConfirm ? (
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-3 rounded-xl border border-[#ff3b30]/20 text-[14px] font-medium text-[#ff3b30] hover:bg-[#ff3b30]/5 transition-apple"
              >
                Reset All Data
              </button>
            ) : (
              <div className="space-y-3 animate-slide-up">
                <p className="text-[13px] text-[#86868b] leading-relaxed">
                  This will permanently delete all your protocols, daily logs,
                  and settings. You&apos;ll start fresh from onboarding. This cannot
                  be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[#f5f5f7] text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#e8e8ed] transition-apple"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2.5 rounded-xl bg-[#ff3b30] text-[13px] font-semibold text-white hover:bg-[#e8342a] transition-apple"
                  >
                    Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-2">
          <p className="text-[11px] text-[#d2d2d7]">
            Protocolize v1.0 &middot; Made with science and care
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#1d1d1f] text-white text-[13px] font-medium px-5 py-3 rounded-full shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
    </Shell>
  );
}
