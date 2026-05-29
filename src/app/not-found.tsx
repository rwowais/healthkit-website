/**
 * Styled 404. Without this, Next renders its unstyled default "404 — This
 * page could not be found" on a white background, which breaks the dark,
 * calm aesthetic and feels broken. Server component (static) — no client JS.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-8 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--text-4)]">
        404
      </p>
      <h2 className="mt-2 text-[18px] font-bold text-[var(--text-1)]">
        This page isn&rsquo;t here
      </h2>
      <p className="mt-2.5 max-w-[320px] text-[14px] leading-relaxed text-[var(--text-3)]">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <Link
        href="/today"
        className="press tr-fast mt-5 rounded-[var(--r-pill)] bg-[var(--text-1)] px-6 py-3 text-[13px] font-semibold text-[#08090B]"
      >
        Go to Today
      </Link>
    </div>
  );
}
