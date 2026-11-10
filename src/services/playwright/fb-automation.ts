import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import db, { logActivity, getSetting, resolveHeadless, isDeveloperMode } from '@/lib/db';
import { PostItem } from '@/types';
import { isSessionAvailable, getUserDataDir, injectSessionCookies, getSessionPath, getChromiumLaunchArgs } from './session';
import { checkDuplicatePublish, markTrendAsPublished } from '../dedup';
import { sendServerPushNotification } from '../notifications';

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
export async function dismissBlockingPagePopups(page: any, targetPageName?: string): Promise<boolean> {
  let dismissed = false;

  if (targetPageName) {
    // 1. Check for "Your profiles & Pages" modal
    try {
      const profileHandled = await handleProfileSwitcherModal(page, targetPageName);
      if (profileHandled) dismissed = true;
    } catch { }
  }

  try {
    const notNowBtn = page.locator('div[role="dialog"] div[aria-label="Not now"]').first();
    if (notNowBtn) {
      logActivity('INFO', 'PUBLISH', 'Phát hiện popup...');
      logActivity('INFO', 'PUBLISH', `[Bypass Popup] Đang click nút "Not now"...`);
      await notNowBtn.click();
      await page.waitForTimeout(1500);
      dismissed = true;
    } else {
      logActivity('INFO', 'PUBLISH', '[Bypass] Không tìm thấy nút "Not now"');
    }
  } catch (err: any) {
    logActivity('WARN', 'PUBLISH', `Lỗi xử lý popup: ${err.message}`);
  }

  return dismissed;
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

export interface PublishOptions {
  headless?: boolean;
  force?: boolean;
  recordVideo?: boolean;
}

export async function executePublishAndComment(
  post: PostItem,
  options?: PublishOptions
): Promise<PublishResult> {
  const force = options?.force ?? false;
  const headless = resolveHeadless(options?.headless ?? true);
  const shouldRecordVideo =
    options?.recordVideo !== undefined
      ? Boolean(options.recordVideo)
      : post.record_video !== undefined && post.record_video !== null
        ? Boolean(post.record_video)
        : true;

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

  // DEDUPLICATION GUARD: Check if post or topic was already published (bypass if force is true)
  if (!force) {
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
    `Starting publish process for post ${post.id}: "${post.trend_title}" (Target: ${targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Trang cá nhân'})`
  );

  // Update status to publishing
  db.prepare(`UPDATE posts SET status = 'publishing' WHERE id = ?`).run(post.id);

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
    const launchOptions: any = {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications']),
    };

    if (shouldRecordVideo) {
      launchOptions.recordVideo = {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      };
    }

    context = await chromium.launchPersistentContext(getUserDataDir(), launchOptions);

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = shouldRecordVideo ? page.video() : null;
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
    }

    // Dismiss any blocking popups before locating post trigger
    await dismissBlockingPagePopups(page, pageName);

    // BƯỚC 0: Vào trang đích (mặc định https://www.facebook.com/pages/?category=your_pages&ref=bookmarks)
    // (Đã điều hướng ở trên tới targetUrl)

    // BƯỚC 1: Click vào span có text: "Create post"
    logActivity('INFO', 'PUBLISH', '[Bước 1] Tìm và click vào thẻ "Create post"...');
    let postTrigger = page.locator('a[aria-label="Create post"]').first();

    if (!postTrigger) {
      // Thử xử lý modal profile switcher và cuộn nhẹ trang xuống
      await handleProfileSwitcherModal(page, pageName);
      await page.evaluate(() => window.scrollBy(0, 300));
      await page.waitForTimeout(1500);
      postTrigger = page.locator('a[aria-label="Create post"]').first();
    }

    if (!postTrigger) {
      throw new Error(
        `Không tìm thấy nút tạo bài viết "Create post" trên ${targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Facebook'
        }. Hãy vào tab Cài đặt -> bấm "Mở trình duyệt" để chuyển đổi sang tư cách Fanpage trước.`
      );
    }

    logActivity('INFO', 'PUBLISH', 'Clicking post creation trigger ("Create post")...');
    await postTrigger.click();
    await page.waitForTimeout(5000);

    // BƯỚC 2: 1 modal mở ra nhập nội dung vào 1 div có contenteditable="true"
    logActivity('INFO', 'PUBLISH', '[Bước 2] Modal tạo bài viết mở ra, tìm div có contenteditable="true" để nhập nội dung...');
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

    // Kiểm tra và dismiss [aria-label="Mentions suggestions"] nếu xuất hiện
    logActivity('INFO', 'PUBLISH', 'Kiểm tra popup [aria-label="Mentions suggestions"]...');
    const mentionsSuggestions = page.locator('[aria-label="Mentions suggestions"]');
    try {
      const isMentionsVisible = await mentionsSuggestions
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      if (isMentionsVisible) {
        logActivity('INFO', 'PUBLISH', 'Phát hiện [aria-label="Mentions suggestions"], đang đóng popup gợi ý...');
        const suggestionCount = await mentionsSuggestions.first().locator('ul li').count();

        if (suggestionCount > 1) {
          // click second item
          await mentionsSuggestions.first().locator('ul li').nth(1);
        }
        else {
          await mentionsSuggestions.first().locator('ul li').first().click();
        }
        await page.waitForTimeout(500);

        await mentionsSuggestions.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
        logActivity('INFO', 'PUBLISH', 'Đã đóng popup Mentions suggestions thành công.');
      }
    } catch {
      // Bỏ qua nếu không có popup
    }
    await page.waitForTimeout(2000);

    await dismissBlockingPagePopups(page, pageName);

    // BƯỚC 3: Ấn Next, sau đó ấn Post
    logActivity('INFO', 'PUBLISH', '[Bước 3] Kiểm tra nút Next và nút Post để xuất bản bài viết...');

    // 3a. Tìm nút Next (nếu có trong wizard tạo bài của Fanpage)
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
        logActivity('INFO', 'PUBLISH', 'Phát hiện bước chuyển tiếp, đang bấm nút "Next" / "Tiếp"...');
        await nBtn.click().catch(() => nBtn.click({ force: true }));
        await page.waitForTimeout(2500);
        break;
      }
    }

    await dismissBlockingPagePopups(page, pageName);

    // 3b. Tìm nút Post
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
          submitBtn = el;
          break;
        }
      }
      if (submitBtn) break;
    }

    if (!submitBtn) {
      throw new Error('Không tìm thấy nút Đăng (Post) hợp lệ trên giao diện Facebook.');
    }

    await dismissBlockingPagePopups(page, pageName);
    await page.waitForTimeout(1000);

    logActivity('INFO', 'PUBLISH', `Kích hoạt nút Đăng (Post) lên ${targetType === 'page' ? 'Fanpage' : 'Facebook'}...`);
    await submitBtn.click().catch(() => submitBtn.click({ force: true }));

    // Giám sát tiến trình đăng bài
    logActivity('INFO', 'PUBLISH', 'Đang giám sát tiến trình xuất bản và tự động xử lý popup...');

    await dismissBlockingPagePopups(page, pageName);

    // Đợi thêm 3.5 giây để máy chủ Facebook cập nhật vào feeds trước khi chuyển trang
    await page.waitForTimeout(3500);

    // BƯỚC 4: Sau khi post thành công, vào https://www.facebook.com/professional_dashboard/content/content_library tìm bài đã post
    logActivity('INFO', 'PUBLISH', '[Bước 4] Điều hướng đến /professional_dashboard/content/content_library để tìm bài viết vừa post...');
    let exactPostUrl = targetUrl;

    try {
      await page.goto('https://www.facebook.com/professional_dashboard/content/content_library/?date_range=TODAY&placement_type=ALL&post_types[0]=TEXT&sort_by=DATE&sorting_method=METRICS_DESCENDING', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(1500);

      await handleAccountChooserOrLogin(page, context);
      await handleProfileSwitcherModal(page, pageName);

      // Tìm URL bài viết trên feed gần đây nhất
      let feedPostLinkCount = await page.locator('[aria-label="Content Library"] [aria-colindex="2"] a[href*="content_id"]').count();

      if (!feedPostLinkCount) {
        await page.reload();
      }

      const firstFeedPostLink = page.locator('[aria-label="Content Library"] [aria-colindex="2"] a[href*="content_id"]').first();
      if (firstFeedPostLink && (await firstFeedPostLink.isVisible({ timeout: 4000 }).catch(() => false))) {
        await firstFeedPostLink.click();
      }
    } catch (feedNavErr: any) {
      logActivity('WARN', 'PUBLISH', `Lỗi khi tải feed /professional_dashboard/content/content_library: ${feedNavErr.message}`);
    }

    let commentSuccess = false;

    try {
      await handleProfileSwitcherModal(page, pageName);
      await page.waitForTimeout(2500);

      // Kiểm tra xem URL trên trình duyệt có cập nhật sang link bài viết trực tiếp không
      const currentUrl = page.url();
      if (
        currentUrl && currentUrl.includes('content_id')
      ) {
        exactPostUrl = currentUrl;
        logActivity('SUCCESS', 'PUBLISH', `URL chính xác của bài viết từ modal: ${exactPostUrl}`);
      }

      // BƯỚC 5: Nhập bình luận vào thẻ có contenteditable="true" trong modal
      logActivity('INFO', 'COMMENT', '[Bước 5] Nhập bình luận vào thẻ contenteditable="true" trong modal...');
      await handleProfileSwitcherModal(page, pageName);


      let commentBox = page.locator('div[contenteditable="true"]').first();

      if (commentBox) {
        await commentBox.click();
        await page.waitForTimeout(600);
        await page.keyboard.insertText(post.comment_content);
        await page.waitForTimeout(1500);

        // BƯỚC 6: Click vào element aria-label="Post comment"
        logActivity('INFO', 'COMMENT', '[Bước 6] Tìm và click element aria-label="Post comment"...');
        const postCommentBtnSelectors = [
          '[aria-label="Post comment"]',
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

    const isDevMode = isDeveloperMode();
    let savedVideoFileName: string | undefined = undefined;

    // Lưu video khi bài viết bật toggle record_video hoặc developer mode
    if (video) {
      try {
        if (shouldRecordVideo) {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await video.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          logActivity('INFO', 'PUBLISH', `[Video] Đã lưu video quá trình đăng thành công: ${videoFileName}`);
        } else {
          await video.delete().catch(() => { });
        }
      } catch (vErr: any) {
        logActivity('WARN', 'PUBLISH', `Lỗi xử lý video đăng bài: ${vErr.message}`);
      }
    }

    if (context) {
      await context.close().catch(() => { });
    }

    // Nếu bài viết trước đó từng lỗi và có video_path cũ (và khác video mới tạo), xóa file video cũ đi
    if (post.video_path && post.video_path !== savedVideoFileName) {
      try {
        const oldVidPath = path.join(VIDEOS_DIR, path.basename(post.video_path));
        if (fs.existsSync(oldVidPath)) fs.unlinkSync(oldVidPath);
      } catch { }
    }

    // Update database with exact post URL and video_path (lưu video_path nếu developer mode bật)
    db.prepare(`
      UPDATE posts 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, screenshot_path = ?, video_path = ?, fb_post_url = ?, error_message = NULL
      WHERE id = ?
    `).run(screenshotFileName, savedVideoFileName || null, exactPostUrl, post.id);

    markTrendAsPublished({ trend_id: post.trend_id, trend_title: post.trend_title });

    logActivity('SUCCESS', 'PUBLISH', `Post ${post.id} successfully published to ${targetType === 'page' ? 'Fanpage' : 'Facebook'}!`);

    // Gửi push notification khi post thành công
    await sendServerPushNotification({
      type: 'post',
      status: 'success',
      title: post.trend_title,
      url: exactPostUrl,
      details: targetType === 'page' ? `Đã đăng lên Fanpage (${pageName || targetUrl})` : 'Đã đăng lên Trang cá nhân',
    }).catch(() => { });

    return {
      success: true,
      postId: post.id,
      fbPostUrl: exactPostUrl,
      commentSuccess,
      screenshotPath: screenshotFileName,
      videoPath: savedVideoFileName,
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

    // Gửi push notification khi post thất bại
    await sendServerPushNotification({
      type: 'post',
      status: 'failed',
      title: post.trend_title,
      error: errorMsg,
    }).catch(() => { });

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

  const directPostUrl = (options?.postUrl || post.fb_post_url || '').trim();
  if (!directPostUrl) {
    throw new Error('Chưa có liên kết bài viết Facebook (directPostUrl / fb_post_url). executeCommentOnly chỉ chạy khi có directPostUrl.');
  }

  const headless = resolveHeadless(options?.headless ?? true);
  const shouldRecordVideo =
    post.record_video !== undefined && post.record_video !== null
      ? Boolean(post.record_video)
      : true;
  const { pageName } = resolveTargetUrl();
  const targetUrl = directPostUrl;

  const screenshotFileName = `comment_${post.id}_${Date.now()}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);
  const videoFileName = `comment_${post.id}_${Date.now()}.webm`;

  let context: any;
  let page: any;
  let video: any;
  try {
    const launchOptions: any = {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: getChromiumLaunchArgs(['--disable-notifications']),
    };

    if (shouldRecordVideo) {
      launchOptions.recordVideo = {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      };
    }

    context = await chromium.launchPersistentContext(getUserDataDir(), launchOptions);

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = shouldRecordVideo ? page.video() : null;
    page.on('crash', () => {
      logActivity('ERROR', 'COMMENT', 'Playwright page crashed (Bộ nhớ RAM trên VPS bị cạn kiệt hoặc tiến trình bị ngắt).');
    });

    // Only abort actual video streaming files (avoids proxying hundreds of normal requests through DevTools Protocol)
    await page.route(/\.(mp4|webm|avi|mov)($|\?)/i, (route: any) => route.abort().catch(() => { }));

    let resolvedPostUrl = targetUrl;
    logActivity('INFO', 'COMMENT', `[Comment Only] Điều hướng trực tiếp đến bài viết: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);
    await handleProfileSwitcherModal(page, pageName);

    let commentBox = page.locator('div[contenteditable="true"]').first();

    if (commentBox) {
      await commentBox.click();
      await page.waitForTimeout(600);
      await page.keyboard.insertText(post.comment_content);
      await page.waitForTimeout(1500);

      logActivity('INFO', 'COMMENT', '[Comment Only] Tìm và click element aria-label="Post comment"...');
      const postCommentBtnSelectors = [
        '[aria-label="Post comment"]',
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
        logActivity('INFO', 'COMMENT', '[Comment Only] Phát hiện nút aria-label="Post comment", đang bấm gửi bình luận...');
        await postCommentBtn.click();
        await page.waitForTimeout(3000);
      } else {
        logActivity('INFO', 'COMMENT', '[Comment Only] Không thấy nút aria-label="Post comment", gửi bằng phím Enter...');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
      }

      logActivity('SUCCESS', 'COMMENT', `[Comment Only] Đã tự động gửi bình luận nguồn tin thành công cho bài viết ${post.id}`);
    } else {
      logActivity('WARN', 'COMMENT', '[Comment Only] Không tìm thấy thẻ contenteditable="true" trong modal bình luận.');
      throw new Error('Không tìm thấy thẻ contenteditable="true" trong modal bình luận.');
    }

    await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });

    let savedVideoFileName: string | undefined = undefined;
    if (page && !page.isClosed()) {
      await page.close().catch(() => { });
    }

    const isDevMode = isDeveloperMode();
    if (video) {
      try {
        if (shouldRecordVideo) {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await video.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          logActivity('INFO', 'COMMENT', `[Video] Đã lưu video quá trình bình luận thành công: ${videoFileName}`);
        } else {
          await video.delete().catch(() => { });
        }
      } catch (vErr: any) {
        logActivity('WARN', 'COMMENT', `Lỗi xử lý video bình luận: ${vErr.message}`);
      }
    }

    if (context) {
      await context.close().catch(() => { });
    }

    // Mark post comment status in db and update fb_post_url with exact link
    db.prepare(`UPDATE posts SET comment_id = 'commented', screenshot_path = ?, video_path = COALESCE(?, video_path), fb_post_url = ?, error_message = NULL WHERE id = ?`).run(
      screenshotFileName,
      savedVideoFileName || null,
      resolvedPostUrl,
      post.id
    );
    logActivity('SUCCESS', 'COMMENT', `[Comment Only] Đã gửi bình luận nguồn thành công cho bài viết ${post.id}`);

    return { success: true, screenshotPath: screenshotFileName, videoPath: savedVideoFileName };
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

export { uploadFacebookReel, type PostReelOptions, type PostReelResult } from './fb-reel';


