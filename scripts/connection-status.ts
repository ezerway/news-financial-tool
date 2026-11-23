import fs from 'fs';
import path from 'path';
import { checkFacebookLoginStatus, getSessionPath, getUserDataDir } from '../src/services/playwright/session';
import { checkTikTokLoginStatus, getTikTokSessionPath } from '../src/services/playwright/tiktok-session';
import { checkYouTubeLoginStatus } from '../src/services/playwright/youtube-session';
import { checkZaloLoginStatus } from '../src/services/playwright/zalo-session';
import {
  isTikTokAutoPostEnabled,
  isYouTubeAutoPostEnabled,
  isZaloAutoPostEnabled,
  getYouTubeChannelUrl,
  getSetting,
  resolveHeadless,
} from '../src/lib/db';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileMeta(filePath: string): string {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeStr = formatBytes(stats.size);
      const mtimeStr = stats.mtime.toLocaleString('vi-VN');
      return `${sizeStr} • Cập nhật: ${mtimeStr}`;
    }
  } catch {}
  return 'Chưa có file';
}

async function main() {
  console.log('\n======================================================');
  console.log('       TrendPulse - Platform Connection Status        ');
  console.log('======================================================\n');

  // 1. Facebook
  console.log('🔵 [1] FACEBOOK');
  try {
    const fbStatus = await checkFacebookLoginStatus();
    const fbSessionFile = getSessionPath();
    const fbSessionExists = fs.existsSync(fbSessionFile);

    if (fbStatus.loggedIn) {
      console.log('   Trạng thái:    ✅ ĐÃ KẾT NỐI (Connected)');
      console.log(`   Đích đăng:     ${fbStatus.username || 'Trang cá nhân'}`);
      console.log(`   File session:  ${path.relative(process.cwd(), fbSessionFile)} (${getFileMeta(fbSessionFile)})`);
      console.log(`   Thông tin:     ${fbStatus.message}`);
    } else {
      console.log('   Trạng thái:    ❌ CHƯA KẾT NỐI (Not connected)');
      console.log(`   Lý do:         ${fbStatus.message}`);
      console.log(`   File session:  ${fbSessionExists ? 'Có (nhưng cookie hết hạn/không hợp lệ)' : 'Chưa có file fb-session.json'}`);
      console.log('   👉 Kết nối:    Chạy "pnpm fb:login" để đăng nhập.');
    }
  } catch (err: any) {
    console.log(`   Trạng thái:    ⚠️ Lỗi kiểm tra: ${err.message}`);
  }

  console.log('\n------------------------------------------------------');

  // 2. TikTok
  console.log('🎵 [2] TIKTOK');
  try {
    const ttStatus = await checkTikTokLoginStatus();
    const ttSessionFile = getTikTokSessionPath();
    const ttSessionExists = fs.existsSync(ttSessionFile);
    const ttAutoPost = isTikTokAutoPostEnabled();

    if (ttStatus.loggedIn) {
      console.log('   Trạng thái:    ✅ ĐÃ KẾT NỐI (Connected)');
      if (ttStatus.username) {
        console.log(`   Tài khoản:     ${ttStatus.username}`);
      }
      console.log(`   Tự động đăng:  ${ttAutoPost ? '🟢 BẬT (Auto-post On)' : '⚪ TẮT (Chỉ đăng thủ công)'}`);
      console.log(`   File session:  ${path.relative(process.cwd(), ttSessionFile)} (${getFileMeta(ttSessionFile)})`);
      console.log(`   Thông tin:     ${ttStatus.message}`);
    } else {
      console.log('   Trạng thái:    ❌ CHƯA KẾT NỐI (Not connected)');
      console.log(`   Tự động đăng:  ${ttAutoPost ? '🟢 BẬT' : '⚪ TẮT'}`);
      console.log(`   Lý do:         ${ttStatus.message}`);
      console.log(`   File session:  ${ttSessionExists ? 'Có (nhưng cookie hết hạn/không hợp lệ)' : 'Chưa có file tiktok-session.json'}`);
      console.log('   👉 Kết nối:    Chạy "pnpm tiktok:login" để đăng nhập / vượt xác minh.');
    }
  } catch (err: any) {
    console.log(`   Trạng thái:    ⚠️ Lỗi kiểm tra: ${err.message}`);
  }

  console.log('\n------------------------------------------------------');

  // 3. YouTube Shorts
  console.log('▶️ [3] YOUTUBE SHORTS');
  try {
    const ytStatus = await checkYouTubeLoginStatus();
    const configuredChannel = getYouTubeChannelUrl();
    const ytAutoPost = isYouTubeAutoPostEnabled();
    const userDataDir = getUserDataDir();

    if (ytStatus.loggedIn) {
      console.log('   Trạng thái:    ✅ ĐÃ KẾT NỐI (Connected)');
      console.log(`   Kênh mục tiêu: ${configuredChannel || '(Chưa cấu hình link kênh cụ thể, dùng kênh mặc định)'}`);
      console.log(`   Tự động đăng:  ${ytAutoPost ? '🟢 BẬT (Auto-post On)' : '⚪ TẮT (Chỉ đăng thủ công)'}`);
      console.log(`   Thư mục profile: ${path.relative(process.cwd(), userDataDir)}`);
      console.log(`   Thông tin:     ${ytStatus.message}`);
    } else {
      console.log('   Trạng thái:    ❌ CHƯA KẾT NỐI (Not connected)');
      console.log(`   Kênh mục tiêu: ${configuredChannel || 'Chưa cấu hình'}`);
      console.log(`   Tự động đăng:  ${ytAutoPost ? '🟢 BẬT' : '⚪ TẮT'}`);
      console.log(`   Lý do:         ${ytStatus.message}`);
      console.log('   👉 Kết nối:    Chạy "pnpm youtube:login" để đăng nhập Google / YouTube Studio.');
    }
  } catch (err: any) {
    console.log(`   Trạng thái:    ⚠️ Lỗi kiểm tra: ${err.message}`);
  }

  console.log('\n------------------------------------------------------');

  // 4. Zalo Video
  console.log('💬 [4] ZALO VIDEO');
  try {
    const zlStatus = await checkZaloLoginStatus();
    const zlAutoPost = isZaloAutoPostEnabled();
    const userDataDir = getUserDataDir();

    if (zlStatus.loggedIn) {
      console.log('   Trạng thái:    ✅ ĐÃ KẾT NỐI (Connected)');
      console.log(`   Tự động đăng:  ${zlAutoPost ? '🟢 BẬT (Auto-post On)' : '⚪ TẮT (Chỉ đăng thủ công)'}`);
      console.log(`   Thư mục profile: ${path.relative(process.cwd(), userDataDir)}`);
      console.log(`   Thông tin:     ${zlStatus.message}`);
    } else {
      console.log('   Trạng thái:    ❌ CHƯA KẾT NỐI (Not connected)');
      console.log(`   Tự động đăng:  ${zlAutoPost ? '🟢 BẬT' : '⚪ TẮT'}`);
      console.log(`   Lý do:         ${zlStatus.message}`);
      console.log('   👉 Kết nối:    Chạy "pnpm zalo:login" để đăng nhập Zalo Video Creator.');
    }
  } catch (err: any) {
    console.log(`   Trạng thái:    ⚠️ Lỗi kiểm tra: ${err.message}`);
  }

  console.log('\n======================================================');
  console.log('⚙️ CẤU HÌNH HỆ THỐNG');
  const defaultHeadless = resolveHeadless(true);
  console.log(`   Chế độ chạy ngầm (Headless): ${defaultHeadless ? 'CÓ (Không hiện cửa sổ)' : 'KHÔNG (Hiện cửa sổ)'}`);
  console.log(`   Thư mục lưu trữ chính:       ${path.relative(process.cwd(), getUserDataDir())}`);

  console.log('\n💡 CÁC LỆNH HỖ TRỢ NHANH:');
  console.log('   - Đăng nhập Facebook:       pnpm fb:login');
  console.log('   - Đăng nhập TikTok:         pnpm tiktok:login');
  console.log('   - Đăng nhập YouTube Studio: pnpm youtube:login');
  console.log('   - Đăng nhập Zalo Video:     pnpm zalo:login');
  console.log('   - Xuất bản Reel:            pnpm post-reel');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Fatal error checking connection status:', err);
  process.exit(1);
});
