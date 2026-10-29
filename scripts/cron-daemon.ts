import { runAutomationCycle } from '../src/services/auto-runner';
import { logActivity, getSetting } from '../src/lib/db';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function startDaemon() {
  let customLimit: number | undefined;
  let customIntervalMinutes: number | undefined;
  const isDryRun = process.argv.includes('--dry-run');
  const forcePublish = process.argv.includes('--publish');

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--limit=')) {
      customLimit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--limit' || arg === '--count' || arg === '-l') {
      const next = process.argv[i + 1];
      if (next && !next.startsWith('-')) {
        customLimit = parseInt(next, 10);
      }
    } else if (arg.startsWith('--interval=')) {
      customIntervalMinutes = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--interval' || arg === '-i') {
      const next = process.argv[i + 1];
      if (next && !next.startsWith('-')) {
        customIntervalMinutes = parseInt(next, 10);
      }
    }
  }

  // Khoảng thời gian lặp lại: ưu tiên CLI -> settings DB -> mặc định 60 phút
  const intervalMinutes =
    customIntervalMinutes ||
    parseInt(getSetting('crawler_interval_minutes', '60'), 10) ||
    60;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`\n======================================================`);
  console.log(`🚀 TrendPulse Cron Daemon Đã Khởi Động`);
  console.log(`⏰ Chu kỳ lặp lại: Cứ mỗi ${intervalMinutes} phút chạy 1 lần`);
  console.log(`📤 Tự động xuất bản lên Facebook: ${forcePublish ? 'CÓ (bật qua --publish)' : 'Theo cài đặt Auto-Pilot trong Web'}`);
  console.log(`📊 Số bài viết tối đa mỗi lần: ${customLimit ? `${customLimit} bài (qua CLI)` : 'Theo cấu hình trong Cài đặt'}`);
  console.log(`🕒 Thời gian bắt đầu: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`======================================================\n`);

  logActivity('INFO', 'AUTO', `Cron daemon khởi động - chu kỳ chạy mỗi ${intervalMinutes} phút.`);

  // Hàm thực thi chu kỳ và hẹn giờ cho lần kế tiếp
  const executeCycle = async (isFirstRun = false) => {
    const runTime = new Date();
    console.log(
      `\n🔔 [${formatTime(runTime)}] ${
        isFirstRun ? 'Khởi động lần đầu: Chạy ngay lập tức!' : 'Đến hẹn chu kỳ: Kích hoạt tự động hóa TrendPulse...'
      }`
    );

    try {
      const res = await runAutomationCycle({ limit: customLimit, dryRun: isDryRun, forcePublish });
      console.log(`✅ [${formatTime(new Date())}] Chu kỳ hoàn tất:`, JSON.stringify(res, null, 2));
    } catch (err: any) {
      console.error(`❌ [${formatTime(new Date())}] Lỗi thực thi chu kỳ:`, err.message);
    }

    const nextRunTime = new Date(Date.now() + intervalMs);
    console.log(`\n⏳ [Hẹn giờ] Lần chạy tiếp theo sẽ diễn ra lúc: ${formatTime(nextRunTime)} (sau ${intervalMinutes} phút)`);

    setTimeout(() => {
      executeCycle(false);
    }, intervalMs);
  };

  // Chạy ngay lần đầu tiên khi daemon vừa khởi động
  await executeCycle(true);
}

startDaemon();
