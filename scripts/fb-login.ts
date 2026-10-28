import readline from 'readline';
import {
  launchInteractiveLogin,
  saveRawFacebookCookies,
  checkFacebookLoginStatus,
} from '../src/services/playwright/session';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  console.log('\n======================================================');
  console.log('       TrendPulse - Facebook Authentication CLI       ');
  console.log('======================================================\n');

  // Check if we are running in headless Linux environment (no GUI DISPLAY)
  const isHeadlessLinux = process.platform === 'linux' && !process.env.DISPLAY;

  if (isHeadlessLinux) {
    console.log('⚠️  Phát hiện máy chủ Linux không có màn hình GUI ($DISPLAY is not set).');
    console.log('   Trình duyệt Chromium có cửa sổ giao diện không thể mở trực tiếp tại terminal này.\n');
    console.log('👉 BẠN CÓ 3 CÁCH KẾT NỐI FACEBOOK CHO VPS:');
    console.log('------------------------------------------------------');
    console.log('1. [NHANH NHẤT] Nhập trực tiếp Cookie (c_user & xs) ngay dưới đây.');
    console.log('2. [DỄ NHẤT] Mở Dashboard Web trên trình duyệt -> Tab "Cài đặt & Tài khoản FB" ->');
    console.log('   Mục "Sao lưu & Khôi phục" -> Tải file `fb-session.json` lên.');
    console.log('3. Đăng nhập trên máy tính cá nhân (Mac/Win) bằng `pnpm fb:login`, sau đó copy');
    console.log('   file `storage/fb-session.json` lên thư mục `storage/` trên VPS.\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      console.log('------------------------------------------------------');
      console.log('HƯỚNG DẪN LẤY COOKIE TỪ TRÌNH DUYỆT MÁY BẠN:');
      console.log(' - Vào facebook.com trên trình duyệt máy tính của bạn.');
      console.log(' - Nhấn F12 (DevTools) -> Chọn tab Application -> Storage -> Cookies -> https://www.facebook.com');
      console.log(' - Hoặc cài tiện ích "Cookie-Editor" trên Chrome/Edge/Firefox.');
      console.log(' - Tìm 2 cookie: `c_user` (dãy số ID) và `xs` (chuỗi token bảo mật).\n');

      const cUser = await askQuestion(rl, '➤ Nhập giá trị cookie `c_user`: ');
      const xs = await askQuestion(rl, '➤ Nhập giá trị cookie `xs`: ');

      if (cUser.trim() && xs.trim()) {
        saveRawFacebookCookies(cUser, xs);
        const status = await checkFacebookLoginStatus();
        console.log('\n======================================================');
        console.log('✅ ' + status.message);
        console.log(`👤 Tài khoản: ${status.username || 'Facebook User'}`);
        console.log('======================================================\n');
        rl.close();
        process.exit(0);
      } else {
        console.log('\n❌ Bạn chưa nhập đủ c_user hoặc xs. Hủy thao tác.');
        rl.close();
        process.exit(1);
      }
    } catch (err: unknown) {
      console.error('\n❌ Lỗi:', err instanceof Error ? err.message : String(err));
      rl.close();
      process.exit(1);
    }
  }

  // If GUI display is available (macOS, Windows, or Linux with DISPLAY/X11):
  console.log('Mở trình duyệt Chromium... Vui lòng đăng nhập và vượt qua 2FA nếu có.');
  try {
    const result = await launchInteractiveLogin();
    console.log('Thành công:', result);
    process.exit(0);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Lỗi đăng nhập:', msg);
    if (process.platform === 'linux' && !process.env.DISPLAY) {
      console.log('\n💡 Gợi ý: Trên Linux VPS không có GUI, hãy dùng:');
      console.log('   - `xvfb-run -a pnpm fb:login` (nếu có cài xvfb)');
      console.log('   - Hoặc copy file `storage/fb-session.json` từ máy cá nhân lên VPS.');
    }
    process.exit(1);
  }
}

main();
