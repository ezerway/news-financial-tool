import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { replaceDateWildcards } from '@/lib/date';
import {
  logActivity,
  isDeveloperMode,
  resolveHeadless,
  getYouTubeChannelUrl,
  parseYouTubeChannelHandle,
} from '@/lib/db';
import {
  getChromiumLaunchArgs,
  cleanStaleChromeLocks,
  getUserDataDir,
} from './session';

export interface PostYouTubeResult {
  success: boolean;
  youtubeUrl?: string;
  message: string;
  error?: string;
  screenshotPath?: string;
  debugVideoPath?: string;
  commentSuccess?: boolean;
}

const SCREENSHOTS_DIR = path.join(process.cwd(), 'storage', 'screenshots');
const VIDEOS_DIR = path.join(process.cwd(), 'storage', 'videos');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  try {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  } catch { }
}
if (!fs.existsSync(VIDEOS_DIR)) {
  try {
    fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  } catch { }
}

/**
 * Kiểm tra và chuyển đổi tài khoản/kênh YouTube mục tiêu qua Account Menu
 * theo cấu hình channel link / handle của người dùng.
 */
async function ensureTargetChannel(
  page: Page,
  configuredChannelUrl: string,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void
): Promise<void> {
  if (!configuredChannelUrl) return;

  const targetHandle = parseYouTubeChannelHandle(configuredChannelUrl);
  if (!targetHandle) return;

  const targetHandleClean = targetHandle.replace(/^@/, '').toLowerCase();
  notify(`Đang điều hướng đến kênh YouTube: ${configuredChannelUrl} (Handle: ${targetHandle})...`);

  try {
    await page.goto(configuredChannelUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);

    // 1. Click vào [aria-label="Account menu"]
    const accountBtn = page.locator(
      '[aria-label="Account menu"], button#avatar-btn, [aria-label="Trình đơn tài khoản"], #avatar-btn'
    ).first();

    const isAccountBtnVisible = await accountBtn.isVisible().catch(() => false);
    if (!isAccountBtnVisible) {
      notify(`Chưa thấy nút Account menu. Có thể chưa đăng nhập hoặc mạng chậm. Tiếp tục kiểm tra...`, 'WARN');
      return;
    }

    await accountBtn.click();
    await page.waitForTimeout(1500);

    // 2. Check [id="channel-handle"] có match với targetHandle không
    const handleLocator = page.locator('[id="channel-handle"], #channel-handle').first();
    const isHandleVisible = await handleLocator.isVisible({ timeout: 5000 }).catch(() => false);

    let currentHandle = '';
    if (isHandleVisible) {
      currentHandle = (await handleLocator.innerText()).trim().toLowerCase();
    }

    const isMatch = currentHandle.replace(/^@/, '').includes(targetHandleClean);

    if (isMatch) {
      notify(`Kênh YouTube hiện tại (${currentHandle}) đã khớp với kênh cài đặt (${targetHandle}).`, 'SUCCESS');
      // Đóng popup menu bằng cách nhấn Escape
      await page.keyboard.press('Escape').catch(() => { });
      return;
    }

    notify(
      `Kênh hiện tại (${currentHandle || 'chưa xác định'}) chưa khớp với ${targetHandle}. Đang chuyển đổi tài khoản...`,
      'INFO'
    );

    // 3. Click vào thẻ a có innerText là "Switch account" (hoặc "Chuyển đổi tài khoản")
    const switchAccountBtn = page
      .locator('a, ytd-compact-link-renderer, tp-yt-paper-item')
      .filter({ hasText: /Switch account|Chuyển đổi tài khoản/i })
      .first();

    const canSwitch = await switchAccountBtn.isVisible({ timeout: 5000 }).catch(() => false);
    if (!canSwitch) {
      notify(`Không tìm thấy nút "Switch account". Tiếp tục với tài khoản mặc định...`, 'WARN');
      await page.keyboard.press('Escape').catch(() => { });
      return;
    }

    await switchAccountBtn.click();
    await page.waitForTimeout(2000);

    // 4. Click vào selector: ytd-account-item-renderer .ytd-account-item-renderer có innerText match với [channel-handle]
    const accountItem = page
      .locator('ytd-account-item-renderer .ytd-account-item-renderer, ytd-account-item-renderer')
      .filter({ hasText: new RegExp(targetHandleClean, 'i') })
      .first();

    const itemExists = await accountItem.isVisible({ timeout: 8000 }).catch(() => false);
    if (itemExists) {
      await accountItem.click();
      notify(`Đã click chọn kênh: ${targetHandle}. Đang chờ tải lại kênh mới...`, 'SUCCESS');
      await page.waitForLoadState('domcontentloaded').catch(() => { });
      await page.waitForTimeout(3000);
    } else {
      notify(
        `Không tìm thấy mục kênh có tên ${targetHandle} trong danh sách Switch account. Vui lòng đảm bảo tài khoản Google đã có quyền vào kênh này.`,
        'WARN'
      );
      await page.keyboard.press('Escape').catch(() => { });
    }
  } catch (err: any) {
    notify(`Lưu ý khi kiểm tra/chuyển kênh YouTube: ${err.message}`, 'WARN');
    await page.keyboard.press('Escape').catch(() => { });
  }
}

