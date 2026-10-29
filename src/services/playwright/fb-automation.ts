import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import db, { logActivity, getSetting } from '@/lib/db';
import { PostItem } from '@/types';
import { isSessionAvailable, getUserDataDir, injectSessionCookies, getSessionPath, getChromiumLaunchArgs } from './session';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'storage', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

export interface PublishResult {
  success: boolean;
  postId: string;
  fbPostUrl?: string;
  commentSuccess?: boolean;
  screenshotPath?: string;
  error?: string;
}

/**
 * Automatically dismiss any blocking popups such as WhatsApp button upsell ("Make it easier to contact you"),
 * messaging button prompts, or audience review dialogs that prevent posting.
 */
async function dismissBlockingPagePopups(page: any): Promise<boolean> {
  let dismissed = false;

  // 1. If "Leave Page?" / "Rời khỏi trang?" dialog appears, ALWAYS click "Keep editing" to stay in the composer
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
  } catch {}

  // 2. Only dismiss specific WhatsApp / contact suggestion popups (DO NOT click generic Close buttons)
  try {
    const whatsAppPrompt = page.locator('div:has-text("Make it easier to contact you"), div:has-text("WhatsApp")');
    if ((await whatsAppPrompt.count()) > 0 && (await whatsAppPrompt.first().isVisible({ timeout: 500 }).catch(() => false))) {
      const notNowBtn = page
        .locator(
          'div:has-text("Make it easier to contact you") div[role="button"]:has-text("Not now"), ' +
          'div:has-text("Make it easier to contact you") div[role="button"]:has-text("Lúc khác"), ' +
          'div:has-text("WhatsApp") div[role="button"]:has-text("Not now"), ' +
          'div:has-text("WhatsApp") div[role="button"]:has-text("Lúc khác"), ' +
          'div:has-text("WhatsApp") div[role="button"]:has-text("Không phải bây giờ")'
        )
        .first();

      if ((await notNowBtn.count()) > 0 && (await notNowBtn.isVisible({ timeout: 500 }).catch(() => false))) {
        logActivity('INFO', 'PUBLISH', '[Dismiss Popup] Bấm "Not now" trên popup đề xuất WhatsApp...');
        await notNowBtn.click({ force: true }).catch(() => {});
        await page.waitForTimeout(1000);
        dismissed = true;
      }
    }
  } catch {}

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
      await cookieConsent.click().catch(() => {});
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
      } catch {}

      // If a target URL was specified (like a Fanpage) and we are currently on facebook.com home, navigate to targetUrl
      if (targetUrl && page.url() && !page.url().includes(targetUrl.replace(/^https?:\/\/(www\.)?facebook\.com\/?/, ''))) {
        logActivity('INFO', 'AUTH', `Đang điều hướng tiếp tục đến trang đích: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
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

export async function executePublishAndComment(
  post: PostItem,
  options?: { dryRun?: boolean; headless?: boolean }
): Promise<PublishResult> {
  const dryRun = options?.dryRun ?? false;
  const headless = options?.headless ?? true;

  const targetType = getSetting('fb_target_type', 'page');
  const pageUrl = (getSetting('fb_page_url', '') || getSetting('fb_target_url', '')).trim();
  let targetUrl = getSetting('fb_target_url', 'https://www.facebook.com/').trim();

  if (targetType === 'page') {
    if (!pageUrl) {
      const errorMsg =
        'Bạn đã chọn chế độ "Đăng lên Fanpage" nhưng chưa cấu hình "Đường dẫn Fanpage" trong tab Cài đặt.';
      db.prepare(`UPDATE posts SET status = 'failed', error_message = ? WHERE id = ?`).run(errorMsg, post.id);
      logActivity('ERROR', 'PUBLISH', errorMsg);
      return { success: false, postId: post.id, error: errorMsg };
    }
    targetUrl = pageUrl;
  }

  logActivity(
    'INFO',
    'PUBLISH',
    `Starting publish process for post ${post.id}: "${post.trend_title}" (Target: ${
      targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Trang cá nhân'
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

  let context;
  const screenshotFileName = `post_${post.id}_${Date.now()}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  try {
    context = await chromium.launchPersistentContext(getUserDataDir(), {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      args: getChromiumLaunchArgs(['--disable-notifications']),
    });

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    logActivity('INFO', 'PUBLISH', `Đang điều hướng đến trang đích Facebook: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 50000 });
    await page.waitForTimeout(3000);

    // Bypass Account Chooser / Continue splash screen if present
    await handleAccountChooserOrLogin(page, context, targetUrl);

    // Step 0: Check if we are in Page mode and Facebook shows a "Switch to Page" prompt
    if (targetType === 'page') {
      logActivity('INFO', 'PUBLISH', `[Page Mode] Kiểm tra nút chuyển quyền sang Fanpage trên: ${targetUrl}`);
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
          await page.waitForTimeout(4000);
          break;
        }
      }
    }

    // Step 1: Check for "What's on your mind?" / "Tạo bài viết" button
    const postTriggerSelectors = [
      'div[role="button"]:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'div[role="button"]:has-text("Tạo bài viết")',
      'div[role="button"]:has-text("Create post")',
      'div[role="button"]:has-text("Create a post")',
      'div[role="button"]:has-text("Viết gì đó")',
      'div[role="button"]:has-text("Write something")',
      'div[role="button"]:has-text("Tạo bài viết trên trang")',
      'div[role="button"]:has-text("Tạo bài đăng")',
      'div[aria-label*="Tạo bài viết"]',
      'div[aria-label*="Create a post"]',
      'div[aria-label*="Create post"]',
      'span:has-text("Bạn đang nghĩ gì")',
      'span:has-text("What\'s on your mind")',
      'span:has-text("Tạo bài viết")',
      'span:has-text("Viết gì đó")',
      'span:has-text("Tạo bài viết trên trang")',
    ];

    let postTrigger = null;
    for (const selector of postTriggerSelectors) {
      const el = page.locator(selector).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1000 }).catch(() => false))) {
        postTrigger = el;
        break;
      }
    }

    if (!postTrigger) {
      // Try scrolling slightly down to reveal the post composer on Fanpage timeline
      await page.evaluate(() => window.scrollBy(0, 350));
      await page.waitForTimeout(1500);

      for (const selector of postTriggerSelectors) {
        const el = page.locator(selector).first();
        if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1000 }).catch(() => false))) {
          postTrigger = el;
          break;
        }
      }
    }

    if (!postTrigger) {
      throw new Error(
        `Không tìm thấy nút tạo bài viết trên ${
          targetType === 'page' ? 'Fanpage (' + targetUrl + ')' : 'Facebook'
        }. Hãy vào tab Cài đặt -> bấm "Mở trình duyệt" để chuyển đổi sang tư cách Fanpage trước.`
      );
    }

    logActivity('INFO', 'PUBLISH', 'Clicking post creation trigger...');
    await postTrigger.click();
    await page.waitForTimeout(2000);

    // Step 2: Locate the post dialog textbox
    const textboxSelectors = [
      'div[role="dialog"] div[role="textbox"]',
      'div[aria-label*="Bạn đang nghĩ gì"][role="textbox"]',
      'div[aria-label*="What\'s on your mind"][role="textbox"]',
      'div[aria-label*="Tạo bài viết"][role="textbox"]',
      'div[aria-label*="Tạo bài đăng"][role="textbox"]',
      'div[aria-label*="Viết gì đó"][role="textbox"]',
      'div[role="dialog"] div[contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"]',
    ];

    let textbox = null;
    for (const sel of textboxSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible({ timeout: 1000 }).catch(() => false))) {
        textbox = el;
        break;
      }
    }

    if (!textbox) {
      throw new Error('Không tìm thấy ô nhập nội dung bài viết trong modal.');
    }

    logActivity('INFO', 'PUBLISH', 'Filling post content using keyboard events...');
    await textbox.click();
    await page.waitForTimeout(500);

    // Fill content using insertText to properly trigger Facebook Lexical framework
    await page.keyboard.insertText(post.post_content);
    await page.waitForTimeout(2000);

    // Step 2.5: Auto-dismiss blocking popups like "Make it easier to contact you" (WhatsApp prompt)
    for (let attempt = 0; attempt < 3; attempt++) {
      const hadPopup = await dismissBlockingPagePopups(page);
      if (!hadPopup) break;
      await page.waitForTimeout(1000);
    }

    // Step 3: Handle "Tiếp" / "Next" button in Fanpage 2-step post creation wizard
    const nextBtnSelectors = [
      'div[role="dialog"] div[role="button"]:has-text("Tiếp")',
      'div[role="dialog"] div[role="button"]:has-text("Next")',
      'div[role="button"]:has-text("Tiếp")',
      'div[role="button"]:has-text("Next")',
    ];

    for (const nsel of nextBtnSelectors) {
      const nBtn = page.locator(nsel).first();
      if ((await nBtn.count()) > 0 && (await nBtn.isVisible({ timeout: 1000 }).catch(() => false))) {
        // Wait until Next button is enabled
        for (let w = 0; w < 5; w++) {
          const isDisabled = (await nBtn.getAttribute('aria-disabled')) === 'true';
          if (!isDisabled) break;
          await page.waitForTimeout(1000);
        }
        logActivity('INFO', 'PUBLISH', 'Phát hiện bước chuyển tiếp, đang bấm nút "Tiếp" (Next)...');
        await nBtn.click().catch(() => nBtn.click({ force: true }));
        await page.waitForTimeout(3000);
        break;
      }
    }

    // Check again for popup after wizard transitions
    await dismissBlockingPagePopups(page);

    // Step 4: Click Submit / Đăng (Post) button
    const submitBtnSelectors = [
      'div[role="dialog"] div[role="button"]:has-text("Đăng")',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
      'div[role="dialog"] button:has-text("Đăng")',
      'div[role="dialog"] button:has-text("Post")',
      'div[role="button"]:has-text("Đăng")',
      'div[role="button"]:has-text("Post")',
      'button:has-text("Đăng")',
      'button:has-text("Post")',
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

          if (
            txt === 'Post' ||
            txt === 'Đăng' ||
            txt === 'Share' ||
            txt === 'Chia sẻ' ||
            ariaLabel === 'Post' ||
            ariaLabel === 'Đăng'
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

    // Wait until submit button is enabled
    for (let w = 0; w < 5; w++) {
      const isDisabled =
        (await submitBtn.getAttribute('aria-disabled')) === 'true' ||
        (await submitBtn.getAttribute('disabled')) !== null;
      if (!isDisabled) break;
      logActivity('INFO', 'PUBLISH', 'Nút Đăng đang chờ xử lý (disabled), kiểm tra popup cản trở...');
      await dismissBlockingPagePopups(page);
      await page.waitForTimeout(1000);
    }

    logActivity('INFO', 'PUBLISH', `Kích hoạt nút Đăng (Post) lên ${targetType === 'page' ? 'Fanpage' : 'Facebook'}...`);
    await submitBtn.click().catch(() => submitBtn.click({ force: true }));

    // CRITICAL VERIFICATION: Ensure the composer textbox actually hides/detaches
    try {
      await textbox.waitFor({ state: 'hidden', timeout: 20000 });
      logActivity('SUCCESS', 'PUBLISH', 'Trình tạo bài viết đã đóng thành công (bài viết đã được xuất bản).');
    } catch {
      // If still open, retry clicking Post once or dismiss blocking prompt
      if (await textbox.isVisible().catch(() => false)) {
        logActivity('WARN', 'PUBLISH', 'Hộp thoại chưa đóng, thử xử lý popup và bấm Đăng lại...');
        await dismissBlockingPagePopups(page);
        if (await submitBtn.isVisible().catch(() => false)) {
          await submitBtn.click().catch(() => submitBtn.click({ force: true }));
          await textbox.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
        }
      }
    }

    // Strict guard: if textbox is still visible, ABORT before comment step
    if (await textbox.isVisible().catch(() => false)) {
      throw new Error(
        'Không thể xuất bản bài viết: Hộp thoại tạo bài viết vẫn chưa đóng sau khi bấm Đăng (Post). Dừng lại để tránh bước comment bị ghi đè lên bài viết.'
      );
    }

    await page.waitForTimeout(3000);

    // Step 4.5: Navigate to Most Recent Feeds (sk=h_chr) to get the exact Post URL
    logActivity('INFO', 'PUBLISH', 'Đang truy cập trang Feeds gần đây nhất (sk=h_chr) để lấy đường dẫn chính xác của bài viết vừa đăng...');
    let exactPostUrl = targetUrl;

    try {
      await page.goto('https://www.facebook.com/?filter=all&sk=h_chr', { waitUntil: 'networkidle', timeout: 40000 });
      await page.waitForTimeout(3000);

      // Find the timestamp link (contains __tn__=%2CO%2CP-R) of the top post
      const timeLink = page.locator('a[href*="__tn__=%2CO%2CP-R"]').first();
      if ((await timeLink.count()) > 0 && (await timeLink.isVisible({ timeout: 5000 }).catch(() => false))) {
        logActivity('INFO', 'PUBLISH', 'Phát hiện bài đăng mới nhất trên feed, mở để lấy URL trực tiếp...');
        await Promise.all([
          page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
          timeLink.click(),
        ]);
        await page.waitForTimeout(2000);

        const currentUrl = page.url();
        if (
          currentUrl &&
          (currentUrl.includes('/posts/') ||
            currentUrl.includes('story_fbid') ||
            currentUrl.includes('/photo') ||
            currentUrl.includes('/permalink'))
        ) {
          exactPostUrl = currentUrl.split('?')[0];
          logActivity('SUCCESS', 'PUBLISH', `Đã lấy thành công URL chính xác của bài viết: ${exactPostUrl}`);
        }
      } else {
        logActivity('INFO', 'PUBLISH', 'Chưa tìm thấy trên sk=h_chr, chuyển về timeline Fanpage...');
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 35000 });
        await page.waitForTimeout(2000);
      }
    } catch (feedNavErr: any) {
      logActivity('WARN', 'PUBLISH', `Lỗi khi lấy URL bài viết qua feed: ${feedNavErr.message}`);
    }

    // Step 5: Auto-comment source links on the published post
    logActivity('INFO', 'COMMENT', 'Tìm kiếm ô bình luận trên bài viết vừa đăng để gửi link nguồn...');
    let commentSuccess = false;

    try {
      // Scroll slightly down to make comment section visible if needed
      await page.evaluate(() => window.scrollBy(0, 450));
      await page.waitForTimeout(2000);

      // Selectors for comment input on Facebook post
      const commentInputSelectors = [
        'div[aria-label*="Comment as"][role="textbox"]',
        'div[aria-label*="Bình luận dưới tên"][role="textbox"]',
        'div[aria-label*="Viết bình luận"][role="textbox"]',
        'div[aria-label*="Write a comment"][role="textbox"]',
        'div[aria-placeholder*="Comment as"][role="textbox"]',
        'div[aria-placeholder*="Bình luận dưới tên"][role="textbox"]',
        'div[aria-placeholder*="Viết bình luận"][role="textbox"]',
        'div[aria-placeholder*="Write a comment"][role="textbox"]',
        'div[data-lexical-editor="true"][role="textbox"]',
        'form div[role="textbox"]',
      ];

      let commentBox = null;
      for (const sel of commentInputSelectors) {
        const els = page.locator(sel);
        const count = await els.count();
        for (let i = 0; i < count; i++) {
          const el = els.nth(i);
          if (await el.isVisible().catch(() => false)) {
            // Only exclude if it is inside the post creation modal (Create post / Tạo bài viết)
            const isInsideComposer = await el
              .evaluate((node) => {
                const dialog = node.closest('div[role="dialog"]');
                if (!dialog) return false;
                const txt = (dialog as HTMLElement).innerText || dialog.textContent || '';
                return txt.includes('Create post') || txt.includes('Tạo bài viết') || txt.includes('Post settings');
              })
              .catch(() => false);

            if (!isInsideComposer) {
              commentBox = el;
              break;
            }
          }
        }
        if (commentBox) break;
      }

      // If comment box is collapsed, try clicking the "Comment" / "Bình luận" action button on the post
      if (!commentBox) {
        const commentTrigger = page
          .locator(
            'div[role="article"] div[role="button"]:has-text("Comment"), ' +
            'div[role="article"] div[role="button"]:has-text("Bình luận"), ' +
            'div[role="button"]:has-text("Comment"), ' +
            'div[role="button"]:has-text("Bình luận")'
          )
          .first();
        if ((await commentTrigger.count()) > 0 && (await commentTrigger.isVisible().catch(() => false))) {
          await commentTrigger.click();
          await page.waitForTimeout(1500);

          for (const sel of commentInputSelectors) {
            const el = page.locator(sel).first();
            if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
              commentBox = el;
              break;
            }
          }
        }
      }

      if (commentBox) {
        await commentBox.click();
        await page.waitForTimeout(600);
        await page.keyboard.insertText(post.comment_content);
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(3000);
        commentSuccess = true;
        logActivity('SUCCESS', 'COMMENT', `Đã tự động gửi bình luận nguồn tin thành công cho bài viết ${post.id}`);
      } else {
        logActivity('WARN', 'COMMENT', 'Không tìm thấy ô bình luận trên timeline, nhưng bài viết đã được đăng thành công.');
      }
    } catch (commentErr: any) {
      logActivity('WARN', 'COMMENT', `Bước auto-comment gặp sự cố: ${commentErr.message}`);
    }

    // Step 6: Save audit screenshot
    await page.screenshot({ path: screenshotFullPath, fullPage: false });

    // Update database with exact post URL
    db.prepare(`
      UPDATE posts 
      SET status = 'published', published_at = CURRENT_TIMESTAMP, screenshot_path = ?, fb_post_url = ?, error_message = NULL
      WHERE id = ?
    `).run(screenshotFileName, exactPostUrl, post.id);

    logActivity('SUCCESS', 'PUBLISH', `Post ${post.id} successfully published to ${targetType === 'page' ? 'Fanpage' : 'Facebook'}!`);

    await context.close();

    return {
      success: true,
      postId: post.id,
      fbPostUrl: exactPostUrl,
      commentSuccess,
      screenshotPath: screenshotFileName,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Lỗi không xác định khi đăng bài';
    logActivity('ERROR', 'PUBLISH', `Failed to publish post ${post.id}: ${errorMsg}`);

    // Try to capture error screenshot if page is still alive
    if (context) {
      try {
        const p = context.pages()[0];
        if (p) await p.screenshot({ path: screenshotFullPath });
      } catch (_) {}
      await context.close();
    }

    db.prepare(`
      UPDATE posts 
      SET status = 'failed', error_message = ?, screenshot_path = ?
      WHERE id = ?
    `).run(errorMsg, screenshotFileName, post.id);

    return {
      success: false,
      postId: post.id,
      error: errorMsg,
      screenshotPath: screenshotFileName,
    };
  }
}

