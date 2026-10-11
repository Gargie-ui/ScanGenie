import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // serverExternalPackages is a top-level configuration key in modern Next.js (14+)
  serverExternalPackages: ["sharp", "onnxruntime-node"],
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas'],
};

export default nextConfig;
