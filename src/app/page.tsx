"use client";

import { useState, useEffect } from "react";
import Shell from "@/components/Shell";
import ProtocolCard from "@/components/ProtocolCard";
import { protocols, categoryInfo } from "@/lib/protocols";
import { Category } from "@/lib/types";
import { loadRoutine, addProtocol, removeProtocol } from "@/lib/storage";

const categories: Category[] = ["sleep", "exercise", "diet", "supplements"];

export default function BrowsePage() {
  const [activeCategory, setActiveCategory] = useState<Category>("sleep");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");

  useEffect(() => {
    const routine = loadRoutine();
    setSelectedIds(new Set(routine.selectedProtocols.map((p) => p.protocolId)));
  }, []);

  const filtered = protocols
    .filter((p) => p.category === activeCategory)
    .filter(
      (p) => filterDifficulty === "all" || p.difficulty === filterDifficulty
    )
    .filter(
      (p) =>
        filterSource === "all" || p.recommendedBy.includes(filterSource)
    );

  function handleToggle(protocolId: string) {
    if (selectedIds.has(protocolId)) {
      removeProtocol(protocolId);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(protocolId);
        return next;
      });
    } else {
      addProtocol(protocolId);
      setSelectedIds((prev) => new Set(prev).add(protocolId));
    }
  }

  const totalSelected = selectedIds.size;

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Build Your{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            Longevity Routine
          </span>
        </h1>
        <p className="text-[#6b6b80] text-lg max-w-2xl">
          Evidence-based protocols from Peter Attia and Andrew Huberman. Pick
          the ones that fit your life, plan your weeks, and track your progress.
        </p>
        {totalSelected > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg text-sm">
            <span className="font-semibold">{totalSelected}</span> protocols
            selected
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const info = categoryInfo[cat];
          const count = protocols.filter((p) => p.category === cat).length;
          const selectedCount = protocols.filter(
            (p) => p.category === cat && selectedIds.has(p.id)
          ).length;
          const active = activeCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                active
                  ? "bg-white/10 text-white ring-1 ring-white/10"
                  : "bg-[#12121a] text-[#6b6b80] hover:bg-[#1a1a25] hover:text-white"
              }`}
            >
              <span>{info.icon}</span>
              <span>{info.label}</span>
              <span className="text-xs opacity-60">
                {selectedCount}/{count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          value={filterDifficulty}
          onChange={(e) => setFilterDifficulty(e.target.value)}
          className="bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e8e8ed] focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <option value="all">All difficulties</option>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="advanced">Advanced</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="bg-[#12121a] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#e8e8ed] focus:outline-none focus:ring-1 focus:ring-white/20"
        >
          <option value="all">All sources</option>
          <option value="Attia">Peter Attia</option>
          <option value="Huberman">Andrew Huberman</option>
        </select>
      </div>

      {/* Category Description */}
      <p className="text-[#6b6b80] text-sm mb-6">
        {categoryInfo[activeCategory].description}
      </p>

      {/* Protocol Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filtered.map((protocol) => (
          <ProtocolCard
            key={protocol.id}
            protocol={protocol}
            isSelected={selectedIds.has(protocol.id)}
            onToggle={() => handleToggle(protocol.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-[#6b6b80]">
          <p className="text-lg">No protocols match your filters.</p>
          <p className="text-sm mt-1">Try adjusting the filters above.</p>
        </div>
      )}

      <div className="h-20 md:hidden" />
    </Shell>
  );
}
