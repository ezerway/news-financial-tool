import { runAutomationCycle } from '../src/services/auto-runner';
import { processScheduledReels } from '../src/services/reels';
import { cleanOldReelsStorage } from '../src/services/storage-cleanup';
import { logActivity, getSetting } from '../src/lib/db';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function runReelsStorageCleanup(days: number, contextLabel: string) {
  try {
    const cleanRes = await cleanOldReelsStorage(days);
    if (cleanRes.deletedVideos > 0 || cleanRes.deletedScreenshots > 0) {
      console.log(
        `🧹 [${formatTime(new Date())}] [${contextLabel}] Đã dọn dẹp ${cleanRes.deletedVideos} video và ${cleanRes.deletedScreenshots} screenshot của các post Reel cũ (> ${days} ngày), giải phóng ${cleanRes.freedFormatted}.`
      );
    } else {
      console.log(
        `🧹 [${formatTime(new Date())}] [${contextLabel}] Đã kiểm tra bộ nhớ Reel: Không có video/screenshot cũ (> ${days} ngày) cần xóa.`
      );
    }
  } catch (err: any) {
    console.error(`❌ [${formatTime(new Date())}] [${contextLabel}] Lỗi dọn dẹp bộ nhớ Reel:`, err.message);
  }
}

async function startDaemon() {
  let customLimit: number | undefined;
  let customIntervalMinutes: number | undefined;
  let customCleanDays: number | undefined;
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
    } else if (arg.startsWith('--clean-days=')) {
      customCleanDays = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--clean-days' || arg === '-c') {
      const next = process.argv[i + 1];
      if (next && !next.startsWith('-')) {
        customCleanDays = parseInt(next, 10);
      }
    }
  }

  // Khoảng thời gian lặp lại: ưu tiên CLI -> settings DB -> mặc định 60 phút
  const intervalMinutes =
    customIntervalMinutes ||
    parseInt(getSetting('crawler_interval_minutes', '60'), 10) ||
    60;
  const intervalMs = intervalMinutes * 60 * 1000;

  // Số ngày để dọn video & screenshot Reel cũ: ưu tiên CLI -> settings DB -> mặc định 2 ngày
  const cleanDays =
    customCleanDays ||
    parseInt(getSetting('clean_reels_days', '2'), 10) ||
    2;

  console.log(`\n======================================================`);
  console.log(`🚀 TrendPulse Cron Daemon Đã Khởi Động`);
  console.log(`⏰ Chu kỳ lặp lại: Cứ mỗi ${intervalMinutes} phút chạy 1 lần`);
  console.log(`📤 Tự động xuất bản lên Facebook: ${forcePublish ? 'CÓ (bật qua --publish)' : 'Theo cài đặt Auto-Pilot trong Web'}`);
  console.log(`📊 Số bài viết tối đa mỗi lần: ${customLimit ? `${customLimit} bài (qua CLI)` : 'Theo cấu hình trong Cài đặt'}`);
  console.log(`🧹 Dọn dẹp bộ nhớ Reel: Tự động xóa video & screenshot của post Reel tạo từ ${cleanDays} ngày trước`);
  console.log(`🕒 Thời gian bắt đầu: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`======================================================\n`);

  logActivity(
    'INFO',
    'AUTO',
    `Cron daemon khởi động - chu kỳ chạy mỗi ${intervalMinutes} phút, tự động dọn dẹp Reel cũ > ${cleanDays} ngày.`
  );

  // Vòng lặp kiểm tra và đăng Reel đã đặt lịch mỗi 30 giây
  setInterval(async () => {
    try {
      const scheduledResult = await processScheduledReels();
      if (scheduledResult.processed > 0) {
        console.log(`🎬 [${formatTime(new Date())}] Đã xử lý ${scheduledResult.processed} Reel theo lịch (Thành công: ${scheduledResult.successful}, Thất bại: ${scheduledResult.failed})`);
      }
    } catch (err: any) {
      console.error(`❌ [${formatTime(new Date())}] Lỗi xử lý Reel hẹn giờ:`, err.message);
    }
  }, 30 * 1000);

  // Kiểm tra lịch Reel ngay khi khởi động
  processScheduledReels().catch(() => {});

  // Dọn dẹp video & screenshot các post Reel cũ (> 2 ngày) ngay khi khởi động
  await runReelsStorageCleanup(cleanDays, 'Khởi động');

  // Hàm thực thi chu kỳ và hẹn giờ cho lần kế tiếp
  const executeCycle = async (isFirstRun = false) => {
    const runTime = new Date();
    console.log(
      `\n🔔 [${formatTime(runTime)}] ${
        isFirstRun ? 'Khởi động lần đầu: Chạy ngay lập tức!' : 'Đến hẹn chu kỳ: Kích hoạt tự động hóa TrendPulse...'
      }`
    );

    try {
      const res = await runAutomationCycle({ limit: customLimit, forcePublish });
      console.log(`✅ [${formatTime(new Date())}] Chu kỳ hoàn tất:`, JSON.stringify(res, null, 2));
    } catch (err: any) {
      console.error(`❌ [${formatTime(new Date())}] Lỗi thực thi chu kỳ:`, err.message);
    }

    // Tự động dọn dẹp video & screenshot của các post Reel cũ sau mỗi chu kỳ
    await runReelsStorageCleanup(cleanDays, 'Chu kỳ');

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
