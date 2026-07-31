import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.DROPBOARD_NEXT_DIST_DIR ?? ".next",
  output:
    process.env.DROPBOARD_BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
};

export default nextConfig;
