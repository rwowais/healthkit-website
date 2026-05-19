"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icons";

/** Calm upgrade card — used at free-tier caps. Never a hard wall. */
export function UpgradeCTA({
  title,
  line,
}: {
  title: string;
  line: string;
}) {
  const router = useRouter();
  return (
    <div
      className="relative overflow-hidden rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surface-2)" }}
    >
      <span
        className="ambient"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, color-mix(in srgb, var(--readiness) 16%, transparent), transparent 60%)",
        }}
      />
      <div className="relative flex items-start gap-3.5">
        <span
          className="chip h-10 w-10 shrink-0"
          style={{
            background:
              "color-mix(in srgb, var(--readiness) 16%, var(--surface-3))",
            color: "var(--readiness)",
          }}
        >
          <Icon name="bulb" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold text-[var(--text-1)]">
            {title}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-3)]">
            {line}
          </p>
          <button
            onClick={() => router.push("/upgrade")}
            className="press tr-fast mt-3 rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2.5 text-[13px] font-semibold text-[#08090B]"
          >
            See Premium
          </button>
        </div>
      </div>
    </div>
  );
}

/** Peek: show the real value blurred with one true teaser line + CTA. */
export function PremiumPeek({
  teaser,
  children,
}: {
  teaser: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div className="relative overflow-hidden rounded-[var(--r-lg)]">
      <div
        aria-hidden
        className="pointer-events-none select-none"
        style={{ filter: "blur(7px)", opacity: 0.5 }}
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-[280px] text-[14px] font-medium leading-relaxed text-[var(--text-1)]">
          {teaser}
        </p>
        <button
          onClick={() => router.push("/upgrade")}
          className="press tr-fast rounded-[var(--r-pill)] bg-[var(--text-1)] px-5 py-2.5 text-[13px] font-semibold text-[#08090B]"
        >
          Unlock with Premium
        </button>
      </div>
    </div>
  );
}
