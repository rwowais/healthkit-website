/**
 * shareCard.ts — render a branded 1080×1080 progress image to a canvas and
 * offer it via the Web Share API (with the PNG), falling back to a download.
 * No dependencies. Shared by the Insights "share your progress" card and the
 * Today milestone moment so the visual identity stays consistent.
 *
 * Guarded throughout: if canvas / share is unavailable, it no-ops rather than
 * throwing. Must be called from a user gesture for navigator.share to work.
 */
export interface ShareCardOpts {
  /** The hero number/word, drawn large (e.g. "22", "30"). */
  big: string;
  /** Caption under the hero (e.g. "active days in the last month"). */
  label: string;
  /** Optional smaller line under the caption. */
  sub?: string;
  /** Download filename + share title. */
  filename?: string;
  title?: string;
}

export async function shareCardImage(opts: ShareCardOpts): Promise<void> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const F = "system-ui, -apple-system, 'Segoe UI', sans-serif";
    const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
    bg.addColorStop(0, "#0E1014");
    bg.addColorStop(1, "#171A21");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1080);
    const glow = ctx.createRadialGradient(880, 200, 0, 880, 200, 760);
    glow.addColorStop(0, "rgba(134,217,156,0.22)");
    glow.addColorStop(1, "rgba(134,217,156,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.fillStyle = "#86D99C";
    ctx.font = `600 34px ${F}`;
    ctx.fillText("PROTOCOLIZE", 90, 140);
    ctx.fillStyle = "#F4F5F7";
    ctx.font = `800 240px ${F}`;
    ctx.fillText(opts.big, 84, 600);
    ctx.fillStyle = "#D6DAE0";
    ctx.font = `600 46px ${F}`;
    ctx.fillText(opts.label, 92, 678);
    if (opts.sub) {
      ctx.fillStyle = "#8A8F99";
      ctx.font = `400 36px ${F}`;
      ctx.fillText(opts.sub, 92, 762);
    }
    ctx.fillStyle = "#5A5F68";
    ctx.font = `400 30px ${F}`;
    ctx.fillText("your longevity operating system", 92, 1000);

    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob(res, "image/png")
    );
    if (!blob) return;
    const name = opts.filename ?? "protocolize-progress.png";
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: opts.title ?? "My progress" });
        return;
      } catch {
        /* cancelled / unsupported → download */
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    /* canvas/share unavailable — no-op */
  }
}