/**
 * Execute comment-only automation on an already published Facebook post.
 */
export async function executeCommentOnly(
  post: PostItem,
  options?: { postUrl?: string; headless?: boolean }
): Promise<{ success: boolean; error?: string; screenshotPath?: string }> {
  if (!isSessionAvailable()) {
    throw new Error('Chưa thiết lập session Facebook. Vui lòng kết nối tài khoản Facebook trước.');
  }

  const headless = options?.headless ?? true;
  const pageUrl = (getSetting('fb_page_url', '') || getSetting('fb_target_url', '')).trim();
  const directPostUrl = (options?.postUrl || post.fb_post_url || '').trim();

  // If specific post URL is provided and looks like a post, go directly to it. Otherwise go to Fanpage URL.
  const isDirectPost =
    directPostUrl &&
    (directPostUrl.includes('/posts/') ||
      directPostUrl.includes('story_fbid') ||
      directPostUrl.includes('/permalink') ||
      directPostUrl.includes('/photo'));
  const targetUrl = isDirectPost ? directPostUrl : pageUrl || 'https://www.facebook.com/';

  const screenshotFileName = `comment_${post.id}_${Date.now()}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  let context;
  try {
    context = await chromium.launchPersistentContext(getUserDataDir(), {
      headless: headless,
      viewport: { width: 1280, height: 900 },
      args: getChromiumLaunchArgs(['--disable-notifications']),
    });

    // Inject cookies from fb-session.json into context
    await injectSessionCookies(context);

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    let resolvedPostUrl = targetUrl;
    if (!isDirectPost) {
      logActivity('INFO', 'COMMENT', '[Comment Only] Đang tìm bài viết mới nhất trên Feeds (sk=h_chr)...');
      try {
        await page.goto('https://www.facebook.com/?filter=all&sk=h_chr', { waitUntil: 'networkidle', timeout: 40000 });
        await page.waitForTimeout(3000);

        // Bypass Account Chooser / Continue splash screen if present
        await handleAccountChooserOrLogin(page, context);

        const timeLink = page.locator('a[href*="__tn__=%2CO%2CP-R"]').first();
        if ((await timeLink.count()) > 0 && (await timeLink.isVisible({ timeout: 5000 }).catch(() => false))) {
          await Promise.all([
            page.waitForNavigation({ timeout: 15000 }).catch(() => {}),
            timeLink.click(),
          ]);
          await page.waitForTimeout(2000);
          const curr = page.url();
          if (
            curr &&
            (curr.includes('/posts/') ||
              curr.includes('story_fbid') ||
              curr.includes('/photo') ||
              curr.includes('/permalink'))
          ) {
            resolvedPostUrl = curr.split('?')[0];
            logActivity('INFO', 'COMMENT', `[Comment Only] Đã mở link bài viết trực tiếp: ${resolvedPostUrl}`);
          }
        } else {
          logActivity('INFO', 'COMMENT', `[Comment Only] Điều hướng về Fanpage: ${targetUrl}`);
          await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 40000 });
          await page.waitForTimeout(2500);
          await page.evaluate(() => window.scrollBy(0, 500));
        }
      } catch (err: any) {
        logActivity('WARN', 'COMMENT', `[Comment Only] Lỗi tìm bài qua feeds: ${err.message}, mở timeline...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 35000 });
      }
    } else {
      logActivity('INFO', 'COMMENT', `[Comment Only] Điều hướng trực tiếp đến bài viết: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 50000 });
      await page.waitForTimeout(3000);
    }

    const commentInputSelectors = [
      'div[aria-label*="Comment as"][role="textbox"]',
      'div[aria-label*="Bình luận dưới tên"][role="textbox"]',
      'div[aria-label*="Viết bình luận"][role="textbox"]',
      'div[aria-label*="Write a comment"][role="textbox"]',
      'div[aria-placeholder*="Comment as"][role="textbox"]',
      'div[aria-placeholder*="Bình luận dưới tên"][role="textbox"]',
      'div[aria-placeholder*="Viết bình luận"][role="textbox"]',
      'div[aria-placeholder*="Write a comment"][role="textbox"]',
      'div[data-lexical-editor="true"][role="textbox"]',
      'form div[role="textbox"]',
    ];

    let commentBox = null;
    for (const sel of commentInputSelectors) {
      const els = page.locator(sel);
      const count = await els.count();
      for (let i = 0; i < count; i++) {
        const el = els.nth(i);
        if (await el.isVisible().catch(() => false)) {
          // Only exclude if inside a composer modal (Create post / Tạo bài viết)
          const isInsideComposer = await el
            .evaluate((node) => {
              const dialog = node.closest('div[role="dialog"]');
              if (!dialog) return false;
              const txt = (dialog as HTMLElement).innerText || dialog.textContent || '';
              return txt.includes('Create post') || txt.includes('Tạo bài viết') || txt.includes('Post settings');
            })
            .catch(() => false);

          if (!isInsideComposer) {
            commentBox = el;
            break;
          }
        }
      }
      if (commentBox) break;
    }

    // If comment box is collapsed, click "Comment" / "Bình luận" button on the first post
    if (!commentBox) {
      const commentTrigger = page
        .locator(
          'div[role="article"] div[role="button"]:has-text("Comment"), ' +
          'div[role="article"] div[role="button"]:has-text("Bình luận"), ' +
          'div[role="button"]:has-text("Comment"), ' +
          'div[role="button"]:has-text("Bình luận")'
        )
        .first();

      if ((await commentTrigger.count()) > 0 && (await commentTrigger.isVisible().catch(() => false))) {
        logActivity('INFO', 'COMMENT', '[Comment Only] Nhấn nút "Bình luận" để mở ô nhập...');
        await commentTrigger.click();
        await page.waitForTimeout(1500);

        for (const sel of commentInputSelectors) {
          const el = page.locator(sel).first();
          if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
            commentBox = el;
            break;
          }
        }
      }
    }

    if (!commentBox) {
      throw new Error(
        'Không tìm thấy ô nhập bình luận trên bài viết. Hãy kiểm tra xem bạn đã chuyển sang tư cách Fanpage hoặc bài viết có cho phép bình luận không.'
      );
    }

    logActivity('INFO', 'COMMENT', `[Comment Only] Đang điền nội dung link nguồn vào ô bình luận...`);
    await commentBox.click();
    await page.waitForTimeout(600);
    await page.keyboard.insertText(post.comment_content);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3500);

    await page.screenshot({ path: screenshotFullPath, fullPage: false });

    // Mark post comment status in db and update fb_post_url with exact link
    db.prepare(`UPDATE posts SET comment_id = 'commented', screenshot_path = ?, fb_post_url = ?, error_message = NULL WHERE id = ?`).run(
      screenshotFileName,
      resolvedPostUrl,
      post.id
    );
    logActivity('SUCCESS', 'COMMENT', `[Comment Only] Đã gửi bình luận nguồn thành công cho bài viết ${post.id}`);

    await context.close();
    return { success: true, screenshotPath: screenshotFileName };
  } catch (err: any) {
    if (context) {
      try {
        const p = context.pages()[0];
        if (p) await p.screenshot({ path: screenshotFullPath });
      } catch (_) {}
      await context.close();
    }
    logActivity('ERROR', 'COMMENT', `[Comment Only] Thất bại: ${err.message}`);
    return { success: false, error: err.message, screenshotPath: screenshotFileName };
  }
}

