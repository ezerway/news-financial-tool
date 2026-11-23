import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { logActivity, resolveHeadless, isDeveloperMode } from '@/lib/db';
import {
  getChromiumLaunchArgs,
  cleanStaleChromeLocks,
  getUserDataDir,
} from './session';
import { getZaloUserDataDir } from './zalo-session';
import { replaceDateWildcards } from '@/lib/date';

export interface PostZaloOptions {
  reelId?: string;
  filePath: string;
  content?: string;
  comment?: string;
  headless?: boolean;
  onProgress?: (message: string) => void;
}

export interface PostZaloResult {
  success: boolean;
  message: string;
  filePath?: string;
  zaloUrl?: string;
  commentSuccess?: boolean;
  commentError?: string;
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
 * Helper dùng chung để gửi danh sách bình luận (phân cách bởi dấu |) lên Zalo Video
 */
export async function postCommentsOnZaloPage(
  page: Page,
  rawComment: string,
  targetRow?: any,
  notify: (msg: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS') => void = () => {}
): Promise<{ success: boolean; sentCount: number; total: number; error?: string }> {
  const comments = rawComment
    .split('|')
    .map((c) => replaceDateWildcards(c.trim()))
    .filter(Boolean);

  if (comments.length === 0) {
    return { success: true, sentCount: 0, total: 0 };
  }

  try {
    // 1. Nếu có hàng tr chỉ định, click vào thẻ img trong hàng đó để mở khung chi tiết / bình luận
    if (targetRow) {
      const imgElem = targetRow.locator('img').first();
      if (await imgElem.isVisible({ timeout: 5000 }).catch(() => false)) {
        notify('Nhấp vào ảnh đại diện video để mở khung bình luận...');
        await imgElem.click();
        await page.waitForTimeout(2000);
      }
    }

    // 2. Tìm ô nhập bình luận input.ant-input
    const commentInput = page.locator('input.ant-input, textarea.ant-input').first();
    await commentInput.waitFor({ state: 'visible', timeout: 15000 });

    let sentCount = 0;
    for (let i = 0; i < comments.length; i++) {
      const cText = comments[i];
      notify(`Đang nhập bình luận Zalo (${i + 1}/${comments.length}): "${cText}"...`);

      await commentInput.scrollIntoViewIfNeeded().catch(() => {});
      await commentInput.click();
      await page.waitForTimeout(500);

      // Nhập nội dung
      await commentInput.fill(cText);
      await page.waitForTimeout(800);

      // Nhấn Enter để gửi
      notify(`Gửi bình luận (${i + 1}/${comments.length}) bằng phím Enter...`);
      await commentInput.press('Enter');
      await page.waitForTimeout(3500);
      sentCount++;

      if (i < comments.length - 1) {
        await page.waitForTimeout(2000);
      }
    }

    if (sentCount > 0) {
      notify(`Đã gửi thành công ${sentCount}/${comments.length} bình luận lên Zalo Video!`, 'SUCCESS');
      return { success: true, sentCount, total: comments.length };
    } else {
      return { success: false, sentCount: 0, total: comments.length, error: 'Không thể gửi bình luận vào video Zalo.' };
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    notify(`Lỗi gửi bình luận Zalo Video: ${errorMsg}`, 'WARN');
    return { success: false, sentCount: 0, total: comments.length, error: errorMsg };
  }
}

/**
 * Tải video lên Zalo Video Creator (https://video.zalo.me/creator/video)
 */
export async function uploadZaloVideo(options: PostZaloOptions): Promise<PostZaloResult> {
  const { reelId, filePath, content = '', comment, headless: optHeadless, onProgress } = options;
  const isHeadless = resolveHeadless(optHeadless !== undefined ? optHeadless : true);
  const isDev = isDeveloperMode();
  const timestamp = Date.now();
  const idTag = reelId ? String(reelId).slice(0, 8) : 'manual';
  const videoFileName = `zalo_video_${idTag}_${timestamp}.webm`;
  const errVideoFileName = `zalo_video_err_${idTag}_${timestamp}.webm`;
  const screenshotFileName = `zalo_video_err_${idTag}_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    logActivity(level, 'POST_ZALO_VIDEO', `[Zalo Video] ${msg}`);
    console.log(`[Zalo Video] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    const err = `Không tìm thấy file video: ${resolvedPath}`;
    notify(err, 'ERROR');
    return { success: false, message: err, error: err };
  }

  const userDataDir = getZaloUserDataDir();
  cleanStaleChromeLocks(userDataDir);

  const launchArgs = getChromiumLaunchArgs([
    '--disable-blink-features=AutomationControlled',
  ]);

  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let video: any = null;
  let savedDebugVideoFileName: string | undefined;
  let savedScreenshotFileName: string | undefined;

  try {
    notify(`Khởi chạy trình duyệt đăng video Zalo (headless: ${isHeadless})...`);
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: isHeadless,
      viewport: { width: 1280, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: launchArgs,
    });

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.setDefaultTimeout(45000);

    // Ẩn navigator.webdriver
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      try {
        (window as any).chrome = { runtime: {} };
      } catch {}
    });

