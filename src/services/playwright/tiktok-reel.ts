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
 * Đọc mã OTP TikTok mới nhất từ tài khoản Gmail đang đăng nhập trong browser profile.
 * Hỗ trợ trích xuất cả khi email được gom nhóm theo thread (conversation).
 */
async function fetchLatestTikTokOTP(gmailPage: any): Promise<{ code: string | null; msgId: string | null; preview: string }> {
  try {
    await gmailPage.goto('https://mail.google.com/mail/u/0/#search/from%3Atiktok', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(() => {});
    await gmailPage.waitForTimeout(3000);

    const firstRow = gmailPage.locator('tr[role="row"]').first();
    if (!(await firstRow.isVisible({ timeout: 4000 }).catch(() => false))) {
      return { code: null, msgId: null, preview: '' };
    }
    await firstRow.click().catch(() => {});
    await gmailPage.waitForTimeout(2000);

    const msgs = gmailPage.locator('[data-message-id]');
    const count = await msgs.count().catch(() => 0);
    if (count === 0) {
      return { code: null, msgId: null, preview: '' };
    }

    const lastMsg = msgs.last();
    const msgId = (await lastMsg.getAttribute('data-message-id').catch(() => '')) || '';
    const html = await lastMsg.innerHTML().catch(() => '');
    const cleanText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    const match =
      cleanText.match(/enter this code in TikTok:\s*([A-Z0-9]{6})/i) ||
      cleanText.match(/([A-Z0-9]{6})\s+is your verification code/i) ||
      cleanText.match(/code is:\s*([A-Z0-9]{6})/i) ||
      cleanText.match(/([0-9]{6})\s+is your 6-digit code/i);

    return {
      code: match ? match[1].trim().toUpperCase() : null,
      msgId,
      preview: cleanText.slice(0, 150),
    };
  } catch {
    return { code: null, msgId: null, preview: '' };
  }
}

/**
 * Nhập mã xác minh 6 ký tự vào ô placeholder="Enter 6-digit code" trên modal TikTok
 * và click nút xác nhận (Next / Verify).
 */
async function submitTikTokOTPInput(
  page: any,
  code: string,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void
): Promise<boolean> {
  notify(`Tiến hành nhập mã OTP [${code}] vào ô placeholder="Enter 6-digit code"...`);
  await page.bringToFront().catch(() => {});
  await page.waitForTimeout(1000);

  const codeInputSelectors = [
    'input[placeholder="Enter 6-digit code"]',
    'input[placeholder*="6-digit code"]',
    'input[placeholder*="Enter 6-digit"]',
    'input[placeholder*="code" i]',
    'div[role="dialog"] input:not([type="hidden"])',
    '.TUXModal input:not([type="hidden"])',
  ];

  let targetInput: any = null;
  for (const sel of codeInputSelectors) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
      targetInput = loc;
      break;
    }
  }

  if (!targetInput) {
    notify('Không tìm thấy ô nhập placeholder="Enter 6-digit code" trong modal!', 'WARN');
    return false;
  }

  // Focus, clear và nhập từng ký tự
  await targetInput.click({ timeout: 2000 }).catch(() => {});
  await targetInput.fill('').catch(() => {});
  await targetInput.pressSequentially(code, { delay: 80 }).catch(() => {});

  // Dispatch React input event để kích hoạt state & enable nút Next
  await page.evaluate(({ c, selectors }: { c: string; selectors: string[] }) => {
    let input: HTMLInputElement | null = null;
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) {
        input = el as HTMLInputElement;
        break;
      }
    }
    if (input) {
      input.focus();
      input.value = c;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, { c: code, selectors: codeInputSelectors });

  // Paste / gõ thêm bằng bàn phím phòng trường hợp
  await page.keyboard.type(code, { delay: 50 }).catch(() => {});
  await page.waitForTimeout(1000);

  // Click nút Next / Verify
  const nextButtons = [
    'button:has-text("Next")',
    'button:has-text("Verify")',
    'button:has-text("Tiếp tục")',
    'button:has-text("Confirm")',
    'button:has-text("Xác nhận")',
    'div[role="dialog"] button.TUXButton--primary',
    'div[role="dialog"] button[type="submit"]',
  ];

  for (const bSel of nextButtons) {
    const btn = page.locator(bSel).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      notify(`Đang click nút xác nhận [${bSel}]...`);
      await btn.click({ timeout: 2000 }).catch(() => {});
      break;
    }
  }

  await page.waitForTimeout(3000);
  return true;
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
    'div[role="dialog"]:has-text("Verify identity")',
    'div[role="dialog"]:has-text("verify your identity")',
    'div:has-text("Verify it\'s really you")',
    'div:has-text("Verify identity")',
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

  notify('TikTok yêu cầu xác minh danh tính ("Verify it\'s really you" / "Verify identity")!', 'WARN');

  // Bước 1: Trước khi gửi mã mới, đọc mã & msgId hiện tại trên Gmail
  let initialMsgId = '';
  let fallbackLatestCode = '';
  try {
    const checkPage = await context.newPage();
    const initialInfo = await fetchLatestTikTokOTP(checkPage);
    if (initialInfo.code) {
      fallbackLatestCode = initialInfo.code;
      initialMsgId = initialInfo.msgId || '';
      notify(`[Gmail] Mã TikTok hiện có trong hòm thư: ${fallbackLatestCode} (msgId: ${initialMsgId})`);
    }
    await checkPage.close().catch(() => {});
  } catch (err: any) {
    notify(`[Gmail] Chưa đọc được mã cũ: ${err?.message || err}`, 'INFO');
  }

  // Bước 2: Kiểm tra xem đã ở màn hình nhập mã (placeholder="Enter 6-digit code") chưa,
  // nếu chưa thì click vào lựa chọn Email (selector pc-home-item-)
  const isCodeInputVisible = async () => {
    return await page
      .locator('input[placeholder="Enter 6-digit code"], input[placeholder*="6-digit code"], input[placeholder*="code" i]')
      .first()
      .isVisible({ timeout: 500 })
      .catch(() => false);
  };

  if (!(await isCodeInputVisible())) {
    notify('Đang chọn phương thức xác minh qua Email trên TikTok...');
    const clickStart = Date.now();

    while (Date.now() - clickStart < 15000) {
      // Click phần tử với selector pc-home-item-
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
          notify(`Tìm thấy ${count} phần tử [${sel}], click gửi mã...`);
          const box = await targetItem.boundingBox().catch(() => null);
          if (box) {
            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
          }
          await targetItem.click({ force: true }).catch(() => {});
          break;
        }
      }

      // Kiểm tra thêm trong các iframes
      for (const frame of page.frames()) {
        for (const sel of pcHomeSelectors) {
          const frameItems = frame.locator(sel);
          if ((await frameItems.count().catch(() => 0)) > 0) {
            let target = frameItems.filter({ hasText: /email|@/i }).first();
            if ((await target.count().catch(() => 0)) === 0) {
              target = frameItems.first();
            }
            await target.click({ force: true }).catch(() => {});
            break;
          }
        }
      }

      // Thử click vào text email hoặc card
      await page.evaluate(() => {
        const pcItem = document.querySelector('[class*="pc-home-item-"], [id*="pc-home-item-"]');
        if (pcItem) {
          (pcItem as HTMLElement).click();
          pcItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return;
        }
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
          const text = (el.textContent || '').trim();
          if (text.includes('@') && text.includes('.com') && el.children.length === 0) {
            const card =
              el.closest('[class*="pc-home-item-"]') ||
              el.closest('button') ||
              el.closest('li') ||
              el.parentElement ||
              el;
            (card as HTMLElement).click();
            break;
          }
        }
      });

      await page.waitForTimeout(2000);

      if (await isCodeInputVisible()) {
        notify('Đã click chọn xác minh Email thành công! Giao diện nhập mã (placeholder="Enter 6-digit code") đã xuất hiện.', 'SUCCESS');
        break;
      }

      notify('Đang thử lại click vào lựa chọn Email...');
      await page.waitForTimeout(1000);
    }
  } else {
    notify('Giao diện nhập mã (placeholder="Enter 6-digit code") đã mở sẵn.', 'INFO');
  }

  // Bước 3: Mở tab Gmail và lấy mã OTP từ TikTok
  notify('Đang truy cập Gmail để tự động lấy mã OTP xác minh từ TikTok...');
  let verificationCode = '';
  let gmailPage: any = null;

  try {
    gmailPage = await context.newPage();
    const pollStart = Date.now();
    const maxPollTime = 40000; // Đợi tối đa 40s

    while (Date.now() - pollStart < maxPollTime) {
      const info = await fetchLatestTikTokOTP(gmailPage);

      if (info.code) {
        // Nếu có email mới với messageId khác
        if (info.msgId && info.msgId !== initialMsgId) {
          verificationCode = info.code;
          notify(`Đã tìm thấy mã OTP MỚI từ TikTok: ${verificationCode}`, 'SUCCESS');
          break;
        }

        // Hoặc nếu đã đợi quá 12s mà TikTok không đổi messageId nhưng có mã hợp lệ
        if (Date.now() - pollStart > 12000 && (info.code || fallbackLatestCode)) {
          verificationCode = info.code || fallbackLatestCode;
          notify(`Sử dụng mã OTP gần nhất hiện có từ TikTok: ${verificationCode}`, 'INFO');
          break;
        }
      }

      notify('Đang đợi email OTP mới từ TikTok (thử lại sau 3s)...');
      await page.waitForTimeout(3000);
    }
  } catch (gmailErr: any) {
    notify(`Lỗi khi truy vấn Gmail: ${gmailErr?.message || gmailErr}`, 'WARN');
  } finally {
    if (gmailPage && !gmailPage.isClosed()) {
      await gmailPage.close().catch(() => {});
    }
  }

  if (!verificationCode && fallbackLatestCode) {
    verificationCode = fallbackLatestCode;
    notify(`Thử sử dụng mã OTP gần nhất: ${verificationCode}`, 'INFO');
  }

  // Bước 4: Nhập mã OTP vào ô placeholder="Enter 6-digit code"
  if (verificationCode) {
    await submitTikTokOTPInput(page, verificationCode, notify);
  } else {
    notify('Không tìm thấy mã OTP từ Gmail.', 'WARN');
    if (!headless) {
      notify('Trình duyệt đang mở, bạn có thể tự nhập mã OTP trên màn hình trong 60 giây...', 'WARN');
      await page.waitForTimeout(60000);
    }
  }

  // Bước 5: Kiểm tra xem modal đã đóng chưa
  const checkModalClosed = async () => {
    for (const vSel of verifyModalSelectors) {
      if (await page.locator(vSel).first().isVisible({ timeout: 1500 }).catch(() => false)) {
        return false;
      }
    }
    return true;
  };

  let isClosed = await checkModalClosed();

  // Nếu modal chưa đóng, kiểm tra xem có cần click "Resend code" không
  if (!isClosed) {
    const resendBtn = page.locator('text=/resend code/i, [class*="resend"]').first();
    if (await resendBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      notify('Modal chưa đóng hoặc mã hết hạn, click "Resend code" để nhận mã mới...', 'WARN');
      await resendBtn.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(4000);

      // Đọc lại Gmail một lần nữa
      try {
        const retryGmailPage = await context.newPage();
        const newInfo = await fetchLatestTikTokOTP(retryGmailPage);
        await retryGmailPage.close().catch(() => {});
        if (newInfo.code && newInfo.code !== verificationCode) {
          notify(`Đã nhận mã OTP mới sau khi Resend: ${newInfo.code}`, 'SUCCESS');
          await submitTikTokOTPInput(page, newInfo.code, notify);
          await page.waitForTimeout(3000);
          isClosed = await checkModalClosed();
        }
      } catch {}
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
 * Tự động đăng bình luận lên video qua TikTok Studio:
 * 1. Vào https://www.tiktok.com/tiktokstudio/content (nếu chưa ở đó)
 * 2. Click vào '[data-tt="components_ActionCell_Container"] [data-icon="Comments"]'
 * 3. Nhập comment vào textarea id="comment-input"
 * 4. Click vào '[data-tt="components_CommentInputEditor_TUXButton"]'
 * Hỗ trợ tách nhiều comment bởi dấu "|" và gửi lần lượt.
 */
export async function postCommentsOnTikTokStudio(
  page: Page,
  commentRaw: string,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void,
  targetVideoUrl?: string,
  isDirectAfterPost: boolean = false
): Promise<{ success: boolean; total: number; sent: number; error?: string }> {
  const comments = commentRaw
    .split('|')
    .map((c) => replaceDateWildcards(c.trim()))
    .filter(Boolean);

  if (comments.length === 0) {
    return { success: true, total: 0, sent: 0 };
  }

  try {
    notify(`Bắt đầu đăng ${comments.length} bình luận qua TikTok Studio...`);

    // 1. Vào https://www.tiktok.com/tiktokstudio/content nếu chưa ở trang này
    const currentUrl = page.url();
    if (!currentUrl.includes('/tiktokstudio/content')) {
      notify('Điều hướng đến TikTok Studio Content (https://www.tiktok.com/tiktokstudio/content)...');
      await page.goto('https://www.tiktok.com/tiktokstudio/content', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      await page.waitForTimeout(5000);
    }

    await dismissAllTooltip(page);

    // 2. Click vào icon Comments
    // Kiểm tra xem textarea#comment-input đã hiển thị chưa (trường hợp drawer đã mở sẵn)
    const textareaSelector = 'textarea#comment-input, #comment-input, textarea[id="comment-input"]';
    let textarea = page.locator(textareaSelector).first();
    let isTextareaVisible = await textarea.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isTextareaVisible) {
      if (isDirectAfterPost) {
        notify('Bình luận ngay sau khi đăng: Đang đợi 12-15s để TikTok Studio xử lý video trước khi click [data-icon="Comments"]...');
        await page.waitForTimeout(13000);
      }

      notify('Đang tìm nút mở bình luận [data-icon="Comments"]...');

      let commentBtn: any = null;

      // Nếu có targetVideoUrl, thử tìm đúng hàng chứa video đó
      if (targetVideoUrl) {
        const videoIdMatch = targetVideoUrl.match(/\/video\/(\d+)/);
        const videoId = videoIdMatch ? videoIdMatch[1] : '';

        if (videoId) {
          const matchingRow = page
            .locator(`tr:has(a[href*="${videoId}"]), div[role="row"]:has(a[href*="${videoId}"])`)
            .first();
          if (await matchingRow.isVisible({ timeout: 2000 }).catch(() => false)) {
            const rowBtn = matchingRow
              .locator('[data-tt="components_ActionCell_Container"] [data-icon="Comments"], [data-icon="Comments"]')
              .first();
            if (await rowBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              commentBtn = rowBtn;
            }
          }
        }
      }

      // Nếu không chỉ định hoặc không tìm thấy hàng cụ thể, lấy nút comment của video đầu tiên
      if (!commentBtn) {
        commentBtn = page
          .locator('[data-tt="components_ActionCell_Container"] [data-icon="Comments"], [data-icon="Comments"]')
          .first();
      }

      if (await commentBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await commentBtn.scrollIntoViewIfNeeded().catch(() => {});
        await commentBtn.click();
        notify('Đã click mở bảng bình luận TikTok Studio.');
        await page.waitForTimeout(2500);
      } else {
        throw new Error('Không tìm thấy icon Comments ([data-icon="Comments"]) trên TikTok Studio.');
      }

      textarea = page.locator(textareaSelector).first();
      isTextareaVisible = await textarea.isVisible({ timeout: 8000 }).catch(() => false);
      if (!isTextareaVisible) {
        throw new Error('Đã click icon Comments nhưng ô nhập bình luận (textarea id="comment-input") không xuất hiện.');
      }
    }

    let sentCount = 0;

    // 3 & 4. Lặp qua từng comment để nhập và gửi
    for (let i = 0; i < comments.length; i++) {
      const cmt = comments[i];
      notify(`Đang nhập bình luận (${i + 1}/${comments.length}): "${cmt}"...`);

      await textarea.scrollIntoViewIfNeeded().catch(() => {});
      await textarea.click();
      await textarea.fill('');
      await page.waitForTimeout(300);

      // Gõ bàn phím tuần tự để kích hoạt đầy đủ React state và bộ đếm ký tự của TikTok
      await textarea.pressSequentially(cmt, { delay: 35 });
      await page.waitForTimeout(800);

      // Nút gửi: [data-tt="components_CommentInputEditor_TUXButton"]
      const sendBtn = page.locator('[data-tt="components_CommentInputEditor_TUXButton"]').first();
      await sendBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);

      if (!(await sendBtn.isVisible().catch(() => false))) {
        throw new Error('Không tìm thấy nút gửi bình luận ([data-tt="components_CommentInputEditor_TUXButton"]).');
      }

      const isDisabled = await sendBtn.isDisabled().catch(() => false);
      if (isDisabled) {
        throw new Error('Nút gửi bình luận đang bị vô hiệu hoá (disabled).');
      }

      // Lắng nghe API publish comment
      const publishPromise = page
        .waitForResponse((res: any) => res.url().includes('/api/comment/publish/'), { timeout: 10000 })
        .catch(() => null);

      await sendBtn.click();

      const publishRes = await publishPromise;
      let apiSuccess = false;
      if (publishRes && publishRes.ok()) {
        const json = await publishRes.json().catch(() => ({}));
        if (json.status_code === 0 || json.comment) {
          apiSuccess = true;
        }
      }

      await page.waitForTimeout(1500);

      const isInputCleared = await textarea.inputValue().then((v: string) => v.trim() === '').catch(() => false);

      if (apiSuccess || isInputCleared) {
        sentCount++;
        notify(`Đã đăng bình luận (${i + 1}/${comments.length}) thành công!`, 'SUCCESS');
      } else {
        notify(`Bình luận (${i + 1}/${comments.length}) chưa xác nhận được kết quả gửi.`, 'WARN');
      }

      // Giãn cách giữa các bình luận để tránh bị TikTok gắn cờ spam
      if (i < comments.length - 1) {
        await page.waitForTimeout(2500);
      }
    }

    return {
      success: sentCount > 0,
      total: comments.length,
      sent: sentCount,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    notify(`Lỗi khi đăng bình luận qua TikTok Studio: ${errorMsg}`, 'WARN');
    return {
      success: false,
      total: comments.length,
      sent: 0,
      error: errorMsg,
    };
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
    if (options.comment && options.comment.trim()) {
      notify(`[Bước 7/7] Đang tự động bình luận lên video TikTok qua TikTok Studio...`);
      const commentRes = await postCommentsOnTikTokStudio(page, options.comment, notify, tiktokVideoUrl, true);
      commentSuccess = commentRes.success;
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
        if (isDevMode || commentSuccess === false) {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await targetVideo.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          if (commentSuccess === false) {
            notify(`[Video Debug] Đã lưu video quá trình đăng TikTok (Lỗi bình luận): ${videoFileName}`, 'WARN');
          } else {
            notify(`[Dev Mode] Đã lưu video quá trình đăng TikTok: ${videoFileName}`, 'SUCCESS');
          }
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
): Promise<{ success: boolean; message: string; error?: string; screenshotPath?: string; debugVideoPath?: string }> {
  // Khi có DISPLAY (:99 trên VPS), mặc định chạy headed (headless: false) để hiển thị lên VNC và tránh bị TikTok gán cờ bot headless
  const headless =
    options?.headless !== undefined
      ? options.headless
      : (process.env.DISPLAY ? false : resolveHeadless(true));

  const userDataDir = getTikTokUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  const timestamp = Date.now();
  const videoFileName = `tiktok_comment_${timestamp}.webm`;
  const screenshotFileName = `tiktok_comment_err_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  let context: any = null;
  let page: any = null;
  let video: any = null;

  try {
    logActivity('INFO', 'COMMENT_TIKTOK', `Đang mở trình duyệt để bình luận video TikTok: ${videoUrl}`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1440, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1440, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications', '--disable-blink-features=AutomationControlled']),
    });

    const loadedCookies = await injectTikTokSessionCookies(context);
    logActivity('INFO', 'COMMENT_TIKTOK', `Đã nạp ${loadedCookies} cookies TikTok vào trình duyệt`);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();

    // Ẩn navigator.webdriver để giảm tỷ lệ kích hoạt Captcha
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      try {
        (window as any).chrome = { runtime: {} };
      } catch {}
    });

    // Ưu tiên bình luận qua TikTok Studio để tránh bị Captcha chặn
    try {
      const studioRes = await postCommentsOnTikTokStudio(
        page,
        comment,
        (msg, level) => logActivity(level || 'INFO', 'COMMENT_TIKTOK', msg),
        videoUrl
      );
      if (studioRes.success) {
        if (context) {
          for (const p of context.pages()) {
            if (!p.isClosed()) await p.close().catch(() => {});
          }
        }
        const isDev = isDeveloperMode();
        let savedVideo: string | undefined = undefined;
        const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
        if (targetVideo) {
          if (isDev) {
            await targetVideo.saveAs(path.join(VIDEOS_DIR, videoFileName)).catch(() => {});
            savedVideo = videoFileName;
          } else {
            await targetVideo.delete().catch(() => {});
          }
        }
        return {
          success: true,
          message: `Đã đăng thành công ${studioRes.sent}/${studioRes.total} bình luận qua TikTok Studio!`,
          debugVideoPath: savedVideo,
        };
      }
    } catch (studioErr: any) {
      logActivity('WARN', 'COMMENT_TIKTOK', `Thử bình luận qua TikTok Studio không thành công: ${studioErr.message}, tiếp tục thử qua giao diện xem video công khai...`);
    }

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
        throw new Error('CAPTCHA_REQUIRED: Hết thời gian chờ giải Captcha (60s).');
      }
    }

    const isLogin = await page.evaluate(() => {
      const loginModal = document.querySelector('#login-modal, [data-e2e="login-modal"]');
      return Boolean(loginModal);
    });

    if (isLogin) {
      logActivity('WARN', 'COMMENT_TIKTOK', 'TikTok yêu cầu đăng nhập. Phiên cookie chưa hợp lệ.');
      throw new Error('LOGIN_REQUIRED: TikTok yêu cầu đăng nhập (phiên chưa được xác thực hoặc cookie đã hết hạn).');
    }

    // Tách các bình luận theo dấu |
    const commentItems = comment
      .split('|')
      .map((c) => replaceDateWildcards(c.trim()))
      .filter(Boolean);

    if (commentItems.length === 0) {
      throw new Error('Nội dung bình luận trống.');
    }

    let sentCount = 0;

    for (let i = 0; i < commentItems.length; i++) {
      const itemText = commentItems[i];
      logActivity('INFO', 'COMMENT_TIKTOK', `Đang gửi bình luận công khai (${i + 1}/${commentItems.length}): "${itemText}"...`);

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
      }, itemText);

      await page.waitForTimeout(1000);

      const postBtn = page.locator('[data-e2e="comment-post"]').first();
      if ((await postBtn.count()) === 0) {
        throw new Error('Không tìm thấy nút gửi bình luận TikTok');
      }

      const isDisabled = await postBtn.isDisabled().catch(() => false);
      if (isDisabled) {
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

      const isEditorCleared = await page.evaluate(() => {
        const el = document.querySelector('.public-DraftEditor-content');
        return !el || ((el as HTMLElement).innerText || el.textContent || '').trim() === '';
      });

      if (apiSuccess || isEditorCleared) {
        sentCount++;
        logActivity('SUCCESS', 'COMMENT_TIKTOK', `Đã đăng bình luận (${i + 1}/${commentItems.length}) thành công!`);
      } else if (await checkIsCaptcha()) {
        const solved = await waitForCaptchaSolution(60000);
        if (!solved) {
          throw new Error('CAPTCHA_REQUIRED: Hết thời gian chờ giải Captcha (60s).');
        }
        sentCount++;
      }

      if (i < commentItems.length - 1) {
        await page.waitForTimeout(2500);
      }
    }

    // Đóng pages để hoàn tất ghi video
    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
    }

    const isDevMode = isDeveloperMode();
    let savedVideoFileName: string | undefined = undefined;
    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);

    if (targetVideo) {
      if (isDevMode) {
        await targetVideo.saveAs(path.join(VIDEOS_DIR, videoFileName)).catch(() => {});
        savedVideoFileName = videoFileName;
      } else {
        await targetVideo.delete().catch(() => {});
      }
    }

    logActivity('SUCCESS', 'COMMENT_TIKTOK', `Đã hoàn tất gửi ${sentCount}/${commentItems.length} bình luận TikTok!`);
    return {
      success: true,
      message: `Đã gửi thành công ${sentCount}/${commentItems.length} bình luận TikTok!`,
      debugVideoPath: savedVideoFileName,
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    logActivity('ERROR', 'COMMENT_TIKTOK', `Lỗi đăng bình luận TikTok: ${errMsg}`);

    let savedScreenshotFileName: string | undefined = undefined;
    let savedVideoFileName: string | undefined = undefined;

    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => {});
        savedScreenshotFileName = screenshotFileName;
        logActivity('WARN', 'COMMENT_TIKTOK', `Đã lưu ảnh chụp màn hình lỗi TikTok: ${screenshotFileName}`);
      } catch {}
    }

    // Đóng pages để Playwright flush video
    if (context) {
      const pages = context.pages();
      for (const p of pages) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      try {
        const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
        await targetVideo.saveAs(finalVideoPath);
        savedVideoFileName = videoFileName;
        logActivity('WARN', 'COMMENT_TIKTOK', `[Video Debug] Đã lưu video thao tác lỗi bình luận TikTok: ${videoFileName}`);
      } catch (vErr: any) {
        logActivity('WARN', 'COMMENT_TIKTOK', `Lỗi lưu video TikTok debug: ${vErr?.message || vErr}`);
      }
    }

    return {
      success: false,
      message: `Lỗi đăng bình luận TikTok: ${errMsg}`,
      error: errMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedVideoFileName,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}
