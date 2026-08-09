import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // serverExternalPackages is a top-level configuration key in modern Next.js (14+)
  serverExternalPackages: ["sharp", "onnxruntime-node"],
};

export default nextConfig;
