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
}

export default nextConfig
