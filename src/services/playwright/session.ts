import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logActivity, getSetting } from '@/lib/db';

const STORAGE_DIR = path.join(process.cwd(), 'storage');
const SESSION_FILE = path.join(STORAGE_DIR, 'fb-session.json');
const USER_DATA_DIR = path.join(STORAGE_DIR, 'browser-profile');

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export function isSessionAvailable(): boolean {
  return fs.existsSync(SESSION_FILE);
}

export function getSessionPath(): string {
  return SESSION_FILE;
}

export function getUserDataDir(): string {
  return USER_DATA_DIR;
}

export async function checkFacebookLoginStatus(): Promise<{
  loggedIn: boolean;
  username?: string;
  message: string;
  targetType?: string;
  pageUrl?: string;
  pageName?: string;
}> {
  const targetType = getSetting('fb_target_type', 'page');
  const pageUrl = (getSetting('fb_page_url', '') || getSetting('fb_target_url', '')).trim();
  const pageName = getSetting('fb_page_name', '');

  if (!fs.existsSync(SESSION_FILE)) {
    return {
      loggedIn: false,
      message: 'Chưa có file phiên đăng nhập (storage/fb-session.json)',
      targetType,
      pageUrl,
      pageName,
    };
  }

  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const state = JSON.parse(raw);
    const cookies = state.cookies || [];

    // Check for Facebook session cookies (c_user, xs)
    const cUser = cookies.find((c: any) => c.name === 'c_user');
    const xs = cookies.find((c: any) => c.name === 'xs');

    if (!cUser || !xs) {
      return {
        loggedIn: false,
        message: 'Session cookies không hợp lệ hoặc đã hết hạn.',
        targetType,
        pageUrl,
        pageName,
      };
    }

    // Check expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (cUser.expires && cUser.expires < nowSec) {
      return {
        loggedIn: false,
        message: 'Cookie Facebook đã hết hạn.',
        targetType,
        pageUrl,
        pageName,
      };
    }

    let targetLabel = 'Trang cá nhân';
    if (targetType === 'page') {
      targetLabel = pageName ? `Fanpage: ${pageName}` : (pageUrl ? `Fanpage (${pageUrl.replace(/^https?:\/\/(www\.)?facebook\.com\/?/, '')})` : 'Fanpage (chưa nhập URL)');
    }

    return {
      loggedIn: true,
      username: `User ${cUser.value} [${targetLabel}]`,
      message: `Phiên Facebook đang hoạt động • Đích: ${targetLabel}`,
      targetType,
      pageUrl,
      pageName,
    };
  } catch (err: any) {
    return {
      loggedIn: false,
      message: `Lỗi đọc session: ${err.message}`,
      targetType,
      pageUrl,
      pageName,
    };
  }
}

export async function launchInteractiveLogin(initialUrl?: string): Promise<string> {
  logActivity('INFO', 'AUTH', 'Khởi chạy trình duyệt tương tác để quản lý phiên Facebook / Fanpage...');

  const browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 850 },
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  });

  const page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();
  const target = initialUrl || getSetting('fb_page_url') || 'https://www.facebook.com/';
  logActivity('INFO', 'AUTH', `Đang mở Facebook tại: ${target}. Bạn có thể đăng nhập hoặc chuyển đổi sang Fanpage cần đăng bài.`);
  await page.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Continuously save session state every 3 seconds while user is interacting
  const saveState = async () => {
    try {
      await browser.storageState({ path: SESSION_FILE });
    } catch {}
  };

  const interval = setInterval(saveState, 3000);

  // Keep browser open until user closes the window or 10-minute timeout
  await new Promise<void>((resolve) => {
    browser.on('close', () => {
      clearInterval(interval);
      resolve();
    });
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 10 * 60 * 1000);
  });

  // Final session save
  await saveState();
  logActivity('SUCCESS', 'AUTH', 'Đã lưu trữ phiên làm việc và trạng thái tài khoản Facebook/Fanpage thành công!');
  return 'Đã lưu phiên làm việc Facebook/Fanpage thành công!';
}
