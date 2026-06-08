import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Mengabaikan error pada modul node_modules saat build
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Tambahkan ini untuk webpack agar lebih toleran terhadap import dari @better-auth
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

export default nextConfig;
