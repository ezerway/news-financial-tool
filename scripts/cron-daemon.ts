import { runAutomationCycle } from '../src/services/auto-runner';
import { logActivity } from '../src/lib/db';

/**
 * Tính toán chính xác số mili-giây còn lại đến đúng đầu giờ tròn tiếp theo (HH:00:00.000)
 */
function getMsUntilNextTopOfTheHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

async function startDaemon() {
  console.log(`\n======================================================`);
  console.log(`🚀 TrendPulse Precision Cron Daemon Đã Khởi Động`);
  console.log(`⏰ Cơ chế: Luôn kích hoạt vào đúng đầu giờ tròn (HH:00:00)`);
  console.log(`======================================================\n`);

  let customLimit: number | undefined;
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
    }
  }

  logActivity('INFO', 'AUTO', 'Cron daemon khởi động - đặt lịch chạy đúng đầu giờ tròn (HH:00).');

  const scheduleNext = () => {
    const msToWait = getMsUntilNextTopOfTheHour();
    const nextTime = new Date(Date.now() + msToWait);
    const minutesLeft = Math.round(msToWait / 60000);

    console.log(
      `⏳ [Đồng hồ hẹn giờ] Chu kỳ tiếp theo sẽ chạy lúc: ${formatTime(nextTime)} (sau khoảng ${minutesLeft} phút nữa)`
    );

    setTimeout(async () => {
      const runTime = new Date();
      console.log(`\n🔔 [${formatTime(runTime)}] ĐÚNG GIỜ TRÒN! Kích hoạt chu kỳ tự động hóa TrendPulse...`);

      try {
        const res = await runAutomationCycle({ limit: customLimit, dryRun: isDryRun, forcePublish });
        console.log(`✅ [${formatTime(new Date())}] Chu kỳ hoàn tất:`, JSON.stringify(res, null, 2));
      } catch (err: any) {
        console.error(`❌ [${formatTime(new Date())}] Lỗi thực thi chu kỳ:`, err.message);
      }

      // Hẹn giờ cho giờ tròn tiếp theo
      scheduleNext();
    }, msToWait);
  };

  scheduleNext();
}

startDaemon();
