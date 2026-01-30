/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    turbo: {
      rules: {},
    },
  },
  // Exclude @xenova/transformers from server-side bundling
  // It only runs client-side
  serverExternalPackages: ['@xenova/transformers'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle @xenova/transformers on server
      config.externals = config.externals || [];
      config.externals.push('@xenova/transformers');
    }
    return config;
  },
}

export default nextConfig
