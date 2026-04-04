"use client";

import { useState } from "react";
import Shell from "@/components/Shell";
import { meals } from "@/lib/meals";
import type { MealIdea } from "@/lib/types";

const mealTypes = ["all", "breakfast", "lunch", "dinner", "snack", "dessert"] as const;

const typeColors: Record<string, string> = {
  breakfast: "#ff9f0a",
  lunch: "#30d158",
  dinner: "#5e5ce6",
  snack: "#0071e3",
  dessert: "#ff453a",
};

const typeIcons: Record<string, string> = {
  breakfast: "sunrise",
  lunch: "sun",
  dinner: "moon",
  snack: "coffee",
  dessert: "heart",
};

function MacroBar({
  label,
  value,
  max,
  color,
  unit,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  unit: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-[#86868b]">{label}</span>
        <span className="text-[#1d1d1f] font-medium">
          {value}
          {unit}
        </span>
      </div>
      <div className="h-1.5 bg-[#d2d2d7]/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function MealsPage() {
  const [activeType, setActiveType] = useState<string>("all");
  const [premiumToast, setPremiumToast] = useState(false);

  function handlePremiumClick() {
    setPremiumToast(true);
    setTimeout(() => setPremiumToast(false), 3000);
  }

  const filtered = activeType === "all"
    ? meals
    : meals.filter((m) => m.type === activeType);

  return (
    <Shell>
      {/* Hero */}
      <div className="mb-10">
        <h1 className="text-[32px] font-bold tracking-tight text-[#1d1d1f] mb-2">
          Meal Library
        </h1>
        <p className="text-[17px] text-[#86868b]">
          High-protein, whole-food meals optimized for performance and longevity.
        </p>
      </div>

      {/* Type Filter */}
      <div className="flex flex-wrap gap-2 mb-8">
        {mealTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-apple capitalize ${
              activeType === type
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#fbfbfd] border border-[#d2d2d7]/30 text-[#86868b] hover:text-[#1d1d1f]"
            }`}
          >
            {type === "all" ? "All" : type}
          </button>
        ))}
      </div>

      {/* Meal Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((meal) => {
          const isPremium = meal.tier === "premium";
          const typeColor = typeColors[meal.type] || "#86868b";

          return (
            <div
              key={meal.id}
              className="bg-[#fbfbfd] border border-[#d2d2d7]/30 rounded-2xl p-5 flex flex-col transition-apple hover:shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
                    style={{
                      backgroundColor: typeColor + "18",
                      color: typeColor,
                    }}
                  >
                    {meal.type}
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

              <h3 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">
                {meal.name}
              </h3>

              {isPremium ? (
                /* Locked state for premium meals */
                <div className="flex-1 flex flex-col">
                  <div className="relative flex-1 mb-4">
                    <div className="space-y-2 select-none blur-[6px] pointer-events-none" aria-hidden="true">
                      <div className="h-3 w-3/4 bg-[#d2d2d7]/40 rounded" />
                      <div className="h-3 w-1/2 bg-[#d2d2d7]/40 rounded" />
                      <div className="h-3 w-2/3 bg-[#d2d2d7]/40 rounded" />
                      <div className="h-3 w-1/2 bg-[#d2d2d7]/40 rounded" />
                      <div className="mt-4 space-y-2">
                        <div className="h-1.5 bg-[#d2d2d7]/20 rounded-full" />
                        <div className="h-1.5 bg-[#d2d2d7]/20 rounded-full" />
                        <div className="h-1.5 bg-[#d2d2d7]/20 rounded-full" />
                      </div>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="text-[#af52de]/30"
                      >
                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                      </svg>
                    </div>
                  </div>
                  <button
                    onClick={handlePremiumClick}
                    className="w-full py-2.5 rounded-full text-[13px] font-semibold transition-apple bg-[#af52de]/10 text-[#af52de] hover:bg-[#af52de]/20 flex items-center justify-center gap-1.5"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
                    </svg>
                    Unlock with Premium
                  </button>
                </div>
              ) : (
                <>
                  {/* Ingredients */}
                  <div className="mb-4 flex-1">
                    <p className="text-[11px] font-medium text-[#86868b] uppercase tracking-wide mb-1.5">
                      Ingredients
                    </p>
                    <ul className="space-y-0.5">
                      {meal.ingredients.map((ing, i) => (
                        <li
                          key={i}
                          className="text-[13px] text-[#1d1d1f] flex items-start gap-1.5"
                        >
                          <span className="w-1 h-1 rounded-full bg-[#d2d2d7] mt-1.5 shrink-0" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Macro Bars */}
                  <div className="space-y-2 mb-4">
                    <MacroBar
                      label="Protein"
                      value={meal.macros.protein}
                      max={60}
                      color="#0071e3"
                      unit="g"
                    />
                    <MacroBar
                      label="Carbs"
                      value={meal.macros.carbs}
                      max={80}
                      color="#ff9f0a"
                      unit="g"
                    />
                    <MacroBar
                      label="Fat"
                      value={meal.macros.fat}
                      max={40}
                      color="#ff453a"
                      unit="g"
                    />
                    <div className="flex items-center justify-between text-[12px] pt-1 border-t border-[#d2d2d7]/20">
                      <span className="text-[#86868b]">Calories</span>
                      <span className="text-[#1d1d1f] font-semibold">
                        {meal.macros.calories} kcal
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {meal.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[#86868b]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#86868b] text-[15px]">
            No meals match your filter.
          </p>
        </div>
      )}

      <div className="h-20 lg:hidden" />

      {/* Premium Toast */}
      {premiumToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1d1d1f] text-white px-5 py-3 rounded-2xl shadow-lg text-[13px] font-medium flex items-center gap-2 animate-fade-in">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-[#af52de]"
          >
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
          </svg>
          Premium subscription coming soon
        </div>
      )}
    </Shell>
  );
}
