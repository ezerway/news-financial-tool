import fs from 'fs';
import path from 'path';
import db, { logActivity } from '@/lib/db';
import { getStorageDir } from '@/services/playwright/session';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getDirStats(dirPath: string): { count: number; sizeBytes: number } {
  let count = 0;
  let sizeBytes = 0;

  if (fs.existsSync(/*turbopackIgnore: true*/ dirPath)) {
    try {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ dirPath);
      for (const file of files) {
        if (file === '.gitkeep' || file.startsWith('.')) continue;
        const filePath = path.join(/*turbopackIgnore: true*/ dirPath, file);
        try {
          const stat = fs.statSync(/*turbopackIgnore: true*/ filePath);
          if (stat.isFile()) {
            count++;
            sizeBytes += stat.size;
          }
        } catch {}
      }
    } catch {}
  }

  return { count, sizeBytes };
}

export interface CleanupResult {
  success: boolean;
  deletedVideos: number;
  deletedScreenshots: number;
  freedBytes: number;
  freedFormatted: string;
  affectedReels?: number;
  message?: string;
}

/**
 * Dọn dẹp video và ảnh chụp màn hình của các post Reel đã tạo từ X ngày trước đó (mặc định 2 ngày).
 * Giữ nguyên bài viết & metadata (caption, status, published_at, URLs) nhưng giải phóng dung lượng đĩa.
 */
