import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "onnxruntime-node",
    "@xenova/transformers",
  ],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/*",
    ],
  },
  outputFileTracingExcludes: {
    "/api/**/*": [
      "./node_modules/onnxruntime-node/bin/napi-v3/darwin/**",
      "./node_modules/onnxruntime-node/bin/napi-v3/win32/**",
    ],
  },
};

export default nextConfig;
