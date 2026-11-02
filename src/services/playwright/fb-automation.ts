import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import db, { logActivity, getSetting } from '@/lib/db';
import { PostItem } from '@/types';
import { isSessionAvailable, getUserDataDir, injectSessionCookies, getSessionPath, getChromiumLaunchArgs } from './session';
import { checkDuplicatePublish, markTrendAsPublished } from '../dedup';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'storage', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const VIDEOS_DIR = path.join(process.cwd(), 'storage', 'videos');
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

export interface PublishResult {
  success: boolean;
  postId: string;
  fbPostUrl?: string;
  commentSuccess?: boolean;
  screenshotPath?: string;
  videoPath?: string;
  error?: string;
}

/**
 * Automatically handle Facebook "Your profiles & Pages" modal.
 * Triggered when switching profile or when Facebook prompts to choose identity.
 */
export async function handleProfileSwitcherModal(page: any, targetPageName?: string): Promise<boolean> {
  try {
    const dialogs = page.locator('div[role="dialog"]');
    const dialogCount = await dialogs.count();
    if (dialogCount === 0) return false;

    for (let i = 0; i < dialogCount; i++) {
      const dialog = dialogs.nth(i);
      if (!(await dialog.isVisible().catch(() => false))) continue;

      const dialogText = await dialog.innerText().catch(() => '');
      const isProfileSwitcher =
        dialogText.includes('Your profiles & Pages') ||
        dialogText.includes('Trang cá nhân & Trang của bạn') ||
        dialogText.includes('Switch to interact on this post') ||
        dialogText.includes('Chuyển để tương tác') ||
        dialogText.includes('Search profiles and Pages') ||
        dialogText.includes('Tìm kiếm trang cá nhân và Trang') ||
        dialogText.includes('Switch profile') ||
        dialogText.includes('Chuyển trang cá nhân');

      if (!isProfileSwitcher) continue;

      logActivity('INFO', 'AUTH', '[Bypass] Phát hiện modal "Your profiles & Pages". Đang xử lý...');

      const pageName = targetPageName || getSetting('fb_page_name', '') || 'Financial News';

      // 1. If target page is listed, click it to ensure active identity is the Fanpage
      if (pageName) {
        const pageOption = dialog.locator(
          `div[role="radio"]:has-text("${pageName}"), ` +
          `div[role="button"]:has-text("${pageName}"), ` +
          `div:has-text("${pageName}")`
        ).last();

        if ((await pageOption.count()) > 0 && (await pageOption.isVisible().catch(() => false))) {
          logActivity('INFO', 'AUTH', `[Bypass] Đang chọn "${pageName}" trong modal Profiles & Pages...`);
          await pageOption.click().catch(() => { });
          await page.waitForTimeout(2000);
        }
      }

      // 2. Close the modal by clicking the 'X' button or pressing Escape
      const closeButtons = dialog.locator(
        'div[aria-label="Close"], ' +
        'div[aria-label="Đóng"], ' +
        'button[aria-label*="Close"], ' +
        'button[aria-label*="Đóng"], ' +
        'div[role="button"][aria-label*="Close"], ' +
        'div[role="button"][aria-label*="Đóng"]'
      );

      if ((await closeButtons.count()) > 0 && (await closeButtons.first().isVisible().catch(() => false))) {
        logActivity('INFO', 'AUTH', '[Bypass] Bấm nút Đóng (X) trên modal "Your profiles & Pages"...');
        await closeButtons.first().click().catch(() => { });
      } else {
        logActivity('INFO', 'AUTH', '[Bypass] Nhấn Escape để đóng modal "Your profiles & Pages"...');
        await page.keyboard.press('Escape');
      }

      await page.waitForTimeout(1500);
      return true;
    }
  } catch (err: any) {
    logActivity('WARN', 'AUTH', `Lỗi khi xử lý modal Profiles & Pages: ${err.message}`);
  }
  return false;
}

/**
 * Automatically dismiss any blocking popups such as WhatsApp button upsell ("Make it easier to contact you"),
 * messaging button prompts, profile switcher dialogs, or audience review dialogs that prevent posting.
 */
async function dismissBlockingPagePopups(page: any, targetPageName?: string): Promise<boolean> {
  let dismissed = false;

  // 1. Check for "Your profiles & Pages" modal
  try {
    const profileHandled = await handleProfileSwitcherModal(page, targetPageName);
    if (profileHandled) dismissed = true;
  } catch { }

  // 2. If "Leave Page?" / "Rời khỏi trang?" dialog appears, ALWAYS click "Keep editing" to stay in the composer
  try {
    const keepEditingBtn = page
      .locator(
        'div[role="button"]:has-text("Keep editing"), ' +
        'div[role="button"]:has-text("Tiếp tục chỉnh sửa"), ' +
        'button:has-text("Keep editing"), ' +
        'button:has-text("Tiếp tục chỉnh sửa")'
      )
      .first();
    if ((await keepEditingBtn.count()) > 0 && (await keepEditingBtn.isVisible({ timeout: 500 }).catch(() => false))) {
      logActivity('INFO', 'PUBLISH', 'Phát hiện hộp thoại "Leave Page?", bấm "Keep editing" để giữ nguyên bài viết...');
      await keepEditingBtn.click();
      await page.waitForTimeout(1000);
      return true;
    }
  } catch { }

  // 3. Dismiss WhatsApp "Make it easier to contact you" popup
  const whatsAppDismissed = await dismissWhatsAppPopup(page);
  if (whatsAppDismissed) dismissed = true;

  return dismissed;
}

/**
 * Specifically detect and dismiss the WhatsApp upsell popup ("Make it easier to contact you")
 * by clicking "Not now" or the close button.
 */