    // 1. Mở trang Video Creator
    notify('Đang truy cập https://video.zalo.me/creator/video...');
    await page.goto('https://video.zalo.me/creator/video', { waitUntil: 'domcontentloaded', timeout: 50000 });
    await page.waitForTimeout(3000);

    // 2. Click nút trên aside
    notify('Tìm nút tạo/tải video trên thanh bên (aside button)...');
    const asideBtn = page.locator('aside button, aside .ant-btn').first();
    await asideBtn.waitFor({ state: 'visible', timeout: 15000 });
    await asideBtn.click();
    await page.waitForTimeout(1500);

    // 3. Click nút trong modal để mở file chooser
    notify('Tìm nút tải video trong popup (.ant-modal-root button.ant-btn-primary)...');
    const modalBtn = page.locator('.ant-modal-root button.ant-btn-primary, .ant-modal button.ant-btn-primary').first();
    await modalBtn.waitFor({ state: 'visible', timeout: 15000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 20000 }),
      modalBtn.click(),
    ]);

    notify(`Đang tải file video lên: ${path.basename(resolvedPath)}...`);
    await fileChooser.setFiles(resolvedPath);
    await page.waitForTimeout(3000);

    // 4. Điền nội dung vào ô soạn thảo [contenteditable="true"]
    const captionText = content ? replaceDateWildcards(content).trim() : '';
    if (captionText) {
      notify(`Đang điền nội dung mô tả video: "${captionText.slice(0, 60)}..."`);
      const editor = page.locator('[contenteditable="true"]').first();
      await editor.waitFor({ state: 'visible', timeout: 25000 });
      await editor.click();
      await page.waitForTimeout(500);
      await editor.fill(captionText).catch(async () => {
        await page?.keyboard.type(captionText);
      });
      await page.waitForTimeout(1000);
    }

    // 5. Click nút "Đăng video"
    notify('Tìm nút "Đăng video"...');
    const publishBtn = page
      .locator('button')
      .filter({ hasText: /^Đăng video$/i })
      .first();
    await publishBtn.waitFor({ state: 'visible', timeout: 20000 });
    await publishBtn.scrollIntoViewIfNeeded().catch(() => {});
    await publishBtn.click();
    notify('Đã bấm "Đăng video", chờ hệ thống tiếp nhận...');
    await page.waitForTimeout(4000);

    // 6. Điều hướng đến tab tổng quát để kiểm tra trạng thái và lấy link
    notify('Chuyển đến trang quản lý video (tab=tong-quat&type=public) để theo dõi xử lý...');
    await page.goto('https://video.zalo.me/creator/video?tab=tong-quat&type=public', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    let zaloVideoUrl = '';
    let targetRowFound: any = null;
    const searchKeyword = captionText ? captionText.slice(0, 25).trim() : path.basename(resolvedPath);

    // 7. Vòng lặp chờ xử lý: Cứ 5s lại reload 1 lần kiểm tra 'Thành công'
    notify(`Đang chờ Zalo xử lý video (tối đa 3 phút, kiểm tra mỗi 5s)...`);
    for (let attempt = 0; attempt < 36; attempt++) {
      await page.waitForTimeout(5000);
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 35000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const rows = await page.locator('tbody tr.ant-table-row, tbody tr').all();
      if (rows.length === 0) continue;

      for (const row of rows) {
        const rowText = (await row.innerText().catch(() => '')) || '';
        const lines = rowText.split('\n').map((l) => l.trim()).filter(Boolean);

        // lines[1] là 1 phần trong text nội dung
        const rowTitle = lines[1] || '';
        const isMatched =
          (searchKeyword && rowTitle.includes(searchKeyword)) ||
          (captionText && captionText.includes(rowTitle)) ||
          attempt >= 3; // Nếu là video mới nhất ở đầu bảng

        if (isMatched) {
          targetRowFound = row;
          // Kiểm tra trạng thái xử lý 'Thành công'
          const statusText = lines[17] || '';
          const isSuccess = statusText === 'Thành công' || /Thành công/i.test(rowText);

          if (isSuccess) {
            const rowKey = await row.getAttribute('data-row-key');
            if (rowKey) {
              zaloVideoUrl = `https://video.zalo.me/creator/phan-tich/noi-dung/video-${rowKey}.html`;
              notify(`Zalo Video đã xử lý thành công! Link: ${zaloVideoUrl}`, 'SUCCESS');
              break;
            }
          } else {
            notify(`Video đang được Zalo xử lý (Lần thử ${attempt + 1}/36, trạng thái: ${statusText || 'Đang xử lý'})...`);
          }
        }
      }

      if (zaloVideoUrl) break;
    }

    // Nếu chưa lấy được link qua data-row-key nhưng đã đăng, thử lấy hàng đầu tiên
    if (!zaloVideoUrl && targetRowFound) {
      const rowKey = await targetRowFound.getAttribute('data-row-key');
      if (rowKey) {
        zaloVideoUrl = `https://video.zalo.me/creator/phan-tich/noi-dung/video-${rowKey}.html`;
      }
    }

    // 8. Tự động bình luận nếu có
    let commentSuccess = false;
    let commentErrorMsg: string | undefined;

    if (comment && comment.trim()) {
      notify(`Thực hiện gửi bình luận vào video Zalo vừa đăng...`);
      const cmtRes = await postCommentsOnZaloPage(page, comment, targetRowFound, notify);
      commentSuccess = cmtRes.success;
      if (!cmtRes.success) {
        commentErrorMsg = cmtRes.error;
      }
    }

    // Đóng pages để hoàn tất ghi video
    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      if (isDev) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await targetVideo.saveAs(finalVideoPath).catch(() => {});
          savedDebugVideoFileName = videoFileName;
        } catch {}
      } else {
        await targetVideo.delete().catch(() => {});
      }
    }

    if (context) {
      await context.close().catch(() => {});
      context = null;
    }

    notify(`Hoàn tất xuất bản Zalo Video! ${zaloVideoUrl ? `(Link: ${zaloVideoUrl})` : ''}`, 'SUCCESS');

    return {
      success: true,
      message: zaloVideoUrl
        ? `Xuất bản video Zalo thành công! Link: ${zaloVideoUrl}`
        : 'Đã tải video lên Zalo Video Creator thành công!',
      filePath: resolvedPath,
      zaloUrl: zaloVideoUrl || undefined,
      commentSuccess: comment ? commentSuccess : undefined,
      commentError: commentErrorMsg,
      debugVideoPath: savedDebugVideoFileName,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    notify(`Lỗi khi xuất bản Zalo Video: ${errorMsg}`, 'ERROR');

    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: screenshotFullPath, fullPage: true });
        savedScreenshotFileName = screenshotFileName;
      } catch {}
    }

    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      if (isDev) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, errVideoFileName);
          await targetVideo.saveAs(finalVideoPath).catch(() => {});
          savedDebugVideoFileName = errVideoFileName;
        } catch {}
      } else {
        await targetVideo.delete().catch(() => {});
      }
    }

    if (context) {
      await context.close().catch(() => {});
      context = null;
    }

    return {
      success: false,
      message: 'Xuất bản Zalo Video thất bại: ' + errorMsg,
      filePath: resolvedPath,
      error: errorMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedDebugVideoFileName,
    };
  }
}

