/**
 * Analytics.tsx — privacy-first, cookie-less site analytics via
 * Plausible (https://plausible.io). Env-gated and inert by default —
 * the owner sets NEXT_PUBLIC_PLAUSIBLE_DOMAIN to enable; without
 * that env var, this component renders nothing and no third-party
 * script loads.
 *
 * Why Plausible:
 *   - GDPR/CCPA/PECR-friendly (no cookies, no personal data, no
 *     cross-site tracking). Avoids the cookie banner requirement
 *     that a GA-class tracker forces.
 *   - <1 KB script, loaded async, no impact on Lighthouse.
 *   - Self-hostable later if the owner ever wants to move off
 *     plausible.io infrastructure.
 *
 * To enable:
 *   1. Sign up at plausible.io (or self-host).
 *   2. Add a site with the production domain.
 *   3. Set NEXT_PUBLIC_PLAUSIBLE_DOMAIN=protocolize.com in Vercel
 *      env vars and redeploy.
 *
 * Wired from layout.tsx so it loads on every route. The script
 * itself respects DNT (Do Not Track) and honors the user's
 * privacy preferences.
 */
import Script from "next/script";

export default function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
