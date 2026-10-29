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

/**
 * Robust launch flags for Chromium across macOS, Windows, and Linux VPS
 * Adds --disable-dev-shm-usage and --disable-gpu on Linux to eliminate RESULT_CODE_KILLED_BAD_MESSAGE
 */
export function getChromiumLaunchArgs(extraArgs: string[] = []): string[] {
  const args = [
    '--disable-blink-features=AutomationControlled',
    ...extraArgs,
  ];

  if (process.platform === 'linux') {
    args.push(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // Uses /tmp instead of 64MB /dev/shm (fixes RESULT_CODE_KILLED_BAD_MESSAGE)
      '--disable-gpu',           // Avoids GPU IPC driver crash on headless VPS
      '--disable-software-rasterizer',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-component-extensions-with-background-pages',
      '--disable-extensions',
      '--mute-audio',
      '--no-zygote',
      '--js-flags=--max-old-space-size=512'
    );
  }

  return args;
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

let isInteractiveLoginActive = false;

export async function launchInteractiveLogin(initialUrl?: string): Promise<string> {
  if (isInteractiveLoginActive) {
    return 'Cửa sổ trình duyệt đang được mở. Vui lòng thao tác trên cửa sổ trình duyệt đã mở!';
  }

  isInteractiveLoginActive = true;
  logActivity('INFO', 'AUTH', 'Khởi chạy trình duyệt tương tác để quản lý phiên Facebook / Fanpage...');

  const launchArgs = getChromiumLaunchArgs();

  let browser;
  try {
    browser = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: false,
      viewport: null, // Crucial for macOS / Retina to eliminate viewport redraw flickering
      args: launchArgs,
    });
  } catch (err: unknown) {
    isInteractiveLoginActive = false;
    throw err;
  }

  // Inject existing cookies if available
  await injectSessionCookies(browser);

  const page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();
  const target = initialUrl || getSetting('fb_page_url') || 'https://www.facebook.com/';
  logActivity('INFO', 'AUTH', `Đang mở Facebook tại: ${target}. Bạn có thể đăng nhập hoặc chuyển đổi sang Fanpage cần đăng bài.`);
  await page.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});

  // Save session state on navigation or periodically
  const saveState = async () => {
    try {
      await browser.storageState({ path: SESSION_FILE });
    } catch {}
  };

  page.on('load', () => {
    saveState().catch(() => {});
  });

  // Moderate periodic save (every 15s instead of 3s to avoid CDP focus & render jitter)
  const interval = setInterval(saveState, 15000);

  try {
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
  } finally {
    clearInterval(interval);
    isInteractiveLoginActive = false;
  }
}

/**
 * Saves Facebook cookies directly into fb-session.json for headless environments (Linux VPS)
 */
export function saveRawFacebookCookies(cUserVal: string, xsVal: string, extraCookies: Array<Record<string, unknown>> = []): { success: boolean; message: string } {
  const cleanCUser = cUserVal.trim();
  const cleanXs = xsVal.trim();
  if (!cleanCUser || !cleanXs) {
    throw new Error('Vui lòng cung cấp cả c_user và xs hợp lệ.');
  }

  const oneYearLater = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const cookies = [
    {
      name: 'c_user',
      value: cleanCUser,
      domain: '.facebook.com',
      path: '/',
      expires: oneYearLater,
      httpOnly: false,
      secure: true,
      sameSite: 'None',
    },
    {
      name: 'xs',
      value: cleanXs,
      domain: '.facebook.com',
      path: '/',
      expires: oneYearLater,
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
    ...extraCookies.filter((c) => c.name !== 'c_user' && c.name !== 'xs'),
  ];

  const state = {
    cookies,
    origins: [],
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), 'utf-8');
  logActivity('SUCCESS', 'AUTH', `Đã lưu cookie Facebook thủ công cho tài khoản ID: ${cleanCUser}`);
  return { success: true, message: `Đã lưu phiên đăng nhập Facebook thành công cho User ID: ${cleanCUser}` };
}

