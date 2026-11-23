import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import {
  getUserDataDir,
  getSessionPath,
  isSessionAvailable,
  getChromiumLaunchArgs,
  injectSessionCookies,
  cleanStaleChromeLocks,
} from './session';
import { dismissBlockingPagePopups } from './fb-automation';
import { logActivity, resolveHeadless, isDeveloperMode } from '@/lib/db';
import { replaceDateWildcards } from '@/lib/date';

export interface PostReelOptions {
  reelId?: string;
  filePath: string;
  content?: string;
  comment?: string;
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
  reelUrl?: string;
  commentSuccess?: boolean;
  screenshotPath?: string;
  debugVideoPath?: string;
}

const FB_CONTENT_LIBRARY_URL =
  'https://www.facebook.com/professional_dashboard/content/content_library/';

const VIDEOS_DIR = path.join(process.cwd(), 'storage', 'videos');
const SCREENSHOTS_DIR = path.join(process.cwd(), 'storage', 'screenshots');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

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
  const { filePath, content = '', comment = '', headless: requestedHeadless = false, onProgress, keepOpen = false } = options;
  const headless = resolveHeadless(requestedHeadless);

  const idTag = options.reelId ? options.reelId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'standalone';
  const timestamp = Date.now();
  const screenshotFileName = `reel_error_${idTag}_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);
  const videoFileName = `reel_${idTag}_${timestamp}.webm`;

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
  let video: any = null;

  try {
    notify('Khởi chạy trình duyệt Playwright Chromium...');
    const launchArgs = getChromiumLaunchArgs(['--disable-notifications']);

    try {
      cleanStaleChromeLocks(getUserDataDir());
      // Try launching with persistent context profile
      context = await chromium.launchPersistentContext(getUserDataDir(), {
        headless,
        viewport: { width: 1366, height: 850 },
        recordVideo: {
          dir: VIDEOS_DIR,
          size: { width: 1366, height: 850 },
        },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        args: launchArgs,
        permissions: ['clipboard-read', 'clipboard-write'],
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
        recordVideo: {
          dir: VIDEOS_DIR,
          size: { width: 1366, height: 850 },
        },
        storageState,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
    }

    if (!context) {
      throw new Error('Không thể khởi tạo browser context.');
    }

    // Inject cookies from fb-session.json if available
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();

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
        await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 120000 }).catch(() => { });
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
    await targetMenuItem.scrollIntoViewIfNeeded().catch(() => { });
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
        await uploadTrigger.click({ force: true }).catch(() => { });
        fileChooser = await retryFileChooser.catch(() => null);
      }
    }

    if (!fileChooser) {
      throw new Error('Không bắt được sự kiện filechooser từ Facebook để put file.');
    }

    notify(`Đã bắt được filechooser! Đang put file: ${resolvedPath}...`);
    await fileChooser.setFiles(resolvedPath);
    notify('Đã put file thành công qua filechooser!', 'SUCCESS');
    await page.waitForTimeout(3000);

    // Kiểm tra và đảm bảo video đã được nạp vào form Create Reel
    const ensureVideoLoaded = async (activePage: Page) => {
      const fileInput = activePage.locator('input[type="file"]').first();
      if ((await fileInput.count()) > 0) {
        notify('Nạp file bổ sung vào input[type="file"] của form...');
        await fileInput.setInputFiles(resolvedPath).catch(() => {});
        await activePage.waitForTimeout(2000);
      }

      const addVideoPrompt = activePage
        .locator('div:has-text("Add video"), div:has-text("Thêm video")')
        .filter({ hasText: /drag and drop|kéo và thả/i })
        .first();

      if (await addVideoPrompt.isVisible({ timeout: 3000 }).catch(() => false)) {
        notify('Phát hiện ô "Add video" vẫn hiển thị, kích hoạt filechooser trực tiếp từ nút...');
        try {
          const fcPromise = activePage.waitForEvent('filechooser', { timeout: 10000 });
          await addVideoPrompt.click({ force: true });
          const fc = await fcPromise.catch(() => null);
          if (fc) {
            await fc.setFiles(resolvedPath);
            notify('Đã setFiles thành công qua nút Add video!', 'SUCCESS');
          }
        } catch (e: any) {
          notify(`Lỗi khi click ô Add video: ${e.message}`, 'WARN');
        }
        await activePage.waitForTimeout(3000);
      }
    };
    if (page) {
      await ensureVideoLoaded(page);
    }

    // Bước 6: Nhập content vào '[aria-label="Posts"] [contenteditable="true"]'
    notify('Đang chờ khung nhập nội dung bài viết [aria-label="Posts"] [contenteditable="true"]...');
    const editor = page.locator('[aria-label="Posts"] [contenteditable="true"]').first();
    await editor.waitFor({ state: 'visible', timeout: 45000 });

    const finalContent = replaceDateWildcards(content);
    if (finalContent && finalContent.trim()) {
      notify(`Đang điền nội dung bài viết (${finalContent.length} ký tự, đã xử lý wildcard %%DATE%%)...`);
      await editor.click();
      await page.waitForTimeout(500);
      await page.keyboard.insertText(finalContent);
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

        await mentionsSuggestions.first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => { });
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
    await audioTab.scrollIntoViewIfNeeded().catch(() => { });

    // Chờ cho video xử lý xong và Audio tab được enable
    try {
      const handle = await audioTab.elementHandle();
      if (handle) {
        await page.waitForFunction(
          (el) => el && el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled'),
          handle,
          { timeout: 35000 }
        );
      }
    } catch {
      notify('Audio tab vẫn aria-disabled hoặc timeout, tiếp tục click với force...');
    }

    await audioTab.click({ force: true });
    notify('Đã click vào thẻ Audio.');
    await page.waitForTimeout(2000);

    // Bước 8: Chọn nhạc trong Music Library nếu có
    try {
      notify('Đang tìm danh sách bài hát [aria-label="Music Library Song List"][role="list"]...');
      const musicList = page.locator('[aria-label="Music Library Song List"][role="list"]');
      await musicList.waitFor({ state: 'visible', timeout: 10000 });

      const songItems = page.locator('[aria-label="Music Library Song List"][role="list"] [role="listitem"]');
      await songItems.first().waitFor({ state: 'visible', timeout: 10000 });
      const songCount = await songItems.count();
      notify(`Tìm thấy ${songCount} bài hát trong Music Library Song List.`);

      if (songCount > 0) {
        const randomIndex = Math.floor(Math.random() * songCount);
        const targetSong = songItems.nth(randomIndex);
        notify(`Đang chọn bài hát số ${randomIndex + 1}...`);
        await targetSong.scrollIntoViewIfNeeded().catch(() => { });
        await targetSong.click();
        await page.waitForTimeout(2000);
      }
    } catch (musicErr: any) {
      notify(`Bỏ qua chọn nhạc thư viện (${musicErr.message}), tiếp tục quy trình đăng Reel...`, 'WARN');
    }

    // Helper tắt âm thanh gốc cho Reel Facebook:
    // Click vào [aria-label="Change volume"] sau đó click 20 lần vào [aria-label="Decrease volume"]
    const muteOriginalAudioIfPresent = async (stageDescription: string): Promise<boolean> => {
      if (!page) return false;
      const activePage = page;

      try {
        notify(`Kiểm tra nút [aria-label="Change volume"] (${stageDescription})...`);

        // Ưu tiên tìm Change volume trong vùng Original audio / Âm thanh gốc nếu có, hoặc lấy phần tử đầu tiên
        let changeVolBtn = activePage.locator('div:has-text("Original audio"), div:has-text("Âm thanh gốc")')
          .locator('[aria-label="Change volume"]')
          .first();

        if ((await changeVolBtn.count()) === 0 || !(await changeVolBtn.isVisible().catch(() => false))) {
          changeVolBtn = activePage.locator('[aria-label="Change volume"]').first();
        }

        const isChangeVolVisible = await changeVolBtn.isVisible({ timeout: 4000 }).catch(() => false);
        if (!isChangeVolVisible) {
          return false;
        }

        notify('Tìm thấy [aria-label="Change volume"]. Đang click để mở thanh âm lượng...');
        await changeVolBtn.scrollIntoViewIfNeeded().catch(() => { });
        await changeVolBtn.click();
        await activePage.waitForTimeout(600);

        // Tìm nút Decrease volume
        const decreaseVolBtn = activePage.locator('[aria-label="Decrease volume"]').first();
        const isDecreaseVisible = await decreaseVolBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (!isDecreaseVisible) {
          notify('Không tìm thấy nút [aria-label="Decrease volume"] sau khi click Change volume.', 'WARN');
          return false;
        }

        notify('Bắt đầu click 20 lần vào [aria-label="Decrease volume"] để tắt âm gốc...');
        for (let i = 1; i <= 20; i++) {
          await decreaseVolBtn.click().catch(() => { });
          await activePage.waitForTimeout(80);
        }
        notify('Đã click 20 lần vào [aria-label="Decrease volume"] (đã tắt âm gốc hoàn toàn)!', 'SUCCESS');
        await activePage.waitForTimeout(500);
        return true;
      } catch (err: any) {
        notify(`Lỗi khi tắt âm gốc (${stageDescription}): ${err.message}`, 'WARN');
        return false;
      }
    };

    // Thử tắt âm gốc ngay sau khi chọn bài hát
    let isOriginalMuted = await muteOriginalAudioIfPresent('sau khi chọn bài hát');

    // Bước 9: Sau đó click '[aria-label="Done"][role="button"]' nếu có
    notify('Đang kiểm tra nút [aria-label="Done"][role="button"]...');
    const doneBtn = page.locator('[aria-label="Done"][role="button"]').first();
    if (await doneBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await doneBtn.click();
      notify('Đã click nút Done.');
      await page.waitForTimeout(2000);
    }

    // Nếu trước khi bấm Done chưa tắt được âm gốc thì thử lại sau khi bấm Done
    if (!isOriginalMuted) {
      await muteOriginalAudioIfPresent('sau khi click Done');
    }

    // Bước 10: Sau đó click '[aria-label="Next"][role="button"]'
    notify('Đang tìm và click nút [aria-label="Next"][role="button"]...');
    const nextBtn = page.locator('[aria-label="Next"][role="button"]').first();
    await nextBtn.waitFor({ state: 'visible', timeout: 20000 });
    await nextBtn.click();
    notify('Đã click nút Next.');
    await page.waitForTimeout(2500);

    // Bỏ qua popup nếu hiện sau Next
    await dismissBlockingPagePopups(page);

    // Bước 11: Sau đó click '[aria-label="Post"][role="button"]'
    notify('Đang tìm và click nút [aria-label="Post"][role="button"]...');
    const postBtn = page.locator('[aria-label="Post"][role="button"]').first();
    await postBtn.waitFor({ state: 'visible', timeout: 25000 });
    await postBtn.click();
    notify('Đã click nút Post để xuất bản Reel!', 'SUCCESS');
    await page.waitForTimeout(3000);

    // Bỏ qua popup nếu hiện sau Next
    await dismissBlockingPagePopups(page);

    // Bước 13: Đợi khoảng 30 giây để Facebook xử lý video và xuất bản vào bảng tin
    notify('Đang đợi khoảng 30 giây để Facebook xử lý video và xuất bản Reel...');
    await page.waitForTimeout(30000);

    // Bước 14: Lấy link Reel thực tế từ Content Library hoặc Thông báo
    let reelUrl: string | undefined;
    try {
      notify('Đang tìm link Reel vừa xuất bản từ Content Library / Insights...');

      await page.addInitScript(() => {
        (window as any).__copiedReelUrl = '';
        if (navigator.clipboard) {
          const origWrite = navigator.clipboard.writeText;
          navigator.clipboard.writeText = function (text: string) {
            (window as any).__copiedReelUrl = text;
            return origWrite ? origWrite.apply(this, arguments as any) : Promise.resolve();
          };
        }
        const origExec = document.execCommand;
        document.execCommand = function (cmd: string) {
          if (cmd === 'copy') {
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
              const val = (active as any).value;
              if (val && typeof val === 'string' && val.includes('facebook.com')) {
                (window as any).__copiedReelUrl = val.trim();
              }
            }
          }
          return origExec ? origExec.apply(this, arguments as any) : true;
        };
      });

      let insightsUrl: string | undefined;
      const cleanCaption = content
        ? content.replace(/#\S+/g, '').replace(/\n+/g, ' ').trim().toLowerCase().slice(0, 30)
        : '';

      // Polling tối đa 6 lần (khoảng 35s) để Facebook xử lý video và xuất hiện thông báo / insights link
      for (let poll = 0; poll < 6; poll++) {
        // 1. Kiểm tra Content Library (Ưu tiên cao nhất vì sắp xếp chuẩn theo ngày hôm nay)
        await page.goto(
          'https://www.facebook.com/professional_dashboard/content/content_library/?date_range=TODAY&placement_type=ALL&post_type=ALL_CONTENT&post_types[0]=REELS&sort_by=DATE&sorting_method=METRICS_DESCENDING',
          { waitUntil: 'domcontentloaded', timeout: 35000 }
        ).catch(() => {});
        await page.waitForTimeout(3000);

        const contentLinks = page.locator('a[href*="/content/insights/?content_id="]');
        const contentCount = await contentLinks.count().catch(() => 0);
        if (contentCount > 0) {
          let matchedHref: string | null = null;
          for (let i = 0; i < contentCount; i++) {
            const item = contentLinks.nth(i);
            const itemText = (await item.innerText().catch(() => '')).toLowerCase();
            const href = await item.getAttribute('href').catch(() => null);
            if (href && cleanCaption && itemText.includes(cleanCaption)) {
              matchedHref = href;
              break;
            }
          }
          // Nếu không khớp caption chính xác, lấy hàng đầu tiên (bài mới nhất)
          if (!matchedHref) {
            const firstHref = await contentLinks.first().getAttribute('href').catch(() => null);
            if (firstHref) matchedHref = firstHref;
          }
          if (matchedHref) {
            insightsUrl = matchedHref.startsWith('http') ? matchedHref : `https://www.facebook.com${matchedHref}`;
            notify(`Đã tìm thấy link insights từ Content Library: ${insightsUrl}`, 'SUCCESS');
            break;
          }
        }

        // 2. Kiểm tra trang thông báo Notifications (bỏ qua thông báo cột mốc lượt xem fb_shorts_video_views)
        await page.goto('https://www.facebook.com/notifications/', {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        }).catch(() => {});
        await page.waitForTimeout(2500);

        const notifLinks = page.locator('a[href*="/content/insights/?content_id="]');
        const notifCount = await notifLinks.count().catch(() => 0);
        for (let i = 0; i < notifCount; i++) {
          const item = notifLinks.nth(i);
          const href = await item.getAttribute('href').catch(() => null);
          if (!href) continue;
          if (href.includes('notif_t=fb_shorts_video_views')) continue; // Bỏ qua milestone thông báo lượt xem
          const text = (await item.innerText().catch(() => '')).toLowerCase();
          if (text.includes('play') || text.includes('lượt phát') || text.includes('lượt xem')) continue;
          if (href.includes('fb_shorts_video_processed') || text.includes('ready to view') || text.includes('sẵn sàng')) {
            insightsUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
            notify(`Đã tìm thấy link insights từ Thông báo: ${insightsUrl}`, 'SUCCESS');
            break;
          }
        }
        if (insightsUrl) break;

        notify(`Đang chờ Facebook xử lý Reel và sinh link insights (lần ${poll + 1}/6)...`);
        await page.waitForTimeout(5000);
      }

      if (insightsUrl) {
        notify(`Điều hướng đến trang Post Insights: ${insightsUrl}`);
        await page.goto(insightsUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 35000,
        }).catch(() => {});
        await page.waitForTimeout(3000);

        // Click nút 3 chấm Actions for this post để Copy link chia sẻ công khai
        try {
          const actionBtn = page.locator('[aria-label*="Actions for this post" i], [aria-label*="Hành động cho bài viết" i]').first();
          if (await actionBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
            await actionBtn.click();
            await page.waitForTimeout(1000);

            const copyBtn = page.locator([
              '[role="menuitem"]:has-text("Copy link")',
              'div:has-text("Copy link")',
              '[role="button"]:has-text("Copy link")',
              '[role="menuitem"]:has-text("Sao chép liên kết")',
              'div:has-text("Sao chép liên kết")',
              '[role="button"]:has-text("Sao chép liên kết")'
            ].join(', ')).first();

            if (await copyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await copyBtn.click();
              await page.waitForTimeout(1000);

              const copied = await page.evaluate(async () => {
                try {
                  return (await navigator.clipboard.readText()) || (window as any).__copiedReelUrl;
                } catch {
                  return (window as any).__copiedReelUrl || null;
                }
              });

              if (copied && typeof copied === 'string' && copied.includes('facebook.com')) {
                reelUrl = copied.trim();
                notify(`Đã lấy link Reel công khai từ nút Copy link: ${reelUrl}`, 'SUCCESS');
              }
            }
          }
        } catch (copyErr: any) {
          notify(`Không thể copy link qua menu Actions: ${copyErr.message}`, 'WARN');
        }

        // Nếu không copy được link share thì dùng chính link insights (vẫn có thể comment trực tiếp)
        if (!reelUrl) {
          reelUrl = insightsUrl;
          notify(`Sử dụng link insights làm link Reel: ${reelUrl}`, 'INFO');
        }
      } else {
        notify('Chưa tìm thấy link insights của Reel vừa đăng (Facebook có thể đang xử lý nền chậm).', 'WARN');
      }
    } catch (fetchErr: any) {
      notify(`Không thể lấy link Reel sau khi đăng: ${fetchErr.message}`, 'WARN');
    }

    // Bước 15: Tự động bình luận (Auto-comment) vào Reel nếu có nội dung bình luận
    let commentSuccess = false;
    const finalComment = comment ? replaceDateWildcards(comment).trim() : '';

    if (finalComment && reelUrl && page && !page.isClosed()) {
      notify(`Bắt đầu quy trình tự động bình luận (Auto-comment) cho Reel: ${reelUrl}`);
      try {
        // Nếu trang hiện tại chưa phải là reelUrl thì điều hướng tới reelUrl
        if (!page.url().includes(reelUrl.replace(/^https?:\/\/(www\.)?facebook\.com/, ''))) {
          await page.goto(reelUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
          await page.waitForTimeout(3000);
        }

        // Lưu URL sau redirect nếu từ link share sang link reel trực tiếp
        if (page.url() && page.url().includes('/reel/')) {
          reelUrl = page.url();
        }

        // Chờ nếu video đang xử lý ("This content isn't available right now")
        for (let attempt = 0; attempt < 4; attempt++) {
          const notAvailable = await page.locator('text="This content isn\'t available right now", text="Nội dung này hiện không khả dụng"').isVisible({ timeout: 1500 }).catch(() => false);
          if (!notAvailable) break;
          notify(`Reel đang được Facebook xử lý nền, đợi thêm 10s (lần ${attempt + 1}/4)...`);
          await page.waitForTimeout(10000);
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
        }

        // Gửi các bình luận qua hàm dùng chung
        const commentResult = await postCommentsOnFacebookPage(page, finalComment, notify);
        commentSuccess = commentResult.success;
      } catch (cmErr: any) {
        notify(`Lỗi trong quá trình tự động bình luận Reel: ${cmErr.message}`, 'WARN');
      }
    } else if (finalComment && !reelUrl) {
      notify('Không thể tự động bình luận vì chưa xác định được link Reel công khai.', 'WARN');
    }

    // Save session state to keep cookies fresh
    try {
      if (context) {
        await context.storageState({ path: getSessionPath() });
      }
    } catch {
      // Ignore
    }

    let savedSuccessVideoFileName: string | undefined = undefined;

    if (keepOpen && !headless) {
      notify('Giữ trình duyệt mở để bạn theo dõi trạng thái hoàn tất của Reel...');
    } else {
      // Đóng page để hoàn thành ghi video
      if (page && !page.isClosed()) {
        await page.close().catch(() => { });
      }

      const isDevMode = isDeveloperMode();

      // Khi bật developer mode: lưu lại toàn bộ video quá trình đăng Reel thành công
      // Khi chưa bật: xóa video tạm để tiết kiệm dung lượng ổ cứng
      if (video) {
        try {
          if (isDevMode) {
            const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
            await video.saveAs(finalVideoPath);
            savedSuccessVideoFileName = videoFileName;
            notify(`[Dev Mode] Đã lưu video quá trình đăng Reel thành công: ${videoFileName}`, 'SUCCESS');
          } else {
            await video.delete().catch(() => { });
          }
        } catch { }
      }
    }

    return {
      success: true,
      message: reelUrl
        ? `Đã xuất bản Reel Facebook thành công! Link: ${reelUrl}`
        : 'Đã xuất bản Reel Facebook thành công!',
      filePath: resolvedPath,
      reelUrl,
      commentSuccess,
      debugVideoPath: savedSuccessVideoFileName,
    };
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    notify(`Lỗi trong quá trình đăng Reel: ${errMsg}`, 'ERROR');

    let savedScreenshotFileName: string | undefined = undefined;
    let savedVideoFileName: string | undefined = undefined;

    // Chụp ảnh màn hình lỗi
    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });
        savedScreenshotFileName = screenshotFileName;
        notify(`Đã lưu ảnh chụp màn hình lỗi tại: ${screenshotFileName}`);
      } catch (sErr: any) {
        notify(`Không thể chụp ảnh màn hình lỗi: ${sErr.message}`, 'WARN');
      }

      // Đóng page để Playwright kết thúc luồng ghi video
      await page.close().catch(() => { });
    }

    // Lưu video quay lại toàn bộ quá trình lỗi để debug
    if (video) {
      try {
        const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
        await video.saveAs(finalVideoPath);
        savedVideoFileName = videoFileName;
        notify(`[Video Debug] Đã lưu video quá trình đăng Reel lỗi: ${videoFileName}`, 'SUCCESS');
      } catch (vErr: any) {
        notify(`Lỗi lưu video debug: ${vErr.message}`, 'WARN');
      }
    }

    return {
      success: false,
      message: `Đăng Reel thất bại: ${errMsg}`,
      filePath: resolvedPath,
      error: errMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedVideoFileName,
    };
  } finally {
    if (!keepOpen) {
      if (page && !page.isClosed()) await page.close().catch(() => { });
      if (context) await context.close().catch(() => { });
      if (isStandaloneBrowser && browser) await browser.close().catch(() => { });
    }
  }
}

