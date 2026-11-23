import readline from 'readline';
import { launchInteractiveZaloLogin } from '../src/services/playwright/zalo-session';

async function main() {
  console.log('\n======================================================');
  console.log('       TrendPulse - Zalo Video Creator Auth & Switch  ');
  console.log('======================================================\n');
  console.log('🚀 Đang khởi chạy trình duyệt Chromium để đăng nhập Zalo Video Creator...');
  console.log('👉 Trình duyệt sẽ mở đến https://video.zalo.me/creator/video');
  console.log('👉 Vui lòng quét mã QR hoặc đăng nhập tài khoản Zalo của bạn.');
  console.log('👉 Toàn bộ phiên và cookies sẽ tự động lưu vào browser-profile dùng chung.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const loginPromise = launchInteractiveZaloLogin('https://video.zalo.me/creator/video');
    console.log('💡 Sau khi hoàn tất đăng nhập, bạn có thể đóng cửa sổ trình duyệt.');
    await loginPromise;
    console.log('\n🎉 Hoàn tất xác minh và lưu trữ phiên Zalo Video!');
  } catch (err: any) {
    console.error('\n❌ Lỗi:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
