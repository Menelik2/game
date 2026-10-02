import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [],
  },
  // Empty default = offline demo on Vercel (do not bake localhost)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'true',
  },
  /**
   * Same-origin proxy (avoids browser CORS):
   * Browser → /backend/games → API_URL/api/games
   * Set server env API_URL on Vercel (not required to be NEXT_PUBLIC).
   */
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
