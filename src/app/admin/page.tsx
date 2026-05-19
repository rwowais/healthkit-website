"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { activePacks, activeBundleVersion } from "@/lib/knowledge";
import { Eyebrow, Skeleton } from "@/components/ui";

type Gate = "checking" | "denied" | "ok";

export default function AdminHome() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("checking");

  useEffect(() => {
    let alive = true;
    isAdmin().then((ok) => {
      if (!alive) return;
      setGate(ok ? "ok" : "denied");
      if (!ok) setTimeout(() => router.replace("/today"), 1400);
    });
    return () => {
      alive = false;
    };
  }, [router]);

  if (gate === "checking")
    return (
      <div className="mx-auto max-w-[680px] px-6 py-16">
        <Skeleton className="h-6 w-40" rounded="rounded-full" />
        <Skeleton className="mt-5 h-40 w-full" />
      </div>
    );

  if (gate === "denied")
    return (
      <div className="mx-auto flex max-w-[680px] flex-col items-center px-6 py-24 text-center">
        <p className="t-section text-[var(--text-1)]">Not authorized</p>
        <p className="t-caption mt-2">
          This is an internal area. Returning you to the app…
        </p>
      </div>
    );

  const packs = activePacks();
  const behaviors = new Set(
    packs.flatMap((p) => p.behaviors.map((b) => b.canonicalKey))
  ).size;

  const sections: { label: string; status: string }[] = [
    { label: "Protocols & behaviors", status: "Browse (P2)" },
    { label: "Adaptation rules", status: "Browse (P2)" },
    { label: "Insight & recommendation templates", status: "Browse (P2)" },
    { label: "Evidence tiers", status: "Browse (P2)" },
    { label: "Intelligence config", status: "Browse (P2)" },
    { label: "Simulate timeline / adaptation", status: "P2" },
    { label: "Editing · versions · rollback", status: "P3" },
    { label: "Publish bundle (diff vs live)", status: "P3" },
    { label: "AI suggestion review", status: "P4" },
  ];

  return (
    <div className="mx-auto max-w-[680px] px-6 py-12">
      <Eyebrow color="var(--readiness)">Internal · Protocol Intelligence</Eyebrow>
      <h1 className="t-title mt-2 text-[var(--text-1)]">Knowledge CMS</h1>
      <p className="t-caption mt-2 leading-relaxed">
        Authoring layer for protocol intelligence. The live app runs on
        the built-in catalog until a reviewed bundle is published —
        nothing here affects users yet.
      </p>

      <div className="mt-7 grid grid-cols-3 gap-3">
        {[
          { k: "Protocols", v: packs.length },
          { k: "Behaviors", v: behaviors },
          { k: "Live bundle", v: `v${activeBundleVersion()}` },
        ].map((s) => (
          <div
            key={s.k}
            className="rounded-[var(--r-md)] p-4"
            style={{ background: "var(--surface-2)" }}
          >
            <p className="text-[22px] font-bold text-[var(--text-1)]">
              {s.v}
            </p>
            <p className="t-caption mt-1">{s.k}</p>
          </div>
        ))}
      </div>

      <div className="mt-7">
        <Eyebrow>Sections</Eyebrow>
        <div className="well mt-3 space-y-1.5 p-1.5">
          {sections.map((s) => (
            <div
              key={s.label}
              className="row flex items-center justify-between px-4 py-3"
            >
              <span className="text-[14px] font-medium text-[var(--text-1)]">
                {s.label}
              </span>
              <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-3)]">
                {s.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-8 text-center text-[11px] text-[var(--text-4)]">
        Protocolize · internal · build{" "}
        {process.env.NEXT_PUBLIC_BUILD ?? "dev"}
      </p>
    </div>
  );
}
