"use client";

import { useEffect } from "react";
import { watchSystemTheme } from "@/lib/theme";

/**
 * Mounts the OS light/dark listener so a "System" theme preference updates
 * live while the app is open (not just on reload). Renders nothing.
 */
export default function ThemeWatcher() {
  useEffect(() => watchSystemTheme(), []);
  return null;
}
