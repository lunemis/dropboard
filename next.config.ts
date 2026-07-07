import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the file-tracing root to this project. Without it, Next.js walks up the
  // directory tree and can pick a parent folder as the workspace root when an
  // unrelated lockfile lives above the repo (e.g. cloning into ~/git alongside
  // other projects), emitting a scary "inferred workspace root" warning on an
  // otherwise-clean build. It also keeps the production file trace scoped to the
  // project instead of the whole parent tree.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
