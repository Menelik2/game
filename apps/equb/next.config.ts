import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Do NOT set output: 'export' — API routes need the Node serverless runtime
  env: {
    NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE || 'true',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    const api = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || '')
      .trim()
      .replace(/\/$/, '');
    if (!api) return [];
    return [{ source: '/backend/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
