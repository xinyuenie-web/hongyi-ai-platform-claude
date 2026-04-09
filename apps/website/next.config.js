/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@hongyi/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cos.ap-guangzhou.myqcloud.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'http',
        hostname: '106.53.112.26',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },
  output: 'standalone',
};

module.exports = nextConfig;