/**
 * Tự động gửi bình luận lên Zalo Video qua trang quản lý hoặc link video
 */
export async function commentZaloVideoOnly(
  videoUrl: string,
  comment: string,
  options?: { headless?: boolean }
): Promise<{ success: boolean; message: string; error?: string; screenshotPath?: string; debugVideoPath?: string }> {
  const isHeadless = resolveHeadless(options?.headless ?? true);
  const isDev = isDeveloperMode();
  const timestamp = Date.now();
  const videoFileName = `zalo_comment_${timestamp}.webm`;
  const errVideoFileName = `zalo_comment_err_${timestamp}.webm`;
  const screenshotFileName = `zalo_comment_err_${timestamp}.png`;
  const screenshotFullPath = path.join(SCREENSHOTS_DIR, screenshotFileName);

  let savedScreenshotFileName: string | undefined;
  let savedDebugVideoFileName: string | undefined;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let video: any = null;

  const notify = (msg: string, level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' = 'INFO') => {
    logActivity(level, 'COMMENT_ZALO', `[Zalo Comment] ${msg}`);
    console.log(`[Zalo Comment] ${msg}`);
  };

  try {
    notify(`Bắt đầu quy trình bình luận Zalo Video...`);
    const userDataDir = getZaloUserDataDir();
    cleanStaleChromeLocks(userDataDir);

    const launchArgs = getChromiumLaunchArgs([
      '--disable-blink-features=AutomationControlled',
    ]);

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: isHeadless,
      viewport: { width: 1280, height: 900 },
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: 1280, height: 900 },
      },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      args: launchArgs,
    });

    page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    video = page.video();
    page.setDefaultTimeout(45000);

    // Mở trang danh sách video
    notify('Truy cập trang danh sách video Zalo...');
    await page.goto('https://video.zalo.me/creator/video?tab=tong-quat&type=public', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    // Trích xuất row-key từ videoUrl nếu có dạng: video-[key].html
    const keyMatch = videoUrl.match(/video-([^./]+)\.html/);
    const targetKey = keyMatch ? keyMatch[1] : '';

    let targetRow: any = null;
    const rows = await page.locator('tbody tr.ant-table-row, tbody tr').all();

    if (targetKey) {
      for (const r of rows) {
        const k = await r.getAttribute('data-row-key');
        if (k === targetKey) {
          targetRow = r;
          break;
        }
      }
    }

    // Nếu không tìm thấy bằng key thì lấy hàng đầu tiên
    if (!targetRow && rows.length > 0) {
      targetRow = rows[0];
    }

    const cmtRes = await postCommentsOnZaloPage(page, comment, targetRow, notify);
    if (!cmtRes.success) {
      throw new Error(cmtRes.error || 'Không thể gửi bình luận vào video Zalo');
    }

    // Đóng pages & context
    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
    }

    const targetVideo = video || (page && !page.isClosed() ? page.video() : null);
    if (targetVideo) {
      if (isDev) {
        try {
          const finalVideoPath = path.join(VIDEOS_DIR, videoFileName);
          await targetVideo.saveAs(finalVideoPath).catch(() => {});
          savedDebugVideoFileName = videoFileName;
        } catch {}
      } else {
        await targetVideo.delete().catch(() => {});
      }
    }

    if (context) {
      await context.close().catch(() => {});
      context = null;
    }

    return {
      success: true,
      message: `Đã gửi thành công ${cmtRes.sentCount}/${cmtRes.total} bình luận lên video Zalo!`,
      debugVideoPath: savedDebugVideoFileName,
    };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    notify(`Lỗi bình luận Zalo Video: ${errorMsg}`, 'ERROR');

    if (page && !page.isClosed()) {
      try {
        await page.screenshot({ path: screenshotFullPath, fullPage: true });
        savedScreenshotFileName = screenshotFileName;
      } catch {}
    }

    if (context) {
      for (const p of context.pages()) {
        if (!p.isClosed()) await p.close().catch(() => {});
      }
      await context.close().catch(() => {});
      context = null;
    }

    return {
      success: false,
      message: 'Bình luận Zalo thất bại: ' + errorMsg,
      error: errorMsg,
      screenshotPath: savedScreenshotFileName,
      debugVideoPath: savedDebugVideoFileName,
    };
  }
}