/**
 * Tự động tải lên video ngắn YouTube Shorts qua YouTube Studio
 */
export async function uploadYouTubeShortVideo(options: {
  reelId?: string;
  filePath: string;
  content: string;
  comment?: string;
  scheduledAt?: string | null;
  headless?: boolean;
}): Promise<PostYouTubeResult> {
  const { reelId, filePath, content, comment, scheduledAt } = options;
  const isHeadless = resolveHeadless(options.headless ?? true);
  const isDev = isDeveloperMode();
  const idTag = reelId ? reelId.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'manual';
  const timestamp = Date.now();

  const screenshotFileName = `yt_shorts_err_${idTag}_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);
  let savedScreenshotFileName: string | undefined;

  const successVideoFileName = `yt_shorts_success_${idTag}_${timestamp}.webm`;
  const errVideoFileName = `yt_shorts_err_${idTag}_${timestamp}.webm`;
  let savedDebugVideoFileName: string | undefined;

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let video: any = null;

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    logActivity(level, 'POST_YOUTUBE_SHORTS', `[YouTube Shorts] ${msg}`);
    console.log(`[YouTube Shorts] ${msg}`);
  };

  try {
    const userDataDir = getUserDataDir();
    cleanStaleChromeLocks(userDataDir);

    const launchArgs = getChromiumLaunchArgs([
      '--disable-blink-features=AutomationControlled',
    ]);
    const launchOptions: any = {
      headless: isHeadless,
      args: launchArgs,
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 800 },
      },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    notify(`Khởi động Chromium (Headless: ${isHeadless}, DevMode: ${isDev}) dùng chung profile...`);
    context = await chromium.launchPersistentContext(userDataDir, launchOptions);

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.setDefaultTimeout(60000);

    // Ẩn navigator.webdriver để giảm bị YouTube nhận diện là automation
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
      try {
        (window as any).chrome = { runtime: {} };
      } catch { }
    });

    // 1. Kiểm tra kênh và switch account nếu có cấu hình channel link
    const configuredChannelUrl = getYouTubeChannelUrl();
    await ensureTargetChannel(page, configuredChannelUrl, notify);

    // 2. Mở YouTube Studio
    notify('Đang truy cập YouTube Studio (https://studio.youtube.com)...');
    await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Xử lý màn hình cảnh báo "Improve your experience" nếu có
    const skipToStudioBtn = page.locator(
      'a:has-text("SKIP TO YOUTUBE STUDIO"), button:has-text("SKIP TO YOUTUBE STUDIO"), :has-text("SKIP TO YOUTUBE STUDIO"), a:has-text("Bỏ qua để đến YouTube Studio")'
    ).first();
    if (await skipToStudioBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      notify('Phát hiện màn hình "Improve your experience", đang bấm "SKIP TO YOUTUBE STUDIO"...');
      await skipToStudioBtn.click().catch(() => { });
      await page.waitForTimeout(4000);
    }

    // Kiểm tra xem có bị chuyển về trang đăng nhập Google không
    const currentUrl = page.url();
    if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin')) {
      throw new Error(
        'Chưa đăng nhập tài khoản Google / YouTube Studio. Vui lòng vào Cài đặt để mở trình duyệt đăng nhập trước.'
      );
    }

    // Đóng các popup thông báo hoặc dialog chào mừng nếu có
    const dismissBtns = page.locator(
      'ytcp-button:has-text("Dismiss"), ytcp-button:has-text("Đóng"), ytcp-button:has-text("Tiếp tục"), ytcp-button:has-text("Got it"), ytcp-button:has-text("Đã hiểu")'
    );
    if (await dismissBtns.first().isVisible().catch(() => false)) {
      await dismissBtns.first().click().catch(() => { });
      await page.waitForTimeout(1000);
    }

    // 3. Click nút Tạo (Create) -> Tải video lên (Upload videos) hoặc nút Upload trực tiếp
    notify('Đang mở hộp thoại Tải video lên...');
    const createBtn = page.locator(
      '#create-icon, [aria-label="Create"], [aria-label="Tạo"], ytcp-button#create-icon, button#create-icon, ytcp-icon-button#create-icon'
    ).first();

    const directUploadBtn = page.locator(
      '#upload-icon, ytcp-button:has-text("Upload videos"), ytcp-button:has-text("Tải video lên")'
    ).first();

    if (await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      const uploadOption = page.locator(
        '#text-item-0, tp-yt-paper-item:has-text("Upload videos"), tp-yt-paper-item:has-text("Tải video lên"), #items tp-yt-paper-item, ytcp-text-menu #items tp-yt-paper-item'
      ).first();

      if (await uploadOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        await uploadOption.click();
        await page.waitForTimeout(2000);
      }
    } else if (await directUploadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      notify('Nhấp nút Tải video lên trực tiếp trên dashboard...');
      await directUploadBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Chờ createBtn thêm tối đa 15s nếu mạng đang tải
      await createBtn.waitFor({ state: 'visible', timeout: 15000 });
      await createBtn.click();
      await page.waitForTimeout(1000);

      const uploadOption = page.locator(
        '#text-item-0, tp-yt-paper-item:has-text("Upload videos"), tp-yt-paper-item:has-text("Tải video lên"), #items tp-yt-paper-item'
      ).first();
      await uploadOption.waitFor({ state: 'visible', timeout: 10000 });
      await uploadOption.click();
      await page.waitForTimeout(2000);
    }

    // 4. Chọn tệp video
    notify(`Đang tải tệp video lên: ${path.basename(filePath)}...`);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 20000 });
    await fileInput.setInputFiles(path.resolve(filePath));

    // 5. Chờ giao diện tải lên và kiểm tra xem có popup "Verify it's you" không
    notify('Đang chờ giao diện chi tiết hoặc popup xác minh...');
    const titleBox = page.locator('#title-textarea #textbox, #textbox[aria-label*="title" i], #textbox[aria-label*="tiêu đề" i]').first();

    // Kiểm tra lặp trong 15s xem có popup xác minh "Verify it's you" xuất hiện không
    for (let i = 0; i < 15; i++) {
      const hasBackdrop = await page.locator('tp-yt-iron-overlay-backdrop.opened, ytcp-auth-confirmation-dialog').first().isVisible().catch(() => false);
      const hasVerifyText = await page.locator(':has-text("Verify it\'s you"), :has-text("Xác minh bạn là chính bạn")').first().isVisible().catch(() => false);

      if (hasBackdrop || hasVerifyText) {
        notify('Đã phát hiện popup "Verify it\'s you" / overlay xác minh! Đang click nút "Next"...', 'INFO');

        // Click Next bằng Playwright locator hoặc evaluate
        const nextBtn = page.locator('#confirm-button').first();
        if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          notify('Click nút Next qua Playwright locator...');
          await nextBtn.click().catch(() => { });
        } else {
          notify('Click nút Next qua evaluate DOM...');
          await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const target = all.find((el: any) => {
              const text = (el.innerText || el.textContent || '').trim();
              return text === 'Next' || text === 'Tiếp theo';
            });
            if (target) (target as HTMLElement).click();
          }).catch(() => { });
        }

        notify('Đã click nút "Next". Đang chờ 6 giây xem Google phản hồi gì...');
        await page.waitForTimeout(6000);

        const postNextSc = `yt_shorts_post_next_${idTag}_${Date.now()}.png`;
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, postNextSc), fullPage: false }).catch(() => { });
        savedScreenshotFileName = postNextSc;
        notify(`Đã lưu ảnh chụp sau khi click Next: ${postNextSc}`);

        const currentPages = context?.pages() || [page];
        notify(`Số lượng tabs: ${currentPages.length}. URLs: ${currentPages.map(p => p.url()).join(' | ')}`);

        if (currentPages.length > 1) {
          const newTab = currentPages[currentPages.length - 1];
          const newTabSc = `yt_shorts_new_tab_${idTag}_${Date.now()}.png`;
          await newTab.screenshot({ path: path.join(SCREENSHOTS_DIR, newTabSc), fullPage: false }).catch(() => { });
          savedScreenshotFileName = newTabSc;
          notify(`Đã lưu ảnh tab mới: ${newTabSc}`);
        }

        break;
      }
      await page.waitForTimeout(1000);
    }

    // Chờ ô tiêu đề hiển thị
    await titleBox.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 6. Nhập Tiêu đề (Title) & Mô tả (Description) kèm hashtag #Shorts
    let titleText = content.trim();
    if (!titleText.toLowerCase().includes('#shorts')) {
      titleText = `${titleText} #Shorts`.trim();
    }
    // Tiêu đề YouTube tối đa 100 ký tự
    if (titleText.length > 100) {
      titleText = titleText.substring(0, 92) + ' #Shorts';
    }

    notify(`Nhập tiêu đề Shorts: "${titleText}"...`);
    if (await titleBox.isVisible({ timeout: 15000 }).catch(() => false)) {
      await titleBox.click();
      await page.keyboard.press('Meta+A').catch(() => { });
      await page.keyboard.press('Control+A').catch(() => { });
      await page.keyboard.press('Backspace').catch(() => { });
      await titleBox.fill(titleText);
    }

    // Mô tả Description
    const descBox = page.locator('#description-textarea #textbox, #textbox[aria-label*="description" i], #textbox[aria-label*="mô tả" i]').first();
    if (await descBox.isVisible().catch(() => false)) {
      await descBox.fill(`${content}\n\n#Shorts`);
    }

    // 7. Bắt buộc: Chọn "Không, đây không phải nội dung dành cho trẻ em" (Not made for kids)
    notify('Cấu hình đối tượng người xem (Không dành cho trẻ em)...');
    const notForKidsRadio = page.locator(
      'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], tp-yt-paper-radio-button:has-text("No, it\'s not made for kids"), tp-yt-paper-radio-button:has-text("Không, đây không phải nội dung dành cho trẻ em")'
    ).first();

    await notForKidsRadio.scrollIntoViewIfNeeded().catch(() => { });
    await notForKidsRadio.click({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // 8. Bấm Tiếp (Next) qua các bước Video elements -> Checks -> Visibility
    notify('Chuyển qua các bước kiểm tra (Next)...');
    for (let step = 0; step < 3; step++) {
      await page.waitForTimeout(1500);
      const nextBtn = page.locator('#next-button, button#next-button, ytcp-button#next-button').first();
      if (await nextBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // 9. Cấu hình Chế độ hiển thị (Visibility / Schedule)
    const isScheduled = Boolean(scheduledAt && new Date(scheduledAt).getTime() > Date.now());

    if (isScheduled && scheduledAt) {
      notify(`Đặt lịch xuất bản YouTube Shorts vào: ${scheduledAt}...`);
      const scheduleRadio = page.locator(
        '#schedule-radio-button, tp-yt-paper-radio-button[name="SCHEDULE"], tp-yt-paper-radio-button:has-text("Schedule"), tp-yt-paper-radio-button:has-text("Lên lịch")'
      ).first();
      await scheduleRadio.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
      // Giữ thời gian mặc định hoặc hỗ trợ date picker
    } else {
      notify('Chọn chế độ hiển thị: Công khai (Public)...');
      const publicRadio = page.locator(
        'tp-yt-paper-radio-button[name="PUBLIC"], tp-yt-paper-radio-button:has-text("Public"), tp-yt-paper-radio-button:has-text("Công khai")'
      ).first();
      await publicRadio.click({ timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // 10. Trích xuất link video Shorts
    let shortsUrl: string | undefined;
    try {
      const videoLinkElem = page.locator('a.ytcp-video-info, [href*="youtu.be"], [href*="youtube.com/shorts"]').first();
      if (await videoLinkElem.isVisible({ timeout: 5000 }).catch(() => false)) {
        const rawHref = (await videoLinkElem.getAttribute('href')) || (await videoLinkElem.innerText());
        if (rawHref) {
          const idMatch = rawHref.match(/(?:youtu\.be\/|shorts\/|watch\?v=)([a-zA-Z0-9_\-]+)/);
          if (idMatch && idMatch[1]) {
            shortsUrl = `https://www.youtube.com/shorts/${idMatch[1]}`;
          } else {
            shortsUrl = rawHref.trim();
          }
        }
      }
    } catch { }

    // 11. Bấm nút Hoàn tất / Xuất bản (Save / Publish / Schedule / Done)
    notify('Đang bấm Xuất bản video...');
    const doneBtn = page.locator('#done-button, button#done-button, ytcp-button#done-button, #publish-button').first();
    await doneBtn.waitFor({ state: 'visible', timeout: 20000 });
    await doneBtn.click();
    await page.waitForTimeout(4000);

    // Kiểm tra link video trong popup xác nhận nếu chưa lấy được ở bước trước
    if (!shortsUrl) {
      try {
        const dialogLink = page.locator('a[href*="youtu.be"], a[href*="youtube.com/shorts"]').first();
        if (await dialogLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          const rawHref = await dialogLink.getAttribute('href');
          if (rawHref) {
            const idMatch = rawHref.match(/(?:youtu\.be\/|shorts\/|watch\?v=)([a-zA-Z0-9_\-]+)/);
            if (idMatch && idMatch[1]) {
              shortsUrl = `https://www.youtube.com/shorts/${idMatch[1]}`;
            } else {
              shortsUrl = rawHref.trim();
            }
          }
        }
      } catch { }
    }

    notify(`Xuất bản YouTube Shorts thành công! (Link: ${shortsUrl || 'Chưa lấy được link chi tiết'})`, 'SUCCESS');

    // 12. Gửi bình luận đầu tiên (First Comment) nếu có và không phải hẹn giờ
    let commentSuccess = false;
    if (comment && comment.trim() && shortsUrl && !isScheduled) {
      try {
        notify(`Đang chuyển đến video để gửi bình luận đầu tiên: "${comment.trim()}"...`);
        await page.goto(shortsUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000);

        const commentBtn = page.locator('[aria-label="View comments"]').first();
        await commentBtn.click();

        const commentBox = page.locator('#placeholder-area, #contenteditable-root, ytd-commentbox #contenteditable-textarea').first();
        await commentBox.scrollIntoViewIfNeeded().catch(() => { });
        if (await commentBox.isVisible({ timeout: 10000 }).catch(() => false)) {
          await commentBox.click();
          await page.keyboard.type(comment.trim());
          await page.waitForTimeout(1000);

          const submitBtn = page.locator('button[aria-label*="Comment"], button[aria-label*="Bình luận"]').first();
          await submitBtn.click();
          await page.waitForTimeout(2000);
          commentSuccess = true;
          notify('Đã gửi bình luận đầu tiên thành công trên YouTube Shorts!', 'SUCCESS');
        }
      } catch (cErr: any) {
        notify(`Không thể gửi bình luận đầu tiên trên YouTube: ${cErr.message}`, 'WARN');
      }
    }

    // Đóng tất cả pages để Playwright hoàn tất ghi video
    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => { });
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      if (isDev) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, successVideoFileName);
          await targetVideo.saveAs(finalVideoPath).catch(() => { });
          savedDebugVideoFileName = successVideoFileName;
        } catch { }
      } else {
        await targetVideo.delete().catch(() => { });
      }
    }

    if (context) {
      await context.close().catch(() => { });
      context = null;
    }

    return {
      success: true,
      youtubeUrl: shortsUrl,
      message: `Đăng video ngắn YouTube Shorts thành công!${shortsUrl ? ` Link: ${shortsUrl}` : ''}`,
      debugVideoPath: savedDebugVideoFileName,
      commentSuccess,
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    notify(`Lỗi đăng YouTube Shorts: ${errorMsg}`, 'ERROR');

    // Chụp screenshot lỗi trước khi đóng page
    try {
      const activePage = (page && !page.isClosed())
        ? page
        : (context ? context.pages().find((p) => !p.isClosed()) : null);
      if (activePage) {
        await activePage.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });
        savedScreenshotFileName = screenshotFileName;
        notify(`Đã lưu ảnh chụp màn hình lỗi YouTube tại: ${screenshotFileName}`);
      }
    } catch { }

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
        const finalVideoPath = path.join(VIDEOS_DIR, errVideoFileName);
        await targetVideo.saveAs(finalVideoPath);
        savedDebugVideoFileName = errVideoFileName;
        notify(`[Video Debug] Đã lưu video thao tác lỗi YouTube: ${errVideoFileName}`, 'SUCCESS');
      } catch (vErr: any) {
        notify(`Lỗi lưu video debug YouTube: ${vErr?.message || vErr}`, 'WARN');
      }
    }

    if (context) {
      await context.close().catch(() => { });
      context = null;
    }

    return {
      success: false,
      message: `Đăng video ngắn YouTube Shorts thất bại: ${errorMsg}`,
      error: errorMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedDebugVideoFileName,
    };
  }
}

