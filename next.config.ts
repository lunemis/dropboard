import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output:
    process.env.DROPBOARD_BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
  turbopack: {
    // The filesystem-backed store intentionally resolves its data directory at
    // runtime. Turbopack reports that trace as the project config file even
    // though project sources are excluded from route traces below.
    ignoreIssue: [
      {
        path: "**/next.config.ts",
        title: "Encountered unexpected file in NFT list",
      },
    ],
  },
  outputFileTracingExcludes: {
    "/*": ["./next.config.ts", "./data/**/*", "./tests/**/*"],
  },
};

export default nextConfig;
