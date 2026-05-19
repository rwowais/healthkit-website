import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import SyncConflictPrompt from "@/components/SyncConflictPrompt";

export const metadata: Metadata = {
  title: "Protocolize — Longevity Intelligence",
  description:
    "Premium longevity, recovery, and sleep optimization. Track protocols, monitor readiness, and improve your healthspan with science-backed routines.",
  applicationName: "Protocolize",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Protocolize",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
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
      style={{ colorScheme: "dark" }}
    >
      <body className="antialiased">
        {children}
        <SyncConflictPrompt />
        <ServiceWorker />
      </body>
    </html>
  );
}
