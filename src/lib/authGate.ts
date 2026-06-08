/**
 * authGate.ts — pure routing policy for the account wall.
 *
 * Kept separate from the AuthGate component so the allowlist logic is unit
 * testable without rendering React / mocking next/navigation.
 */

// Public, no-account-required routes. Everything else is behind the wall.
// `/auth` covers `/auth` and `/auth/reset`; `/` is the marketing landing;
// `/privacy` + `/terms` are legal pages a logged-out visitor must be able to
// read (and that app-store review will hit without signing in).
export const PUBLIC_PREFIXES = ["/auth", "/privacy", "/terms"] as const;

/** True when `pathname` may be viewed without a signed-in account. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}
