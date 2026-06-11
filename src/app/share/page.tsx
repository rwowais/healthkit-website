"use client";

/**
 * /share — landing route for the Web Share Target.
 *
 * When the user shares something to Protocolize from another app
 * (e.g. tapping Share → Protocolize on a PDF, link, or selected
 * text), the OS opens this URL with `title`, `text`, and/or `url`
 * as query parameters. We then offer to file the content where it
 * makes sense.
 *
 * Pragmatic V1: we surface the content and offer two destinations:
 *   1. Attach as a NOTE on the most-recent biomarker entry (useful
 *      for clipping a lab result PDF link or commentary)
 *   2. Save as a new custom behavior (reminder) the user can edit
 *
 * Out of scope for V1 (later):
 *   - File uploads (PDFs, images) via `share_target.method: "POST"`
 *     and enctype "multipart/form-data" — we'd need a parser route
 *   - Direct biomarker-value parsing — opens up "is this lipid panel
 *     numbers?" territory that's a feature in its own right
 *
 * Privacy: nothing is auto-saved. The user has to confirm a
 * destination, so a stray share doesn't write to their data.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Shell from "@/components/Shell";
import { Card, Eyebrow, Button, useToast } from "@/components/ui";
import { useAppState } from "@/hooks/useAppState";

function ShareInner() {
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { state, upsertCustomPack } = useAppState();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!search) return;
    setTitle(search.get("title") ?? "");
    setText(search.get("text") ?? "");
    setUrl(search.get("url") ?? "");
  }, [search]);

  const empty = !title && !text && !url;

  // Try to detect "this looks like a URL" so we can offer the
  // right primary action — most shares from Mail/Safari are links
  // to a lab result PDF or research article.
  const looksLikeUrl =
    !!url ||
    /^https?:\/\//i.test(text.trim()) ||
    /^https?:\/\//i.test(title.trim());

  const composite = [title, text, url].filter(Boolean).join("\n\n").trim();

  // Save as a custom-pack note behavior. Creates (or appends to) a
  // pack called "Saved from Share" so the user has one place to
  // find all shared content. The new behavior carries the shared
  // text as both title (truncated) and rationale (full text).
  function saveAsBehavior() {
    if (empty) {
      toast.show("Nothing to save");
      return;
    }
    const ts = Date.now();
    const packId = "shared-clippings";
    const existingPack = state.customPacks.find((p) => p.id === packId);
    const newBehavior = {
      canonicalKey: `custom:${packId}:share-${ts.toString(36)}`,
      title:
        (title || text || url).slice(0, 60) +
        (((title || text || url).length ?? 0) > 60 ? "…" : ""),
      block: "anytime" as const,
      anchor: "wake" as const,
      offsetMin: 0,
      rationale: composite || "Shared content",
      icon: "sparkle",
      leverage: 1 as const,
      kind: "action" as const,
    };
    if (existingPack) {
      upsertCustomPack({
        ...existingPack,
        behaviors: [...existingPack.behaviors, newBehavior],
      });
    } else {
      upsertCustomPack({
        id: packId,
        name: "Saved from Share",
        tagline: "Things you shared into Protocolize",
        goal: "custom",
        accent: "var(--warm)",
        icon: "sparkle",
        source: "custom",
        durationLabel: "Ongoing",
        behaviors: [newBehavior],
      });
      // upsertCustomPack auto-installs the pack, so it surfaces immediately.
    }
    toast.show("Saved to your clippings");
    router.push("/protocols");
  }

  function openUrlExternally() {
    const target =
      url ||
      ((text.match(/https?:\/\/\S+/) || [])[0] ?? "") ||
      ((title.match(/https?:\/\/\S+/) || [])[0] ?? "");
    // The `url` share-target param is attacker-controlled (any app/site can
    // invoke the share target) — without a scheme check, javascript:/data:
    // URLs reached the click sink (audit round 2). Allow http(s) only.
    if (!target) return;
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return;
    } catch {
      return;
    }
    window.open(target, "_blank", "noopener,noreferrer");
  }

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <div>
          <Eyebrow>Shared with Protocolize</Eyebrow>
          <h1 className="t-title mt-2 text-[var(--text-1)]">
            Where should this land?
          </h1>
          <p className="t-caption mt-2 leading-relaxed">
            We won&apos;t save anything until you choose a destination.
          </p>
        </div>

        <Card>
          <Eyebrow>What you shared</Eyebrow>
          {empty ? (
            <p className="t-body mt-2.5 text-[var(--text-3)]">
              Nothing came through. Go back to the app you were in and
              try the Share menu again.
            </p>
          ) : (
            <div className="mt-2.5 space-y-2">
              {title && (
                <p className="text-[14px] font-semibold text-[var(--text-1)]">
                  {title}
                </p>
              )}
              {text && (
                <p className="text-[13.5px] leading-relaxed text-[var(--text-2)] whitespace-pre-wrap">
                  {text}
                </p>
              )}
              {url && (
                <p className="text-[12.5px] text-[var(--readiness)] break-all">
                  {url}
                </p>
              )}
            </div>
          )}
        </Card>

        {!empty && (
          <div className="flex flex-col gap-2.5">
            {looksLikeUrl && (
              <Button onClick={openUrlExternally} full>
                Open the link
              </Button>
            )}
            <Button onClick={saveAsBehavior} full variant="ghost">
              Save to my clippings
            </Button>
            <Link
              href="/today"
              className="press tr-fast w-full rounded-[var(--r-pill)] py-3 text-center text-[13px] font-medium text-[var(--text-3)]"
            >
              Cancel
            </Link>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default function SharePage() {
  // Next 16 requires Suspense around useSearchParams.
  return (
    <Suspense
      fallback={
        <Shell>
          <div className="flex flex-col gap-4">
            <p className="t-eyebrow">Shared with Protocolize</p>
          </div>
        </Shell>
      }
    >
      <ShareInner />
    </Suspense>
  );
}
