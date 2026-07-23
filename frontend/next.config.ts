import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project - a stray package-lock.json in the
  // parent home directory otherwise gets misdetected as the root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
