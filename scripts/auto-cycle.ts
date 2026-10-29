import { runAutomationCycle } from '../src/services/auto-runner';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const forcePublish = process.argv.includes('--publish');

  let customLimit: number | undefined;
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

  console.log(`=== Khởi động chu kỳ tự động hóa TrendPulse ===`);
  console.log(`Chế độ: ${isDryRun ? 'Mô phỏng (Dry Run)' : 'Thực tế'}`);
  console.log(`Số bài viết mỗi chu kỳ: ${customLimit ? `${customLimit} bài (qua tham số CLI)` : 'Theo cấu hình trong Cài đặt DB'}`);
  console.log(`Tự động xuất bản: ${forcePublish ? 'Có' : 'Theo cài đặt trong DB'}\n`);

  try {
    const res = await runAutomationCycle({ dryRun: isDryRun, forcePublish, limit: customLimit });
    console.log('Kết quả:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Lỗi thực thi:', err.message);
    process.exit(1);
  }
}

main();
