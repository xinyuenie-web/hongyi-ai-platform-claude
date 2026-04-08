// 红艺AI花木平台 - PM2 进程管理配置
// 使用方式: pm2 start ecosystem.config.js

module.exports = {
  apps: [
    {
      // Express API 后端服务
      name: 'hongyi-server',
      script: 'tsx',
      args: 'apps/server/src/index.ts',
      cwd: '/www/wwwroot/hongyi',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      error_file: '/www/wwwlogs/hongyi-server-error.log',
      out_file: '/www/wwwlogs/hongyi-server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
    {
      // Next.js 前端网站（standalone 模式）
      name: 'hongyi-website',
      script: 'apps/website/.next/standalone/server.js',
      cwd: '/www/wwwroot/hongyi',
      instances: 2,
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      error_file: '/www/wwwlogs/hongyi-website-error.log',
      out_file: '/www/wwwlogs/hongyi-website-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
};
