import createMDX from '@next/mdx';
import type { NextConfig } from 'next';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withContentlayer } = require('next-contentlayer2');

const nextConfig: NextConfig = {
  // Configure `pageExtensions` to include markdown and MDX files
  pageExtensions: ['md', 'mdx', 'ts', 'tsx']
  // Optionally, add any other Next.js config below
};

const withMDX = createMDX({
  // Add markdown plugins here, as desired
});

module.exports = withMDX(withContentlayer(nextConfig));

export default nextConfig;
