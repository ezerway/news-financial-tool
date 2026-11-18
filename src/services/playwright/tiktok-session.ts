import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logActivity } from '@/lib/db';
import { getStorageDir, getChromiumLaunchArgs, cleanStaleChromeLocks, getUserDataDir, isInteractiveSessionActive, setInteractiveSessionActive } from './session';

export function getTikTokSessionPath(): string {
  return path.join(/*turbopackIgnore: true*/ getStorageDir(), 'tiktok-session.json');
}

/**
 * Dùng chung browser-profile với Facebook và toàn bộ hệ thống (không tách riêng)
 */
export function getTikTokUserDataDir(): string {
  return getUserDataDir();
}

export function isTikTokSessionAvailable(): boolean {
  const sessionPath = getTikTokSessionPath();
  if (fs.existsSync(/*turbopackIgnore: true*/ sessionPath)) {
    try {
      const stats = fs.statSync(/*turbopackIgnore: true*/ sessionPath);
      return stats.size > 20;
    } catch {
      return false;
    }
  }
  return false;
}

export interface TikTokStatusResult {
  loggedIn: boolean;
  username?: string;
  message: string;
}

export async function checkTikTokLoginStatus(): Promise<TikTokStatusResult> {
  const sessionPath = getTikTokSessionPath();
  if (!fs.existsSync(/*turbopackIgnore: true*/ sessionPath)) {
    return {
      loggedIn: false,
      message: 'Chưa có file phiên TikTok (storage/tiktok-session.json)',
    };
  }

  try {
    const raw = fs.readFileSync(/*turbopackIgnore: true*/ sessionPath, 'utf-8');
    const state = JSON.parse(raw);
    const cookies = state.cookies || [];
    if (!Array.isArray(cookies) || cookies.length === 0) {
      return {
        loggedIn: false,
        message: 'File phiên rỗng, chưa có cookies TikTok.',
      };
    }

    // Key TikTok authentication cookies
    const authCookie = cookies.find(
      (c: any) =>
        c.name === 'sessionid' ||
        c.name === 'sid_guard' ||
        c.name === 'sessionid_ss' ||
        c.name === 'uid_tt' ||
        c.name === 'tt_chain_token'
    );

    if (!authCookie) {
      return {
        loggedIn: false,
        message: 'Chưa tìm thấy cookie xác thực (sessionid). Vui lòng đăng nhập TikTok.',
      };
    }

    // Check expiration if available
    const nowSec = Math.floor(Date.now() / 1000);
    if (authCookie.expires && authCookie.expires < nowSec) {
      return {
        loggedIn: false,
        message: 'Cookie phiên TikTok đã hết hạn. Vui lòng đăng nhập lại.',
      };
    }

    return {
      loggedIn: true,
      username: 'TikTok Creator',
      message: 'Phiên TikTok đang hoạt động sẵn sàng đăng video',
    };
  } catch (err: any) {
    return {
      loggedIn: false,
      message: `Lỗi đọc file phiên: ${err.message}`,
    };
  }
}

export async function launchInteractiveTikTokLogin(targetUrl = 'https://www.tiktok.com/login'): Promise<string> {
  if (isInteractiveSessionActive()) {
    return 'Cửa sổ trình duyệt đang được mở. Vui lòng thao tác trên cửa sổ đó!';
  }

  setInteractiveSessionActive(true);
  logActivity('INFO', 'AUTH', 'Khởi chạy trình duyệt tương tác để đăng nhập TikTok...');

  const launchArgs = getChromiumLaunchArgs();
  const userDataDir = getTikTokUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  let browser;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: null,
      args: launchArgs,
    });
  } catch (err: unknown) {
    setInteractiveSessionActive(false);
    throw err;
  }

  await injectTikTokSessionCookies(browser);

  const page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();
  logActivity('INFO', 'AUTH', `Đang mở TikTok tại: ${targetUrl}. Hãy đăng nhập tài khoản của bạn.`);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});

  const saveState = async () => {
    try {
      await browser.storageState({ path: getTikTokSessionPath() });
    } catch {}
  };

  page.on('load', () => {
    saveState().catch(() => {});
  });

  const interval = setInterval(saveState, 15000);

  try {
    await new Promise<void>((resolve) => {
      browser.on('close', () => {
        clearInterval(interval);
        resolve();
      });
      setTimeout(() => {
        clearInterval(interval);
        resolve();
      }, 15 * 60 * 1000);
    });

    await saveState();
    logActivity('SUCCESS', 'AUTH', 'Đã lưu trữ phiên làm việc TikTok thành công!');
    return 'Đã lưu phiên làm việc TikTok thành công!';
  } finally {
    clearInterval(interval);
    setInteractiveSessionActive(false);
  }
}

