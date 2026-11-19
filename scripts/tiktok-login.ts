import readline from 'readline';
import { launchInteractiveTikTokLogin } from '../src/services/playwright/tiktok-session';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n======================================================');
  console.log('       TrendPulse - TikTok Authentication & Verify    ');
  console.log('======================================================\n');
  console.log('🚀 Đang khởi chạy trình duyệt Chromium để đăng nhập / xác minh TikTok...');
  console.log('👉 Trình duyệt sẽ mở đến TikTok Studio Upload.');
  console.log('👉 Nếu TikTok hiện "Verify it\'s really you", vui lòng chọn Email và nhập mã OTP.');
  console.log('👉 Phiên làm việc và cookies sẽ tự động được lưu vào storage/tiktok-session.json.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const loginPromise = launchInteractiveTikTokLogin('https://www.tiktok.com/tiktokstudio/upload');
    console.log('💡 Sau khi hoàn tất đăng nhập/xác minh, bạn có thể đóng cửa sổ trình duyệt.');
    await loginPromise;
    console.log('\n🎉 Hoàn tất xác minh và lưu trữ phiên TikTok!');
  } catch (err: any) {
    console.error('\n❌ Lỗi:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
