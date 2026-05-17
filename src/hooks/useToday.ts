"use client";

import { useEffect, useState } from "react";

interface UseTodayReturn {
  dateString: string; // "YYYY-MM-DD"
  displayDate: string; // "Saturday, May 17"
  dayOfWeek: number; // 0=Mon, 6=Sun
}

function getToday(): UseTodayReturn {
  const now = new Date();

  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const dateString = `${y}-${m}-${d}`;

  const displayDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Convert JS day (0=Sun, 6=Sat) to ISO day (0=Mon, 6=Sun)
  const jsDay = now.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  return { dateString, displayDate, dayOfWeek };
}

export function useToday(): UseTodayReturn {
  const [today, setToday] = useState<UseTodayReturn>(getToday);

  useEffect(() => {
    // Recalculate in case component was hydrated on a different day
    setToday(getToday());

    // Check for day change every 60 seconds
    const interval = setInterval(() => {
      const current = getToday();
      setToday((prev) => {
        if (prev.dateString !== current.dateString) return current;
        return prev;
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  return today;
}
