import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logActivity } from '@/lib/db';
import {
  getStorageDir,
  getChromiumLaunchArgs,
  cleanStaleChromeLocks,
  getUserDataDir,
  isInteractiveSessionActive,
  setInteractiveSessionActive,
} from './session';

/**
 * Trả về thư mục Profile dùng chung duy nhất của hệ thống.
 */
export function getZaloUserDataDir(): string {
  return getUserDataDir();
}

export function getZaloSessionPath(): string {
  return path.join(/*turbopackIgnore: true*/ getStorageDir(), 'zalo-session.json');
}

export interface ZaloStatusResult {
  loggedIn: boolean;
  username?: string;
  message: string;
}

/**
 * Kiểm tra trạng thái đăng nhập Zalo Video trên browser-profile dùng chung.
 */
export async function checkZaloLoginStatus(): Promise<ZaloStatusResult> {
  const userDataDir = getZaloUserDataDir();
  const sessionPath = getZaloSessionPath();

  // Kiểm tra file session riêng nếu có
  if (fs.existsSync(sessionPath)) {
    try {
      const stats = fs.statSync(sessionPath);
      if (stats.size > 20) {
        return {
          loggedIn: true,
          message: 'Phiên Zalo Video đã được lưu và sẵn sàng',
        };
      }
    } catch {}
  }

  // Kiểm tra sự tồn tại của thư mục profile Chromium
  if (!fs.existsSync(userDataDir)) {
    return {
      loggedIn: false,
      message: 'Chưa có dữ liệu phiên trình duyệt. Vui lòng đăng nhập Zalo Video Creator.',
    };
  }

  // Quét file cookies Chromium
  const defaultDir = path.join(userDataDir, 'Default');
  const cookiesPath = path.join(defaultDir, 'Network', 'Cookies');
  const oldCookiesPath = path.join(defaultDir, 'Cookies');

  const hasCookieFile = fs.existsSync(cookiesPath) || fs.existsSync(oldCookiesPath);
  if (!hasCookieFile) {
    return {
      loggedIn: false,
      message: 'Chưa tìm thấy cookie trong profile. Vui lòng đăng nhập Zalo Video Creator.',
    };
  }

  return {
    loggedIn: true,
    message: 'Phiên trình duyệt sẵn sàng cho Zalo Video Creator',
  };
}

/**
 * Khởi chạy trình duyệt tương tác có giao diện người dùng
 * để đăng nhập Zalo Video Creator (quét mã QR hoặc đăng nhập SĐT).
 */
export async function launchInteractiveZaloLogin(initialUrl?: string): Promise<string> {
  if (isInteractiveSessionActive()) {
    return 'Cửa sổ trình duyệt đang được mở. Vui lòng thao tác trên cửa sổ trình duyệt đã mở!';
  }

  setInteractiveSessionActive(true);
  const target = initialUrl || 'https://video.zalo.me/creator/video';
  logActivity('INFO', 'AUTH', `Khởi chạy trình duyệt tương tác để đăng nhập Zalo Video: ${target}...`);

  const launchArgs = getChromiumLaunchArgs([
    '--disable-blink-features=AutomationControlled',
  ]);
  const userDataDir = getZaloUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  let browser: BrowserContext | null = null;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: null,
      args: launchArgs,
    });

    const page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();

    // Ẩn navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      try {
        (window as any).chrome = { runtime: {} };
      } catch {}
    });

    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });

    logActivity('INFO', 'AUTH', 'Cửa sổ đăng nhập Zalo Video đã mở. Vui lòng quét mã QR hoặc đăng nhập...');

    // Lắng nghe khi người dùng đóng trình duyệt
    await new Promise<void>((resolve) => {
      browser?.on('close', async () => {
        setInteractiveSessionActive(false);
        resolve();
      });
    });

    // Lưu cookie vào file zalo-session.json để backup
    try {
      const cookies = await browser.cookies();
      const zaloCookies = cookies.filter((c: any) => c.domain.includes('zalo.me'));
      if (zaloCookies.length > 0) {
        fs.writeFileSync(getZaloSessionPath(), JSON.stringify({ cookies: zaloCookies }, null, 2), 'utf-8');
      }
    } catch {}

    logActivity('SUCCESS', 'AUTH', 'Đã đóng cửa sổ tương tác Zalo Video. Phiên đã được lưu lại.');
    return 'Hoàn tất quá trình đăng nhập Zalo Video.';
  } catch (err: any) {
    setInteractiveSessionActive(false);
    logActivity('ERROR', 'AUTH', `Lỗi phiên tương tác Zalo Video: ${err.message}`);
    throw err;
  }
}
