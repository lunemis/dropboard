import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:
    process.env.DROPBOARD_BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
};

export default nextConfig;
