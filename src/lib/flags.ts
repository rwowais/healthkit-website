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
