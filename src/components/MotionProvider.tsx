"use client";

/**
 * App-wide motion governor. framer-motion animations are driven in JS
 * (requestAnimationFrame → inline transforms), so they bypass the CSS
 * `@media (prefers-reduced-motion)` block in globals.css entirely. This
 * wraps the tree in MotionConfig with `reducedMotion="user"`, which makes
 * every <motion.*> component honor the OS "Reduce Motion" setting —
 * suppressing transform/layout animation while keeping opacity fades —
 * without having to touch each animation call site.
 */
import { MotionConfig } from "framer-motion";

export default function MotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