export async function cleanOldReelsStorage(days: number = 2): Promise<CleanupResult> {
  const safeDays = Math.max(1, Number(days) || 2);
  const storageDir = getStorageDir();
  const videosDir = path.join(/*turbopackIgnore: true*/ storageDir, 'videos');
  const screenshotsDir = path.join(/*turbopackIgnore: true*/ storageDir, 'screenshots');

  let deletedVideos = 0;
  let deletedScreenshots = 0;
  let freedBytes = 0;
  const deletedFilePaths = new Set<string>();

  const cutoffMs = Date.now() - safeDays * 24 * 60 * 60 * 1000;

  // 1. Tìm các Reel đã tạo từ `safeDays` ngày trước đó.
  // Không dọn các Reel đang ở trạng thái 'scheduled' mà thời gian hẹn giờ còn ở tương lai.
  let oldReels: any[] = [];
  try {
    oldReels = db
      .prepare(
        `
        SELECT id, video_path, video_filename, screenshot_path, debug_video_path,
               tiktok_screenshot_path, tiktok_debug_video_path,
               youtube_screenshot_path, youtube_debug_video_path,
               status, scheduled_at, created_at
        FROM reels
        WHERE datetime(COALESCE(created_at, 'now')) <= datetime('now', '-' || ? || ' days')
          AND (status != 'scheduled' OR scheduled_at IS NULL OR datetime(scheduled_at) <= datetime('now'))
      `
      )
      .all(safeDays) as any[];
  } catch (err: any) {
    console.error('[Storage Cleanup] Lỗi truy vấn reels cũ:', err.message);
    oldReels = [];
  }

  // Lọc thêm theo cutoffMs chuẩn xác của JavaScript
  const eligibleReels = oldReels.filter((r) => {
    if (!r.created_at) return true;
    const t = new Date(r.created_at).getTime();
    return isNaN(t) || t <= cutoffMs;
  });

  const safelyDeleteFile = (filePath: string, isVideo: boolean): boolean => {
    if (!filePath || deletedFilePaths.has(filePath)) return false;
    try {
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          freedBytes += stat.size;
          fs.unlinkSync(filePath);
          deletedFilePaths.add(filePath);
          if (isVideo) deletedVideos++;
          else deletedScreenshots++;
          return true;
        }
      }
    } catch (err: any) {
      console.warn(`[Storage Cleanup] Không thể xóa file ${filePath}:`, err.message);
    }
    return false;
  };

  const resolveStorageFile = (rawPath: string | null | undefined, baseDir: string): string | null => {
    if (!rawPath || typeof rawPath !== 'string') return null;
    const trimmed = rawPath.trim();
    if (!trimmed) return null;

    // Ưu tiên đường dẫn trực tiếp trong baseDir
    const inBaseDir = path.join(baseDir, path.basename(trimmed));
    if (fs.existsSync(inBaseDir)) {
      return inBaseDir;
    }

    // Kiểm tra đường dẫn tuyệt đối/tương đối
    const resolved = path.resolve(trimmed);
    if (fs.existsSync(resolved)) {
      // Chỉ cho phép xóa nếu file nằm trong storageDir hoặc videosDir hoặc screenshotsDir
      if (resolved.startsWith(storageDir) || resolved.startsWith(baseDir)) {
        return resolved;
      }
    }

    return null;
  };

  // Duyệt từng Reel để xóa các file liên quan
  for (const reel of eligibleReels) {
    // A. Xóa video chính của Reel (nếu nằm trong storage/videos hoặc storageDir)
    if (reel.video_path) {
      const vidFile = resolveStorageFile(reel.video_path, videosDir);
      if (vidFile) {
        // Kiểm tra xem có Reel nào khác (chưa quá 2 ngày hoặc đang lên lịch) vẫn đang dùng file này không
        let isSharedWithNewerReel = false;
        try {
          const sharing = db
            .prepare(
              `
              SELECT id FROM reels
              WHERE id != ?
                AND (video_path = ? OR video_filename = ?)
                AND (datetime(COALESCE(created_at, 'now')) > datetime('now', '-' || ? || ' days')
                     OR (status = 'scheduled' AND datetime(scheduled_at) > datetime('now')))
              LIMIT 1
            `
            )
            .get(reel.id, reel.video_path, path.basename(reel.video_path), safeDays);
          if (sharing) isSharedWithNewerReel = true;
        } catch {}

        if (!isSharedWithNewerReel) {
          safelyDeleteFile(vidFile, true);
        }
      }
    }

    // B. Xóa video debug lỗi Facebook nếu có
    if (reel.debug_video_path) {
      const dbgVid = resolveStorageFile(reel.debug_video_path, videosDir);
      if (dbgVid) safelyDeleteFile(dbgVid, true);
    }

    // C. Xóa video debug lỗi TikTok nếu có
    if (reel.tiktok_debug_video_path) {
      const ttDbgVid = resolveStorageFile(reel.tiktok_debug_video_path, videosDir);
      if (ttDbgVid) safelyDeleteFile(ttDbgVid, true);
    }

    // D. Xóa ảnh screenshot lỗi Facebook nếu có
    if (reel.screenshot_path) {
      const sc = resolveStorageFile(reel.screenshot_path, screenshotsDir);
      if (sc) safelyDeleteFile(sc, false);
    }

    // E. Xóa ảnh screenshot lỗi TikTok nếu có
    if (reel.tiktok_screenshot_path) {
      const ttSc = resolveStorageFile(reel.tiktok_screenshot_path, screenshotsDir);
      if (ttSc) safelyDeleteFile(ttSc, false);
    }

    // F. Xóa video debug lỗi YouTube Shorts nếu có
    if (reel.youtube_debug_video_path) {
      const ytDbgVid = resolveStorageFile(reel.youtube_debug_video_path, videosDir);
      if (ytDbgVid) safelyDeleteFile(ytDbgVid, true);
    }

    // G. Xóa ảnh screenshot lỗi YouTube Shorts nếu có
    if (reel.youtube_screenshot_path) {
      const ytSc = resolveStorageFile(reel.youtube_screenshot_path, screenshotsDir);
      if (ytSc) safelyDeleteFile(ytSc, false);
    }

    // Cập nhật reset các cột debug screenshot/video về NULL trong DB
    try {
      db.prepare(
        `
        UPDATE reels
        SET screenshot_path = NULL,
            debug_video_path = NULL,
            tiktok_screenshot_path = NULL,
            tiktok_debug_video_path = NULL,
            youtube_screenshot_path = NULL,
            youtube_debug_video_path = NULL
        WHERE id = ?
      `
      ).run(reel.id);
    } catch {}
  }

  // 2. Dọn thêm các file tạm rác liên quan đến Reel trong storage/videos & storage/screenshots có tuổi đời > safeDays
  if (fs.existsSync(videosDir)) {
    try {
      const vidFiles = fs.readdirSync(videosDir);
      for (const file of vidFiles) {
        if (file === '.gitkeep' || file.startsWith('.')) continue;
        if (file.startsWith('reel_') || file.startsWith('tiktok_reel_')) {
          const filePath = path.join(videosDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile() && stat.mtimeMs <= cutoffMs) {
              safelyDeleteFile(filePath, true);
            }
          } catch {}
        }
      }
    } catch {}
  }

  if (fs.existsSync(screenshotsDir)) {
    try {
      const scFiles = fs.readdirSync(screenshotsDir);
      for (const file of scFiles) {
        if (file === '.gitkeep' || file.startsWith('.')) continue;
        if (
          file.startsWith('reel_') ||
          file.startsWith('tiktok_reel_') ||
          file.startsWith('tiktok_comment_')
        ) {
          const filePath = path.join(screenshotsDir, file);
          try {
            const stat = fs.statSync(filePath);
            if (stat.isFile() && stat.mtimeMs <= cutoffMs) {
              safelyDeleteFile(filePath, false);
            }
          } catch {}
        }
      }
    } catch {}
  }

  const freedFormatted = formatBytes(freedBytes);

  if (deletedVideos > 0 || deletedScreenshots > 0) {
    logActivity(
      'SUCCESS',
      'CLEANUP',
      `[Tự động dọn dẹp] Đã xóa ${deletedVideos} video và ${deletedScreenshots} screenshot của các post Reel tạo từ ${safeDays} ngày trước, giải phóng ${freedFormatted} dung lượng đĩa.`
    );
  }

  return {
    success: true,
    deletedVideos,
    deletedScreenshots,
    freedBytes,
    freedFormatted,
    affectedReels: eligibleReels.length,
    message: `Đã dọn dẹp ${deletedVideos} video và ${deletedScreenshots} ảnh screenshot của các post Reel cũ (> ${safeDays} ngày), giải phóng ${freedFormatted}.`,
  };
}

