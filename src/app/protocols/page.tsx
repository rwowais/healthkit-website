"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import { protocols, categoryInfo } from "@/lib/protocols";
import { loadRoutine, addProtocol, removeProtocol } from "@/lib/storage";
import type { UserRoutine, Category, Difficulty } from "@/lib/types";

const categories: Category[] = ["sleep", "exercise", "diet", "supplements"];
const difficulties: Difficulty[] = ["easy", "moderate", "advanced"];
const sources = ["Attia", "Huberman"];

const difficultyColors: Record<Difficulty, string> = {
  easy: "bg-[#30d158]/10 text-[#30d158]",
  moderate: "bg-[#ff9f0a]/10 text-[#ff9f0a]",
  advanced: "bg-[#ff453a]/10 text-[#ff453a]",
};

export default function ProtocolsPage() {
  const [routine, setRoutine] = useState<UserRoutine | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [filterDifficulty, setFilterDifficulty] = useState<Difficulty | "all">("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  useEffect(() => {
    setRoutine(loadRoutine());
  }, []);

  if (!routine) return null;

  const selectedIds = new Set(routine.selectedProtocols.map((sp) => sp.protocolId));

  const filtered = protocols.filter((p) => {
    if (activeCategory !== "all" && p.category !== activeCategory) return false;
    if (filterDifficulty !== "all" && p.difficulty !== filterDifficulty) return false;
    if (filterSource !== "all" && !p.recommendedBy.includes(filterSource)) return false;
    return true;
  });

  function handleToggle(protocolId: string) {
    if (selectedIds.has(protocolId)) {
      const updated = removeProtocol(protocolId);
      setRoutine({ ...updated });
    } else {
      const updated = addProtocol(protocolId);
      setRoutine({ ...updated });
    }
  }

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-2">
          Protocols
        </h1>
        <p className="text-[17px] text-[#86868b]">
          Evidence-based habits for longevity, curated from leading experts.
        </p>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-2 rounded-full text-[13px] font-medium transition-apple ${
            activeCategory === "all"
              ? "bg-[#1d1d1f] text-white"
              : "bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[#86868b] hover:text-[#1d1d1f]"
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-apple flex items-center gap-1.5 ${
              activeCategory === cat
                ? "text-white"
                : "bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[#86868b] hover:text-[#1d1d1f]"
            }`}
            style={
              activeCategory === cat
                ? { backgroundColor: categoryInfo[cat].color }
                : undefined
            }
          >
            <span>{categoryInfo[cat].icon}</span>
            {categoryInfo[cat].label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8">
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value as Difficulty | "all")}
          className="px-3 py-1.5 rounded-full text-[13px] bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[#1d1d1f] outline-none cursor-pointer"
        >
          <option value="all">All Difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="px-3 py-1.5 rounded-full text-[13px] bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[#1d1d1f] outline-none cursor-pointer"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Protocol Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const isAdded = selectedIds.has(p.id);
          const isPremium = p.tier === "premium";
          const catColor = categoryInfo[p.category].color;

          return (
            <div
              key={p.id}
              className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 flex flex-col transition-apple hover:shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: catColor + "18",
                      color: catColor,
                    }}
                  >
                    {p.subcategory}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${difficultyColors[p.difficulty]}`}
                  >
                    {p.difficulty}
                  </span>
                  {isPremium && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#af52de]/10 text-[#af52de] flex items-center gap-1">
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                      </svg>
                      Premium
                    </span>
                  )}
                </div>
              </div>

              <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-1.5">
                {p.name}
              </h3>
              <p className="text-[13px] text-[#86868b] leading-relaxed mb-3 flex-1">
                {p.description}
              </p>

              <div className="flex items-center gap-3 mb-4 text-[12px] text-[#86868b]">
                {p.frequency && (
                  <span className="flex items-center gap-1">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                    {p.frequency}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  {p.recommendedBy.join(" & ")}
                </span>
              </div>

              <button
                onClick={() => handleToggle(p.id)}
                className={`w-full py-2.5 rounded-full text-[13px] font-semibold transition-apple ${
                  isAdded
                    ? "bg-[#30d158]/10 text-[#30d158] hover:bg-[#ff453a]/10 hover:text-[#ff453a]"
                    : "bg-[#0071e3] text-white hover:bg-[#0077ed]"
                }`}
              >
                {isAdded ? "\u2713 Added" : "+ Add to Routine"}
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#86868b] text-[15px]">
            No protocols match your filters.
          </p>
        </div>
      )}

      <div className="h-20 lg:hidden" />
    </Shell>
  );
}
