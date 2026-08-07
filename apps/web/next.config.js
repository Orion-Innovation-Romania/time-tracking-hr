/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Ensure the standalone server bundles files from the monorepo root.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  transpilePackages: ['@ttah/shared'],
  async rewrites() {
    // In dev, proxy /api/* to the NestJS server so cookies stay same-origin.
    // In prod behind Caddy this rewrite is unused (Caddy routes /api to the API).
    const target = process.env.API_INTERNAL_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${target}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
