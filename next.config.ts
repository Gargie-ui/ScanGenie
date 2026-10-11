import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "onnxruntime-node",
    "pdf-parse",
    "pdfjs-dist",
    "@napi-rs/canvas",
  ],
};

export default nextConfig;
