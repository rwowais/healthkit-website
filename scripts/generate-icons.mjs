#!/usr/bin/env node
/**
 * Generate PNG icons + iOS splash screens from the source SVG icons.
 *
 * Why this exists:
 *   PWAs need PNG icons in many specific sizes (Android adaptive
 *   icons, iOS home-screen icons, various manifest sizes). iOS Safari
 *   ALSO needs apple-touch-icon as PNG — SVG isn't honored. Splash
 *   screens are even pickier: Apple wants an exact-pixel PNG per
 *   device size, otherwise users see a white flash on launch.
 *
 *   Rather than commit dozens of pre-rendered PNGs (which drift from
 *   the SVG source whenever we update brand), this script re-renders
 *   everything from public/icon.svg + public/icon-maskable.svg in one
 *   command:
 *
 *     node scripts/generate-icons.mjs
 *
 *   Run it whenever the source icons change. Outputs land in
 *   public/icons/ and public/splash/ — both git-tracked so Vercel
 *   serves them statically.
 */
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PUB = new URL("../public/", import.meta.url).pathname;
const ICONS_DIR = join(PUB, "icons");
const SPLASH_DIR = join(PUB, "splash");

await mkdir(ICONS_DIR, { recursive: true });
await mkdir(SPLASH_DIR, { recursive: true });

const iconSvg = await readFile(join(PUB, "icon.svg"));
const maskSvg = await readFile(join(PUB, "icon-maskable.svg"));

// ── App icons ─────────────────────────────────────────────────────
// PWA standard sizes + iOS apple-touch-icon. The "any" variants use
// the standard icon (rounded corners visible); the "maskable" variants
// use the padded icon so Android can apply its own mask shape (circle,
// squircle, rounded square) without clipping the artwork.
const ICON_SIZES = [
  { size: 48, name: "icon-48.png", src: iconSvg },
  { size: 72, name: "icon-72.png", src: iconSvg },
  { size: 96, name: "icon-96.png", src: iconSvg },
  { size: 128, name: "icon-128.png", src: iconSvg },
  { size: 144, name: "icon-144.png", src: iconSvg },
  { size: 152, name: "icon-152.png", src: iconSvg },
  { size: 167, name: "icon-167.png", src: iconSvg }, // iPad Pro
  { size: 180, name: "icon-180.png", src: iconSvg }, // apple-touch-icon
  { size: 192, name: "icon-192.png", src: iconSvg },
  { size: 256, name: "icon-256.png", src: iconSvg },
  { size: 384, name: "icon-384.png", src: iconSvg },
  { size: 512, name: "icon-512.png", src: iconSvg },
  // Maskable — used by Android adaptive icons. Safe area = central 80%.
  { size: 192, name: "maskable-192.png", src: maskSvg },
  { size: 512, name: "maskable-512.png", src: maskSvg },
];

console.log("Generating app icons...");
for (const { size, name, src } of ICON_SIZES) {
  await sharp(src)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(ICONS_DIR, name));
  console.log(`  ${name} (${size}x${size})`);
}

// ── iOS splash screens ────────────────────────────────────────────
// Apple requires EXACT pixel dimensions per device family. Without
// these, iOS shows a white flash on PWA launch instead of branded
// splash. Background matches the manifest theme color so the splash
// blends into the app's first paint.
//
// Strategy: render the icon centered on a dark background at each
// device's exact native resolution. The icon stays small (~30% of
// shorter edge) so it looks centered, not stretched.
const BG = "#08090B";
const SPLASH_SIZES = [
  // iPhone
  { w: 1290, h: 2796, name: "iphone-6.7.png" },  // 15/16 Pro Max
  { w: 1179, h: 2556, name: "iphone-6.1.png" },  // 15/16
  { w: 1284, h: 2778, name: "iphone-6.5.png" },  // 14/13/12 Pro Max
  { w: 1170, h: 2532, name: "iphone-6.1-legacy.png" }, // 14/13/12
  { w: 1080, h: 2340, name: "iphone-6.1-mini.png" }, // 13 mini
  { w: 828, h: 1792, name: "iphone-xr.png" },     // XR / 11
  { w: 750, h: 1334, name: "iphone-se.png" },     // SE / 8 / 7
  // iPad
  { w: 2048, h: 2732, name: "ipad-pro-12.9.png" },
  { w: 1668, h: 2388, name: "ipad-pro-11.png" },
  { w: 1640, h: 2360, name: "ipad-air.png" },
  { w: 1620, h: 2160, name: "ipad-10.png" },
  { w: 1536, h: 2048, name: "ipad-9.7.png" },
];

console.log("\nGenerating iOS splash screens...");
for (const { w, h, name } of SPLASH_SIZES) {
  // Render the icon at a reasonable size (about 30% of shorter edge).
  const iconSize = Math.round(Math.min(w, h) * 0.3);
  const iconPng = await sharp(iconSvg)
    .resize(iconSize, iconSize)
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: iconPng, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(join(SPLASH_DIR, name));
  console.log(`  ${name} (${w}x${h})`);
}

// ── Generate a favicon.ico (32x32 PNG inside .ico shell) ──────────
// Browsers still ask for /favicon.ico even with newer link rels.
// Writing a 32x32 PNG ICO covers desktop browser tabs + bookmarks.
console.log("\nGenerating favicon...");
const fav = await sharp(iconSvg).resize(32, 32).png().toBuffer();
await writeFile(join(PUB, "favicon-32.png"), fav);
console.log("  favicon-32.png");

console.log("\nDone. Re-run when icon source SVGs change.");
