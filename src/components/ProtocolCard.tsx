"use client";

import { Protocol } from "@/lib/types";

const difficultyColors: Record<string, string> = {
  easy: "bg-emerald-500/20 text-emerald-400",
  moderate: "bg-amber-500/20 text-amber-400",
  advanced: "bg-red-500/20 text-red-400",
};

const categoryColors: Record<string, string> = {
  sleep: "border-l-indigo-400",
  exercise: "border-l-red-400",
  diet: "border-l-emerald-400",
  supplements: "border-l-amber-400",
};

export default function ProtocolCard({
  protocol,
  isSelected,
  onToggle,
}: {
  protocol: Protocol;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`relative bg-[#12121a] rounded-xl border-l-4 ${
        categoryColors[protocol.category]
      } p-5 transition-all hover:bg-[#1a1a25] ${
        isSelected ? "ring-1 ring-white/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="font-semibold text-white text-sm">
              {protocol.name}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                difficultyColors[protocol.difficulty]
              }`}
            >
              {protocol.difficulty}
            </span>
          </div>
          <p className="text-[#6b6b80] text-sm leading-relaxed mb-3">
            {protocol.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-[#6b6b80]">
            <span className="bg-white/5 px-2 py-1 rounded">
              {protocol.subcategory}
            </span>
            {protocol.frequency && (
              <span className="bg-white/5 px-2 py-1 rounded">
                {protocol.frequency}
              </span>
            )}
            <span>
              {protocol.recommendedBy.map((r) => (
                <span
                  key={r}
                  className="inline-block bg-white/5 px-2 py-1 rounded mr-1"
                >
                  {r}
                </span>
              ))}
            </span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all ${
            isSelected
              ? "bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400"
              : "bg-white/5 text-[#6b6b80] hover:bg-emerald-500/20 hover:text-emerald-400"
          }`}
          title={isSelected ? "Remove from routine" : "Add to routine"}
        >
          {isSelected ? "✓" : "+"}
        </button>
      </div>
    </div>
  );
}