/**
 * Smart parse and save cookies from multiple formats:
 * - Cookie-Editor JSON array: [{ name: "c_user", value: "..." }, ...]
 * - Playwright storageState JSON: { cookies: [...], origins: [...] }
 * - Raw cookie string: c_user=...; xs=...; datr=...
 */
export function parseAndSaveFacebookCookies(rawInput: string): { success: boolean; message: string; cUser?: string } {
  const text = rawInput.trim();
  if (!text) {
    throw new Error('Dữ liệu cookie trống. Vui lòng dán cookie hợp lệ.');
  }

  let cookiesList: Array<Record<string, unknown>> = [];
  let originsList: Array<Record<string, unknown>> = [];

  if (text.startsWith('[') || text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        cookiesList = parsed;
      } else if (parsed && Array.isArray(parsed.cookies)) {
        cookiesList = parsed.cookies;
        if (Array.isArray(parsed.origins)) {
          originsList = parsed.origins;
        }
      }
    } catch (e: unknown) {
      throw new Error(`Dữ liệu JSON không đúng định dạng: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    // Parse key=value; key=value string
    const pairs = text.split(';');
    for (const pair of pairs) {
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (name && value) {
          cookiesList.push({ name, value });
        }
      }
    }
  }

  // Validate c_user and xs
  const cUserObj = cookiesList.find((c) => c.name === 'c_user');
  const xsObj = cookiesList.find((c) => c.name === 'xs');

  if (!cUserObj || !cUserObj.value || !xsObj || !xsObj.value) {
    throw new Error('Không tìm thấy cookie c_user hoặc xs trong dữ liệu bạn vừa nhập. Vui lòng đảm bảo đã copy đúng cookie Facebook.');
  }

  const oneYearLater = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const normalizedCookies = cookiesList.map((c) => ({
    name: String(c.name),
    value: String(c.value),
    domain: typeof c.domain === 'string' && c.domain ? (c.domain.startsWith('.') ? c.domain : `.${c.domain.replace(/^\.+/, '')}`) : '.facebook.com',
    path: typeof c.path === 'string' && c.path ? c.path : '/',
    expires: typeof c.expires === 'number' ? c.expires : (typeof c.expirationDate === 'number' ? Math.floor(c.expirationDate) : oneYearLater),
    httpOnly: Boolean(c.httpOnly),
    secure: Boolean(c.secure ?? true),
    sameSite: (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') ? c.sameSite : 'None',
  }));

  const state = {
    cookies: normalizedCookies,
    origins: originsList,
  };

  fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2), 'utf-8');
  logActivity('SUCCESS', 'AUTH', `Đã lưu thành công ${normalizedCookies.length} cookies Facebook cho User ID: ${cUserObj.value}`);

  return {
    success: true,
    message: `Đã lưu thành công ${normalizedCookies.length} cookies Facebook cho User ID: ${cUserObj.value}`,
    cUser: String(cUserObj.value),
  };
}

/**
 * Injects cookies from fb-session.json into an active Playwright browser context
 */
export async function injectSessionCookies(context: { addCookies: (cookies: any[]) => Promise<void> }): Promise<number> {
  if (!fs.existsSync(SESSION_FILE)) return 0;

  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    const state = JSON.parse(raw);
    const cookies = state.cookies || [];
    if (!Array.isArray(cookies) || cookies.length === 0) return 0;

    const oneYearLater = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const validCookies = cookies
      .filter((c: any) => c.name && c.value)
      .map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain?.startsWith('.') ? c.domain : (c.domain ? `.${c.domain.replace(/^\.+/, '')}` : '.facebook.com'),
        path: c.path || '/',
        expires: typeof c.expires === 'number' ? c.expires : (c.expirationDate ? Math.floor(c.expirationDate) : oneYearLater),
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(c.secure ?? true),
        sameSite: (c.sameSite === 'Strict' || c.sameSite === 'Lax' || c.sameSite === 'None') ? c.sameSite : 'None',
      }));

    if (validCookies.length > 0) {
      await context.addCookies(validCookies);
      return validCookies.length;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('WARN', 'AUTH', `Không thể nạp cookies từ session file: ${msg}`);
  }
  return 0;
}


