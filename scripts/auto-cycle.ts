import { runAutomationCycle } from '../src/services/auto-runner';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const forcePublish = process.argv.includes('--publish');

  console.log(`=== Khởi động chu kỳ tự động hóa TrendPulse ===`);
  console.log(`Chế độ: ${isDryRun ? 'Mô phỏng (Dry Run)' : 'Thực tế'}`);
  console.log(`Tự động xuất bản: ${forcePublish ? 'Có' : 'Theo cài đặt trong DB'}\n`);

  try {
    const res = await runAutomationCycle({ dryRun: isDryRun, forcePublish });
    console.log('Kết quả:', JSON.stringify(res, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Lỗi thực thi:', err.message);
    process.exit(1);
  }
}

main();
