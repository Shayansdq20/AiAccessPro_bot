import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@pro-ai-access/shared'],
};

export default nextConfig;
