import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.externals.push('kysely');
    return config;
  },
};

export default nextConfig;
