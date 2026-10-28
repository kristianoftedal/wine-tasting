import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    swcPlugins: [["@swc-jotai/react-refresh", {}]],
  },
  // Native ONNX binaries and the transformers.js runtime must stay out of the
  // bundler; the local soft engines import them at first use.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node"],
}

export default nextConfig
