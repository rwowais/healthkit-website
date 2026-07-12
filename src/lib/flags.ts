/**
 * Build-time feature flags. Flip a value (+ redeploy) to turn a whole feature
 * surface on or off across the app, without ripping the code out.
 */

/**
 * Biomarkers / "Body Trends" — HIDDEN from users for now (2026-06-13, founder
 * call). The feature needs clinical-threshold + UX work before it's ready, so
 * every user-facing entry point and display is gated off while we keep building.
 *
 * Reversible by design: the engine, the /biomarkers page, and any data users
 * already logged are all left intact — flip this back to `true` and the feature
 * returns with history. Surfaces gated on this flag:
 *   • Profile "Body Trends" card        (src/app/profile/page.tsx)
 *   • Global search "Body trends" entry (src/components/GlobalSearch.tsx)
 *   • /biomarkers route                 (redirects to /profile when off)
 *   • Insights biomarker attention note + ForecastCard + the Body-Trends CTA
 *   • The "Body metric" goal type       (src/components/GoalsCard.tsx)
 *   • The /upgrade "Biomarker-aware adaptation" value prop
 */
export const BIOMARKERS_ENABLED = false;

/**
 * Pre-launch simplification (2026-07-12, founder call): hide power-user /
 * not-yet-real Profile sections. All reversible — flip to `true` to restore.
 */
// "Day blocks" rename/re-time editor (power-user; night-shift escape hatch).
export const DAY_BLOCKS_ENABLED = false;
// "Weekly goal" active-days target + its ring on Today.
export const WEEKLY_GOAL_ENABLED = false;
// Wearable integrations list — everything is "Soon"; don't advertise vaporware.
export const INTEGRATIONS_ENABLED = false;
