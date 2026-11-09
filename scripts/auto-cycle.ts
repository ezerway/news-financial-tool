import { runAutomationCycle, retryTrendSourcesAndPublish } from '../src/services/auto-runner';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const forcePublish = process.argv.includes('--publish');
  const isRetryMissing = process.argv.includes('--retry') || process.argv.includes('--retry-missing');

  let customLimit: number | undefined;
  let customTrendId: string | undefined;

  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--limit=')) {
      customLimit = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--limit' || arg === '--count' || arg === '-l') {
      const next = process.argv[i + 1];
      if (next && !next.startsWith('-')) {
        customLimit = parseInt(next, 10);
      }
    } else if (arg.startsWith('--trend=')) {
      customTrendId = arg.split('=')[1];
    } else if (arg === '--trend' || arg === '-t') {
      const next = process.argv[i + 1];
      if (next && !next.startsWith('-')) {
        customTrendId = next;
      }
    }
  }

  if (isRetryMissing || customTrendId) {
    console.log(`=== Chạy lại tìm kiếm link nguồn báo chí và đăng bài ===`);
    console.log(`Mục tiêu: ${customTrendId ? `Xu hướng ID ${customTrendId}` : 'Tất cả các xu hướng chưa có nguồn / chưa đăng'}`);
    console.log(`Chế độ: ${isDryRun ? 'Mô phỏng (Dry Run)' : 'Thực tế'}`);
    console.log(`Tự động xuất bản: ${forcePublish ? 'Có' : 'Có (mặc định cho retry)'}\n`);

    try {
      const res = await retryTrendSourcesAndPublish({
        trendId: customTrendId,
        allMissing: !customTrendId,
        dryRun: isDryRun,
        forcePublish: true,
        limit: customLimit || 5,
      });
      console.log('Kết quả chạy lại:', JSON.stringify(res, null, 2));
      process.exit(0);
    } catch (err: any) {
      console.error('Lỗi khi chạy lại:', err.message);
      process.exit(1);
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