/**
 * Dọn dẹp toàn bộ screenshots và videos trong hệ thống (thao tác thủ công từ Cài đặt).
 */
export async function cleanAllStorage(): Promise<CleanupResult> {
  const storageDir = getStorageDir();
  const screenshotsDir = path.join(/*turbopackIgnore: true*/ storageDir, 'screenshots');
  const videosDir = path.join(/*turbopackIgnore: true*/ storageDir, 'videos');

  let deletedScreenshots = 0;
  let deletedVideos = 0;
  let freedBytes = 0;

  // 1. Dọn dẹp screenshots
  if (fs.existsSync(/*turbopackIgnore: true*/ screenshotsDir)) {
    try {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ screenshotsDir);
      for (const file of files) {
        if (file === '.gitkeep' || file.startsWith('.')) continue;
        const filePath = path.join(/*turbopackIgnore: true*/ screenshotsDir, file);
        try {
          const stat = fs.statSync(/*turbopackIgnore: true*/ filePath);
          if (stat.isFile()) {
            freedBytes += stat.size;
            fs.unlinkSync(/*turbopackIgnore: true*/ filePath);
            deletedScreenshots++;
          }
        } catch {}
      }
    } catch {}
  }

  // 2. Dọn dẹp videos
  if (fs.existsSync(/*turbopackIgnore: true*/ videosDir)) {
    try {
      const files = fs.readdirSync(/*turbopackIgnore: true*/ videosDir);
      for (const file of files) {
        if (file === '.gitkeep' || file.startsWith('.')) continue;
        const filePath = path.join(/*turbopackIgnore: true*/ videosDir, file);
        try {
          const stat = fs.statSync(/*turbopackIgnore: true*/ filePath);
          if (stat.isFile()) {
            freedBytes += stat.size;
            fs.unlinkSync(/*turbopackIgnore: true*/ filePath);
            deletedVideos++;
          }
        } catch {}
      }
    } catch {}
  }

  // 3. Reset các đường dẫn trong database
  try {
    db.prepare(`UPDATE posts SET screenshot_path = NULL, video_path = NULL`).run();
  } catch {}
  try {
    db.prepare(
      `UPDATE reels SET screenshot_path = NULL, debug_video_path = NULL, tiktok_screenshot_path = NULL, tiktok_debug_video_path = NULL, youtube_screenshot_path = NULL, youtube_debug_video_path = NULL`
    ).run();
  } catch {}

  const freedFormatted = formatBytes(freedBytes);
  logActivity(
    'SUCCESS',
    'CLEANUP',
    `Đã xóa toàn bộ ${deletedScreenshots} ảnh chụp màn hình và ${deletedVideos} video, giải phóng ${freedFormatted} dung lượng ổ cứng.`
  );

  return {
    success: true,
    deletedScreenshots,
    deletedVideos,
    freedBytes,
    freedFormatted,
    message: `Đã dọn dẹp thành công! Đã xóa ${deletedScreenshots} ảnh màn hình và ${deletedVideos} video (${freedFormatted}).`,
  };
}