export async function dismissWhatsAppPopup(page: any): Promise<boolean> {
  try {
    const whatsAppDialog = page.locator(
      'div[role="dialog"] div[role="button"][aria-label="Add WhatsApp button"]'
    );

    if ((await whatsAppDialog.count()) > 0 && (await whatsAppDialog.first().isVisible({ timeout: 800 }).catch(() => false))) {
      logActivity('INFO', 'PUBLISH', 'Phát hiện popup "Make it easier to contact you" (WhatsApp)...');

      const notNowSelectors = [
        'div[role="dialog"] div[role="button"][aria-label="Not now"]',
        'div[role="dialog"] div[role="button"]:has-text("Not now")',
        'div[role="dialog"] div[role="button"]:has-text("Lúc khác")',
        'div[role="dialog"] div[role="button"]:has-text("Không phải bây giờ")',
        'div[role="dialog"] button:has-text("Not now")',
        'div[role="dialog"] button:has-text("Lúc khác")',
        'div[role="button"]:has-text("Not now")',
        'div[role="button"]:has-text("Lúc khác")',
        'div[role="button"]:has-text("Không phải bây giờ")',
        'button:has-text("Not now")',
        'button:has-text("Lúc khác")',
        'span:has-text("Not now")',
        'span:has-text("Lúc khác")',
      ];

      for (const sel of notNowSelectors) {
        const btn = page.locator(sel).first();
        if ((await btn.count()) > 0 && (await btn.isVisible({ timeout: 800 }).catch(() => false))) {
          logActivity('INFO', 'PUBLISH', `[Bypass Popup] Đang click nút "Not now" ("${await btn.innerText().catch(() => 'Not now')}") trên popup WhatsApp...`);
          await btn.click({ force: true }).catch(() => { });
          await page.waitForTimeout(1500);
          return true;
        }
      }

      // Nếu không tìm thấy chữ Not now, thử bấm nút đóng (X) ở góc phải
      const closeButtons = page.locator(
        'div[role="dialog"]:has-text("Make it easier to contact you") div[aria-label="Close"], ' +
        'div[role="dialog"]:has-text("Make it easier to contact you") div[aria-label="Đóng"], ' +
        'div[role="dialog"]:has-text("WhatsApp") div[aria-label="Close"], ' +
        'div[role="dialog"]:has-text("WhatsApp") div[aria-label="Đóng"], ' +
        'div[role="dialog"]:has-text("Make it easier to contact you") button[aria-label="Close"], ' +
        'div[role="dialog"]:has-text("Make it easier to contact you") button[aria-label="Đóng"]'
      );
      if ((await closeButtons.count()) > 0 && (await closeButtons.first().isVisible({ timeout: 800 }).catch(() => false))) {
        logActivity('INFO', 'PUBLISH', '[Bypass Popup] Đang click nút Đóng (X) trên popup WhatsApp...');
        await closeButtons.first().click({ force: true }).catch(() => { });
        await page.waitForTimeout(1500);
        return true;
      }
    }
  } catch (err: any) {
    logActivity('WARN', 'PUBLISH', `Lỗi xử lý popup WhatsApp: ${err.message}`);
  }
  return false;
}

/**
 * Automatically handle Facebook Account Chooser / "Continue as [User]" / Remembered Profile splash screens
 */
