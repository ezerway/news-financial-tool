import readline from 'readline';
import { launchInteractiveYouTubeLogin } from '../src/services/playwright/youtube-session';
import { getYouTubeChannelUrl } from '../src/lib/db';

async function main() {
  console.log('\n======================================================');
  console.log('       TrendPulse - YouTube Studio Auth & Switch      ');
  console.log('======================================================\n');
  console.log('🚀 Đang khởi chạy trình duyệt Chromium để đăng nhập Google / YouTube Studio...');
  const configuredChannel = getYouTubeChannelUrl();
  if (configuredChannel) {
    console.log(`🎯 Kênh YouTube mục tiêu đã cấu hình: ${configuredChannel}`);
  }
  console.log('👉 Trình duyệt sẽ mở đến YouTube Studio.');
  console.log('👉 Vui lòng đăng nhập tài khoản Google và chuyển đúng kênh Shorts cần đăng.');
  console.log('👉 Toàn bộ phiên và cookies sẽ tự động lưu vào browser-profile dùng chung.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const loginPromise = launchInteractiveYouTubeLogin(configuredChannel || 'https://studio.youtube.com/');
    console.log('💡 Sau khi hoàn tất đăng nhập/chọn kênh, bạn có thể đóng cửa sổ trình duyệt.');
    await loginPromise;
    console.log('\n🎉 Hoàn tất xác minh và lưu trữ phiên YouTube!');
  } catch (err: any) {
    console.error('\n❌ Lỗi:', err.message);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