export function parseAndSaveTikTokCookies(rawCookiesInput: string): { success: boolean; message: string } {
  try {
    let cookies: any[] = [];
    const input = rawCookiesInput.trim();

    if (input.startsWith('[') || input.startsWith('{')) {
      const parsed = JSON.parse(input);
      cookies = Array.isArray(parsed) ? parsed : (parsed.cookies || []);
    } else {
      const pairs = input.split(';');
      for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx > -1) {
          const name = pair.slice(0, idx).trim();
          const value = pair.slice(idx + 1).trim();
          if (name) {
            cookies.push({
              name,
              value,
              domain: '.tiktok.com',
              path: '/',
              secure: true,
              sameSite: 'None',
            });
          }
        }
      }
    }

    if (!Array.isArray(cookies) || cookies.length === 0) {
      throw new Error('Dữ liệu cookie không hợp lệ. Vui lòng kiểm tra lại định dạng JSON hoặc Name=Value.');
    }

    const oneYearLater = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const normalizedCookies = cookies
      .filter((c: any) => c && c.name && c.value)
      .map((c: any) => {
        const name = String(c.name).trim();
        const value = String(c.value).trim();
        const isHostCookie = name.startsWith('__Host-');
        const isSecure = Boolean(c.secure ?? true);

        let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';
        if (c.sameSite === 'Strict' || c.sameSite === 'Lax') {
          sameSite = c.sameSite;
        } else if (c.sameSite === 'None' || c.sameSite === 'no_restriction') {
          sameSite = isSecure ? 'None' : 'Lax';
        }

        const rawDomain = c.domain ? String(c.domain).trim() : '.tiktok.com';
        const domain = rawDomain.startsWith('.') ? rawDomain : `.${rawDomain.replace(/^\.+/, '')}`;
        const rawExpires = typeof c.expires === 'number' ? c.expires : (c.expirationDate ? Number(c.expirationDate) : oneYearLater);
        const expires = Math.floor(rawExpires);

        const cookieObj: any = {
          name,
          value,
          path: c.path || '/',
          expires,
          httpOnly: Boolean(c.httpOnly),
          secure: isSecure,
          sameSite,
        };

        if (!isHostCookie) {
          cookieObj.domain = domain;
        }

        return cookieObj;
      });

    const sessionData = {
      cookies: normalizedCookies,
      origins: [
        {
          origin: 'https://www.tiktok.com',
          localStorage: [],
        },
      ],
    };

    fs.writeFileSync(getTikTokSessionPath(), JSON.stringify(sessionData, null, 2), 'utf-8');
    logActivity('SUCCESS', 'AUTH', `Đã lưu thành công ${normalizedCookies.length} cookies TikTok vào tiktok-session.json`);

    return {
      success: true,
      message: `Đã lưu thành công ${normalizedCookies.length} cookies TikTok!`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Lỗi lưu cookies: ${err.message}`,
    };
  }
}

export async function injectTikTokSessionCookies(context: { addCookies: (cookies: any[]) => Promise<void> }): Promise<number> {
  const sessionFile = getTikTokSessionPath();
  if (!fs.existsSync(/*turbopackIgnore: true*/ sessionFile)) return 0;

  try {
    const raw = fs.readFileSync(sessionFile, 'utf-8');
    const state = JSON.parse(raw);
    const cookies = state.cookies || [];
    if (!Array.isArray(cookies) || cookies.length === 0) return 0;

    const oneYearLater = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
    const isTikTokDomain = (d?: string) => {
      if (!d) return true;
      const lower = d.toLowerCase();
      return (
        lower.includes('tiktok.com') ||
        lower.includes('byteoversea.com') ||
        lower.includes('ibytedtos.com') ||
        lower.includes('tiktokcdn.com')
      );
    };

    const validCookies = cookies
      .filter((c: any) => c && c.name && c.value && isTikTokDomain(c.domain))
      .map((c: any) => {
        const name = String(c.name).trim();
        const value = String(c.value).trim();
        const isHostCookie = name.startsWith('__Host-');
        const isSecure = Boolean(c.secure ?? true);

        let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';
        if (c.sameSite === 'Strict' || c.sameSite === 'Lax') {
          sameSite = c.sameSite;
        } else if (c.sameSite === 'None' || c.sameSite === 'no_restriction') {
          sameSite = isSecure ? 'None' : 'Lax';
        }

        const rawDomain = c.domain ? String(c.domain).trim() : '.tiktok.com';
        const domain = rawDomain.startsWith('.') ? rawDomain : `.${rawDomain.replace(/^\.+/, '')}`;
        const rawExpires = typeof c.expires === 'number' ? c.expires : (c.expirationDate ? Number(c.expirationDate) : oneYearLater);
        const expires = Math.floor(rawExpires);

        const cookieObj: any = {
          name,
          value,
          path: c.path || '/',
          expires,
          httpOnly: Boolean(c.httpOnly),
          secure: isSecure,
          sameSite,
        };

        if (!isHostCookie) {
          cookieObj.domain = domain;
        }

        return cookieObj;
      });

    let loadedCount = 0;
    // Thử nạp hàng loạt trước để tối ưu tốc độ
    try {
      await context.addCookies(validCookies);
      loadedCount = validCookies.length;
    } catch {
      // Nếu có bất kỳ cookie nào lỗi định dạng, chuyển sang nạp từng cookie độc lập
      for (const cookie of validCookies) {
        try {
          await context.addCookies([cookie]);
          loadedCount++;
        } catch {
          // Bỏ qua cookie không hợp lệ để không ảnh hưởng đến các cookie khác
        }
      }
    }

    return loadedCount;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('WARN', 'AUTH', `Không thể nạp cookies TikTok từ session file: ${msg}`);
  }
  return 0;
}

