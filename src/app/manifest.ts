import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Protocolize — Longevity Intelligence",
    short_name: "Protocolize",
    description:
      "Premium longevity, recovery, and sleep optimization. Track protocols, monitor readiness, and improve your healthspan.",
    start_url: "/today",
    display: "standalone",
    background_color: "#08090B",
    theme_color: "#08090B",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
