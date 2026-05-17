import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protocolize — Longevity Intelligence",
  description:
    "Premium longevity, recovery, and sleep optimization. Track protocols, monitor readiness, and improve your healthspan with science-backed routines.",
};

export const viewport: Viewport = {
  themeColor: "#08090B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
