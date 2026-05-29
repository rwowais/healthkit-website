import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import SyncConflictPrompt from "@/components/SyncConflictPrompt";
import ErrorBoundary from "@/components/ErrorBoundary";
import StorageSafetyNet from "@/components/StorageSafetyNet";
import TimezoneSentry from "@/components/TimezoneSentry";
import InstallPrompt from "@/components/InstallPrompt";
import Analytics from "@/components/Analytics";
import MotionProvider from "@/components/MotionProvider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://protocolize.com"
  ),
  title: "Protocolize — Longevity Intelligence",
  description:
    "Your adaptive daily protocol. Track behaviors, biomarkers, and the calm intelligence layer that shapes your longevity routine.",
  applicationName: "Protocolize",
  // OG + Twitter cards so shared links render as a branded preview
  // (logo + title + line) instead of a barren URL. Image is the
  // existing 512×512 icon; if/when we ship a dedicated 1200×630
  // social image, swap it in here.
  openGraph: {
    type: "website",
    siteName: "Protocolize",
    title: "Protocolize — Longevity Intelligence",
    description:
      "Your adaptive daily protocol. Sleep, training, nutrition, supplements — calmly orchestrated into one day that reshapes itself around your recovery.",
    images: [
      { url: "/icons/icon-512.png", width: 512, height: 512, alt: "Protocolize" },
    ],
  },
  twitter: {
    card: "summary",
    title: "Protocolize — Longevity Intelligence",
    description:
      "An adaptive daily protocol that calmly reshapes itself around your recovery.",
    images: ["/icons/icon-512.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocolize",
    // iOS-specific splash screens. Apple requires exact-pixel PNGs
    // per device size; without these, iOS shows a white flash on
    // PWA launch instead of the branded splash. The generator script
    // (scripts/generate-icons.mjs) emits these from public/icon.svg.
    startupImage: [
      // iPhone 15/16 Pro Max
      {
        url: "/splash/iphone-6.7.png",
        media:
          "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      // iPhone 15/16
      {
        url: "/splash/iphone-6.1.png",
        media:
          "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      // iPhone 14/13/12 Pro Max
      {
        url: "/splash/iphone-6.5.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      // iPhone 14/13/12
      {
        url: "/splash/iphone-6.1-legacy.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      // iPhone 13 mini
      {
        url: "/splash/iphone-6.1-mini.png",
        media:
          "(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      // iPhone XR / 11
      {
        url: "/splash/iphone-xr.png",
        media:
          "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPhone SE / 8 / 7
      {
        url: "/splash/iphone-se.png",
        media:
          "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPad Pro 12.9"
      {
        url: "/splash/ipad-pro-12.9.png",
        media:
          "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPad Pro 11"
      {
        url: "/splash/ipad-pro-11.png",
        media:
          "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPad Air
      {
        url: "/splash/ipad-air.png",
        media:
          "(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPad 10
      {
        url: "/splash/ipad-10.png",
        media:
          "(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
      // iPad 9.7
      {
        url: "/splash/ipad-9.7.png",
        media:
          "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
      },
    ],
  },
  icons: {
    // Primary icon (browser tab + bookmarks) — SVG scales perfectly
    // on every desktop browser. iOS-specific PNGs come next so Safari
    // honors the apple-touch-icon for home screen.
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/icon-180.png", sizes: "180x180", type: "image/png" },
      { url: "/icons/icon-167.png", sizes: "167x167", type: "image/png" },
      { url: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
    ],
    shortcut: "/favicon-32.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090B",
  width: "device-width",
  initialScale: 1,
  // No maximumScale — locking zoom fails WCAG 1.4.4 for low-vision users.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/* Sets data-theme before first paint so there's no flash of the
            wrong theme. Reads the same localStorage key as theme.ts. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ErrorBoundary>
          <MotionProvider>
            {children}
            <SyncConflictPrompt />
            <ServiceWorker />
            <StorageSafetyNet />
            <TimezoneSentry />
            <InstallPrompt />
            <Analytics />
          </MotionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
