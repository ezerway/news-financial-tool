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
  headless?: boolean;
  timeout?: number;
  onProgress?: (message: string) => void;
}

export interface PostTikTokResult {
  success: boolean;
  message: string;
  filePath: string;
  tiktokUrl?: string;
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

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
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

    // Bước 5: Thêm nhạc
    notify('Bước 5: Thêm nhạc...');
    const soundBtn = page.locator('button [data-default-left-menu="MusicPanel"][data-default-right-menu="AudioClipPropSetting"][data-button-name="sounds"]').first();
    await soundBtn.click();
    await page.waitForTimeout(2000);
    await dismissAllTooltip(page);

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

    notify('Đang chờ TikTok hoàn tất xử lý xuất bản video...');
    await page.waitForTimeout(8000);

    // Bước 7: Làm mới https://www.tiktok.com/tiktokstudio/content lấy link bài viết
    // Selector người dùng: target="_blank" data-tt="components_PostInfoCell_a"
    notify('Bước 7: Truy cập https://www.tiktok.com/tiktokstudio/content để lấy link video...');
    await page.goto('https://www.tiktok.com/tiktokstudio/content', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(4000);

    let tiktokVideoUrl: string | undefined = undefined;
    const cleanMatchText = finalCaption.replace(/#\S+/g, '').trim().toLowerCase().slice(0, 25);

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
            // Ưu tiên bài có tiêu đề trùng khớp hoặc lấy bài viết đầu tiên trên cùng
            if (cleanMatchText === '' || linkText.includes(cleanMatchText) || cleanMatchText.includes(linkText) || i === 0) {
              tiktokVideoUrl = absoluteHref;
              if (cleanMatchText && (linkText.includes(cleanMatchText) || cleanMatchText.includes(linkText))) {
                break;
              }
            }
          }
        }

        if (tiktokVideoUrl) {
          notify(`Đã tìm thấy link TikTok thành công: ${tiktokVideoUrl}`, 'SUCCESS');
          break;
        }
      }

      await page.waitForTimeout(4000);
      if (attempt < 5) {
        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => { });
        await page.waitForTimeout(3000);
      }
    }

    // Đóng page và xử lý video Playwright
    if (page && !page.isClosed()) {
      await page.close().catch(() => { });
    }

    const isDevMode = isDeveloperMode();
    let savedVideoFileName: string | undefined = undefined;

    if (video) {
      try {
        if (isDevMode) {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await video.saveAs(finalVideoPath);
          savedVideoFileName = videoFileName;
          notify(`[Dev Mode] Đã lưu video quá trình đăng TikTok: ${videoFileName}`, 'SUCCESS');
        } else {
          await video.delete().catch(() => { });
        }
      } catch { }
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
      await page.close().catch(() => { });
    }

    if (video) {
      try {
        const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
        await video.saveAs(finalVideoPath);
        savedVideoFileName = videoFileName;
        notify(`[Video Debug] Đã lưu video thao tác lỗi TikTok: ${videoFileName}`);
      } catch { }
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
  const tooltipSelectors = ['[class$="-tooltip"]'];

  for (let i = 0; i < 5; i++) {
    for (const mSel of tooltipSelectors) {
      if (await page.locator(mSel).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        const gotItBtn = await page.locator(`${mSel} button[data-type="primary"]`).first();
        if (gotItBtn) {
          await gotItBtn.click();
        }
        break;
      }
    }

    await page.waitForTimeout(1000);
  }
}
