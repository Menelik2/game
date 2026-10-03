import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // Demo on Vercel: Equb runs fully in the browser (no Nest required).
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'true',
  },
  async rewrites() {
    const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (!api) return [];
    return [
      {
        source: '/backend/:path*',
        destination: `${api}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
