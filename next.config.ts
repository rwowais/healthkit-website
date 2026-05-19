import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // A readable build stamp so we can tell, from inside the app,
    // exactly which deploy a device is running (kills the "is it cached
    // / did it deploy?" guessing). Vercel sets the commit SHA at build.
    NEXT_PUBLIC_BUILD:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
      new Date().toISOString().slice(0, 16).replace("T", " "),
  },
};

export default nextConfig;
