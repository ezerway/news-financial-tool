import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { chromium } from 'playwright';
import db, { logActivity, getDefaultVideoTemplate } from '@/lib/db';
import { TrendItem } from '@/types';
import { convertToRedirectUrl } from '@/lib/link-redirect';
import { generateVideoSlideScript, VideoSlideScript, cleanForbiddenWords } from '../video-script-generator';
import { renderVideoTemplate, VideoTemplateId } from './templates';

const execAsync = promisify(exec);

export interface RenderResult {
  videoPath: string;
  reelId: string;
  script: VideoSlideScript;
  alreadyExisted: boolean;
  templateId?: VideoTemplateId;
}

/**
 * Tìm đường dẫn thực thi ffmpeg
 */
function getFfmpegPath(): string {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }
  const commonPaths = ['/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg', 'ffmpeg'];
  for (const p of commonPaths) {
    if (p === 'ffmpeg') return p;
    if (fs.existsSync(p)) return p;
  }
  return 'ffmpeg';
}

/**
 * Render video 9:16 dạng bản tin ngắn cho từ khóa xu hướng
 * Tích hợp kiểm tra chống tạo trùng lặp
 */
export async function renderTrendVideo(
  trend: TrendItem,
  options: { force?: boolean; width?: number; height?: number; templateId?: string } = {}
): Promise<RenderResult> {
  const width = options.width || 720; // 720x1280 (chuẩn HD 9:16 tối ưu tốc độ render)
  const height = options.height || 1280;
  const duration = 20; // 20 giây bản tin

  const storageDir = path.join(process.cwd(), 'storage');
  const videosDir = path.join(storageDir, 'videos');
  const tempDir = path.join(storageDir, 'temp', 'video_render');

  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  // 1. KIỂM TRA CHỐNG TẠO LẶP: Nếu đã có video cho xu hướng này thì không tạo lại
  if (!options.force && trend.id) {
    const existing = db
      .prepare('SELECT video_generated, video_path FROM trends WHERE id = ?')
      .get(trend.id) as { video_generated?: number; video_path?: string } | undefined;

    if (existing?.video_generated === 1 && existing?.video_path && fs.existsSync(existing.video_path)) {
      logActivity(
        'INFO',
        'VIDEO_RENDER',
        `Xu hướng "${trend.title}" đã được tạo video trước đó (${existing.video_path}). Trả về video hiện có để tránh trùng lặp.`
      );

      const existingReel = db
        .prepare('SELECT id FROM reels WHERE video_path = ? OR trend_id = ?')
        .get(existing.video_path, trend.id) as { id: string } | undefined;

      return {
        videoPath: existing.video_path,
        reelId: existingReel?.id || '',
        script: {} as any,
        alreadyExisted: true,
      };
    }
  }

  logActivity('INFO', 'VIDEO_RENDER', `Bắt đầu quy trình tạo video 9:16 cho xu hướng: "${trend.title}"...`);

  // 2. Sinh kịch bản Slide (Gemini -> Alternate -> Smart Extractor Fallback)
  const script = await generateVideoSlideScript(trend);

  // 3. Tạo mã HTML5 HyperFrames composition dựa trên template đã chọn hoặc cấu hình
  const selectedTemplate = options.templateId || getDefaultVideoTemplate();
  const { html: htmlContent, usedTemplateId } = renderVideoTemplate(selectedTemplate, script, { width, height, duration });

  logActivity(
    'INFO',
    'VIDEO_RENDER',
    `Áp dụng HyperFrames template: [${usedTemplateId}] (lựa chọn: ${selectedTemplate})`
  );

  const renderId = 'trend_' + (trend.id || crypto.randomUUID().substring(0, 8)) + '_' + Date.now();
  const tempHtmlPath = path.join(tempDir, `${renderId}.html`);
  const finalMp4Path = path.join(videosDir, `${renderId}.mp4`);

  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

  // 4. Kiểm tra xem HyperFrames CLI có sẵn trên hệ thống không
  let renderedViaHyperframes = false;
  try {
    const { stdout } = await execAsync('which hyperframes || true');
    if (stdout.trim()) {
      logActivity('INFO', 'VIDEO_RENDER', 'Phát hiện HyperFrames CLI, sử dụng hyperframes render...');
      await execAsync(`hyperframes render --composition "${tempHtmlPath}" --output "${finalMp4Path}" --fps 25`);
      if (fs.existsSync(finalMp4Path)) {
        renderedViaHyperframes = true;
      }
    }
  } catch {}

  // 5. Nếu không có HyperFrames CLI, render bằng Headless Chromium + FFmpeg
  if (!renderedViaHyperframes) {
    logActivity('INFO', 'VIDEO_RENDER', 'Render video bằng Playwright Chromium + FFmpeg engine...');
    const sessionDir = path.join(tempDir, `session_${renderId}`);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const browser = await chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--disable-gpu', '--no-sandbox'],
    });

    let rawVideoPath: string | null = null;

    try {
      const context = await browser.newContext({
        viewport: { width, height },
        deviceScaleFactor: 1,
        recordVideo: {
          dir: sessionDir,
          size: { width, height },
        },
      });

      const page = await context.newPage();

      // Mở file HTML và bật cờ __AUTO_PLAY__
      await page.addInitScript(() => {
        (window as any).__AUTO_PLAY__ = true;
      });

      await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'load' });

      // Đợi đúng thời lượng video (20 giây) + đệm 0.5 giây
      await page.waitForTimeout((duration + 0.5) * 1000);

      // Lấy đối tượng video trước khi đóng trang
      const videoObj = page.video();
      await page.close();
      await context.close();

      if (videoObj) {
        rawVideoPath = await videoObj.path();
      }
    } finally {
      await browser.close();
    }

    if (!rawVideoPath || !fs.existsSync(rawVideoPath)) {
      throw new Error('Không thể thu thập video từ Playwright canvas.');
    }

    // 6. Dùng FFmpeg chuyển đổi video sang chuẩn MP4 H.264
    const ffmpegBin = getFfmpegPath();
    const ffmpegCmd = `"${ffmpegBin}" -y -i "${rawVideoPath}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${finalMp4Path}"`;
    logActivity('INFO', 'VIDEO_RENDER', `Đang mã hóa MP4 H.264 qua FFmpeg...`);
    await execAsync(ffmpegCmd);

    // Dọn dẹp thư mục tạm của session
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
  }

  // Dọn file HTML tạm
  try {
    fs.unlinkSync(tempHtmlPath);
  } catch {}

  if (!fs.existsSync(finalMp4Path)) {
    throw new Error('Quá trình render hoàn tất nhưng không tìm thấy file MP4 đầu ra.');
  }

  const relativeVideoPath = `storage/videos/${path.basename(finalMp4Path)}`;

  // 7. Cập nhật trạng thái bảng trends
  if (trend.id) {
    db.prepare(`
      UPDATE trends 
      SET video_generated = 1, video_path = ?, video_created_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(relativeVideoPath, trend.id);
  }

  // 8. Tự động tạo bản ghi trong bảng reels
  const reelId = 'reel_' + crypto.randomUUID().substring(0, 8);
  const cleanTitle = cleanForbiddenWords(trend.title);
  const caption = `🔥 [BẢN TIN THỊ TRƯỜNG] ${cleanTitle}\n\n${script.slide1.headline}\n\n👉 Đăng ký kênh để cập nhật tin tức kinh tế & tài chính mỗi ngày!\n\n#FinancialNews #TinTuc #TaiChinh #KinhTe #ThiTruong`;

  const articlesList = (trend.articles || [])
    .filter((a) => a.url && !a.url.includes('google.com'))
    .map((a, i) => `${i + 1}. [${a.source || 'Báo chí'}]: ${convertToRedirectUrl(a.url)}`)
    .join('\n');

  const commentContent = articlesList
    ? `🔗 Nguồn tin và bài viết chi tiết để bạn đọc tham khảo:\n${articlesList}\n\n#NguonTin #BaoChi #ThongTinChinhXac`
    : `🔗 Nguồn tin tham khảo từ các cơ quan báo chí chính thống.`;

  db.prepare(`
    INSERT INTO reels (
      id, trend_id, video_path, video_filename, caption, comment_content, status
    ) VALUES (
      @id, @trend_id, @video_path, @video_filename, @caption, @comment_content, 'draft'
    )
  `).run({
    id: reelId,
    trend_id: trend.id || null,
    video_path: relativeVideoPath,
    video_filename: path.basename(finalMp4Path),
    caption: caption,
    comment_content: commentContent,
  });

  logActivity('SUCCESS', 'VIDEO_RENDER', `Đã tạo video 9:16 thành công: ${relativeVideoPath} (Reel ID: ${reelId})`);

  return {
    videoPath: relativeVideoPath,
    reelId,
    script,
    alreadyExisted: false,
    templateId: usedTemplateId,
  };
}
