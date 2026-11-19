import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import {
  getTikTokUserDataDir,
  getTikTokSessionPath,
  isTikTokSessionAvailable,
  injectTikTokSessionCookies,
} from './tiktok-session';
import { getChromiumLaunchArgs, cleanStaleChromeLocks } from './session';
import { logActivity, resolveHeadless, isDeveloperMode } from '@/lib/db';
import { replaceDateWildcards } from '@/lib/date';

export interface PostTikTokOptions {
  reelId?: string;
  filePath: string;
  content?: string;
  comment?: string;
  headless?: boolean;
  timeout?: number;
  onProgress?: (message: string) => void;
}

export interface PostTikTokResult {
  success: boolean;
  message: string;
  filePath: string;
  tiktokUrl?: string;
  commentSuccess?: boolean;
  error?: string;
  screenshotPath?: string;
  debugVideoPath?: string;
}

const VIDEOS_DIR = path.join(process.cwd(), 'storage', 'videos');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'storage', 'screenshots');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

/**
 * Tự động xử lý Popup xác minh danh tính TikTok "Verify it's really you"
 * bằng cách gửi mã về Email và đọc mã OTP trực tiếp từ Gmail trong cùng browser-profile.
 */
async function handleTikTokVerificationModal(
  page: any,
  context: any,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void,
  headless: boolean
): Promise<boolean> {
  const verifyModalSelectors = [
    'div[role="dialog"]:has-text("Verify it\'s really you")',
    'div[role="dialog"]:has-text("verify your identity")',
    'div:has-text("Verify it\'s really you")',
    'div:has-text("Before you continue, verify your identity")',
    'div:has-text("Xác minh danh tính")',
    'div:has-text("Xác minh bạn là chính bạn")',
  ];

  let isVerifyModalVisible = false;
  for (let i = 0; i < 3; i++) {
    for (const vSel of verifyModalSelectors) {
      if (await page.locator(vSel).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        isVerifyModalVisible = true;
        break;
      }
    }
    if (isVerifyModalVisible) break;
    await page.waitForTimeout(1000);
  }

  if (!isVerifyModalVisible) {
    return false;
  }

  notify('TikTok yêu cầu xác minh danh tính ("Verify it\'s really you")!', 'WARN');

  // Bước 1: Trước khi gửi mã mới, đọc mã OTP mới nhất hiện tại trên Gmail (để đối chiếu không lấy nhầm mã cũ)
  let initialLatestCode = '';
  try {
    const checkPage = await context.newPage();
    await checkPage.goto('https://mail.google.com/mail/u/0/#search/from%3Atiktok', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(() => {});
    await checkPage.waitForTimeout(3000);
    const topRowText = await checkPage.locator('tr[role="row"]').first().innerText({ timeout: 4000 }).catch(() => '');
    const m = topRowText.match(/([A-Z0-9]{6})\s+is your/i) || topRowText.match(/([A-Z0-9]{6})/);
    if (m) {
      initialLatestCode = m[1].toUpperCase();
      notify(`[Gmail] Mã TikTok gần nhất hiện có trong hòm thư: ${initialLatestCode}`);
    }
    await checkPage.close().catch(() => {});
  } catch (err: any) {
    notify(`[Gmail] Chưa đọc được mã cũ: ${err?.message || err}`, 'INFO');
  }

  // Bước 2: Bấm vào phương thức xác minh qua Email trong popup TikTok và đảm bảo đã chuyển sang giao diện nhập mã
  notify('Đang chọn phương thức xác minh qua Email trên TikTok...');

  const isMethodScreenStillOpen = async () => {
    return await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      return (
        text.includes('one of the following methods') ||
        text.includes('verify your identity using one of') ||
        text.includes('chọn một trong các phương thức')
      );
    });
  };

  let emailClickedAndTransitioned = false;
  const clickStart = Date.now();

  while (Date.now() - clickStart < 15000) {
    // 0. Click phần tử xác minh với selector chính xác: pc-home-item-
    const pcHomeSelectors = [
      '[class*="pc-home-item-"]',
      '[id*="pc-home-item-"]',
      '[data-e2e*="pc-home-item-"]',
    ];

    for (const sel of pcHomeSelectors) {
      const items = page.locator(sel);
      const count = await items.count().catch(() => 0);
      if (count > 0) {
        let targetItem = items.filter({ hasText: /email|@/i }).first();
        if ((await targetItem.count().catch(() => 0)) === 0) {
          targetItem = items.first();
        }
        notify(`Tìm thấy ${count} phần tử với selector [${sel}], click gửi mã...`);
        const box = await targetItem.boundingBox().catch(() => null);
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
        }
        await targetItem.click({ force: true }).catch(() => {});
        break;
      }
    }

    // Kiểm tra thêm trên tất cả các iframes (nếu modal nằm trong iframe)
    for (const frame of page.frames()) {
      for (const sel of pcHomeSelectors) {
        const frameItems = frame.locator(sel);
        if ((await frameItems.count().catch(() => 0)) > 0) {
          let target = frameItems.filter({ hasText: /email|@/i }).first();
          if ((await target.count().catch(() => 0)) === 0) {
            target = frameItems.first();
          }
          notify(`Tìm thấy phần tử [${sel}] trong iframe, click...`);
          await target.click({ force: true }).catch(() => {});
          break;
        }
      }
    }

    // 1. Thử click trực tiếp vào text email (@...com) hoặc chữ Email
    const emailTextLocator = page.locator('text=/.*@.*\\.com/i').first();
    if (await emailTextLocator.isVisible({ timeout: 500 }).catch(() => false)) {
      const box = await emailTextLocator.boundingBox().catch(() => null);
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
      }
      await emailTextLocator.click({ force: true }).catch(() => {});
    }

    // 2. Thử click vào card container qua DOM evaluation (ưu tiên pc-home-item-)
    await page.evaluate(() => {
      // Ưu tiên class pc-home-item-
      const pcItem = document.querySelector('[class*="pc-home-item-"], [id*="pc-home-item-"]');
      if (pcItem) {
        (pcItem as HTMLElement).click();
        pcItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        pcItem.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        pcItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return;
      }

      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        const text = (el.textContent || '').trim();
        if (text.includes('@') && text.includes('.com') && el.children.length === 0) {
          const card =
            el.closest('[class*="pc-home-item-"]') ||
            el.closest('[role="button"]') ||
            el.closest('button') ||
            el.closest('li') ||
            el.closest('[class*="item"]') ||
            el.closest('[class*="card"]') ||
            el.parentElement ||
            el;
          (card as HTMLElement).click();
          card.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          card.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          break;
        }
      }
    });

    // 3. Thử click chevron > hoặc icon email
    const chevron = page.locator('div[role="dialog"] svg, div[role="dialog"] [class*="arrow"], div[role="dialog"] [class*="chevron"]').first();
    if (await chevron.isVisible({ timeout: 500 }).catch(() => false)) {
      await chevron.click({ force: true }).catch(() => {});
    }

    await page.waitForTimeout(2000);

    // Kiểm tra xem đã chuyển màn hình sang nhập mã chưa
    const stillMethodScreen = await isMethodScreenStillOpen();
    const hasCodeInput = (await page.locator('input').count().catch(() => 0)) > 0;
    const hasCodeText = await page.evaluate(() => {
      const text = (document.body ? document.body.innerText : '').toLowerCase();
      return (
        text.includes('code') ||
        text.includes('mã') ||
        text.includes('resend') ||
        text.includes('gửi lại') ||
        text.includes('sent to') ||
        text.includes('đã gửi')
      );
    });

    if (!stillMethodScreen || hasCodeInput || hasCodeText) {
      emailClickedAndTransitioned = true;
      notify('Đã click chọn xác minh Email thành công! TikTok đã chuyển sang giao diện nhập mã OTP.', 'SUCCESS');
      break;
    }

    notify('Đang thử lại click vào lựa chọn Email...');
    await page.waitForTimeout(1000);
  }

  if (!emailClickedAndTransitioned) {
    notify('Cảnh báo: Chưa xác nhận được TikTok đã chuyển sang giao diện nhập mã OTP, tiếp tục tiến trình...', 'WARN');
  }

  // Bước 3: Mở tab Gmail và đợi mã OTP mới từ TikTok
  notify('Đang truy cập Gmail để tự động lấy mã OTP xác minh từ TikTok...');
  let verificationCode = '';
  let gmailPage: any = null;

  try {
    gmailPage = await context.newPage();
    const maxPollTime = 60000; // Đợi tối đa 60s
    const pollStart = Date.now();

    while (Date.now() - pollStart < maxPollTime) {
      await gmailPage.goto('https://mail.google.com/mail/u/0/#search/from%3Atiktok', {
        waitUntil: 'domcontentloaded',
        timeout: 25000,
      }).catch(() => {});
      await gmailPage.waitForTimeout(3000);

      const rows = gmailPage.locator('tr[role="row"]');
      const rowCount = await rows.count().catch(() => 0);

      if (rowCount > 0) {
        // Kiểm tra 2 email mới nhất
        const checkCount = Math.min(rowCount, 2);
        for (let rIdx = 0; rIdx < checkCount; rIdx++) {
          const row = rows.nth(rIdx);
          const rowText = await row.innerText().catch(() => '');

          // Trích xuất mã OTP 6 ký tự
          const match =
            rowText.match(/([A-Z0-9]{6})\s+is your verification code/i) ||
            rowText.match(/([0-9]{6})\s+is your 6-digit code/i) ||
            rowText.match(/To verify your account[\s\S]*?([A-Z0-9]{6})/i) ||
            rowText.match(/code is:\s*([A-Z0-9]{6})/i);

          if (match && match[1]) {
            const candidateCode = match[1].trim().toUpperCase();
            // CHỈ CHẤP NHẬN MÃ MỚI (KHÁC MÃ CŨ BAN ĐẦU)
            if (candidateCode !== initialLatestCode) {
              verificationCode = candidateCode;
              notify(`Đã tìm thấy mã xác minh MỚI từ TikTok: ${verificationCode}`, 'SUCCESS');
              break;
            }
          } else {
            // Thử click vào email đầu tiên để xem nội dung
            try {
              await row.click({ timeout: 2000 });
              await gmailPage.waitForTimeout(1500);
              const fullText = await gmailPage.evaluate(() => document.body.innerText);
              const fullMatch =
                fullText.match(/([A-Z0-9]{6})\s+is your verification code/i) ||
                fullText.match(/enter this code in TikTok:\s*([A-Z0-9]{6})/i) ||
                fullText.match(/Your 6-digit code is:\s*([0-9]{6})/i) ||
                fullText.match(/([0-9]{6})\s+is your 6-digit code/i);

              if (fullMatch && fullMatch[1]) {
                const candidateCode = fullMatch[1].trim().toUpperCase();
                if (candidateCode !== initialLatestCode) {
                  verificationCode = candidateCode;
                  notify(`Đã đọc mã xác minh MỚI từ nội dung email: ${verificationCode}`, 'SUCCESS');
                  break;
                }
              }
              await gmailPage.goBack().catch(() => {});
            } catch {}
          }
        }

        if (verificationCode) break;
      }

      notify('Đang chờ email OTP mới từ TikTok (thử lại sau 4s)...');
      await page.waitForTimeout(4000);
    }
  } catch (gmailErr: any) {
    notify(`Lỗi khi truy vấn Gmail: ${gmailErr?.message || gmailErr}`, 'WARN');
  } finally {
    if (gmailPage && !gmailPage.isClosed()) {
      await gmailPage.close().catch(() => {});
    }
  }

  // Bước 4: Nhập mã OTP vào form xác minh của TikTok
  if (verificationCode) {
    notify(`Tiến hành nhập mã xác thực [${verificationCode}] vào giao diện TikTok...`);
    await page.bringToFront().catch(() => {});
    await page.waitForTimeout(1500);

    const pinInputs = page.locator('input:not([type="hidden"]):not([type="file"])');
    const inputCount = await pinInputs.count().catch(() => 0);
    notify(`Tìm thấy ${inputCount} ô input trên giao diện TikTok.`);

    if (inputCount >= 6) {
      for (let i = 0; i < 6; i++) {
        await pinInputs.nth(i).click().catch(() => {});
        await pinInputs.nth(i).fill(verificationCode[i]).catch(() => {});
        await page.waitForTimeout(100);
      }
    } else if (inputCount > 0) {
      const singleInput = pinInputs.first();
      await singleInput.click().catch(() => {});
      await singleInput.fill('').catch(() => {});
      await singleInput.fill(verificationCode).catch(async () => {
        await singleInput.pressSequentially(verificationCode, { delay: 80 });
      });
    }

    // Luôn gõ trực tiếp bàn phím để kích hoạt state nếu input là custom component
    await page.keyboard.type(verificationCode, { delay: 80 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Bấm nút Xác nhận nếu có
    const verifyButtons = [
      'button:has-text("Verify")',
      'button:has-text("Xác minh")',
      'button:has-text("Next")',
      'button:has-text("Tiếp tục")',
      'button:has-text("Confirm")',
      'button:has-text("Xác nhận")',
      'button[type="submit"]',
    ];

    for (const bSel of verifyButtons) {
      const b = page.locator(bSel).first();
      if (await b.isVisible({ timeout: 1500 }).catch(() => false)) {
        await b.click().catch(() => {});
        break;
      }
    }

    notify('Đang chờ TikTok xử lý mã OTP...');
    await page.waitForTimeout(5000);
  } else {
    notify('Không lấy được mã OTP tự động từ Gmail.', 'WARN');
    if (!headless) {
      notify('Trình duyệt đang mở, bạn có thể tự nhập mã OTP trên màn hình trong 60 giây...', 'WARN');
      await page.waitForTimeout(60000);
    }
  }

  // Bước 5: Kiểm tra kết quả
  let isClosed = true;
  for (const vSel of verifyModalSelectors) {
    if (await page.locator(vSel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
      isClosed = false;
      break;
    }
  }

  if (isClosed) {
    notify('Xác minh danh tính TikTok hoàn tất thành công! Modal đã đóng.', 'SUCCESS');
    await page.waitForTimeout(3000);

    // Bấm lại nút Post nếu còn hiện
    const retryPostBtn = page.locator('[data-e2e="post_video_button"]').first();
    if (await retryPostBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      notify('Bấm lại nút Đăng video (post_video_button) sau khi xác minh hoàn tất...');
      await retryPostBtn.click().catch(() => {});
      await page.waitForTimeout(3000);
    }
    return true;
  } else {
    throw new Error('TikTok yêu cầu xác minh danh tính ("Verify it\'s really you"), nhưng modal chưa đóng sau khi nhập mã.');
  }
}

/**
 * Automate uploading video to TikTok according to exact workflow:
 * 1. Navigate to https://www.tiktok.com/
 * 2. Click button[data-key-interaction="nav_upload"][aria-label="Upload"]
 * 3. Click [role="button"][aria-label="Select video"] & upload file
 * 4. Fill caption: [aria-autocomplete="list"][contenteditable="true"][role="combobox"]
 * 5. Scroll to bottom, click [data-e2e="post_video_button"]
 * 6. Refresh https://www.tiktok.com/tiktokstudio/content, match a[target="_blank"][data-tt="components_PostInfoCell_a"]
 */
export async function uploadTikTokVideo(options: PostTikTokOptions): Promise<PostTikTokResult> {
  const { reelId, filePath, content = '', onProgress } = options;
  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    logActivity(level, 'POST_TIKTOK', msg);
    if (onProgress) onProgress(msg);
  };

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath);
  if (!fs.existsSync(resolvedPath)) {
    const errorMsg = `Đường dẫn file video không hợp lệ hoặc không tồn tại: ${resolvedPath}`;
    notify(errorMsg, 'ERROR');
    return { success: false, message: errorMsg, filePath: resolvedPath, error: errorMsg };
  }

  const headless = resolveHeadless(options.headless !== undefined ? options.headless : true);
  const idTag = reelId ? String(reelId).slice(0, 8) : 'manual';
  const timestamp = Date.now();
  const videoFileName = `tiktok_reel_${idTag}_${timestamp}.webm`;
  const screenshotFileName = `tiktok_reel_err_${idTag}_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  if (!isTikTokSessionAvailable()) {
    notify('Cảnh báo: Chưa tìm thấy session TikTok (storage/tiktok-session.json). Hãy mở cài đặt và đăng nhập TikTok trước.', 'WARN');
  }

  const userDataDir = getTikTokUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  let context: any = null;
  let page: any = null;
  let video: any = null;

  try {
    notify(`Bắt đầu tiến trình tải video lên TikTok (headless: ${headless})...`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1280, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications', '--disable-blink-features=AutomationControlled']),
    });

    await injectTikTokSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();

    context.on('page', (newPage: Page) => {
      notify(`[TikTok] Phát hiện chuyển hướng hoặc mở tab mới: ${newPage.url()}`);
      page = newPage;
      if (newPage.video()) {
        video = newPage.video();
      }
    });

    // Bước 1: Điều hướng đến trang chủ https://www.tiktok.com/
    notify('Bước 1: Điều hướng đến https://www.tiktok.com/...');
    await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Đóng banner consent nếu có
    const consentBtn = page.locator('button:has-text("Accept all"), button:has-text("Chấp nhận tất cả"), button:has-text("Allow all")').first();
    if (await consentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consentBtn.click().catch(() => { });
    }

    // Bước 2: Click nút Upload
    // Selector chính xác từ người dùng: type="button" data-key-interaction="nav_upload" aria-label="Upload" role="listitem"
    notify('Bước 2: Tìm và click nút Upload...');
    const uploadSelectors = [
      'button[data-key-interaction="nav_upload"][aria-label="Upload"]',
      '[data-key-interaction="nav_upload"]',
      'button[aria-label="Upload"][role="listitem"]',
      'button[aria-label="Upload"]',
      'a[href*="/upload"]',
      'a[href*="/creator-center/upload"]',
      'a[href*="/tiktokstudio/upload"]',
    ];

    let uploadClicked = false;
    for (const sel of uploadSelectors) {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        notify(`Đã tìm thấy nút Upload với selector: ${sel}`);
        await el.click().catch(() => { });
        uploadClicked = true;
        break;
      }
    }

    if (!uploadClicked) {
      notify('Không click được nút upload trên trang chủ, chuyển hướng trực tiếp đến trang Upload TikTok Studio...');
      await page.goto('https://www.tiktok.com/tiktokstudio/upload', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(async () => {
        await page.goto('https://www.tiktok.com/creator-center/upload', { waitUntil: 'domcontentloaded', timeout: 45000 });
      });
    }

    await page.waitForTimeout(4000);
    await dismissAllTooltip(page);
    notify('Đang kiểm tra giao diện chọn file video TikTok...');

    // Bước 3: Click "Select video" và đính kèm file
    // Selector người dùng: role="button" type="button" aria-label="Select video"
    const selectVideoSelectors = [
      '[role="button"][type="button"][aria-label="Select video"]',
      'button[aria-label="Select video"]',
      '[aria-label="Select video"]',
      'button:has-text("Select video")',
      'button:has-text("Chọn video")',
      '[data-e2e="select-video-btn"]',
    ];

    let fileAttached = false;

    // Kiểm tra xem trang có iframe chứa upload uploader không
    const frames = page.frames();
    for (const frame of frames) {
      const fileInput = frame.locator('input[type="file"][accept*="video"], input[type="file"]').first();
      if (await fileInput.count().catch(() => 0) > 0) {
        try {
          await fileInput.setInputFiles(resolvedPath);
          fileAttached = true;
          notify('Đã đính kèm file video thành công qua iframe file input.');
          break;
        } catch { }
      }
    }

    if (!fileAttached) {
      // Thử đính kèm trực tiếp vào input[type="file"] trên trang chính
      const mainFileInput = page.locator('input[type="file"]').first();
      if (await mainFileInput.count().catch(() => 0) > 0) {
        try {
          await mainFileInput.setInputFiles(resolvedPath);
          fileAttached = true;
          notify('Đã đính kèm file video trực tiếp qua input[type="file"].');
        } catch { }
      }
    }

    if (!fileAttached) {
      // Dùng filechooser với nút "Select video"
      for (const sel of selectVideoSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          notify(`Click nút chọn video (${sel})...`);
          const [fileChooser] = await Promise.all([
            page.waitForEvent('filechooser', { timeout: 10000 }).catch(() => null),
            btn.click().catch(() => { }),
          ]);
          if (fileChooser) {
            await fileChooser.setFiles(resolvedPath);
            fileAttached = true;
            notify('Đã đính kèm file video qua FileChooser thành công.');
            break;
          }
        }
      }
    }

    if (!fileAttached) {
      throw new Error('Không thể tìm thấy trình chọn file hoặc input upload trên TikTok.');
    }

    notify('Đang đợi video được tải lên trình soạn thảo TikTok...');
    await page.waitForTimeout(5000);
    await dismissAllTooltip(page);

    // Bước 4: Nhập Caption / Nội dung
    // Selector người dùng: aria-autocomplete="list" contenteditable="true" role="combobox"
    notify('Bước 4: Nhập nội dung caption...');
    const finalCaption = replaceDateWildcards(content || '');

    const captionSelectors = [
      '[aria-autocomplete="list"][contenteditable="true"][role="combobox"]',
      '[contenteditable="true"][role="combobox"]',
      'div[contenteditable="true"]',
      '[data-e2e="caption-input"]',
      'textarea[placeholder*="caption" i]',
    ];

    let captionFilled = false;
    for (const sel of captionSelectors) {
      const editor = page.locator(sel).first();
      if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editor.click();
        await page.waitForTimeout(500);

        // Xóa nội dung mặc định cũ (nếu có, e.g. tên file video)
        const selectAllKey = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
        await page.keyboard.press(selectAllKey).catch(() => { });
        await page.keyboard.press('Backspace').catch(() => { });
        await page.waitForTimeout(300);

        try {
          await editor.fill(finalCaption);
        } catch {
          await editor.pressSequentially(finalCaption, { delay: 10 });
        }
        captionFilled = true;
        notify('Đã điền nội dung caption thành công.');
        break;
      }
    }

    if (!captionFilled) {
      notify('Cảnh báo: Không tìm thấy ô nhập caption, tiếp tục tiến trình đăng...', 'WARN');
    }

    // Click hashtag .hashtag-suggestion-item nếu có
    const firstHash = page.locator('.hashtag-suggestion-item').first();
    if (firstHash) {
      await firstHash.click();
    }

    // Bước 5: Thêm nhạc
    notify('Bước 5: Thêm nhạc...');
    const soundBtn = page.locator('button[data-default-left-menu="MusicPanel"][data-default-right-menu="AudioClipPropSetting"][data-button-name="sounds"]').first();
    await soundBtn.click();
    await page.waitForTimeout(2000);
    await dismissAllTooltip(page);

    // mute video sound
    const soundBtns = page.locator('.TrackOperation__item button');
    const soundBtnsCount = await soundBtns.count();

    if (soundBtnsCount) {
      const muteBtn = soundBtns.nth(0);
      await muteBtn.click();
    }

    const addBtns = page.locator('.MusicPanelMusicItem__operation button');
    // random click a addBtns
    const count = await addBtns.count();
    const randomIndex = Math.floor(Math.random() * count);
    const randomBtn = addBtns.nth(randomIndex);
    await randomBtn.click();

    // click save button .clip-forge-editor-header-right button.Button__root--type-primary
    const saveBtn = page.locator('.clip-forge-editor-header-right button.Button__root--type-primary').first();
    await saveBtn.click();

    // Bước 6: Cuộn xuống cuối trang và Click nút Đăng
    // Selector người dùng: role="button" type="button" data-e2e="post_video_button"
    notify('Bước 6: Cuộn xuống đáy trang và click nút Post...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const postBtnSelectors = [
      '[role="button"][type="button"][data-e2e="post_video_button"]',
      'button[data-e2e="post_video_button"]',
      '[data-e2e="post_video_button"]',
      'button:has-text("Post")',
      'button:has-text("Đăng")',
    ];

    let postBtnFound: any = null;
    for (const sel of postBtnSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        postBtnFound = btn;
        break;
      }
    }

    if (!postBtnFound) {
      throw new Error('Không tìm thấy nút Đăng video (post_video_button) trên TikTok Studio.');
    }

    // Chờ video upload xong nếu nút đang bị disable
    notify('Đang chờ TikTok xử lý video hoàn tất để mở nút Đăng...');
    const maxWaitPost = 120000; // tối đa 2 phút
    const pollStart = Date.now();
    while (Date.now() - pollStart < maxWaitPost) {
      const isDisabled = await postBtnFound.evaluate((el: HTMLElement) => {
        return (
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.classList.contains('disabled') ||
          (el as HTMLButtonElement).disabled
        );
      }).catch(() => false);

      if (!isDisabled) {
        break;
      }
      await page.waitForTimeout(2000);
    }

    await postBtnFound.scrollIntoViewIfNeeded().catch(() => { });
    await postBtnFound.click();
    notify('Đã click nút Đăng video (post_video_button)!');

    // Kiểm tra xem có modal xác nhận "Continue to post?" hiện lên hay không
    try {
      const continueModalSelectors = [
        '.common-modal-header div:has-text("Continue to post?")',
        '.common-modal-header:has-text("Continue to post?")',
        'div[role="dialog"]:has-text("Continue to post?")',
      ];
      const confirmBtnSelectors = [
        '.common-modal-footer button.TUXButton--primary',
        '.common-modal-footer button:has-text("Post now")',
        '.common-modal-footer button:has-text("Post anyway")',
        '.common-modal-footer button:has-text("Post")',
        '.common-modal-footer button:has-text("Đăng")',
      ];

      for (let i = 0; i < 5; i++) {
        let foundModal = false;
        for (const mSel of continueModalSelectors) {
          if (await page.locator(mSel).first().isVisible({ timeout: 1000 }).catch(() => false)) {
            foundModal = true;
            break;
          }
        }

        if (foundModal) {
          notify('Phát hiện modal "Continue to post?", tiến hành click nút xác nhận đăng...');
          let clicked = false;
          for (const bSel of confirmBtnSelectors) {
            const btn = page.locator(bSel).first();
            if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
              await btn.click().catch(() => { });
              notify(`Đã click nút xác nhận modal (${bSel})!`);
              clicked = true;
              break;
            }
          }
          if (!clicked) {
            // Thử click bất kỳ button primary nào trong modal footer
            const fallbackBtn = page.locator('.common-modal-footer button.TUXButton--primary').first();
            await fallbackBtn.click().catch(() => { });
          }
          break;
        }
        await page.waitForTimeout(1000);
      }
    } catch (mErr: any) {
      notify(`Lỗi khi xử lý modal xác nhận đăng: ${mErr.message}`, 'WARN');
    }

    // Kiểm tra xem có popup yêu cầu xác minh danh tính "Verify it's really you" hay không và tự động xử lý qua Gmail
    await handleTikTokVerificationModal(page, context, notify, headless);

    notify('Đang chờ TikTok hoàn tất xử lý xuất bản video...');
    await page.waitForTimeout(8000);

    // Bước 7: Làm mới https://www.tiktok.com/tiktokstudio/content lấy link bài viết
    // Selector người dùng: target="_blank" data-tt="components_PostInfoCell_a"
    notify('Bước 7: Truy cập https://www.tiktok.com/tiktokstudio/content để lấy link video...');
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);

    let tiktokVideoUrl: string | undefined = undefined;
    const cleanMatchText = finalCaption.replace(/#\S+/g, '').trim().toLowerCase().slice(0, 25);
    const cleanFileName = path.basename(resolvedPath, path.extname(resolvedPath)).toLowerCase().slice(0, 20);

    for (let attempt = 1; attempt <= 5; attempt++) {
      notify(`Đang tìm link video trên trang quản lý (lần ${attempt}/5)...`);
      const postLinks = page.locator('a[target="_blank"][data-tt="components_PostInfoCell_a"], a[target="_blank"][href*="/video/"]');
      const count = await postLinks.count();

      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const item = postLinks.nth(i);
          const linkText = (await item.innerText().catch(() => '')).trim().toLowerCase();
          const href = await item.getAttribute('href').catch(() => null);

          if (href) {
            const absoluteHref = href.startsWith('http') ? href : `https://www.tiktok.com${href}`;
            // Chỉ chấp nhận bài viết trùng tiêu đề caption hoặc tên file video, không fallback tùy tiện lấy bài cũ
            const isMatch =
              (cleanMatchText && (linkText.includes(cleanMatchText) || cleanMatchText.includes(linkText))) ||
              (cleanFileName && linkText.includes(cleanFileName));

            if (isMatch) {
              tiktokVideoUrl = absoluteHref;
              break;
            }
          }
        }

        if (tiktokVideoUrl) {
          notify(`Đã tìm thấy link TikTok thành công: ${tiktokVideoUrl}`, 'SUCCESS');
          break;
        }
      }

      await page.waitForTimeout(5000);
      if (attempt < 5) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
        await page.waitForTimeout(3000);
      }
    }

    if (!tiktokVideoUrl) {
      throw new Error('Không tìm thấy link video đã xuất bản trên TikTok Studio sau 5 lần kiểm tra. Video có thể chưa được duyệt hoặc TikTok chặn đăng (yêu cầu xác minh).');
    }

    let commentSuccess: boolean | undefined = undefined;
    if (options.comment && options.comment.trim() && tiktokVideoUrl) {
      notify(`[Bước 7/7] Đang tự động bình luận lên video TikTok...`);
      try {
        await page.goto(tiktokVideoUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await page.waitForTimeout(4000);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // Kiểm tra xem nút post bình luận hoặc khung soạn thảo đã mở sẵn chưa
        let hasPostBtn = (await page.locator('[data-e2e="comment-post"]').count()) > 0;
        if (!hasPostBtn) {
          const commentIcon = page.locator('[data-e2e="comment-icon"]').first();
          if ((await commentIcon.count()) > 0) {
            try {
              await commentIcon.click({ timeout: 5000 });
            } catch {
              await page.evaluate(() => {
                const icon = document.querySelector('[data-e2e="comment-icon"]');
                if (icon) (icon as HTMLElement).click();
              });
            }
            await page.waitForTimeout(2000);
          }
        }

        const editorSelector = '.public-DraftEditor-content, div[contenteditable="true"], [data-e2e="comment-text"]';
        const editor = page.locator(editorSelector).first();

        if (await editor.count() > 0) {
          const commentText = options.comment.trim();
          await page.evaluate((text: string) => {
            const el = document.querySelector('.public-DraftEditor-content') || document.querySelector('div[contenteditable="true"]');
            if (el) {
              (el as HTMLElement).focus();
              const dt = new DataTransfer();
              dt.setData('text/plain', text);
              const ev = new ClipboardEvent('paste', {
                clipboardData: dt,
                bubbles: true,
                cancelable: true,
              });
              el.dispatchEvent(ev);
            }
          }, commentText);

          await page.waitForTimeout(1000);

          const postBtn = page.locator('[data-e2e="comment-post"]').first();
          if (await postBtn.count() > 0) {
            const isDisabled = await postBtn.isDisabled().catch(() => false);
            if (!isDisabled) {
              const publishPromise = page.waitForResponse(
                (res: any) => res.url().includes('/api/comment/publish/'),
                { timeout: 7000 }
              ).catch(() => null);

              try {
                await postBtn.click({ timeout: 4000 });
              } catch {
                await page.evaluate(() => {
                  const btn = document.querySelector('[data-e2e="comment-post"]');
                  if (btn) (btn as HTMLElement).click();
                });
              }

              const publishRes = await publishPromise;
              let apiSuccess = false;
              if (publishRes && publishRes.ok()) {
                const json = await publishRes.json().catch(() => ({}));
                if (json.status_code === 0 || json.comment) {
                  apiSuccess = true;
                }
              }

              await page.waitForTimeout(2500);

              const isEditorCleared = await page.evaluate(() => {
                const el = document.querySelector('.public-DraftEditor-content');
                return !el || ((el as HTMLElement).innerText || el.textContent || '').trim() === '';
              });

              if (apiSuccess || isEditorCleared) {
                commentSuccess = true;
                notify('Đã đăng bình luận tự động lên video TikTok thành công!', 'SUCCESS');
              } else {
                const isCaptcha = await page.evaluate(() => {
                  const text = (document.body?.innerText || '').toLowerCase();
                  return (
                    text.includes('drag the slider') ||
                    text.includes('fit the puzzle') ||
                    text.includes('trượt thanh trượt') ||
                    text.includes('ghép hình')
                  );
                });

                if (isCaptcha) {
                  notify('TikTok yêu cầu giải captcha chống bot (Ghép mảnh ghép). Bình luận chưa thể hoàn tất tự động.', 'WARN');
                  commentSuccess = false;
                } else {
                  commentSuccess = false;
                  notify('Chưa xác nhận được trạng thái gửi bình luận TikTok.', 'WARN');
                }
              }
            } else {
              notify('Nút gửi bình luận TikTok đang bị disable.', 'WARN');
              commentSuccess = false;
            }
          }
        } else {
          notify('Không tìm thấy khung nhập bình luận trên video TikTok.', 'WARN');
          commentSuccess = false;
        }
      } catch (cErr: any) {
        notify(`Lỗi khi tự động bình luận TikTok: ${cErr.message || cErr}`, 'WARN');
        commentSuccess = false;
      }
    }

    // Đóng tất cả pages để Playwright flush và hoàn tất video artifact
    if (context) {
      const allPages = context.pages();
      for (const p of allPages) {
        if (!p.isClosed()) {
          await p.close().catch(() => { });
        }
      }
    }

    const isDevMode = isDeveloperMode();
    let savedVideoFileName: string | undefined = undefined;

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);

    if (targetVideo) {
      try {
        if (isDevMode) {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await targetVideo.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          notify(`[Dev Mode] Đã lưu video quá trình đăng TikTok: ${videoFileName}`, 'SUCCESS');
        } else {
          await targetVideo.delete().catch(() => { });
        }
      } catch (vErr: any) {
        notify(`Lỗi lưu video TikTok: ${vErr?.message || vErr}`, 'WARN');
      }
    }

    if (context) {
      await context.close().catch(() => { });
    }

    return {
      success: true,
      message: tiktokVideoUrl
        ? `Đã xuất bản video TikTok thành công! Link: ${tiktokVideoUrl}`
        : 'Đã xuất bản video TikTok thành công!',
      filePath: resolvedPath,
      tiktokUrl: tiktokVideoUrl,
      commentSuccess,
      debugVideoPath: savedVideoFileName,
    };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    notify(`Lỗi trong quá trình đăng TikTok: ${errMsg}`, 'ERROR');

    let savedScreenshotFileName: string | undefined = undefined;
    let savedVideoFileName: string | undefined = undefined;

    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });
        savedScreenshotFileName = screenshotFileName;
        notify(`Đã lưu ảnh chụp lỗi TikTok tại: ${screenshotFileName}`);
      } catch { }
    }

    // Đóng tất cả pages để Playwright hoàn tất ghi video lỗi
    if (context) {
      const allPages = context.pages();
      for (const p of allPages) {
        if (!p.isClosed()) {
          await p.close().catch(() => { });
        }
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);

    if (targetVideo) {
      try {
        const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
        await targetVideo.saveAs(finalVideoPath);
        savedVideoFileName = videoFileName;
        notify(`[Video Debug] Đã lưu video thao tác lỗi TikTok: ${videoFileName}`, 'SUCCESS');
      } catch (vErr: any) {
        notify(`Lỗi lưu video debug TikTok: ${vErr?.message || vErr}`, 'WARN');
      }
    }

    if (context) {
      await context.close().catch(() => { });
    }

    return {
      success: false,
      message: `Đăng TikTok thất bại: ${errMsg}`,
      filePath: resolvedPath,
      error: errMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedVideoFileName,
    };
  }
}