/**
 * Bình luận trực tiếp lên một Reel Facebook đã xuất bản (hỗ trợ cả link share, link reel, và link insights)
 */
/**
 * Helper dùng chung để đăng danh sách bình luận (phân cách bởi dấu |) lên trang Facebook Reel
 */
export async function postCommentsOnFacebookPage(
  page: Page,
  rawComment: string,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void = () => {}
): Promise<{ success: boolean; sentCount: number; total: number; error?: string }> {
  const finalComment = replaceDateWildcards(rawComment).trim();
  const commentItems = finalComment
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);

  if (commentItems.length === 0) {
    return { success: true, sentCount: 0, total: 0 };
  }

  const commentBoxSelectors = [
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="Comment as" i]',
    'div[aria-label*="Bình luận dưới tên" i]',
    'div[aria-label*="Write a comment" i]',
    'div[aria-label*="Viết bình luận" i]',
    'div[contenteditable="true"]',
  ].join(', ');

  const commentIconSelectors = [
    '[aria-label="Comment" i][role="button"]',
    '[aria-label="Comments" i][role="button"]',
    '[aria-label*="Comment" i][role="button"]',
    '[aria-label="Bình luận" i][role="button"]',
    '[aria-label*="Bình luận" i][role="button"]',
    '[aria-label="Comment" i]',
    '[aria-label="Comments" i]',
    '[aria-label*="Comment" i]',
    '[aria-label="Bình luận" i]',
    '[aria-label*="Bình luận" i]',
  ].join(', ');

  notify(`Bắt đầu đăng ${commentItems.length} bình luận lên Facebook Reel...`);
  let sentCount = 0;

  for (let i = 0; i < commentItems.length; i++) {
    const itemComment = commentItems[i];
    notify(`Đang nhập bình luận Facebook (${i + 1}/${commentItems.length}): "${itemComment}"...`);

    let commentBox = page.locator(commentBoxSelectors).first();
    if (!(await commentBox.isVisible({ timeout: 4000 }).catch(() => false))) {
      const commentIcon = page.locator(commentIconSelectors).first();
      if (await commentIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await commentIcon.click();
        await page.waitForTimeout(1500);
      }
      commentBox = page.locator(commentBoxSelectors).first();
    }

    if (await commentBox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await commentBox.scrollIntoViewIfNeeded().catch(() => {});
      await commentBox.click();
      await page.waitForTimeout(600);
      await page.keyboard.insertText(itemComment);
      await page.waitForTimeout(1500);

      const postCommentBtn = page.locator('[aria-label="Post comment" i], [aria-label="Đăng bình luận" i]').first();
      if (await postCommentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        notify(`Bấm nút gửi bình luận (${i + 1}/${commentItems.length})...`);
        await postCommentBtn.click();
      } else {
        notify(`Gửi bình luận (${i + 1}/${commentItems.length}) bằng phím Enter...`);
        await page.keyboard.press('Enter');
      }
      await page.waitForTimeout(3500);
      sentCount++;
      notify(`Đã gửi bình luận (${i + 1}/${commentItems.length}) thành công!`, 'SUCCESS');

      if (i < commentItems.length - 1) {
        await page.waitForTimeout(2000);
      }
    } else {
      notify(`Không tìm thấy ô nhập bình luận Facebook cho phần ${i + 1}.`, 'WARN');
    }
  }

  if (sentCount > 0) {
    notify(`Đã tự động gửi ${sentCount}/${commentItems.length} bình luận thành công cho Reel!`, 'SUCCESS');
    return { success: true, sentCount, total: commentItems.length };
  } else {
    return {
      success: false,
      sentCount: 0,
      total: commentItems.length,
      error: 'Không tìm thấy ô nhập bình luận trên giao diện Reel.',
    };
  }
}

