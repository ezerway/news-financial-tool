const isLinux = process.platform === 'linux';

const apps = [
  // 1. Dịch vụ màn hình ảo Xvfb cho Linux VPS (Tự động khởi chạy & tự phục hồi cho Playwright / RPC)
  ...(isLinux
    ? [
        {
          name: 'trendpulse-xvfb',
          script: 'scripts/run-xvfb.js',
          cwd: __dirname,
          instances: 1,
          exec_mode: 'fork',
          autorestart: true,
          watch: false,
          max_memory_restart: '150M',
        },
      ]
    : []),

  // 2. Next.js Web Application Server
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
      DISPLAY: ':99',
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DISPLAY: ':99',
    },
  },

  // 3. Cron Daemon tự động chạy chu kỳ
  {
    name: 'trendpulse-cron',
    script: 'node_modules/tsx/dist/cli.mjs',
    args: 'scripts/cron-daemon.ts --publish',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true, // Tiến trình daemon chạy nền liên tục, tự động chạy chu kỳ 1 tiếng 1 lần
    watch: false,
    max_memory_restart: '1000M',
    env: {
      NODE_ENV: 'production',
      DISPLAY: ':99',
    },
    env_production: {
      NODE_ENV: 'production',
      DISPLAY: ':99',
    },
  },
];

module.exports = { apps };
