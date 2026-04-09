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
  // 开发模式下将 /api 请求代理到 Express 后端
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: 'http://localhost:4000/api/:path*',
          },
          {
            source: '/uploads/:path*',
            destination: 'http://localhost:4000/uploads/:path*',
          },
        ]
      : [];
  },
};

module.exports = nextConfig;
