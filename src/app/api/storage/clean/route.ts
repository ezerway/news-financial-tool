import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db, { logActivity } from '@/lib/db';
import { getStorageDir } from '@/services/playwright/session';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getDirStats(dirPath: string): { count: number; sizeBytes: number } {
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

export async function GET() {
  try {
    const storageDir = getStorageDir();
    const screenshotsDir = path.join(/*turbopackIgnore: true*/ storageDir, 'screenshots');
    const videosDir = path.join(/*turbopackIgnore: true*/ storageDir, 'videos');

    const scStats = getDirStats(screenshotsDir);
    const vdStats = getDirStats(videosDir);
    const totalBytes = scStats.sizeBytes + vdStats.sizeBytes;

    return NextResponse.json({
      success: true,
      screenshots: {
        count: scStats.count,
        sizeBytes: scStats.sizeBytes,
        sizeFormatted: formatBytes(scStats.sizeBytes),
      },
      videos: {
        count: vdStats.count,
        sizeBytes: vdStats.sizeBytes,
        sizeFormatted: formatBytes(vdStats.sizeBytes),
      },
      totalCount: scStats.count + vdStats.count,
      totalSizeBytes: totalBytes,
      totalFormatted: formatBytes(totalBytes),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST() {
  try {
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
      db.prepare(`UPDATE reels SET screenshot_path = NULL, debug_video_path = NULL, tiktok_screenshot_path = NULL, tiktok_debug_video_path = NULL`).run();
    } catch {}

    const freedFormatted = formatBytes(freedBytes);
    logActivity(
      'SUCCESS',
      'CLEANUP',
      `Đã xóa toàn bộ ${deletedScreenshots} ảnh chụp màn hình và ${deletedVideos} video, giải phóng ${freedFormatted} dung lượng ổ cứng.`
    );

    return NextResponse.json({
      success: true,
      message: `Đã dọn dẹp thành công! Đã xóa ${deletedScreenshots} ảnh màn hình và ${deletedVideos} video (${freedFormatted}).`,
      deletedScreenshots,
      deletedVideos,
      freedBytes,
      freedFormatted,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logActivity('ERROR', 'CLEANUP', `Lỗi khi dọn dẹp screenshots/videos: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