export async function commentFacebookReelOnly(options: {
  reelUrl: string;
  comment: string;
  headless?: boolean;
  onProgress?: (message: string) => void;
}): Promise<{ success: boolean; realReelUrl?: string; error?: string }> {
  const { reelUrl, comment, headless: requestedHeadless = false, onProgress } = options;
  const headless = resolveHeadless(requestedHeadless);

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    console.log(`[Reel Comment] ${msg}`);
    try {
      logActivity(level, 'COMMENT', msg);
    } catch {}
    if (onProgress) onProgress(msg);
  };

  const finalComment = replaceDateWildcards(comment).trim();
  if (!finalComment) {
    return { success: false, error: 'Nội dung bình luận không được để trống.' };
  }

  let resolvedUrl = (reelUrl || '').trim();
  let publicReelUrl: string | undefined;

  if (!resolvedUrl) {
    return { success: false, error: 'Không có đường dẫn Reel hợp lệ để bình luận.' };
  }

  notify(`Bắt đầu bình luận lên Reel: ${resolvedUrl}`);

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browser: any = null;
  let isStandaloneBrowser = false;

  try {
    const launchArgs = getChromiumLaunchArgs(['--disable-notifications']);
    try {
      cleanStaleChromeLocks(getUserDataDir());
      context = await chromium.launchPersistentContext(getUserDataDir(), {
        headless,
        viewport: { width: 1366, height: 850 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        args: launchArgs,
        permissions: ['clipboard-read', 'clipboard-write'],
      });
    } catch {
      browser = await chromium.launch({ headless, args: launchArgs });
      isStandaloneBrowser = true;
      const sessionPath = getSessionPath();
      const storageState = fs.existsSync(sessionPath) ? sessionPath : undefined;
      context = await browser.newContext({
        viewport: { width: 1366, height: 850 },
        storageState,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        permissions: ['clipboard-read', 'clipboard-write'],
      });
    }

    if (!context) throw new Error('Không thể khởi tạo browser context.');
    await injectSessionCookies(context);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    await dismissBlockingPagePopups(page);

    await page.addInitScript(() => {
      (window as any).__copiedReelUrl = '';
      if (navigator.clipboard) {
        const origWrite = navigator.clipboard.writeText;
        navigator.clipboard.writeText = function (text: string) {
          (window as any).__copiedReelUrl = text;
          return origWrite ? origWrite.apply(this, arguments as any) : Promise.resolve();
        };
      }
      const origExec = document.execCommand;
      document.execCommand = function (cmd: string) {
        if (cmd === 'copy') {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            const val = (active as any).value;
            if (val && typeof val === 'string' && val.includes('facebook.com')) {
              (window as any).__copiedReelUrl = val.trim();
            }
          }
        }
        return origExec ? origExec.apply(this, arguments as any) : true;
      };
    });

    notify(`Điều hướng đến: ${resolvedUrl}`);
    await page.goto(resolvedUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3000);

    // Nếu đang ở trang Post Insights, thử lấy link chia sẻ công khai qua menu Actions
    if (page.url().includes('/content/insights')) {
      try {
        const actionBtn = page.locator('[aria-label*="Actions for this post" i], [aria-label*="Hành động cho bài viết" i]').first();
        if (await actionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await actionBtn.click();
          await page.waitForTimeout(800);

          const copyBtn = page.locator([
            '[role="menuitem"]:has-text("Copy link")',
            'div:has-text("Copy link")',
            '[role="button"]:has-text("Copy link")',
            '[role="menuitem"]:has-text("Sao chép liên kết")',
            'div:has-text("Sao chép liên kết")',
            '[role="button"]:has-text("Sao chép liên kết")'
          ].join(', ')).first();

          if (await copyBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await copyBtn.click();
            await page.waitForTimeout(800);

            const copied = await page.evaluate(async () => {
              try {
                return (await navigator.clipboard.readText()) || (window as any).__copiedReelUrl;
              } catch {
                return (window as any).__copiedReelUrl || null;
              }
            });

            if (copied && typeof copied === 'string' && copied.includes('facebook.com')) {
              publicReelUrl = copied.trim();
              notify(`Lấy được link Reel công khai từ Insights: ${publicReelUrl}`, 'INFO');
              // Điều hướng sang link Reel công khai
              await page.goto(publicReelUrl, { waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
              await page.waitForTimeout(3000);
              if (page.url() && page.url().includes('/reel/')) {
                publicReelUrl = page.url();
              }
            }
          }
        }
      } catch {}
    } else if (page.url() && page.url().includes('/reel/')) {
      publicReelUrl = page.url();
    }

    // Chờ nếu video đang xử lý ("This content isn't available right now")
    for (let attempt = 0; attempt < 4; attempt++) {
      const notAvailable = await page.locator('text="This content isn\'t available right now", text="Nội dung này hiện không khả dụng"').isVisible({ timeout: 1500 }).catch(() => false);
      if (!notAvailable) break;
      notify(`Reel đang được Facebook xử lý nền, đợi thêm 10s (lần ${attempt + 1}/4)...`);
      await page.waitForTimeout(10000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
    }

    const commentResult = await postCommentsOnFacebookPage(page, finalComment, notify);
    if (!commentResult.success) {
      throw new Error(commentResult.error || 'Không tìm thấy ô nhập bình luận trên giao diện Reel.');
    }

    return { success: true, realReelUrl: publicReelUrl || page.url() || resolvedUrl };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    notify(`Lỗi khi bình luận lên Reel: ${errorMsg}`, 'ERROR');
    return { success: false, error: errorMsg };
  } finally {
    if (page && !page.isClosed()) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (isStandaloneBrowser && browser) await browser.close().catch(() => {});
  }
}
