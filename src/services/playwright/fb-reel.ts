import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import {
  getUserDataDir,
  getSessionPath,
  isSessionAvailable,
  getChromiumLaunchArgs,
  injectSessionCookies,
} from './session';
import { dismissWhatsAppPopup } from './fb-automation';
import { logActivity } from '@/lib/db';

export interface PostReelOptions {
  filePath: string;
  content?: string;
  headless?: boolean;
  timeout?: number;
  onProgress?: (message: string) => void;
  keepOpen?: boolean;
}

export interface PostReelResult {
  success: boolean;
  message: string;
  filePath: string;
  error?: string;
}

const FB_CONTENT_LIBRARY_URL =
  'https://www.facebook.com/professional_dashboard/content/content_library/';

/**
 * Automate Facebook Reel posting:
 * 1. Open https://www.facebook.com/professional_dashboard/content/content_library/
 * 2. Click [aria-label="Create"]
 * 3. Click [role="menuitem"] with text "Reel"
 * 4. Use page.waitForEvent('filechooser') to put the file into the file chooser.
 */
export async function uploadFacebookReel(
  options: PostReelOptions
): Promise<PostReelResult> {
  const { filePath, content = '', headless = false, onProgress, keepOpen = false } = options;

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    console.log(`[Reel Automation] ${msg}`);
    try {
      logActivity(level, 'POST_REEL', msg);
    } catch {
      // Ignore DB errors if running in standalone script
    }
    if (onProgress) onProgress(msg);
  };

  // 1. Validate file
  if (!filePath || typeof filePath !== 'string') {
    const errorMsg = 'Đường dẫn file video không hợp lệ.';
    notify(errorMsg, 'ERROR');
    return { success: false, message: errorMsg, filePath: '' };
  }

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    const errorMsg = `File không tồn tại trên hệ thống: ${resolvedPath}`;
    notify(errorMsg, 'ERROR');
    return { success: false, message: errorMsg, filePath: resolvedPath, error: errorMsg };
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isFile()) {
    const errorMsg = `Đường dẫn không phải là file: ${resolvedPath}`;
    notify(errorMsg, 'ERROR');
    return { success: false, message: errorMsg, filePath: resolvedPath, error: errorMsg };
  }

  notify(`Bắt đầu đăng Reel với file: ${resolvedPath} (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`);

  if (!isSessionAvailable()) {
    notify(
      'Cảnh báo: Chưa tìm thấy session Facebook (storage/fb-session.json). Nếu chưa đăng nhập, vui lòng chạy "pnpm fb:login" trước.',
      'WARN'
    );
  }

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let isStandaloneBrowser = false;
  let browser: any = null;

  try {
    notify('Khởi chạy trình duyệt Playwright Chromium...');
    const launchArgs = getChromiumLaunchArgs(['--disable-notifications']);

    try {
      // Try launching with persistent context profile
      context = await chromium.launchPersistentContext(getUserDataDir(), {
        headless,
        viewport: { width: 1366, height: 850 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        args: launchArgs,
      });
    } catch (err: any) {
      notify(`Không thể dùng persistent context (${err.message}). Chuyển sang launch thông thường...`, 'WARN');
      browser = await chromium.launch({
        headless,
        args: launchArgs,
      });
      isStandaloneBrowser = true;
      const sessionPath = getSessionPath();
      const storageState = fs.existsSync(sessionPath) ? sessionPath : undefined;
      context = await browser.newContext({
        viewport: { width: 1366, height: 850 },
        storageState,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      });
    }

    if (!context) {
      throw new Error('Không thể khởi tạo browser context.');
    }

    // Inject cookies from fb-session.json if available
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

    // Step 2: Open Professional Dashboard Content Library URL
    notify(`Đang mở: ${FB_CONTENT_LIBRARY_URL}`);
    await page.goto(FB_CONTENT_LIBRARY_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    // Check if redirected to login
    if (page.url().includes('login') || page.url().includes('checkpoint')) {
      notify('Facebook yêu cầu đăng nhập. Vui lòng đăng nhập tài khoản trên cửa sổ trình duyệt...', 'WARN');
      // Give user time if not headless
      if (!headless) {
        await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 120000 }).catch(() => {});
        await page.waitForTimeout(3000);
      }
    }

    // Step 3: Click [aria-label="Create"]
    notify('Đang tìm nút [aria-label="Create"]...');
    const createSelector = '[aria-label="Create"]';
    let createBtn = page.locator(createSelector).first();

    const isCreateVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isCreateVisible) {
      // Fallback selector if Facebook language is Vietnamese or aria-label differs
      const fallbackBtn = page
        .locator('#prodash-create-button, [aria-label="Create" i], [aria-label="Tạo" i], div[role="button"]:has-text("Create"), div[role="button"]:has-text("Tạo")')
        .first();
      if ((await fallbackBtn.count()) > 0) {
        notify('Tìm thấy nút Tạo qua selector bổ trợ.');
        createBtn = fallbackBtn;
      }
    }

    await createBtn.waitFor({ state: 'visible', timeout: 30000 });
    notify('Đã tìm thấy nút Create. Đang click...');
    await createBtn.click();
    await page.waitForTimeout(1500);

    // Step 4: Click [role="menuitem"] có text là "Reel"
    notify('Đang tìm menuitem [role="menuitem"] có text là "Reel"...');
    let targetMenuItem = page.locator('[role="menuitem"]:has-text("Reel")').first();

    try {
      await targetMenuItem.waitFor({ state: 'visible', timeout: 15000 });
    } catch {
      notify('Chưa thấy [role="menuitem"]:has-text("Reel"), thử tìm theo regex hoặc tiếng Việt...', 'WARN');
      const fallbackItem = page
        .locator('[role="menuitem"]')
        .filter({ hasText: /reel|thước phim/i })
        .first();
      if ((await fallbackItem.count()) > 0) {
        targetMenuItem = fallbackItem;
      }
      await targetMenuItem.waitFor({ state: 'visible', timeout: 10000 });
    }

    notify('Đã tìm thấy menuitem Reel.');

    // Step 5: Sử dụng page.waitForEvent('filechooser') để put file
    notify('Đang thiết lập lắng nghe sự kiện page.waitForEvent("filechooser")...');
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 30000 });

    notify('Đang click [role="menuitem"] có text là "Reel"...');
    await targetMenuItem.scrollIntoViewIfNeeded().catch(() => {});
    await targetMenuItem.click();

    notify('Đang đợi sự kiện filechooser để put file...');
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
    } catch (err: any) {
      notify(`Chưa bắt được filechooser trực tiếp sau khi click menuitem (${err.message}). Đang kiểm tra dialog tải video...`, 'WARN');
      const uploadTrigger = page
        .locator('div[role="dialog"] div[role="button"]:has-text("video"), div[role="dialog"] button:has-text("video"), div[role="dialog"] [aria-label*="video" i], input[type="file"]')
        .first();
      if ((await uploadTrigger.count()) > 0) {
        const retryFileChooser = page.waitForEvent('filechooser', { timeout: 15000 });
        await uploadTrigger.click({ force: true }).catch(() => {});
        fileChooser = await retryFileChooser.catch(() => null);
      }
    }

    if (!fileChooser) {
      throw new Error('Không bắt được sự kiện filechooser từ Facebook để put file.');
    }

    notify(`Đã bắt được filechooser! Đang put file: ${resolvedPath}...`);
    await fileChooser.setFiles(resolvedPath);
    notify('Đã put file thành công qua filechooser!', 'SUCCESS');

    // Bước 6: Nhập content vào '[aria-label="Posts"] [contenteditable="true"]'
    notify('Đang chờ khung nhập nội dung bài viết [aria-label="Posts"] [contenteditable="true"]...');
    const editor = page.locator('[aria-label="Posts"] [contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 45000 });

    if (content && content.trim()) {
      notify(`Đang điền nội dung bài viết (${content.length} ký tự)...`);
      await editor.click();
      await page.waitForTimeout(500);
      await page.keyboard.insertText(content);
      await page.waitForTimeout(1000);
      notify('Đã điền nội dung bài viết thành công!');
    }

    // Bước 6b: Kiểm tra và dismiss [aria-label="Mentions suggestions"] nếu xuất hiện
    notify('Kiểm tra popup [aria-label="Mentions suggestions"]...');
    const mentionsSuggestions = page.locator('[aria-label="Mentions suggestions"]');
    try {
      const isMentionsVisible = await mentionsSuggestions
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);

      if (isMentionsVisible) {
        notify('Phát hiện [aria-label="Mentions suggestions"], đang đóng popup gợi ý...');
        // Nhấn phím Escape để đóng popup suggestions mà không mất text đã nhập
        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);

        // Nếu vẫn còn hiển thị, thử nhấn Escape lần nữa
        if (await mentionsSuggestions.first().isVisible({ timeout: 500 }).catch(() => false)) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }

        await mentionsSuggestions.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
        notify('Đã đóng popup Mentions suggestions thành công.');
      }
    } catch {
      // Bỏ qua nếu không có popup
    }
    await page.waitForTimeout(500);

    // Bước 7: Click vào thẻ có text là "Audio"
    notify('Đang tìm và click vào thẻ có text "Audio"...');
    let audioTab = page
      .locator(
        'div[role="tab"]:has-text("Audio"), div[role="button"]:has-text("Audio"), button:has-text("Audio")'
      )
      .first();

    if ((await audioTab.count()) === 0 || !(await audioTab.isVisible().catch(() => false))) {
      audioTab = page.locator(':text-is("Audio"), [aria-label="Audio"], div:has-text("Audio")').filter({ hasText: /^Audio$/i }).first();
    }

    await audioTab.waitFor({ state: 'visible', timeout: 25000 });
    await audioTab.scrollIntoViewIfNeeded().catch(() => {});
    await audioTab.click();
    notify('Đã click vào thẻ Audio.');
    await page.waitForTimeout(2000);

    // Bước 8: Click 1 item '[role="listitem"]' bất kỳ trong list '[aria-label="Music Library Song List"][role="list"]'
    notify('Đang tìm danh sách bài hát [aria-label="Music Library Song List"][role="list"]...');
    const musicList = page.locator('[aria-label="Music Library Song List"][role="list"]');
    await musicList.waitFor({ state: 'visible', timeout: 30000 });

    const songItems = page.locator('[aria-label="Music Library Song List"][role="list"] [role="listitem"]');
    await songItems.first().waitFor({ state: 'visible', timeout: 20000 });
    const songCount = await songItems.count();
    notify(`Tìm thấy ${songCount} bài hát trong Music Library Song List.`);

    if (songCount > 0) {
      const randomIndex = Math.floor(Math.random() * songCount);
      const targetSong = songItems.nth(randomIndex);
      notify(`Đang chọn bài hát số ${randomIndex + 1}...`);
      await targetSong.scrollIntoViewIfNeeded().catch(() => {});
      await targetSong.click();
      await page.waitForTimeout(2000);
    }

    // Bước 9: Sau đó click '[aria-label="Done"][role="button"]'
    notify('Đang tìm và click nút [aria-label="Done"][role="button"]...');
    const doneBtn = page.locator('[aria-label="Done"][role="button"]').first();
    await doneBtn.waitFor({ state: 'visible', timeout: 20000 });
    await doneBtn.click();
    notify('Đã click nút Done.');
    await page.waitForTimeout(2000);

    // Bước 10: Sau đó click '[aria-label="Next"][role="button"]'
    notify('Đang tìm và click nút [aria-label="Next"][role="button"]...');
    const nextBtn = page.locator('[aria-label="Next"][role="button"]').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 20000 });
    await nextBtn.click();
    notify('Đã click nút Next.');
    await page.waitForTimeout(2500);

    // Bỏ qua popup WhatsApp nếu hiện sau Next
    await dismissWhatsAppPopup(page);

    // Bước 11: Sau đó click '[aria-label="Post"][role="button"]'
    notify('Đang tìm và click nút [aria-label="Post"][role="button"]...');
    const postBtn = page.locator('[aria-label="Post"][role="button"]').first();
    await postBtn.waitFor({ state: 'visible', timeout: 25000 });
    await postBtn.click();
    notify('Đã click nút Post để xuất bản Reel!', 'SUCCESS');
    await page.waitForTimeout(3000);

    // Bước 12: Nếu Add WhatsApp modal hiện ra thì hãy Click Not Now
    notify('Đang kiểm tra popup Add WhatsApp sau khi đăng...');
    for (let attempt = 0; attempt < 6; attempt++) {
      const dismissed = await dismissWhatsAppPopup(page);
      if (dismissed) {
        notify('Đã phát hiện và bấm "Not now" đóng popup Add WhatsApp.', 'SUCCESS');
        break;
      }
      await page.waitForTimeout(1000);
    }

    // Wait a few seconds for Facebook to process the published reel
    await page.waitForTimeout(5000);

    // Save session state to keep cookies fresh
    try {
      if (context) {
        await context.storageState({ path: getSessionPath() });
      }
    } catch {
      // Ignore
    }

    if (keepOpen && !headless) {
      notify('Giữ trình duyệt mở để bạn theo dõi trạng thái hoàn tất của Reel...');
    }

    return {
      success: true,
      message: 'Đã xuất bản Reel Facebook thành công!',
      filePath: resolvedPath,
    };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    notify(`Lỗi trong quá trình đăng Reel: ${errMsg}`, 'ERROR');

    // Take debug screenshot if page is available
    if (page && !page.isClosed()) {
      try {
        const errorScreenshot = path.join(
          process.cwd(),
          'storage',
          'screenshots',
          `reel_error_${Date.now()}.png`
        );
        await page.screenshot({ path: errorScreenshot, fullPage: false }).catch(() => {});
        notify(`Đã lưu ảnh chụp màn hình lỗi tại: ${errorScreenshot}`);
      } catch {
        // Ignore screenshot errors
      }
    }

    return {
      success: false,
      message: `Đăng Reel thất bại: ${errMsg}`,
      filePath: resolvedPath,
      error: errMsg,
    };
  } finally {
    if (!keepOpen) {
      if (page && !page.isClosed()) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (isStandaloneBrowser && browser) await browser.close().catch(() => {});
    }
  }
}