/**
 * Tự động đăng bình luận lên video YouTube Shorts / YouTube Video đã có sẵn link công khai
 */
export async function commentYouTubeVideoOnly(
  videoUrl: string,
  comment: string,
  options?: { headless?: boolean }
): Promise<{ success: boolean; message: string; error?: string; screenshotPath?: string; debugVideoPath?: string }> {
  const isHeadless = resolveHeadless(options?.headless ?? true);
  const isDev = isDeveloperMode();
  const timestamp = Date.now();
  const videoFileName = `yt_comment_${timestamp}.webm`;
  const errVideoFileName = `yt_comment_err_${timestamp}.webm`;
  const screenshotFileName = `yt_comment_err_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  let savedScreenshotFileName: string | undefined;
  let savedDebugVideoFileName: string | undefined;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let video: any = null;

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    logActivity(level, 'COMMENT_YOUTUBE', `[YouTube Comment] ${msg}`);
    console.log(`[YouTube Comment] ${msg}`);
  };

  try {
    const comments = comment
      .split('|')
      .map((c) => replaceDateWildcards(c.trim()))
      .filter(Boolean);

    if (comments.length === 0) {
      return { success: true, message: 'Nội dung bình luận trống' };
    }

    notify(`Bắt đầu gửi bình luận vào video YouTube: ${videoUrl} (${comments.length} bình luận)...`);
    const userDataDir = getUserDataDir();
    cleanStaleChromeLocks(userDataDir);

    const launchArgs = getChromiumLaunchArgs([
      '--disable-blink-features=AutomationControlled',
    ]);
    const launchOptions: any = {
      headless: isHeadless,
      args: launchArgs,
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 800 },
      },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    };

    context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.setDefaultTimeout(45000);

    // Ẩn navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      try {
        (window as any).chrome = { runtime: {} };
      } catch { }
    });

    // Kiểm tra kênh và switch account nếu có cấu hình channel link
    const configuredChannelUrl = getYouTubeChannelUrl();
    await ensureTargetChannel(page, configuredChannelUrl, notify);

    // Điều hướng đến video
    notify(`Đang truy cập video: ${videoUrl}...`);
    await page.goto(videoUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(3000);

    const isShorts = videoUrl.includes('/shorts/') || page.url().includes('/shorts/');

    if (isShorts) {
      // Mở drawer bình luận trên YouTube Shorts nếu chưa mở
      const commentDrawer = page.locator('#comment-dialog, ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-comments-section"]').first();
      const isDrawerVisible = await commentDrawer.isVisible().catch(() => false);

      if (!isDrawerVisible) {
        const commentBtn = page.locator(
          '#comments-button, ytd-reel-player-overlay-renderer #comments-button, [aria-label="View comments"], [aria-label*="comments" i], [aria-label*="bình luận" i], button[aria-label*="Comment" i]'
        ).first();

        if (await commentBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          notify('Nhấp mở bảng bình luận Shorts...');
          await commentBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      // Regular YouTube watch page: scroll xuống phần comments
      notify('Cuộn xuống phần bình luận của video...');
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(2000);
    }

    // Đăng lần lượt các bình luận
    let sentCount = 0;
    for (let i = 0; i < comments.length; i++) {
      const cText = comments[i];
      notify(`Đang gửi bình luận ${i + 1}/${comments.length}: "${cText}"...`);

      // Tìm ô nhập comment
      const commentBox = page.locator(
        '#placeholder-area, #contenteditable-root, ytd-commentbox #contenteditable-textarea, #simplebox-placeholder, #comment-dialog #contenteditable-root'
      ).first();

      await commentBox.scrollIntoViewIfNeeded().catch(() => { });
      await commentBox.waitFor({ state: 'visible', timeout: 15000 });
      await commentBox.click();
      await page.waitForTimeout(800);

      const inputEditable = page.locator('#contenteditable-root, ytd-commentbox #contenteditable-textarea, div[contenteditable="true"]').first();
      if (await inputEditable.isVisible().catch(() => false)) {
        await inputEditable.click();
        await page.keyboard.type(cText, { delay: 25 });
      } else {
        await page.keyboard.type(cText, { delay: 25 });
      }
      await page.waitForTimeout(1000);

      // Nhấp nút gửi bình luận
      const submitBtn = page.locator(
        'button[aria-label="Comment"], button[aria-label="Bình luận"]'
      ).first();

      await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
      await submitBtn.click();
      await page.waitForTimeout(15500);
      sentCount++;
      notify(`Đã gửi bình luận ${sentCount} thành công!`);

      if (i < comments.length - 1) {
        await page.waitForTimeout(2000);
      }
    }

    // Đóng pages & context
    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => { });
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      if (isDev) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await targetVideo.saveAs(finalVideoPath).catch(() => { });
          savedDebugVideoFileName = videoFileName;
        } catch { }
      } else {
        await targetVideo.delete().catch(() => { });
      }
    }

    if (context) {
      await context.close().catch(() => { });
      context = null;
    }

    return {
      success: true,
      message: `Đã gửi thành công ${sentCount}/${comments.length} bình luận vào video YouTube!`,
      debugVideoPath: savedDebugVideoFileName,
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    notify(`Lỗi gửi bình luận YouTube: ${errorMsg}`, 'ERROR');

    try {
      if (page && !page.isClosed()) {
        await page.screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });
        savedScreenshotFileName = screenshotFileName;
        notify(`Đã lưu ảnh chụp lỗi bình luận YouTube: ${screenshotFileName}`);
      } else if (context) {
        const pages = context.pages();
        if (pages.length > 0 && !pages[0].isClosed()) {
          await pages[0].screenshot({ path: screenshotFullPath, fullPage: false }).catch(() => { });
          savedScreenshotFileName = screenshotFileName;
        }
      }
    } catch { }

    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => { });
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      try {
        const finalVideoPath = path.join(VIDEOS_DIR, errVideoFileName);
        await targetVideo.saveAs(finalVideoPath).catch(() => { });
        savedDebugVideoFileName = errVideoFileName;
      } catch { }
    }

    if (context) {
      await context.close().catch(() => { });
      context = null;
    }

    return {
      success: false,
      message: `Bình luận YouTube thất bại: ${errorMsg}`,
      error: errorMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedDebugVideoFileName,
    };
  }
}
