import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Protocolize — Your Longevity Protocol, Simplified",
  description:
    "Build science-backed routines for sleep, exercise, nutrition, and supplements. Track daily adherence and optimize your health with protocols from Huberman, Attia, and Walker.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
