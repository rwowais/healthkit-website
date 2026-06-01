"use client";

/**
 * GlobalSearch — one box to jump anywhere: protocols, behaviors, and the main
 * surfaces (Insights, Body trends, Supplements, a break…). Opens from the
 * header search icon into a Sheet. Pure client-side index over the catalog +
 * a curated destination list; selecting a result navigates and closes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { activePacks } from "@/lib/knowledge";
import { listBehaviorAtoms } from "@/lib/packs";
import { Sheet, Eyebrow } from "@/components/ui";
import { Icon, type IconName } from "@/components/ui/icons";

interface Hit {
  kind: "Protocol" | "Behavior" | "Go to";
  title: string;
  sub?: string;
  route: string;
  icon: IconName;
}

const PAGES: Hit[] = [
  { kind: "Go to", title: "Today", route: "/today", icon: "home" },
  { kind: "Go to", title: "Insights", sub: "Patterns from your data", route: "/insights", icon: "bulb" },
  { kind: "Go to", title: "Body trends", sub: "Weight, HRV, resting heart rate", route: "/biomarkers", icon: "pulse" },
  { kind: "Go to", title: "Supplements", sub: "Your stack", route: "/supplements", icon: "pill" },
  { kind: "Go to", title: "Discover protocols", sub: "Browse the full library", route: "/protocols#discover", icon: "compass" },
  { kind: "Go to", title: "Take a break", sub: "Pause everything", route: "/profile#break", icon: "moon" },
  { kind: "Go to", title: "Profile & settings", route: "/profile", icon: "user" },
];

export default function GlobalSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const index = useMemo<Hit[]>(() => {
    const packs: Hit[] = activePacks().map((p) => ({
      kind: "Protocol",
      title: p.name,
      sub: p.tagline,
      route: "/protocols#discover",
      icon: (p.icon as IconName) ?? "layers",
    }));
    const seen = new Set<string>();
    const behaviors: Hit[] = [];
    for (const a of listBehaviorAtoms()) {
      if (seen.has(a.title)) continue;
      seen.add(a.title);
      behaviors.push({
        kind: "Behavior",
        title: a.title,
        sub: a.fromOfficialPacks?.[0],
        route: "/protocols",
        icon: (a.icon as IconName) ?? "check",
      });
    }
    return [...PAGES, ...packs, ...behaviors];
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return PAGES;
    return index.filter(
      (h) =>
        h.title.toLowerCase().includes(query) ||
        (h.sub ?? "").toLowerCase().includes(query)
    );
  }, [q, index]);

  // Group + cap each group so a broad query doesn't return 80 rows.
  const groups = useMemo(() => {
    const order: Hit["kind"][] = ["Go to", "Protocol", "Behavior"];
    return order
      .map((kind) => ({
        kind,
        items: results.filter((h) => h.kind === kind).slice(0, 6),
      }))
      .filter((g) => g.items.length > 0);
  }, [results]);

  const go = (route: string) => {
    onClose();
    router.push(route);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Search">
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Protocols, behaviors, pages…"
        aria-label="Search the app"
        className="w-full rounded-[var(--r-sm)] bg-[var(--surface-2)] px-3.5 py-3 text-[15px] text-[var(--text-1)] outline-none placeholder:text-[var(--text-4)]"
      />
      <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto pb-2">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-[var(--text-3)]">
            Nothing matches &ldquo;{q}&rdquo;.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.kind}>
              <Eyebrow>{g.kind === "Go to" ? "Jump to" : g.kind}</Eyebrow>
              <div className="mt-2 space-y-1">
                {g.items.map((h) => (
                  <button
                    key={`${h.kind}-${h.title}`}
                    onClick={() => go(h.route)}
                    className="press tr-fast row flex w-full items-center gap-3.5 px-3.5 py-3 text-left"
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                      style={{ background: "var(--surface-3)", color: "var(--text-2)" }}
                    >
                      <Icon name={h.icon} size={16} stroke={1.7} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-[var(--text-1)]">
                        {h.title}
                      </span>
                      {h.sub && (
                        <span className="block truncate text-[12px] text-[var(--text-3)]">
                          {h.sub}
                        </span>
                      )}
                    </span>
                    <Icon name="chevron" size={13} className="shrink-0 text-[var(--text-4)]" />
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
}
