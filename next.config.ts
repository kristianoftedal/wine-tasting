import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { withContentlayer } = require("next-contentlayer2");

const nextConfig: NextConfig = {
  /* config options here */
};

module.exports = withContentlayer(nextConfig);

export default nextConfig;