async function dismissAllTooltip(page: Page) {
  const tooltipSelectors = '[class$="-tooltip"]';

  for (let i = 0; i < 2; i++) {
    if (await page.locator(tooltipSelectors).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      const container = page.locator(tooltipSelectors).first();
      if (await container.locator(`button[data-type="primary"]`).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        const gotItBtn = container.locator(`button[data-type="primary"]`).first();
        if (gotItBtn) {
          await gotItBtn.click();
        }
        break;
      }
      break;
    }

    await page.waitForTimeout(1000);
  }

  const gotSelectors = 'button:has-text("Got it")';

  for (let i = 0; i < 2; i++) {
    if (await page.locator(gotSelectors).first().isVisible({ timeout: 1000 }).catch(() => false)) {
      const gotItBtn = page.locator(gotSelectors).first();
      if (gotItBtn) {
        await gotItBtn.click();
      }
      break;
    }

    await page.waitForTimeout(1000);
  }
}

/**
 * Tự động đăng bình luận lên video TikTok đã có sẵn link công khai
 */
export async function commentTikTokVideoOnly(
  videoUrl: string,
  comment: string,
  options?: { headless?: boolean }
): Promise<{ success: boolean; message: string; error?: string }> {
  // Khi có DISPLAY (:99 trên VPS), mặc định chạy headed (headless: false) để hiển thị lên VNC và tránh bị TikTok gán cờ bot headless
  const headless =
    options?.headless !== undefined
      ? options.headless
      : (process.env.DISPLAY ? false : resolveHeadless(true));

  const userDataDir = getTikTokUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  let context: any = null;
  let page: any = null;

  try {
    logActivity('INFO', 'COMMENT_TIKTOK', `Đang mở trình duyệt để bình luận video TikTok: ${videoUrl}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications', '--disable-blink-features=AutomationControlled']),
    });

    const loadedCookies = await injectTikTokSessionCookies(context);
    logActivity('INFO', 'COMMENT_TIKTOK', `Đã nạp ${loadedCookies} cookies TikTok vào trình duyệt`);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Ẩn navigator.webdriver để giảm tỷ lệ kích hoạt Captcha
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      try {
        (window as any).chrome = { runtime: {} };
      } catch {}
    });

    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(4000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    const checkIsCaptcha = async (): Promise<boolean> => {
      return await page.evaluate(() => {
        const text = (document.body?.innerText || '').toLowerCase();
        return (
          text.includes('drag the slider') ||
          text.includes('fit the puzzle') ||
          text.includes('trượt thanh trượt') ||
          text.includes('ghép hình') ||
          Boolean(document.querySelector('#captcha-verify-container-main-page, .captcha-verify-container, [id*="captcha"]'))
        );
      });
    };

    const waitForCaptchaSolution = async (timeoutMs = 60000): Promise<boolean> => {
      logActivity(
        'WARN',
        'COMMENT_TIKTOK',
        'TikTok kích hoạt Captcha mảnh ghép! Đang giữ trình duyệt mở trên màn hình VNC trong 60 giây. Hãy kéo thanh trượt trên ứng dụng Screen Sharing...'
      );
      const startTime = Date.now();
      while (Date.now() - startTime < timeoutMs) {
        await page.waitForTimeout(2000);
        const stillCaptcha = await checkIsCaptcha();
        if (!stillCaptcha) {
          logActivity('SUCCESS', 'COMMENT_TIKTOK', 'Đã vượt qua Captcha TikTok thành công! Đang hoàn tất bình luận...');
          return true;
        }
      }
      return false;
    };

    // Kiểm tra sớm nếu trang bị chặn Captcha ngay khi load
    if (await checkIsCaptcha()) {
      const solved = await waitForCaptchaSolution(60000);
      if (!solved) {
        return {
          success: false,
          message: 'Hết thời gian chờ giải Captcha (60s). Hãy mở Screen Sharing (open vnc://localhost:5900) để kéo thanh trượt khi gửi bình luận.',
          error: 'CAPTCHA_REQUIRED',
        };
      }
    }

    const isLogin = await page.evaluate(() => {
      const loginModal = document.querySelector('#login-modal, [data-e2e="login-modal"]');
      return Boolean(loginModal);
    });

    if (isLogin) {
      logActivity('WARN', 'COMMENT_TIKTOK', 'TikTok yêu cầu đăng nhập. Phiên cookie chưa hợp lệ.');
      return {
        success: false,
        message: 'TikTok yêu cầu đăng nhập (phiên chưa được xác thực hoặc cookie đã hết hạn). Vui lòng cập nhật cookie TikTok.',
        error: 'LOGIN_REQUIRED',
      };
    }

    // Kiểm tra xem nút post bình luận hoặc khung soạn thảo đã mở sẵn chưa
    let hasPostBtn = (await page.locator('[data-e2e="comment-post"]').count()) > 0;
    if (!hasPostBtn) {
      const commentIcon = page.locator('[data-e2e="comment-icon"]').first();
      if ((await commentIcon.count()) > 0) {
        try {
          await commentIcon.click({ timeout: 5000 });
        } catch {
          await page.evaluate(() => {
            const icon = document.querySelector('[data-e2e="comment-icon"]');
            if (icon) (icon as HTMLElement).click();
          });
        }
        await page.waitForTimeout(2000);
      }
    }

    const editorSelector = '.public-DraftEditor-content, div[contenteditable="true"], [data-e2e="comment-text"]';
    const editor = page.locator(editorSelector).first();

    if ((await editor.count()) === 0) {
      throw new Error('Không tìm thấy khung nhập bình luận trên video TikTok');
    }

    const commentText = comment.trim();
    await page.evaluate((text: string) => {
      const el = document.querySelector('.public-DraftEditor-content') || document.querySelector('div[contenteditable="true"]');
      if (el) {
        (el as HTMLElement).focus();
        const dt = new DataTransfer();
        dt.setData('text/plain', text);
        const ev = new ClipboardEvent('paste', {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        });
        el.dispatchEvent(ev);
      }
    }, commentText);

    await page.waitForTimeout(1000);

    const postBtn = page.locator('[data-e2e="comment-post"]').first();
    if ((await postBtn.count()) === 0) {
      throw new Error('Không tìm thấy nút gửi bình luận TikTok');
    }

    const isDisabled = await postBtn.isDisabled().catch(() => false);
    if (isDisabled) {
      // Thử gõ thêm một dấu cách nếu Draft.js chưa kịp bắt sự kiện
      await editor.focus().catch(() => {});
      await page.keyboard.type(' ').catch(() => {});
      await page.waitForTimeout(500);

      const stillDisabled = await postBtn.isDisabled().catch(() => false);
      if (stillDisabled) {
        throw new Error('Nút gửi bình luận TikTok đang bị disable');
      }
    }

    // Lắng nghe API phản hồi publish comment của TikTok
    const publishPromise = page.waitForResponse(
      (res: any) => res.url().includes('/api/comment/publish/'),
      { timeout: 7000 }
    ).catch(() => null);

    // Nhấp nút gửi bình luận với cơ chế dự phòng evaluate để tránh timeout khi có overlay
    try {
      await postBtn.click({ timeout: 4000 });
    } catch {
      await page.evaluate(() => {
        const btn = document.querySelector('[data-e2e="comment-post"]');
        if (btn) (btn as HTMLElement).click();
      });
    }

    const publishRes = await publishPromise;
    let apiSuccess = false;
    if (publishRes && publishRes.ok()) {
      try {
        const json = await publishRes.json().catch(() => ({}));
        if (json.status_code === 0 || json.comment) {
          apiSuccess = true;
        }
      } catch {}
    }

    await page.waitForTimeout(2500);

    // Kiểm tra xem khung soạn thảo đã được xóa trắng chưa (TikTok tự động xóa nội dung khi comment gửi thành công)
    const isEditorCleared = await page.evaluate(() => {
      const el = document.querySelector('.public-DraftEditor-content');
      return !el || ((el as HTMLElement).innerText || el.textContent || '').trim() === '';
    });

    if (apiSuccess || isEditorCleared) {
      logActivity('SUCCESS', 'COMMENT_TIKTOK', 'TikTok đã xác nhận lưu bình luận thành công!');
      return { success: true, message: 'Đã bình luận lên video TikTok thành công' };
    }

    // Nếu API chưa xác nhận và khung soạn thảo chưa xóa, kiểm tra xem có captcha thật sự chặn không
    if (await checkIsCaptcha()) {
      const solved = await waitForCaptchaSolution(60000);
      if (!solved) {
        return {
          success: false,
          message: 'Hết thời gian chờ giải Captcha (60s). Hãy mở Screen Sharing (open vnc://localhost:5900) để kéo thanh trượt khi gửi bình luận.',
          error: 'CAPTCHA_REQUIRED',
        };
      }

      // Sau khi giải captcha xong, nhấn lại nút post nếu bình luận chưa đi
      await page.waitForTimeout(1500);
      const postBtnRetry = page.locator('[data-e2e="comment-post"]').first();
      if ((await postBtnRetry.count()) > 0 && !(await postBtnRetry.isDisabled().catch(() => true))) {
        try {
          await postBtnRetry.click({ timeout: 4000 });
        } catch {
          await page.evaluate(() => {
            const btn = document.querySelector('[data-e2e="comment-post"]');
            if (btn) (btn as HTMLElement).click();
          });
        }
        await page.waitForTimeout(3000);
      }
    }

    logActivity('SUCCESS', 'COMMENT_TIKTOK', 'Đã đăng bình luận lên video TikTok thành công');
    return { success: true, message: 'Đã bình luận lên video TikTok thành công' };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    logActivity('ERROR', 'COMMENT_TIKTOK', `Lỗi đăng bình luận TikTok: ${errMsg}`);
    return { success: false, message: `Lỗi đăng bình luận TikTok: ${errMsg}`, error: errMsg };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}
