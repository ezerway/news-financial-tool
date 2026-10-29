module.exports = {
  apps: [
    {
      name: 'trendpulse-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: __dirname,
      instances: 1, // Bắt buộc 1 instance: SQLite (better-sqlite3) và Playwright chạy an toàn ở fork mode
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1200M',
      node_args: '--max-old-space-size=1024',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'trendpulse-cron',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'scripts/auto-cycle.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: false,
      cron_restart: '0 * * * *', // Chạy tự động 1 tiếng 1 lần (vào phút thứ 0 của mỗi giờ)
      watch: false,
      max_memory_restart: '1000M',
      env: {
        NODE_ENV: 'production',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