async function handleAccountChooserOrLogin(
  page: any,
  context: any,
  targetUrl?: string
): Promise<boolean> {
  try {
    // 1. Check if Facebook cookie consent popup is present
    const cookieConsent = page
      .locator(
        'button:has-text("Allow all cookies"), ' +
        'button:has-text("Cho phép tất cả cookie"), ' +
        'button:has-text("Chấp nhận tất cả"), ' +
        'button:has-text("Allow essential and optional cookies"), ' +
        'button:has-text("Allow essential cookies"), ' +
        'div[role="button"]:has-text("Allow all cookies"), ' +
        'div[role="button"]:has-text("Cho phép tất cả cookie")'
      )
      .first();
    if ((await cookieConsent.count()) > 0 && (await cookieConsent.isVisible({ timeout: 1500 }).catch(() => false))) {
      logActivity('INFO', 'AUTH', '[Bypass] Bấm chấp nhận Cookie Facebook...');
      await cookieConsent.click().catch(() => { });
      await page.waitForTimeout(2000);
    }

    // 2. Check for Account Chooser / "Continue" button (as shown on VPS splash screen)
    const continueSelectors = [
      'button:has-text("Continue")',
      'button:has-text("Tiếp tục")',
      'div[role="button"]:has-text("Continue")',
      'div[role="button"]:has-text("Tiếp tục")',
      'div[aria-label*="Continue"]',
      'div[aria-label*="Tiếp tục"]',
      'a[role="button"]:has-text("Continue")',
      'a[role="button"]:has-text("Tiếp tục")',
      'span:has-text("Continue")',
      'span:has-text("Tiếp tục")',
    ];

    let continueBtn = null;
    for (const sel of continueSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1500 }).catch(() => false))) {
        continueBtn = el;
        break;
      }
    }

    if (continueBtn) {
      logActivity(
        'INFO',
        'AUTH',
        '[Bypass] Phát hiện màn hình xác nhận tài khoản ("Continue / Tiếp tục"). Đang tự động bấm "Continue"...'
      );
      await continueBtn.click({ force: true });
      await page.waitForTimeout(4000);

      // Check if password prompt appears
      const passwordInput = page.locator('input[type="password"]').first();
      if ((await passwordInput.count()) > 0 && (await passwordInput.isVisible({ timeout: 2000 }).catch(() => false))) {
        logActivity(
          'WARN',
          'AUTH',
          'Facebook yêu cầu nhập mật khẩu trên IP VPS mới. Vui lòng export đầy đủ JSON Cookie từ tiện ích Cookie-Editor trên máy tính cá nhân để bỏ qua mật khẩu.'
        );
        return false;
      }

      // Check if we entered Facebook successfully
      logActivity('SUCCESS', 'AUTH', '[Bypass] Đã kích hoạt tài khoản qua màn hình Continue, đang cập nhật session...');
      try {
        await context.storageState({ path: getSessionPath() });
      } catch { }

      // If a target URL was specified (like a Fanpage) and we are currently on facebook.com home, navigate to targetUrl
      if (targetUrl && page.url() && !page.url().includes(targetUrl.replace(/^https?:\/\/(www\.)?facebook\.com\/?/, ''))) {
        logActivity('INFO', 'AUTH', `Đang điều hướng tiếp tục đến trang đích: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => { });
        await page.waitForTimeout(3000);
      }

      return true;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('WARN', 'AUTH', `Kiểm tra màn hình Account Chooser: ${msg}`);
  }

  return false;
}

export function resolveTargetUrl(): { targetType: string; targetUrl: string; pageName: string } {
  const targetType = getSetting('fb_target_type', 'page');
  const pageName = getSetting('fb_page_name', '').trim() || 'Financial News';
  const pageUrlSetting = getSetting('fb_page_url', '').trim();
  const targetUrlSetting = getSetting('fb_target_url', '').trim();

  const isGenericRoot = (u: string) => !u || /^https?:\/\/(www\.)?facebook\.com\/?$/i.test(u);

  let targetUrl = 'https://www.facebook.com/';
  if (targetType === 'page') {
    if (!isGenericRoot(pageUrlSetting)) {
      targetUrl = pageUrlSetting;
    } else if (!isGenericRoot(targetUrlSetting)) {
      targetUrl = targetUrlSetting;
    } else {
      targetUrl = pageUrlSetting || targetUrlSetting || 'https://www.facebook.com/';
    }
  } else {
    targetUrl = !isGenericRoot(targetUrlSetting) ? targetUrlSetting : (!isGenericRoot(pageUrlSetting) ? pageUrlSetting : 'https://www.facebook.com/');
  }

  return { targetType, targetUrl, pageName };
}

export async function executePublishAndComment(
  post: PostItem,
  options?: { dryRun?: boolean; headless?: boolean }
): Promise<PublishResult> {
  const dryRun = options?.dryRun ?? false;
  const headless = options?.headless ?? true;

  const { targetType, targetUrl, pageName } = resolveTargetUrl();

  if (targetType === 'page') {
    const isGenericRoot = /^https?:\/\/(www\.)?facebook\.com\/?$/i.test(targetUrl);
    if (!targetUrl || isGenericRoot) {
      const errorMsg =
        'Bạn đã chọn chế độ "Đăng lên Fanpage" nhưng chưa cấu hình "Đường dẫn Fanpage" hợp lệ trong tab Cài đặt.';
      db.prepare(`UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?`).run(errorMsg, post.id);
      logActivity('ERROR', 'PUBLISH', errorMsg);
      return { success: false, postId: post.id, error: errorMsg };
    }
  }

  // DEDUPLICATION GUARD: Check if post or topic was already published
  if (!dryRun) {
    const dupCheck = checkDuplicatePublish(post);
    if (dupCheck.isDuplicate) {
      const errorMsg = `Hủy đăng bài để tránh trùng lặp: ${dupCheck.reason}`;
      logActivity('WARN', 'PUBLISH', errorMsg);
      return { success: false, postId: post.id, error: errorMsg };
    }
  }

  logActivity(
    'INFO',
    'PUBLISH',
    `Starting publish process for post ${post.id}: "${post.trend_title}" (Target: ${targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Trang cá nhân'
    }, Mode: ${dryRun ? 'Dry Run' : 'Live'})`
  );

  // Update status to publishing
  db.prepare(`UPDATE posts SET status = 'publishing' WHERE id = ?`).run(post.id);

  if (dryRun) {
    // Simulate dry run
    await new Promise((r) => setTimeout(r, 2000));
    const mockScreenshot = `mock_${post.id}.png`;
    const mockUrl = targetType === 'page'
      ? `${targetUrl}/posts/mock_${Date.now()}`
      : `https://facebook.com/permalink.php?story_fbid=mock_${Date.now()}`;

    db.prepare(`
      UPDATE posts 
      SET status = 'published', fb_post_url = ?, published_at = CURRENT_TIMESTAMP, screenshot_path = ?
      WHERE id = ?
    `).run(mockUrl, mockScreenshot, post.id);

    markTrendAsPublished({ trend_id: post.trend_id, trend_title: post.trend_title });

    logActivity(
      'SUCCESS',
      'PUBLISH',
      `[Dry Run] Simulated post and source comment successfully for "${post.trend_title}" on ${targetType === 'page' ? 'Fanpage' : 'Profile'}`
    );

    return {
      success: true,
      postId: post.id,
      fbPostUrl: mockUrl,
      commentSuccess: true,
      screenshotPath: mockScreenshot,
    };
  }

  if (!isSessionAvailable()) {
    const errorMsg = 'Chưa thiết lập session Facebook. Vui lòng kết nối tài khoản Facebook trước.';
    db.prepare(`UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?`).run(errorMsg, post.id);
    logActivity('ERROR', 'PUBLISH', errorMsg);
    return { success: false, postId: post.id, error: errorMsg };
  }

  let context: any;
  let page: any;
  let video: any;
  const screenshotFileName = `post_${post.id}_${Date.now()}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);
  const videoFileName = `publish_${post.id}_${Date.now()}.webm`;

  try {
    context = await chromium.launchPersistentContext(getUserDataDir(), {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications']),
    });

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.on('crash', () => {
      logActivity('ERROR', 'PUBLISH', 'Playwright page crashed (Bộ nhớ RAM trên VPS bị cạn kiệt hoặc tiến trình bị ngắt).');
    });

    // Only abort actual video streaming files (avoids proxying hundreds of normal requests through DevTools Protocol)
    await page.route(/\.(mp4|webm|avi|mov)($|\?)/i, (route: any) => route.abort().catch(() => { }));

    logActivity('INFO', 'PUBLISH', `Đang điều hướng đến trang đích Facebook: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    // Bypass Account Chooser / Continue splash screen if present
    await handleAccountChooserOrLogin(page, context, targetUrl);

    // Step 0: Check if we are in Page mode and Facebook shows a "Switch to Page" prompt
    if (targetType === 'page') {
      logActivity('INFO', 'PUBLISH', `[Page Mode] Kiểm tra nút chuyển quyền sang Fanpage trên: ${targetUrl}`);
      // Dismiss or select Page if "Your profiles & Pages" modal is showing
      await handleProfileSwitcherModal(page, pageName);

      const switchSelectors = [
        'div[role="button"]:has-text("Chuyển ngay")',
        'div[role="button"]:has-text("Switch now")',
        'div[role="button"]:has-text("Chuyển sang")',
        'div[role="button"]:has-text("Switch to")',
        'button:has-text("Chuyển ngay")',
        'button:has-text("Switch now")',
        'div[aria-label*="Chuyển ngay"]',
        'div[aria-label*="Switch now"]',
        'div[aria-label*="Chuyển sang"]',
        'div[aria-label*="Switch to"]',
      ];

      for (const sel of switchSelectors) {
        const btn = page.locator(sel).first();
        if ((await btn.count()) > 0 && (await btn.isVisible({ timeout: 1500 }).catch(() => false))) {
          const btnText = await btn.innerText().catch(() => '');
          logActivity('INFO', 'PUBLISH', `[Page Mode] Phát hiện nút chuyển sang Fanpage ("${btnText}"), đang kích hoạt...`);
          await btn.click();
          await page.waitForTimeout(3000);
          await handleProfileSwitcherModal(page, pageName);
          await page.waitForTimeout(2000);
          break;
        }
      }
    }

    // Dismiss any blocking popups before locating post trigger
    await dismissBlockingPagePopups(page, pageName);

    // BƯỚC 1: Vào trang đích (mặc định https://www.facebook.com/financiial.news)
    // (Đã điều hướng ở trên tới targetUrl)

    // BƯỚC 2: Click vào span có text: "What's on your mind?"
    logActivity('INFO', 'PUBLISH', '[Bước 2] Tìm và click vào thẻ "What\'s on your mind?"...');
    const postTriggerSelectors = [
      'span:has-text("What\'s on your mind?")',
      'span:has-text("What\'s on your mind")',
      'span:has-text("Bạn đang nghĩ gì?")',
      'span:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("Create post")',
      'div[role="button"]:has-text("Tạo bài viết")',
      'div[role="button"]:has-text("Create a post")',
      'div[role="button"]:has-text("Viết gì đó")',
      'div[aria-label*="Create a post"]',
      'div[aria-label*="Create post"]',
      'div[aria-label*="Tạo bài viết"]',
    ];

    let postTrigger = null;
    for (const selector of postTriggerSelectors) {
      const el = page.locator(selector).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1500 }).catch(() => false))) {
        postTrigger = el;
        break;
      }
    }

    if (!postTrigger) {
      // Thử xử lý modal profile switcher và cuộn nhẹ trang xuống
      await handleProfileSwitcherModal(page, pageName);
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(1500);

      for (const selector of postTriggerSelectors) {
        const el = page.locator(selector).first();
        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1500 }).catch(() => false))) {
          postTrigger = el;
          break;
        }
      }
    }

    if (!postTrigger) {
      throw new Error(
        `Không tìm thấy nút tạo bài viết "What's on your mind?" trên ${targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Facebook'
        }. Hãy vào tab Cài đặt -> bấm "Mở trình duyệt" để chuyển đổi sang tư cách Fanpage trước.`
      );
    }

    logActivity('INFO', 'PUBLISH', 'Clicking post creation trigger ("What\'s on your mind?")...');
    await postTrigger.click();
    await page.waitForTimeout(2500);

    // BƯỚC 3: 1 modal mở ra nhập nội dung vào 1 div có contenteditable="true"
    logActivity('INFO', 'PUBLISH', '[Bước 3] Modal tạo bài viết mở ra, tìm div có contenteditable="true" để nhập nội dung...');
    const textboxSelectors = [
      'div[role="dialog"] div[contenteditable="true"]',
      'div[role="dialog"] div[role="textbox"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[aria-label*="What\'s on your mind"][role="textbox"]',
      'div[aria-label*="Bạn đang nghĩ gì"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    let textbox = null;
    for (const sel of textboxSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1500 }).catch(() => false))) {
        textbox = el;
        break;
      }
    }

    if (!textbox) {
      throw new Error('Không tìm thấy ô nhập nội dung (div contenteditable="true") trong modal.');
    }

    logActivity('INFO', 'PUBLISH', 'Đang điền nội dung bài viết...');
    await textbox.click();
    await page.waitForTimeout(500);

    // Điền nội dung bằng insertText tương thích Lexical editor của Facebook
    await page.keyboard.insertText(post.post_content);
    await page.waitForTimeout(2000);

    // Bỏ qua các popup cản trở như WhatsApp prompt nếu có
    for (let attempt = 0; attempt < 3; attempt++) {
      const hadPopup = await dismissBlockingPagePopups(page, pageName);
      if (!hadPopup) break;
      await page.waitForTimeout(1000);
    }

    // BƯỚC 4: Ấn Next, sau đó ấn Post
    logActivity('INFO', 'PUBLISH', '[Bước 4] Kiểm tra nút Next và nút Post để xuất bản bài viết...');

    // 4a. Tìm nút Next (nếu có trong wizard tạo bài của Fanpage)
    const nextBtnSelectors = [
      'div[role="dialog"] div[role="button"]:has-text("Next")',
      'div[role="dialog"] div[role="button"]:has-text("Tiếp")',
      'div[role="dialog"] button:has-text("Next")',
      'div[role="dialog"] button:has-text("Tiếp")',
      'div[role="button"]:has-text("Next")',
      'div[role="button"]:has-text("Tiếp")',
    ];

    for (const nsel of nextBtnSelectors) {
      const nBtn = page.locator(nsel).first();
      if ((await nBtn.count()) > 0 && (await nBtn.isVisible({ timeout: 1500 }).catch(() => false))) {
        for (let w = 0; w < 5; w++) {
          const isDisabled = (await nBtn.getAttribute('aria-disabled')) === 'true';
          if (!isDisabled) break;
          await page.waitForTimeout(800);
        }
        logActivity('INFO', 'PUBLISH', 'Phát hiện bước chuyển tiếp, đang bấm nút "Next" / "Tiếp"...');
        await nBtn.click().catch(() => nBtn.click({ force: true }));
        await page.waitForTimeout(2500);
        break;
      }
    }

    await dismissBlockingPagePopups(page, pageName);

    // 4b. Tìm nút Post
    const submitBtnSelectors = [
      'div[role="dialog"] div[aria-label="Post"]',
      'div[role="dialog"] div[aria-label="Đăng"]',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
      'div[role="dialog"] div[role="button"]:has-text("Đăng")',
      'div[role="dialog"] button:has-text("Post")',
      'div[role="dialog"] button:has-text("Đăng")',
      'div[aria-label="Post"]',
      'div[aria-label="Đăng"]',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("Đăng")',
      'button:has-text("Post")',
      'button:has-text("Đăng")',
    ];

    let submitBtn = null;
    for (const sel of submitBtnSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      for (let i = count - 1; i >= 0; i--) {
        const el = els.nth(i);
        if (await el.isVisible().catch(() => false)) {
          const txt = (await el.innerText().catch(() => '')).trim();
          const ariaLabel = (await el.getAttribute('aria-label').catch(() => '')) || '';
          const cleanTxt = txt.replace(/\s+/g, ' ').trim();

          if (
            cleanTxt === 'Post' ||
            cleanTxt === 'Đăng' ||
            cleanTxt === 'Share' ||
            cleanTxt === 'Chia sẻ' ||
            ariaLabel === 'Post' ||
            ariaLabel === 'Đăng' ||
            (cleanTxt.startsWith('Post') && cleanTxt.length < 15)
          ) {
            submitBtn = el;
            break;
          }
        }
      }
      if (submitBtn) break;
    }

    if (!submitBtn) {
      throw new Error('Không tìm thấy nút Đăng (Post) hợp lệ trên giao diện Facebook.');
    }

    // Chờ nút submit được kích hoạt (enabled)
    for (let w = 0; w < 6; w++) {
      const isDisabled =
        (await submitBtn.getAttribute('aria-disabled')) === 'true' ||
        (await submitBtn.getAttribute('disabled')) !== null;
      if (!isDisabled) break;
      logActivity('INFO', 'PUBLISH', 'Nút Đăng đang chờ xử lý (disabled), kiểm tra popup cản trở...');
      await dismissBlockingPagePopups(page, pageName);
      await page.waitForTimeout(1000);
    }

    logActivity('INFO', 'PUBLISH', `Kích hoạt nút Đăng (Post) lên ${targetType === 'page' ? 'Fanpage' : 'Facebook'}...`);
    await submitBtn.click().catch(() => submitBtn.click({ force: true }));

    // Giám sát tiến trình đăng bài (bắt popup WhatsApp "Make it easier to contact you" khi nút đang xoay)
    logActivity('INFO', 'PUBLISH', 'Đang giám sát tiến trình xuất bản và tự động xử lý popup WhatsApp ("Make it easier to contact you")...');

    let publishCompleted = false;
    const maxWaitSeconds = 35;
    const startPublishWait = Date.now();

    while (Date.now() - startPublishWait < maxWaitSeconds * 1000) {
      await page.waitForTimeout(1000);

      // 1. Kiểm tra và bấm "Not now" ngay khi popup WhatsApp xuất hiện
      const dismissedWhatsApp = await dismissWhatsAppPopup(page);
      if (dismissedWhatsApp) {
        logActivity('SUCCESS', 'PUBLISH', 'Đã bấm "Not now" trên popup WhatsApp thành công!');
        await page.waitForTimeout(2000);
      }

      // 2. Kiểm tra nếu nút Post vẫn còn hiển thị và enabled (cần bấm lại sau khi đóng popup)
      const isPostBtnVisible = await submitBtn.isVisible().catch(() => false);
      if (isPostBtnVisible) {
        const isDisabled =
          (await submitBtn.getAttribute('aria-disabled')) === 'true' ||
          (await submitBtn.getAttribute('disabled')) !== null;
        if (!isDisabled) {
          logActivity('INFO', 'PUBLISH', 'Nút Post vẫn còn hiển thị sau khi đóng popup, đang kích hoạt lại nút Post...');
          await submitBtn.click().catch(() => submitBtn.click({ force: true }));
          await page.waitForTimeout(2000);
        }
      }

      // 3. Kiểm tra xem tất cả các dialog tạo bài viết đã đóng hoàn toàn chưa
      const dialogs = page.locator('div[role="dialog"]');
      const dialogCount = await dialogs.count();
      let hasComposerOpen = false;

      for (let i = 0; i < dialogCount; i++) {
        const dlg = dialogs.nth(i);
        if (await dlg.isVisible().catch(() => false)) {
          const txt = await dlg.innerText().catch(() => '');
          if (
            txt.includes('Create post') ||
            txt.includes('Tạo bài viết') ||
            txt.includes('Post settings') ||
            txt.includes('Make it easier to contact you') ||
            txt.includes('Add a WhatsApp button') ||
            txt.includes('WhatsApp')
          ) {
            hasComposerOpen = true;
            break;
          }
        }
      }

      if (!hasComposerOpen) {
        logActivity('SUCCESS', 'PUBLISH', 'Modal tạo bài viết và popup WhatsApp đã đóng hoàn toàn (bài viết đã được xuất bản).');
        publishCompleted = true;
        break;
      }
    }

    if (!publishCompleted) {
      // Thử xử lý lần cuối nếu popup vẫn còn
      await dismissWhatsAppPopup(page);
      await page.waitForTimeout(2000);
    }

    // Đợi thêm 3.5 giây để máy chủ Facebook cập nhật vào feeds trước khi chuyển trang
    await page.waitForTimeout(3500);

    // BƯỚC 5: Sau khi post thành công, vào https://www.facebook.com/?filter=all&sk=h_chr tìm bài đã post
    logActivity('INFO', 'PUBLISH', '[Bước 5] Điều hướng đến https://www.facebook.com/?filter=all&sk=h_chr để tìm bài viết vừa post...');
    let exactPostUrl = targetUrl;

    try {
      await page.goto('https://www.facebook.com/?filter=all&sk=h_chr', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3500);

      await handleAccountChooserOrLogin(page, context);
      await handleProfileSwitcherModal(page, pageName);

      // Tìm URL bài viết trên feed gần đây nhất
      const firstFeedPostLink = page.locator(
        'a[href*="__tn__=%2CO%2CP-R"]'
      ).first();

      if ((await firstFeedPostLink.count()) > 0 && (await firstFeedPostLink.isVisible({ timeout: 4000 }).catch(() => false))) {
        const href = await firstFeedPostLink.getAttribute('href');
        if (href) {
          exactPostUrl = href.startsWith('http') ? href.split('?')[0] : `https://www.facebook.com${href.split('?')[0]}`;
          logActivity('SUCCESS', 'PUBLISH', `Đã tìm thấy link bài viết: ${exactPostUrl}`);
        }
      }
    } catch (feedNavErr: any) {
      logActivity('WARN', 'PUBLISH', `Lỗi khi tải feed https://www.facebook.com/?filter=all&sk=h_chr: ${feedNavErr.message}`);
    }

    // BƯỚC 6: Để bình luận, click vào thẻ có [role="button"][aria-label*="Comment on"], 1 modal mở ra
    logActivity('INFO', 'COMMENT', '[Bước 6] Tìm và click thẻ [role="button"][aria-label*="Comment on"] để mở modal bình luận...');
    let commentSuccess = false;

    try {
      await handleProfileSwitcherModal(page, pageName);

      const commentButtonSelectors = ['[role="button"][aria-label*="Comment on"]'];

      let commentBtn = null;
      for (const sel of commentButtonSelectors) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2500 }).catch(() => false))) {
          commentBtn = el;
          break;
        }
      }

      if (!commentBtn) {
        // Cuộn nhẹ xuống một chút để nút hiển thị
        await page.evaluate(() => window.scrollBy(0, 350));
        await page.waitForTimeout(1500);

        for (const sel of commentButtonSelectors) {
          const el = page.locator(sel).first();
          if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2500 }).catch(() => false))) {
            commentBtn = el;
            break;
          }
        }
      }

      if (commentBtn) {
        logActivity('INFO', 'COMMENT', 'Bấm vào thẻ [role="button"][aria-label*="Comment on"] để mở modal bình luận...');
        await commentBtn.click();
        await page.waitForTimeout(2500);

        // Kiểm tra xem URL trên trình duyệt có cập nhật sang link bài viết trực tiếp không
        const currentUrl = page.url();
        if (
          currentUrl &&
          (currentUrl.includes('/posts/') ||
            currentUrl.includes('story_fbid') ||
            currentUrl.includes('/photo') ||
            currentUrl.includes('/permalink'))
        ) {
          exactPostUrl = currentUrl.split('?')[0];
          logActivity('SUCCESS', 'PUBLISH', `URL chính xác của bài viết từ modal: ${exactPostUrl}`);
        }
      } else {
        logActivity('WARN', 'COMMENT', 'Không tìm thấy thẻ [role="button"][aria-label*="Comment on"] trên feed.');
      }

      // BƯỚC 7: Nhập bình luận vào thẻ có contenteditable="true" trong modal
      logActivity('INFO', 'COMMENT', '[Bước 7] Nhập bình luận vào thẻ contenteditable="true" trong modal...');
      await handleProfileSwitcherModal(page, pageName);

      const modalCommentInputSelectors = [
        'div[role="dialog"] div[contenteditable="true"]',
        'div[role="dialog"] div[role="textbox"]',
        'div[role="dialog"] div[aria-label*="Viết bình luận"]',
        'div[role="dialog"] div[aria-label*="Write a comment"]',
        'div[role="dialog"] div[aria-label*="Bình luận"]',
        'div[aria-label*="Viết bình luận"][role="textbox"]',
        'div[aria-label*="Write a comment"][role="textbox"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
      ];

      let commentBox = null;
      for (const sel of modalCommentInputSelectors) {
        const els = page.locator(sel);
        const count = await els.count();
        for (let i = 0; i < count; i++) {
          const el = els.nth(i);
          if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
            // Không chọn nhầm modal tạo bài viết
            const isComposer = await el
              .evaluate((node: any) => {
                const dialog = node.closest('div[role="dialog"]');
                if (!dialog) return false;
                const txt = (dialog as HTMLElement).innerText || dialog.textContent || '';
                return txt.includes('Create post') || txt.includes('Tạo bài viết') || txt.includes('Post settings');
              })
              .catch(() => false);

            if (!isComposer) {
              commentBox = el;
              break;
            }
          }
        }
        if (commentBox) break;
      }

      if (commentBox) {
        await commentBox.click();
        await page.waitForTimeout(600);
        await page.keyboard.insertText(post.comment_content);
        await page.waitForTimeout(1500);

        // BƯỚC 8: Click vào element aria-label="Post comment"
        logActivity('INFO', 'COMMENT', '[Bước 8] Tìm và click element aria-label="Post comment"...');
        const postCommentBtnSelectors = [
          '[aria-label="Post comment"]',
          'div[role="dialog"] [aria-label="Post comment"]',
          'div[aria-label="Post comment"]',
          'button[aria-label="Post comment"]',
          '[aria-label*="Post comment" i]',
          '[aria-label="Đăng bình luận"]',
          'div[role="dialog"] [aria-label="Đăng bình luận"]',
          'div[aria-label="Đăng bình luận"]',
          'button[aria-label="Đăng bình luận"]',
          '[aria-label*="Bình luận" i]',
        ];

        let postCommentBtn = null;
        for (const sel of postCommentBtnSelectors) {
          const el = page.locator(sel).first();
          if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2000 }).catch(() => false))) {
            postCommentBtn = el;
            break;
          }
        }

        if (postCommentBtn) {
          logActivity('INFO', 'COMMENT', 'Phát hiện nút aria-label="Post comment", đang bấm gửi bình luận...');
          await postCommentBtn.click();
          await page.waitForTimeout(3000);
          commentSuccess = true;
        } else {
          logActivity('INFO', 'COMMENT', 'Không thấy nút aria-label="Post comment", gửi bằng phím Enter...');
          await page.keyboard.press('Enter');
          await page.waitForTimeout(3000);
          commentSuccess = true;
        }

        logActivity('SUCCESS', 'COMMENT', `Đã tự động gửi bình luận nguồn tin thành công cho bài viết ${post.id}`);
      } else {
        logActivity('WARN', 'COMMENT', 'Không tìm thấy thẻ contenteditable="true" trong modal bình luận.');
      }
    } catch (commentErr: any) {
      logActivity('WARN', 'COMMENT', `Bước auto-comment gặp sự cố: ${commentErr.message}`);
    }

    // Step 6: Save audit screenshot
    await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });

    // Close page to complete video recording
    if (page && !page.isClosed()) {
      await page.close().catch(() => { });
    }

    // Yêu cầu: Chỉ lưu video của bài post bị lỗi. Bài đăng thành công thì xóa video tạm để tiết kiệm dung lượng.
    if (video) {
      try {
        await video.delete().catch(() => { });
      } catch {}
    }

    if (context) {
      await context.close().catch(() => { });
    }

    // Nếu bài viết trước đó từng lỗi và có video_path cũ, xóa file video cũ đi
    if (post.video_path) {
      try {
        const oldVidPath = path.join(VIDEOS_DIR, path.basename(post.video_path));
        if (fs.existsSync(oldVidPath)) fs.unlinkSync(oldVidPath);
      } catch {}
    }

    // Update database with exact post URL and video_path = NULL (vì thành công không cần giữ video)
    db.prepare(`
      UPDATE posts 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, screenshot_path = ?, video_path = NULL, fb_post_url = ?, error_message = NULL
      WHERE id = ?
    `).run(screenshotFileName, exactPostUrl, post.id);

    markTrendAsPublished({ trend_id: post.trend_id, trend_title: post.trend_title });

    logActivity('SUCCESS', 'PUBLISH', `Post ${post.id} successfully published to ${targetType === 'page' ? 'Fanpage' : 'Facebook'}!`);

    return {
      success: true,
      postId: post.id,
      fbPostUrl: exactPostUrl,
      commentSuccess,
      screenshotPath: screenshotFileName,
      videoPath: undefined,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Lỗi không xác định khi đăng bài';
    logActivity('ERROR', 'PUBLISH', `Failed to publish post ${post.id}: ${errorMsg}`);

    let savedVideoFileName: string | undefined = undefined;
    if (context) {
      try {
        const p = page || context.pages()[0];
        if (p && !p.isClosed()) {
          await p.screenshot({ path: screenshotFullPath }).catch(() => { });
          await p.close().catch(() => { });
        }
      } catch (_) { }

      if (video) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await video.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          logActivity('INFO', 'PUBLISH', `[Video] Đã lưu video ghi lại quá trình đăng (lỗi): ${videoFileName}`);
        } catch (vErr: any) {
          logActivity('WARN', 'PUBLISH', `Lỗi lưu video lỗi: ${vErr.message}`);
        }
      }

      await context.close().catch(() => { });
    }

    db.prepare(`
      UPDATE posts 
      SET status = 'failed', error_message = ?, screenshot_path = ?, video_path = ?
      WHERE id = ?
    `).run(errorMsg, screenshotFileName, savedVideoFileName || null, post.id);

    return {
      success: false,
      postId: post.id,
      error: errorMsg,
      screenshotPath: screenshotFileName,
      videoPath: savedVideoFileName,
    };
  }
}

