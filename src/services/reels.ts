import path from 'path';
import fs from 'fs';
import db, { logActivity, resolveHeadless, isTikTokAutoPostEnabled } from '@/lib/db';
import { uploadFacebookReel, PostReelResult } from '@/services/playwright/fb-reel';
import { uploadTikTokVideo, PostTikTokResult } from '@/services/playwright/tiktok-reel';
import { sendServerPushNotification } from './notifications';
import { ReelItem } from '@/types';

export function getReels(status?: string): ReelItem[] {
  let query = 'SELECT * FROM reels';
  const params: any[] = [];

  if (status && status !== 'all') {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const rows = db.prepare(query).all(...params) as ReelItem[];
  return rows;
}

export function getReelById(id: string): ReelItem | null {
  const row = db.prepare('SELECT * FROM reels WHERE id = ?').get(id) as ReelItem | undefined;
  return row || null;
}

export function createReel(data: {
  video_path: string;
  video_filename?: string | null;
  caption?: string;
  scheduled_at?: string | null;
  status?: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
}): ReelItem {
  const id = `reel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = data.status || (data.scheduled_at ? 'scheduled' : 'draft');
  const videoFilename = data.video_filename || path.basename(data.video_path);
  const caption = data.caption || '';
  const scheduledAt = data.scheduled_at || null;

  db.prepare(`
    INSERT INTO reels (id, video_path, video_filename, caption, status, scheduled_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(id, data.video_path, videoFilename, caption, status, scheduledAt);

  logActivity(
    'INFO',
    'CREATE_REEL',
    `Đã tạo Reel mới (${status === 'scheduled' ? `Đã lên lịch lúc ${scheduledAt}` : 'Bản thảo'}): ${videoFilename}`
  );

  return getReelById(id)!;
}

export function updateReel(
  id: string,
  data: Partial<Pick<ReelItem, 'caption' | 'scheduled_at' | 'status' | 'video_path' | 'video_filename' | 'fb_post_url' | 'screenshot_path' | 'debug_video_path'>>
): ReelItem | null {
  const current = getReelById(id);
  if (!current) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.caption !== undefined) {
    updates.push('caption = ?');
    values.push(data.caption);
  }
  if (data.scheduled_at !== undefined) {
    updates.push('scheduled_at = ?');
    values.push(data.scheduled_at);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.video_path !== undefined) {
    updates.push('video_path = ?');
    values.push(data.video_path);
  }
  if (data.video_filename !== undefined) {
    updates.push('video_filename = ?');
    values.push(data.video_filename);
  }
  if (data.fb_post_url !== undefined) {
    updates.push('fb_post_url = ?');
    values.push(data.fb_post_url);
  }
  if (data.screenshot_path !== undefined) {
    updates.push('screenshot_path = ?');
    values.push(data.screenshot_path);
  }
  if (data.debug_video_path !== undefined) {
    updates.push('debug_video_path = ?');
    values.push(data.debug_video_path);
  }

  if (updates.length > 0) {
    values.push(id);
    db.prepare(`UPDATE reels SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  return getReelById(id);
}

export function deleteReel(id: string): boolean {
  const reel = getReelById(id);
  if (!reel) return false;

  // Xóa file video nếu file nằm trong thư mục storage/videos
  const videosDir = path.resolve(process.cwd(), 'storage', 'videos');
  const screenshotsDir = path.resolve(process.cwd(), 'storage', 'screenshots');
  if (reel.video_path) {
    try {
      const resolvedPath = path.resolve(reel.video_path);
      if (resolvedPath.startsWith(videosDir) && fs.existsSync(resolvedPath)) {
        fs.unlinkSync(resolvedPath);
      }
    } catch (err: any) {
      console.error(`Không thể xóa file video ${reel.video_path}:`, err.message);
    }
  }

  // Xóa file video debug lỗi nếu có
  if (reel.debug_video_path) {
    try {
      const dbgPath = path.join(videosDir, path.basename(reel.debug_video_path));
      if (fs.existsSync(dbgPath)) fs.unlinkSync(dbgPath);
    } catch {}
  }

  // Xóa file ảnh chụp màn hình lỗi nếu có
  if (reel.screenshot_path) {
    try {
      const scPath = path.join(screenshotsDir, path.basename(reel.screenshot_path));
      if (fs.existsSync(scPath)) fs.unlinkSync(scPath);
    } catch {}
  }

  db.prepare('DELETE FROM reels WHERE id = ?').run(id);
  logActivity('INFO', 'DELETE_REEL', `Đã xóa Reel: ${id} (${reel.video_filename || 'video'})`);
  return true;
}

export async function publishReelById(
  id: string,
  options?: { headless?: boolean }
): Promise<PostReelResult> {
  const reel = getReelById(id);
  if (!reel) {
    return {
      success: false,
      message: 'Không tìm thấy Reel với ID: ' + id,
      filePath: '',
      error: 'Reel not found',
    };
  }

  // Atomically lock status to publishing to avoid double posting
  const lock = db.prepare(
    "UPDATE reels SET status = 'publishing', error_message = NULL WHERE id = ? AND status != 'publishing'"
  ).run(id);

  if (lock.changes === 0 && reel.status === 'publishing') {
    return {
      success: false,
      message: 'Reel đang trong quá trình xuất bản.',
      filePath: reel.video_path,
      error: 'Already publishing',
    };
  }

  logActivity('INFO', 'POST_REEL', `Bắt đầu xuất bản Reel [${id}]: ${reel.video_filename}`);

  const headless = resolveHeadless(options?.headless !== undefined ? options.headless : true);

  try {
    const result = await uploadFacebookReel({
      reelId: reel.id,
      filePath: reel.video_path,
      content: reel.caption || '',
      headless,
    });

    const videosDir = path.resolve(process.cwd(), 'storage', 'videos');
    const screenshotsDir = path.resolve(process.cwd(), 'storage', 'screenshots');

    if (result.success) {
      // Dọn dẹp video debug lỗi cũ nếu trước đó từng thất bại
      if (reel.debug_video_path) {
        try {
          const oldDbgPath = path.join(videosDir, path.basename(reel.debug_video_path));
          if (fs.existsSync(oldDbgPath)) fs.unlinkSync(oldDbgPath);
        } catch {}
      }
      if (reel.screenshot_path) {
        try {
          const oldScPath = path.join(screenshotsDir, path.basename(reel.screenshot_path));
          if (fs.existsSync(oldScPath)) fs.unlinkSync(oldScPath);
        } catch {}
      }

      db.prepare(`
        UPDATE reels
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            fb_post_url = ?,
            screenshot_path = NULL,
            debug_video_path = ?,
            error_message = NULL
        WHERE id = ?
      `).run(result.reelUrl || null, result.debugVideoPath || null, id);

      logActivity(
        'SUCCESS',
        'POST_REEL',
        result.reelUrl
          ? `Xuất bản Reel Facebook thành công: ${reel.video_filename} (Link: ${result.reelUrl})`
          : `Xuất bản Reel Facebook thành công: ${reel.video_filename}`
      );

      // Gửi push notification khi Reel Facebook xuất bản thành công
      await sendServerPushNotification({
        type: 'reel_fb',
        status: 'success',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Reel Facebook'),
        url: result.reelUrl,
      }).catch(() => { });

      // Đăng đồng bộ lên TikTok nếu được bật cấu hình
      if (isTikTokAutoPostEnabled()) {
        try {
          logActivity('INFO', 'POST_TIKTOK', `[TikTok] Bắt đầu đồng bộ đăng video lên TikTok cho Reel ${id}...`);
          db.prepare(`UPDATE reels SET tiktok_status = 'publishing' WHERE id = ?`).run(id);

          const ttResult = await uploadTikTokVideo({
            reelId: reel.id,
            filePath: reel.video_path,
            content: reel.caption || '',
            headless,
          });

          if (ttResult.success) {
            db.prepare(`
              UPDATE reels 
              SET tiktok_post_url = ?, 
                  tiktok_status = 'published', 
                  tiktok_debug_video_path = ?,
                  tiktok_screenshot_path = NULL,
                  tiktok_error_message = NULL 
              WHERE id = ?
            `).run(ttResult.tiktokUrl || null, ttResult.debugVideoPath || null, id);
            logActivity('SUCCESS', 'POST_TIKTOK', `[TikTok] Đã xuất bản video TikTok thành công: ${reel.video_filename} ${ttResult.tiktokUrl ? `(Link: ${ttResult.tiktokUrl})` : ''}`);

            // Gửi push notification khi video TikTok xuất bản thành công
            await sendServerPushNotification({
              type: 'reel_tiktok',
              status: 'success',
              title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
              url: ttResult.tiktokUrl,
            }).catch(() => { });
          } else {
            db.prepare(`
              UPDATE reels 
              SET tiktok_status = 'failed', 
                  tiktok_debug_video_path = ?,
                  tiktok_screenshot_path = ?,
                  tiktok_error_message = ? 
              WHERE id = ?
            `).run(ttResult.debugVideoPath || null, ttResult.screenshotPath || null, ttResult.error || ttResult.message, id);
            logActivity('WARN', 'POST_TIKTOK', `[TikTok] Đăng video lên TikTok thất bại: ${ttResult.error || ttResult.message}`);

            // Gửi push notification khi video TikTok thất bại
            await sendServerPushNotification({
              type: 'reel_tiktok',
              status: 'failed',
              title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
              error: ttResult.error || ttResult.message,
            }).catch(() => { });
          }
        } catch (ttErr: any) {
          const ttErrMsg = ttErr?.message || String(ttErr);
          db.prepare(`
            UPDATE reels 
            SET tiktok_status = 'failed', tiktok_error_message = ? 
            WHERE id = ?
          `).run(ttErrMsg, id);
          logActivity('WARN', 'POST_TIKTOK', `[TikTok] Lỗi ngoại lệ khi đăng lên TikTok: ${ttErrMsg}`);

          await sendServerPushNotification({
            type: 'reel_tiktok',
            status: 'failed',
            title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
            error: ttErrMsg,
          }).catch(() => { });
        }
      }

      return result;
    } else {
      const errorMsg = result.error || result.message;
      db.prepare(`
        UPDATE reels
        SET status = 'failed',
            error_message = ?,
            screenshot_path = ?,
            debug_video_path = ?
        WHERE id = ?
      `).run(errorMsg, result.screenshotPath || null, result.debugVideoPath || null, id);

      logActivity('ERROR', 'POST_REEL', `Xuất bản Reel thất bại: ${errorMsg}`);

      // Gửi push notification khi Reel Facebook thất bại
      await sendServerPushNotification({
        type: 'reel_fb',
        status: 'failed',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Reel Facebook'),
        error: errorMsg,
      }).catch(() => { });

      return result;
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    db.prepare(`
      UPDATE reels
      SET status = 'failed',
          error_message = ?
      WHERE id = ?
    `).run(errorMsg, id);

    logActivity('ERROR', 'POST_REEL', `Lỗi nghiêm trọng khi xuất bản Reel: ${errorMsg}`);
    return {
      success: false,
      message: 'Lỗi xuất bản: ' + errorMsg,
      filePath: reel.video_path,
      error: errorMsg,
    };
  }
}

/**
 * Xuất bản video Reel trực tiếp lên kênh TikTok
 */
export async function publishTikTokReelById(
  id: string,
  options?: { headless?: boolean }
): Promise<PostTikTokResult> {
  const reel = getReelById(id);
  if (!reel) {
    throw new Error(`Không tìm thấy Reel với ID: ${id}`);
  }

  logActivity('INFO', 'POST_TIKTOK', `Bắt đầu xuất bản video lên TikTok [${id}]: ${reel.video_filename}`);
  db.prepare(`UPDATE reels SET tiktok_status = 'publishing' WHERE id = ?`).run(id);

  const headless = resolveHeadless(options?.headless !== undefined ? options.headless : true);

  try {
    const result = await uploadTikTokVideo({
      reelId: reel.id,
      filePath: reel.video_path,
      content: reel.caption || '',
      headless,
    });

    if (result.success) {
      db.prepare(`
        UPDATE reels 
        SET tiktok_post_url = ?, 
            tiktok_status = 'published', 
            tiktok_debug_video_path = ?,
            tiktok_screenshot_path = NULL,
            tiktok_error_message = NULL 
        WHERE id = ?
      `).run(result.tiktokUrl || null, result.debugVideoPath || null, id);
      logActivity(
        'SUCCESS',
        'POST_TIKTOK',
        `Xuất bản video TikTok thành công: ${reel.video_filename} ${result.tiktokUrl ? `(Link: ${result.tiktokUrl})` : ''}`
      );

      // Gửi push notification khi video TikTok xuất bản thành công
      await sendServerPushNotification({
        type: 'reel_tiktok',
        status: 'success',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
        url: result.tiktokUrl,
      }).catch(() => { });

      return result;
    } else {
      const errorMsg = result.error || result.message;
      db.prepare(`
        UPDATE reels 
        SET tiktok_status = 'failed', 
            tiktok_debug_video_path = ?,
            tiktok_screenshot_path = ?,
            tiktok_error_message = ? 
        WHERE id = ?
      `).run(result.debugVideoPath || null, result.screenshotPath || null, errorMsg, id);
      logActivity('WARN', 'POST_TIKTOK', `Xuất bản video TikTok thất bại: ${errorMsg}`);

      // Gửi push notification khi video TikTok thất bại
      await sendServerPushNotification({
        type: 'reel_tiktok',
        status: 'failed',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
        error: errorMsg,
      }).catch(() => { });

      return result;
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    db.prepare(`
      UPDATE reels 
      SET tiktok_status = 'failed', tiktok_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);
    logActivity('ERROR', 'POST_TIKTOK', `Lỗi nghiêm trọng khi xuất bản TikTok: ${errorMsg}`);
    return {
      success: false,
      message: 'Lỗi xuất bản TikTok: ' + errorMsg,
      filePath: reel.video_path,
      error: errorMsg,
    };
  }
}

let isProcessingScheduledReels = false;

export async function processScheduledReels(): Promise<{
  processed: number;
  successful: number;
  failed: number;
}> {
  if (isProcessingScheduledReels) {
    return { processed: 0, successful: 0, failed: 0 };
  }

  isProcessingScheduledReels = true;
  let processed = 0;
  let successful = 0;
  let failed = 0;

  try {
    const scheduledReels = db.prepare(`
      SELECT * FROM reels
      WHERE status = 'scheduled'
      ORDER BY scheduled_at ASC, created_at ASC
    `).all() as ReelItem[];

    const now = Date.now();
    const dueReels = scheduledReels.filter((reel) => {
      if (!reel.scheduled_at) return true;
      const scheduledTime = new Date(reel.scheduled_at).getTime();
      return !isNaN(scheduledTime) && scheduledTime <= now;
    });

    if (dueReels.length === 0) {
      return { processed: 0, successful: 0, failed: 0 };
    }

    logActivity(
      'INFO',
      'SCHEDULE_REEL',
      `Phát hiện ${dueReels.length} Reel đã đến giờ hẹn đăng. Bắt đầu tự động xuất bản...`
    );

    for (let i = 0; i < dueReels.length; i++) {
      const reel = dueReels[i];
      // Atomic check & lock
      const lockRes = db.prepare(
        "UPDATE reels SET status = 'publishing' WHERE id = ? AND status = 'scheduled'"
      ).run(reel.id);

      if (lockRes.changes === 0) {
        // Was picked up by another process
        continue;
      }

      processed++;
      const result = await publishReelById(reel.id, { headless: true });
      if (result.success) {
        successful++;
      } else {
        failed++;
      }

      // Delay between posts to protect account from spam detection
      if (i < dueReels.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 20000));
      }
    }
  } catch (err: any) {
    console.error('[Reel Scheduler] Lỗi xử lý scheduled reels:', err);
  } finally {
    isProcessingScheduledReels = false;
  }

  return { processed, successful, failed };
}

// Background scheduler singleton in Node.js runtime
declare global {
  var __reelSchedulerStarted: boolean | undefined;
}

if (typeof window === 'undefined' && !globalThis.__reelSchedulerStarted) {
  globalThis.__reelSchedulerStarted = true;
  // Run check every 30 seconds
  setInterval(() => {
    processScheduledReels().catch((err) => {
      console.error('[Reel Scheduler Loop Error]', err);
    });
  }, 30 * 1000);
}

