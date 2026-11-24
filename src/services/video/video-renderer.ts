import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { pathToFileURL } from 'url';
import { chromium } from 'playwright';
import db, { logActivity, getDefaultVideoTemplate } from '@/lib/db';
import { TrendItem } from '@/types';
import { convertToRedirectUrl } from '@/lib/link-redirect';
import { generateVideoSlideScript, VideoSlideScript, cleanForbiddenWords } from '../video-script-generator';
import { renderVideoTemplate, VideoTemplateId, calculateVideoDuration } from './templates';

const execAsync = promisify(exec);

export interface RenderResult {
  videoPath: string;
  reelId: string;
  script: VideoSlideScript;
  alreadyExisted: boolean;
  templateId?: VideoTemplateId;
}

/**
 * Kiểm tra xem một lệnh hoặc file binary có thể thực thi trên hệ điều hành hay không
 * Hoạt động đa nền tảng (Windows, macOS, Linux)
 */
function isBinaryExecutable(binPathOrName: string): boolean {
  try {
    if (!binPathOrName) return false;

    // Nếu là đường dẫn cụ thể chứa dấu phân cách thư mục
    if (binPathOrName.includes('/') || binPathOrName.includes('\\')) {
      if (fs.existsSync(binPathOrName)) {
        try {
          fs.accessSync(binPathOrName, fs.constants.X_OK);
          return true;
        } catch {
          // Trên Windows, file .exe tồn tại là có thể chạy được
          return process.platform === 'win32' && binPathOrName.toLowerCase().endsWith('.exe');
        }
      }
      return false;
    }

    // Nếu là tên lệnh chung, kiểm tra trong biến PATH
    const checkCmd = process.platform === 'win32'
      ? `where "${binPathOrName}" >nul 2>&1`
      : `which "${binPathOrName}" >/dev/null 2>&1`;

    execSync(checkCmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tìm đường dẫn thực thi ffmpeg tự động theo từng hệ điều hành
 * Hỗ trợ: Windows (cmd/powershell/winget), macOS (Homebrew ARM & Intel), Linux (apt/snap/yum)
 */
export function getFfmpegPath(): string | null {
  // 1. Kiểm tra biến môi trường FFMPEG_PATH chỉ định thủ công
  if (process.env.FFMPEG_PATH && isBinaryExecutable(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  // 2. Danh sách các đường dẫn mặc định theo từng hệ điều hành
  const candidatePaths: string[] = [];

  if (process.platform === 'darwin') {
    // macOS
    candidatePaths.push(
      '/opt/homebrew/bin/ffmpeg', // Apple Silicon (M1/M2/M3/M4)
      '/usr/local/bin/ffmpeg',    // Intel Mac
      '/opt/local/bin/ffmpeg',    // MacPorts
      'ffmpeg'
    );
  } else if (process.platform === 'win32') {
    // Windows
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';
    candidatePaths.push(
      'ffmpeg.exe',
      'ffmpeg',
      path.join(programFiles, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      path.join(programFilesX86, 'ffmpeg', 'bin', 'ffmpeg.exe'),
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
      'C:\\tools\\ffmpeg\\bin\\ffmpeg.exe',
      path.join(localAppData, 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe')
    );
  } else {
    // Linux (Ubuntu, Debian, CentOS, Fedora, Alpine)
    candidatePaths.push(
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/snap/bin/ffmpeg',
      '/bin/ffmpeg',
      'ffmpeg'
    );
  }

  for (const candidate of candidatePaths) {
    if (isBinaryExecutable(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Tìm đường dẫn thực thi HyperFrames CLI nếu có cài đặt trên hệ thống
 */
export function getHyperframesPath(): string | null {
  if (process.env.HYPERFRAMES_PATH && isBinaryExecutable(process.env.HYPERFRAMES_PATH)) {
    return process.env.HYPERFRAMES_PATH;
  }

  const candidateNames = process.platform === 'win32'
    ? ['hyperframes.cmd', 'hyperframes.exe', 'hyperframes']
    : ['hyperframes'];

  for (const name of candidateNames) {
    if (isBinaryExecutable(name)) {
      return name;
    }
  }

  return null;
}

/**
 * Render video 9:16 dạng bản tin ngắn cho từ khóa xu hướng
 * Tương thích đa nền tảng: macOS, Linux (Ubuntu/Debian VPS, Docker), Windows
 */
export async function renderTrendVideo(
  trend: TrendItem,
  options: { force?: boolean; width?: number; height?: number; templateId?: string; duration?: number } = {}
): Promise<RenderResult> {
  const width = options.width || 720; // 720x1280 (chuẩn HD 9:16 tối ưu tốc độ render)
  const height = options.height || 1280;

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

    if (existing?.video_generated === 1 && existing?.video_path) {
      const fullPath = path.isAbsolute(existing.video_path)
        ? existing.video_path
        : path.join(process.cwd(), existing.video_path);

      if (fs.existsSync(fullPath)) {
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
  }

  logActivity('INFO', 'VIDEO_RENDER', `Bắt đầu quy trình tạo video 9:16 cho xu hướng: "${trend.title}"...`);

  // 2. Sinh kịch bản Slide (Gemini -> Alternate -> Smart Extractor Fallback)
  const script = await generateVideoSlideScript(trend);

  // 3. Tính toán thời lượng video tự động theo số slide (từ 20s đến 60s)
  const duration = options.duration || calculateVideoDuration(script);

  logActivity(
    'INFO',
    'VIDEO_RENDER',
    `Thời lượng video: ${duration}s (tự động điều chỉnh theo ${script.contentSlides?.length || 0} nhóm nội dung, từ 20s - 60s)`
  );

  // 4. Tạo mã HTML5 HyperFrames composition dựa trên template đã chọn hoặc cấu hình
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
  let renderedSuccessfully = false;
  let finalVideoOutputFile = finalMp4Path;

  const hyperframesBin = getHyperframesPath();
  if (hyperframesBin) {
    try {
      logActivity('INFO', 'VIDEO_RENDER', `Phát hiện HyperFrames CLI (${hyperframesBin}), tiến hành render video...`);
      await execAsync(`"${hyperframesBin}" render --composition "${tempHtmlPath}" --output "${finalMp4Path}" --fps 25 --duration ${duration}`);
      if (fs.existsSync(finalMp4Path)) {
        renderedSuccessfully = true;
      }
    } catch (hfErr: any) {
      logActivity('WARN', 'VIDEO_RENDER', `HyperFrames CLI gặp lỗi: ${hfErr.message}. Tự động chuyển sang Playwright + FFmpeg engine...`);
    }
  }

  // 5. Nếu không có HyperFrames CLI hoặc render CLI thất bại, render bằng Headless Chromium + FFmpeg
  if (!renderedSuccessfully) {
    logActivity('INFO', 'VIDEO_RENDER', 'Render video bằng Playwright Chromium + FFmpeg engine (Cross-platform)...');
    const sessionDir = path.join(tempDir, `session_${renderId}`);
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    // Cờ Chromium tối ưu cho Linux VPS / Docker / macOS / Windows
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--hide-scrollbars',
      ],
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

      // Bật cờ tự động chạy animation loop
      await page.addInitScript(() => {
        (window as any).__AUTO_PLAY__ = true;
      });

      // Mở URL file HTML cross-platform chuẩn RFC 8089 (tương thích cả Windows C:\ và Unix /path)
      const htmlFileUrl = pathToFileURL(tempHtmlPath).href;
      await page.goto(htmlFileUrl, { waitUntil: 'load' });

      // Đợi đúng thời lượng video (20 giây) + đệm 0.5 giây
      await page.waitForTimeout((duration + 0.5) * 1000);

      // Thu thập video canvas
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

    // 6. Xử lý xuất file video qua FFmpeg hoặc fallback WebM
    const ffmpegBin = getFfmpegPath();

    if (ffmpegBin) {
      logActivity('INFO', 'VIDEO_RENDER', `Đang mã hóa MP4 H.264 qua FFmpeg (${ffmpegBin})...`);
      try {
        const ffmpegCmd = `"${ffmpegBin}" -y -i "${rawVideoPath}" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${finalMp4Path}"`;
        await execAsync(ffmpegCmd);

        if (fs.existsSync(finalMp4Path)) {
          finalVideoOutputFile = finalMp4Path;
          renderedSuccessfully = true;
        }
      } catch (ffErr: any) {
        logActivity('WARN', 'VIDEO_RENDER', `Lỗi mã hóa FFmpeg: ${ffErr.message}. Chuyển sang lưu video định dạng WebM...`);
      }
    } else {
      logActivity(
        'WARN',
        'VIDEO_RENDER',
        `Không phát hiện FFmpeg trên hệ điều hành này (${process.platform}). Đang lưu định dạng WebM gốc. Để có MP4 H.264, vui lòng cài đặt FFmpeg (macOS: brew install ffmpeg, Ubuntu: sudo apt install ffmpeg, Windows: winget install Gyan.FFmpeg).`
      );
    }

    // Nếu không có FFmpeg hoặc lệnh FFmpeg lỗi, dùng trực tiếp file WebM do Chromium xuất
    if (!renderedSuccessfully) {
      const finalWebmPath = path.join(videosDir, `${renderId}.webm`);
      fs.copyFileSync(rawVideoPath, finalWebmPath);
      finalVideoOutputFile = finalWebmPath;
      renderedSuccessfully = true;
    }

    // Dọn dẹp thư mục tạm của session
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}
  }

  // Dọn file HTML tạm
  try {
    fs.unlinkSync(tempHtmlPath);
  } catch {}

  if (!fs.existsSync(finalVideoOutputFile)) {
    throw new Error('Quá trình render hoàn tất nhưng không tìm thấy file video đầu ra.');
  }

  // Đảm bảo đường dẫn web luôn dùng slash '/' kể cả trên Windows
  const relativeVideoPath = `storage/videos/${path.basename(finalVideoOutputFile)}`.replace(/\\/g, '/');

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
    video_filename: path.basename(finalVideoOutputFile),
    caption: caption,
    comment_content: commentContent,
  });

  logActivity('SUCCESS', 'VIDEO_RENDER', `Đã tạo video 9:16 thành công: ${relativeVideoPath} (Reel ID: ${reelId}, Template: ${usedTemplateId})`);

  return {
    videoPath: relativeVideoPath,
    reelId,
    script,
    alreadyExisted: false,
    templateId: usedTemplateId,
  };
}
