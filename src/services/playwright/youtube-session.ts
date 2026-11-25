import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logActivity, getSetting } from '@/lib/db';
import {
  getStorageDir,
  getChromiumLaunchArgs,
  cleanStaleChromeLocks,
  getUserDataDir,
  isInteractiveSessionActive,
  setInteractiveSessionActive,
} from './session';

/**
 * Trả về thư mục Profile dùng chung duy nhất của hệ thống (Facebook, TikTok, YouTube).
 */
export function getYouTubeUserDataDir(): string {
  return getUserDataDir();
}

export interface YouTubeStatusResult {
  loggedIn: boolean;
  channelName?: string;
  channelHandle?: string;
  channelUrl?: string;
  message: string;
}

/**
 * Kiểm tra trạng thái đăng nhập YouTube trên browser-profile dùng chung.
 */
export async function checkYouTubeLoginStatus(): Promise<YouTubeStatusResult> {
  const userDataDir = getYouTubeUserDataDir();
  const configuredChannelUrl = getSetting('youtube_channel_url', '').trim();

  // Kiểm tra sự tồn tại của thư mục profile
  if (!fs.existsSync(userDataDir)) {
    return {
      loggedIn: false,
      channelUrl: configuredChannelUrl || undefined,
      message: 'Chưa có dữ liệu phiên trình duyệt. Vui lòng bấm Kết nối để đăng nhập Google / YouTube.',
    };
  }

  // Quét nhanh qua file Cookies SQLite hoặc Default/Network/Cookies của Chromium nếu có
  const defaultDir = path.join(/*turbopackIgnore: true*/ userDataDir, 'Default');
  const cookiesPath = path.join(/*turbopackIgnore: true*/ defaultDir, 'Network', 'Cookies');
  const oldCookiesPath = path.join(/*turbopackIgnore: true*/ defaultDir, 'Cookies');

  const hasCookieFile = fs.existsSync(/*turbopackIgnore: true*/ cookiesPath) || fs.existsSync(/*turbopackIgnore: true*/ oldCookiesPath);
  if (!hasCookieFile) {
    return {
      loggedIn: false,
      channelUrl: configuredChannelUrl || undefined,
      message: 'Chưa tìm thấy cookie trong profile. Vui lòng đăng nhập YouTube Studio.',
    };
  }

  try {
    // Đọc thông tin kênh nếu có cấu hình
    return {
      loggedIn: true,
      channelUrl: configuredChannelUrl || undefined,
      message: configuredChannelUrl
        ? `Phiên trình duyệt sẵn sàng • Kênh mục tiêu: ${configuredChannelUrl}`
        : 'Phiên trình duyệt sẵn sàng cho YouTube Studio',
    };
  } catch (err: any) {
    return {
      loggedIn: false,
      channelUrl: configuredChannelUrl || undefined,
      message: `Lỗi kiểm tra phiên: ${err.message}`,
    };
  }
}

/**
 * Khởi chạy trình duyệt tương tác có giao diện người dùng (hỗ trợ Xvfb / VNC trên Linux)
 * để đăng nhập Google / YouTube Studio và chọn kênh.
 */
export async function launchInteractiveYouTubeLogin(initialUrl?: string): Promise<string> {
  if (isInteractiveSessionActive()) {
    return 'Cửa sổ trình duyệt đang được mở. Vui lòng thao tác trên cửa sổ trình duyệt đã mở!';
  }

  setInteractiveSessionActive(true);
  const target = initialUrl || getSetting('youtube_channel_url', '').trim() || 'https://studio.youtube.com/';
  logActivity('INFO', 'AUTH', `Khởi chạy trình duyệt tương tác để quản lý phiên YouTube: ${target}...`);

  const launchArgs = getChromiumLaunchArgs();
  const userDataDir = getYouTubeUserDataDir();
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

  const page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();
  await page.goto(target, { waitUntil: 'domcontentloaded' }).catch(() => {});

  try {
    // Giữ trình duyệt mở cho tới khi người dùng đóng cửa sổ hoặc hết hạn 15 phút
    await new Promise<void>((resolve) => {
      browser.on('close', () => {
        resolve();
      });
      setTimeout(() => {
        resolve();
      }, 15 * 60 * 1000);
    });
  } finally {
    setInteractiveSessionActive(false);
    try {
      await browser.close();
    } catch {}
    logActivity('INFO', 'AUTH', 'Cửa sổ trình duyệt YouTube đã đóng. Phiên đã được lưu vào browser-profile dùng chung.');
  }

  return 'Hoàn tất phiên tương tác YouTube.';
}
