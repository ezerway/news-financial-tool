import { launchInteractiveLogin } from '../src/services/playwright/session';

async function main() {
  console.log('=== Facebook Interactive Login ===');
  console.log('Mở trình duyệt Chromium... Vui lòng đăng nhập và vượt qua 2FA nếu có.');
  try {
    const result = await launchInteractiveLogin();
    console.log('Thành công:', result);
    process.exit(0);
  } catch (err: any) {
    console.error('Lỗi đăng nhập:', err.message);
    process.exit(1);
  }
}

main();