/**
 * Execute comment-only automation on an already published Facebook post.
 */
export async function executeCommentOnly(
  post: PostItem,
  options?: { postUrl?: string; headless?: boolean }
): Promise<{ success: boolean; error?: string; screenshotPath?: string; videoPath?: string }> {
  if (!isSessionAvailable()) {
    throw new Error('Chưa thiết lập session Facebook. Vui lòng kết nối tài khoản Facebook trước.');
  }

  const headless = options?.headless ?? true;
  const { targetType, targetUrl: defaultTargetUrl, pageName } = resolveTargetUrl();
  const directPostUrl = (options?.postUrl || post.fb_post_url || '').trim();

  // If specific post URL is provided and looks like a post, go directly to it. Otherwise go to target URL.
  const isDirectPost =
    directPostUrl &&
    (directPostUrl.includes('/posts/') ||
      directPostUrl.includes('story_fbid') ||
      directPostUrl.includes('/permalink') ||
      directPostUrl.includes('/photo'));
  const targetUrl = isDirectPost ? directPostUrl : defaultTargetUrl;

  const screenshotFileName = `comment_${post.id}_${Date.now()}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);
  const videoFileName = `comment_${post.id}_${Date.now()}.webm`;

  let context: any;
  let page: any;
  let video: any;
  try {
    context = await chromium.launchPersistentContext(getUserDataDir(), {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications']),
    });

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.on('crash', () => {
      logActivity('ERROR', 'COMMENT', 'Playwright page crashed (Bộ nhớ RAM trên VPS bị cạn kiệt hoặc tiến trình bị ngắt).');
    });

    // Only abort actual video streaming files (avoids proxying hundreds of normal requests through DevTools Protocol)
    await page.route(/\.(mp4|webm|avi|mov)($|\?)/i, (route: any) => route.abort().catch(() => { }));

    let resolvedPostUrl = targetUrl;
    if (!isDirectPost) {
      logActivity('INFO', 'COMMENT', '[Comment Only] Đang tìm bài viết mới nhất trên Feeds (sk=h_chr)...');
      try {
        await page.goto('https://www.facebook.com/?filter=all&sk=h_chr', { waitUntil: 'domcontentloaded', timeout: 40000 });
        await page.waitForTimeout(3000);

        // Bypass Account Chooser / Continue splash screen if present
        await handleAccountChooserOrLogin(page, context);
        await handleProfileSwitcherModal(page, pageName);

        const timeLink = page.locator('a[href*="__tn__=%2CO%2CP-R"], div[role="feed"] a[href*="/posts/"], div[role="feed"] a[href*="story_fbid"]').first();
        if ((await timeLink.count()) > 0 && (await timeLink.isVisible({ timeout: 5000 }).catch(() => false))) {
          const href = await timeLink.getAttribute('href');
          if (href) {
            resolvedPostUrl = href.startsWith('http') ? href.split('?')[0] : `https://www.facebook.com${href.split('?')[0]}`;
            logActivity('INFO', 'COMMENT', `[Comment Only] Đã tìm thấy link bài viết: ${resolvedPostUrl}`);
          }
        }
      } catch (err: any) {
        logActivity('WARN', 'COMMENT', `[Comment Only] Lỗi tìm bài qua feeds: ${err.message}`);
      }
    } else {
      logActivity('INFO', 'COMMENT', `[Comment Only] Điều hướng trực tiếp đến bài viết: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      await handleProfileSwitcherModal(page, pageName);
    }

    // Click data-ad-rendering-role="comment_button" để mở modal bình luận
    const commentBtnSelectors = [
      '[data-ad-rendering-role="comment_button"]',
      'div[data-ad-rendering-role="comment_button"]',
      'div[role="feed"] div[role="article"] [data-ad-rendering-role="comment_button"]',
      'div[role="article"] div[role="button"]:has-text("Comment")',
      'div[role="article"] div[role="button"]:has-text("Bình luận")',
      'div[role="button"]:has-text("Comment")',
      'div[role="button"]:has-text("Bình luận")',
    ];

    let commentBtn = null;
    for (const sel of commentBtnSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2500 }).catch(() => false))) {
        commentBtn = el;
        break;
      }
    }

    if (!commentBtn) {
      await page.evaluate(() => window.scrollBy(0, 350));
      await page.waitForTimeout(1500);

      for (const sel of commentBtnSelectors) {
        const el = page.locator(sel).first();
        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2500 }).catch(() => false))) {
          commentBtn = el;
          break;
        }
      }
    }

    if (commentBtn) {
      logActivity('INFO', 'COMMENT', '[Comment Only] Bấm thẻ comment_button để mở modal bình luận...');
      await commentBtn.click();
      await page.waitForTimeout(2500);

      const currentUrl = page.url();
      if (
        currentUrl &&
        (currentUrl.includes('/posts/') ||
          currentUrl.includes('story_fbid') ||
          currentUrl.includes('/photo') ||
          currentUrl.includes('/permalink'))
      ) {
        resolvedPostUrl = currentUrl.split('?')[0];
      }
    }

    // Tìm thẻ contenteditable="true" trong modal
    const modalCommentInputSelectors = [
      'div[role="dialog"] div[contenteditable="true"]',
      'div[role="dialog"] div[role="textbox"]',
      'div[role="dialog"] div[aria-label*="Viết bình luận"]',
      'div[role="dialog"] div[aria-label*="Write a comment"]',
      'div[role="dialog"] div[aria-label*="Bình luận"]',
      'div[aria-label*="Viết bình luận"][role="textbox"]',
      'div[aria-label*="Write a comment"][role="textbox"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
    ];

    let commentBox = null;
    for (const sel of modalCommentInputSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      for (let i = 0; i < count; i++) {
        const el = els.nth(i);
        if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
          const isComposer = await el
            .evaluate((node: any) => {
              const dialog = node.closest('div[role="dialog"]');
              if (!dialog) return false;
              const txt = (dialog as HTMLElement).innerText || dialog.textContent || '';
              return txt.includes('Create post') || txt.includes('Tạo bài viết') || txt.includes('Post settings');
            })
            .catch(() => false);

          if (!isComposer) {
            commentBox = el;
            break;
          }
        }
      }
      if (commentBox) break;
    }

    if (!commentBox) {
      throw new Error(
        'Không tìm thấy ô nhập bình luận (contenteditable="true") trong modal. Hãy kiểm tra xem bạn đã chuyển sang tư cách Fanpage hoặc bài viết có cho phép bình luận không.'
      );
    }

    logActivity('INFO', 'COMMENT', `[Comment Only] Đang điền nội dung link nguồn vào ô bình luận...`);
    await commentBox.click();
    await page.waitForTimeout(600);
    await page.keyboard.insertText(post.comment_content);
    await page.waitForTimeout(1500);

    // Click nút aria-label="Post comment"
    const postCommentBtnSelectors = [
      '[aria-label="Post comment"]',
      'div[role="dialog"] [aria-label="Post comment"]',
      'div[aria-label="Post comment"]',
      'button[aria-label="Post comment"]',
      '[aria-label*="Post comment" i]',
      '[aria-label="Đăng bình luận"]',
      'div[role="dialog"] [aria-label="Đăng bình luận"]',
      'div[aria-label="Đăng bình luận"]',
      'button[aria-label="Đăng bình luận"]',
      '[aria-label*="Bình luận" i]',
    ];

    let postCommentBtn = null;
    for (const sel of postCommentBtnSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 2000 }).catch(() => false))) {
        postCommentBtn = el;
        break;
      }
    }

    if (postCommentBtn) {
      logActivity('INFO', 'COMMENT', '[Comment Only] Bấm nút aria-label="Post comment"...');
      await postCommentBtn.click();
      await page.waitForTimeout(3000);
    } else {
      logActivity('INFO', 'COMMENT', '[Comment Only] Không thấy nút aria-label="Post comment", gửi bằng phím Enter...');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
    }

    await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });

    let savedVideoFileName: string | undefined = undefined;
    if (page && !page.isClosed()) {
      await page.close().catch(() => { });
    }

    if (video) {
      try {
        await video.delete().catch(() => { });
      } catch {}
    }

    if (context) {
      await context.close().catch(() => { });
    }

    // Mark post comment status in db and update fb_post_url with exact link
    db.prepare(`UPDATE posts SET comment_id = 'commented', screenshot_path = ?, fb_post_url = ?, error_message = NULL WHERE id = ?`).run(
      screenshotFileName,
      resolvedPostUrl,
      post.id
    );
    logActivity('SUCCESS', 'COMMENT', `[Comment Only] Đã gửi bình luận nguồn thành công cho bài viết ${post.id}`);

    return { success: true, screenshotPath: screenshotFileName };
  } catch (err: any) {
    let savedVideoFileName: string | undefined = undefined;
    if (context) {
      try {
        const p = page || context.pages()[0];
        if (p && !p.isClosed()) {
          await p.screenshot({ path: screenshotFullPath }).catch(() => { });
          await p.close().catch(() => { });
        }
      } catch (_) { }

      if (video) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await video.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
        } catch (_) { }
      }

      await context.close().catch(() => { });
    }

    if (savedVideoFileName) {
      db.prepare(`UPDATE posts SET video_path = ? WHERE id = ?`).run(savedVideoFileName, post.id);
    }

    logActivity('ERROR', 'COMMENT', `[Comment Only] Thất bại: ${err.message}`);
    return { success: false, error: err.message, screenshotPath: screenshotFileName, videoPath: savedVideoFileName };
  }
}

