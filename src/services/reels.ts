import path from 'path';
import fs from 'fs';
import db, { logActivity, resolveHeadless } from '@/lib/db';
import { uploadFacebookReel, commentFacebookReelOnly, PostReelResult } from '@/services/playwright/fb-reel';
import { uploadTikTokVideo, commentTikTokVideoOnly, PostTikTokResult } from '@/services/playwright/tiktok-reel';
import { uploadYouTubeShortVideo, commentYouTubeVideoOnly, PostYouTubeResult } from '@/services/playwright/youtube-reel';
import { uploadZaloVideo, commentZaloVideoOnly, PostZaloResult } from '@/services/playwright/zalo-reel';
import { checkFacebookLoginStatus } from '@/services/playwright/session';
import { checkTikTokLoginStatus } from '@/services/playwright/tiktok-session';
import { checkYouTubeLoginStatus } from '@/services/playwright/youtube-session';
import { checkZaloLoginStatus } from '@/services/playwright/zalo-session';
import { isTikTokAutoPostEnabled, isYouTubeAutoPostEnabled, isZaloAutoPostEnabled } from '@/lib/db';
import { sendServerPushNotification } from './notifications';
import { convertCommentLinks } from '@/lib/link-redirect';
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
  comment_content?: string | null;
  scheduled_at?: string | null;
  status?: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
}): ReelItem {
  const id = `reel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const status = data.status || (data.scheduled_at ? 'scheduled' : 'draft');
  const videoFilename = data.video_filename || path.basename(data.video_path);
  const caption = data.caption || '';
  const commentContent = data.comment_content ? convertCommentLinks(data.comment_content) : null;
  const commentStatus = commentContent ? 'idle' : null;
  const scheduledAt = data.scheduled_at || null;

  db.prepare(`
    INSERT INTO reels (id, video_path, video_filename, caption, comment_content, comment_status, status, scheduled_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(id, data.video_path, videoFilename, caption, commentContent, commentStatus, status, scheduledAt);

  logActivity(
    'INFO',
    'CREATE_REEL',
    `Đã tạo Reel mới (${status === 'scheduled' ? `Đã lên lịch lúc ${scheduledAt}` : 'Bản thảo'}): ${videoFilename}`
  );

  return getReelById(id)!;
}

export function updateReel(
  id: string,
  data: Partial<Pick<ReelItem, 'caption' | 'comment_content' | 'comment_status' | 'scheduled_at' | 'status' | 'video_path' | 'video_filename' | 'fb_post_url' | 'tiktok_post_url' | 'tiktok_status' | 'tiktok_comment_status' | 'youtube_post_url' | 'youtube_status' | 'youtube_comment_status' | 'zalo_post_url' | 'zalo_status' | 'zalo_comment_status' | 'published_at' | 'error_message' | 'tiktok_error_message' | 'youtube_error_message' | 'zalo_error_message' | 'screenshot_path' | 'tiktok_screenshot_path' | 'youtube_screenshot_path' | 'zalo_screenshot_path' | 'debug_video_path' | 'tiktok_debug_video_path' | 'youtube_debug_video_path' | 'zalo_debug_video_path'>>
): ReelItem | null {
  const current = getReelById(id);
  if (!current) return null;

  const updates: string[] = [];
  const values: any[] = [];

  if (data.caption !== undefined) {
    updates.push('caption = ?');
    values.push(data.caption);
  }
  if (data.comment_content !== undefined) {
    updates.push('comment_content = ?');
    values.push(data.comment_content ? convertCommentLinks(data.comment_content) : null);
  }
  if (data.comment_status !== undefined) {
    updates.push('comment_status = ?');
    values.push(data.comment_status);
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
    if (data.fb_post_url !== current.fb_post_url) {
      logActivity('INFO', 'UPDATE_REEL_LINK', `Đã cập nhật thủ công link Facebook Reel [${id}]: ${data.fb_post_url || '(Đã xóa link)'}`);
    }
  }
  if (data.tiktok_post_url !== undefined) {
    updates.push('tiktok_post_url = ?');
    values.push(data.tiktok_post_url);
    if (data.tiktok_post_url !== current.tiktok_post_url) {
      logActivity('INFO', 'UPDATE_REEL_LINK', `Đã cập nhật thủ công link TikTok [${id}]: ${data.tiktok_post_url || '(Đã xóa link)'}`);
    }
  }
  if (data.tiktok_status !== undefined) {
    updates.push('tiktok_status = ?');
    values.push(data.tiktok_status);
  }
  if (data.tiktok_comment_status !== undefined) {
    updates.push('tiktok_comment_status = ?');
    values.push(data.tiktok_comment_status);
  }
  if (data.youtube_post_url !== undefined) {
    updates.push('youtube_post_url = ?');
    values.push(data.youtube_post_url);
    if (data.youtube_post_url !== current.youtube_post_url) {
      logActivity('INFO', 'UPDATE_REEL_LINK', `Đã cập nhật thủ công link YouTube Shorts [${id}]: ${data.youtube_post_url || '(Đã xóa link)'}`);
    }
  }
  if (data.youtube_status !== undefined) {
    updates.push('youtube_status = ?');
    values.push(data.youtube_status);
  }
  if (data.youtube_comment_status !== undefined) {
    updates.push('youtube_comment_status = ?');
    values.push(data.youtube_comment_status);
  }
  if (data.zalo_post_url !== undefined) {
    updates.push('zalo_post_url = ?');
    values.push(data.zalo_post_url);
    if (data.zalo_post_url !== current.zalo_post_url) {
      logActivity('INFO', 'UPDATE_REEL_LINK', `Đã cập nhật thủ công link Zalo Video [${id}]: ${data.zalo_post_url || '(Đã xóa link)'}`);
    }
  }
  if (data.zalo_status !== undefined) {
    updates.push('zalo_status = ?');
    values.push(data.zalo_status);
  }
  if (data.zalo_comment_status !== undefined) {
    updates.push('zalo_comment_status = ?');
    values.push(data.zalo_comment_status);
  }
  if (data.published_at !== undefined) {
    updates.push('published_at = ?');
    values.push(data.published_at);
  }
  if (data.error_message !== undefined) {
    updates.push('error_message = ?');
    values.push(data.error_message);
  }
  if (data.tiktok_error_message !== undefined) {
    updates.push('tiktok_error_message = ?');
    values.push(data.tiktok_error_message);
  }
  if (data.youtube_error_message !== undefined) {
    updates.push('youtube_error_message = ?');
    values.push(data.youtube_error_message);
  }
  if (data.zalo_error_message !== undefined) {
    updates.push('zalo_error_message = ?');
    values.push(data.zalo_error_message);
  }
  if (data.screenshot_path !== undefined) {
    updates.push('screenshot_path = ?');
    values.push(data.screenshot_path);
  }
  if (data.tiktok_screenshot_path !== undefined) {
    updates.push('tiktok_screenshot_path = ?');
    values.push(data.tiktok_screenshot_path);
  }
  if (data.youtube_screenshot_path !== undefined) {
    updates.push('youtube_screenshot_path = ?');
    values.push(data.youtube_screenshot_path);
  }
  if (data.zalo_screenshot_path !== undefined) {
    updates.push('zalo_screenshot_path = ?');
    values.push(data.zalo_screenshot_path);
  }
  if (data.debug_video_path !== undefined) {
    updates.push('debug_video_path = ?');
    values.push(data.debug_video_path);
  }
  if (data.tiktok_debug_video_path !== undefined) {
    updates.push('tiktok_debug_video_path = ?');
    values.push(data.tiktok_debug_video_path);
  }
  if (data.youtube_debug_video_path !== undefined) {
    updates.push('youtube_debug_video_path = ?');
    values.push(data.youtube_debug_video_path);
  }
  if (data.zalo_debug_video_path !== undefined) {
    updates.push('zalo_debug_video_path = ?');
    values.push(data.zalo_debug_video_path);
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
  const videosDir = path.resolve(process.cwd(), 'storage', 'videos');
  const screenshotsDir = path.resolve(process.cwd(), 'storage', 'screenshots');

  // ==========================================
  // BƯỚC 1: XUẤT BẢN LÊN FACEBOOK REEL
  // ==========================================
  let fbResult: PostReelResult;
  const fbStatus = await checkFacebookLoginStatus();

  if (!fbStatus.loggedIn) {
    const errorMsg = fbStatus.message || 'Chưa kết nối tài khoản Facebook (storage/fb-session.json)';
    db.prepare(`
      UPDATE reels
      SET status = 'failed',
          error_message = ?
      WHERE id = ?
    `).run(errorMsg, id);

    logActivity('WARN', 'POST_REEL', `[FB] Bỏ qua đăng Facebook cho Reel [${id}]: ${errorMsg}`);
    await sendServerPushNotification({
      type: 'reel_fb',
      status: 'failed',
      title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Reel Facebook'),
      error: errorMsg,
    }).catch(() => { });

    fbResult = {
      success: false,
      message: errorMsg,
      filePath: reel.video_path,
      error: errorMsg,
    };
  } else {
    try {
      fbResult = await uploadFacebookReel({
        reelId: reel.id,
        filePath: reel.video_path,
        content: reel.caption || '',
        comment: reel.comment_content || '',
        headless,
      });

      if (fbResult.success) {
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

        const commentStatus = reel.comment_content
          ? (fbResult.commentSuccess ? 'commented' : 'failed')
          : (reel.comment_status || 'idle');

        db.prepare(`
          UPDATE reels
          SET status = 'published',
              published_at = CURRENT_TIMESTAMP,
              fb_post_url = ?,
              comment_status = ?,
              screenshot_path = NULL,
              debug_video_path = ?,
              error_message = NULL
          WHERE id = ?
        `).run(fbResult.reelUrl || null, commentStatus, fbResult.debugVideoPath || null, id);

        logActivity(
          'SUCCESS',
          'POST_REEL',
          fbResult.reelUrl
            ? `Xuất bản Reel Facebook thành công: ${reel.video_filename} (Link: ${fbResult.reelUrl})`
            : `Xuất bản Reel Facebook thành công: ${reel.video_filename}`
        );

        // Gửi push notification khi Reel Facebook xuất bản thành công
        await sendServerPushNotification({
          type: 'reel_fb',
          status: 'success',
          title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Reel Facebook'),
          url: fbResult.reelUrl,
        }).catch(() => { });
      } else {
        const errorMsg = fbResult.error || fbResult.message;
        db.prepare(`
          UPDATE reels
          SET status = 'failed',
              error_message = ?,
              screenshot_path = ?,
              debug_video_path = ?
          WHERE id = ?
        `).run(errorMsg, fbResult.screenshotPath || null, fbResult.debugVideoPath || null, id);

        logActivity('ERROR', 'POST_REEL', `Xuất bản Reel Facebook thất bại: ${errorMsg}`);

        // Gửi push notification khi Reel Facebook thất bại
        await sendServerPushNotification({
          type: 'reel_fb',
          status: 'failed',
          title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Reel Facebook'),
          error: errorMsg,
        }).catch(() => { });
      }
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      db.prepare(`
        UPDATE reels
        SET status = 'failed',
            error_message = ?
        WHERE id = ?
      `).run(errorMsg, id);

      logActivity('ERROR', 'POST_REEL', `Lỗi nghiêm trọng khi xuất bản Facebook Reel: ${errorMsg}`);
      fbResult = {
        success: false,
        message: 'Lỗi xuất bản: ' + errorMsg,
        filePath: reel.video_path,
        error: errorMsg,
      };
    }
  }

  // ==========================================
  // BƯỚC 2: XUẤT BẢN LÊN TIKTOK THEO THỨ TỰ
  // (Độc lập, không phụ thuộc vào kết quả Facebook)
  // ==========================================
  if (isTikTokAutoPostEnabled()) {
    try {
      logActivity('INFO', 'POST_TIKTOK', `[TikTok] Bắt đầu đồng bộ đăng video lên TikTok cho Reel ${id}...`);
      await publishTikTokReelById(id, { headless });
    } catch (ttErr: any) {
      const ttErrMsg = ttErr?.message || String(ttErr);
      logActivity('WARN', 'POST_TIKTOK', `[TikTok] Lỗi ngoại lệ khi đồng bộ TikTok: ${ttErrMsg}`);
    }
  }

  // ==========================================
  // BƯỚC 3: XUẤT BẢN LÊN YOUTUBE SHORTS THEO THỨ TỰ
  // (Độc lập, không phụ thuộc vào kết quả Facebook hay TikTok)
  // ==========================================
  if (isYouTubeAutoPostEnabled()) {
    try {
      logActivity('INFO', 'POST_YOUTUBE_SHORTS', `[YouTube] Bắt đầu đồng bộ đăng video Shorts cho Reel ${id}...`);
      await publishYouTubeReelById(id, { headless });
    } catch (ytErr: any) {
      const ytErrMsg = ytErr?.message || String(ytErr);
      logActivity('WARN', 'POST_YOUTUBE_SHORTS', `[YouTube] Lỗi ngoại lệ khi đồng bộ YouTube Shorts: ${ytErrMsg}`);
    }
  }

  // ==========================================
  // BƯỚC 4: XUẤT BẢN LÊN ZALO VIDEO THEO THỨ TỰ
  // (Độc lập, không phụ thuộc vào kết quả Facebook, TikTok hay YouTube)
  // ==========================================
  if (isZaloAutoPostEnabled()) {
    try {
      logActivity('INFO', 'POST_ZALO_VIDEO', `[Zalo Video] Bắt đầu đồng bộ đăng video lên Zalo cho Reel ${id}...`);
      await publishZaloReelById(id, { headless });
    } catch (zlErr: any) {
      const zlErrMsg = zlErr?.message || String(zlErr);
      logActivity('WARN', 'POST_ZALO_VIDEO', `[Zalo Video] Lỗi ngoại lệ khi đồng bộ Zalo Video: ${zlErrMsg}`);
    }
  }

  return fbResult;
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

  // Kiểm tra kết nối tài khoản TikTok trước khi post
  const ttStatus = await checkTikTokLoginStatus();
  if (!ttStatus.loggedIn) {
    const errorMsg = ttStatus.message || 'Chưa kết nối tài khoản TikTok (storage/tiktok-session.json)';
    db.prepare(`
      UPDATE reels 
      SET tiktok_status = 'failed', 
          tiktok_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);

    logActivity('WARN', 'POST_TIKTOK', `[TikTok] Bỏ qua đăng TikTok [${id}]: ${errorMsg}`);
    await sendServerPushNotification({
      type: 'reel_tiktok',
      status: 'failed',
      title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Video TikTok'),
      error: errorMsg,
    }).catch(() => { });

    return {
      success: false,
      message: errorMsg,
      filePath: reel.video_path,
      error: errorMsg,
    };
  }

  logActivity('INFO', 'POST_TIKTOK', `Bắt đầu xuất bản video lên TikTok [${id}]: ${reel.video_filename}`);
  db.prepare(`UPDATE reels SET tiktok_status = 'publishing' WHERE id = ?`).run(id);

  const headless = resolveHeadless(options?.headless !== undefined ? options.headless : true);

  try {
    const result = await uploadTikTokVideo({
      reelId: reel.id,
      filePath: reel.video_path,
      content: reel.caption || '',
      comment: reel.comment_content || '',
      headless,
    });

    if (result.success) {
      const ttCommentStatus = reel.comment_content
        ? (result.commentSuccess ? 'commented' : 'failed')
        : (reel.tiktok_comment_status || 'idle');

      const ttErrorMsg = result.commentSuccess === false && result.commentError
        ? `Lỗi bình luận: ${result.commentError}`
        : null;

      db.prepare(`
        UPDATE reels 
        SET tiktok_post_url = ?, 
            tiktok_status = 'published', 
            tiktok_comment_status = ?,
            tiktok_debug_video_path = ?,
            tiktok_screenshot_path = ?,
            tiktok_error_message = ? 
        WHERE id = ?
      `).run(
        result.tiktokUrl || null,
        ttCommentStatus,
        result.debugVideoPath || null,
        result.screenshotPath || null,
        ttErrorMsg,
        id
      );
      logActivity(
        'SUCCESS',
        'POST_TIKTOK',
        `Xuất bản video TikTok thành công: ${reel.video_filename} ${result.tiktokUrl ? `(Link: ${result.tiktokUrl})` : ''}${result.commentSuccess === false ? ` [Bình luận thất bại: ${result.commentError || 'Không rõ lỗi'}]` : ''}`
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
            tiktok_post_url = COALESCE(?, tiktok_post_url),
            tiktok_debug_video_path = ?,
            tiktok_screenshot_path = ?,
            tiktok_error_message = ? 
        WHERE id = ?
      `).run(result.tiktokUrl || null, result.debugVideoPath || null, result.screenshotPath || null, errorMsg, id);
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

export async function publishYouTubeReelById(
  id: string,
  options?: { headless?: boolean }
): Promise<PostYouTubeResult> {
  const reel = getReelById(id);
  if (!reel) {
    return {
      success: false,
      message: 'Không tìm thấy Reel với ID: ' + id,
    };
  }

  if (!fs.existsSync(reel.video_path)) {
    const altPath = path.join(process.cwd(), 'storage', 'videos', path.basename(reel.video_path));
    if (!fs.existsSync(altPath)) {
      return {
        success: false,
        message: `Không tìm thấy file video: ${reel.video_path}. Vui lòng kiểm tra lại đường dẫn file trên máy chủ.`,
      };
    }
  }

  // Kiểm tra kết nối tài khoản Google / YouTube Studio trước khi post
  const ytStatus = await checkYouTubeLoginStatus();
  if (!ytStatus.loggedIn) {
    const errorMsg = ytStatus.message || 'Chưa kết nối tài khoản Google/YouTube Studio';
    db.prepare(`
      UPDATE reels 
      SET youtube_status = 'failed', 
          youtube_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);

    logActivity('WARN', 'POST_YOUTUBE_SHORTS', `[YouTube] Bỏ qua đăng YouTube Shorts [${id}]: ${errorMsg}`);
    await sendServerPushNotification({
      type: 'reel_youtube' as any,
      status: 'failed',
      title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'YouTube Shorts'),
      error: errorMsg,
    }).catch(() => { });

    return {
      success: false,
      message: errorMsg,
      error: errorMsg,
    };
  }

  logActivity('INFO', 'POST_YOUTUBE_SHORTS', `Bắt đầu xuất bản thủ công YouTube Shorts cho Reel: ${id} (${reel.video_filename || 'video'})...`);
  db.prepare(`UPDATE reels SET youtube_status = 'publishing' WHERE id = ?`).run(id);

  const headless = resolveHeadless(options?.headless !== undefined ? options.headless : true);

  try {
    const result = await uploadYouTubeShortVideo({
      reelId: reel.id,
      filePath: reel.video_path,
      content: reel.caption || '',
      comment: reel.comment_content || '',
      scheduledAt: reel.scheduled_at,
      headless,
    });

    if (result.success) {
      const ytCommentStatus = reel.comment_content
        ? (result.commentSuccess ? 'commented' : 'failed')
        : (reel.youtube_comment_status || 'idle');

      db.prepare(`
        UPDATE reels 
        SET youtube_post_url = ?, 
            youtube_status = 'published', 
            youtube_comment_status = ?,
            youtube_debug_video_path = ?,
            youtube_screenshot_path = ?,
            youtube_error_message = NULL 
        WHERE id = ?
      `).run(
        result.youtubeUrl || null,
        ytCommentStatus,
        result.debugVideoPath || null,
        result.screenshotPath || null,
        id
      );
      logActivity(
        'SUCCESS',
        'POST_YOUTUBE_SHORTS',
        `Xuất bản video YouTube Shorts thành công: ${reel.video_filename} ${result.youtubeUrl ? `(Link: ${result.youtubeUrl})` : ''}`
      );

      await sendServerPushNotification({
        type: 'reel_youtube' as any,
        status: 'success',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'YouTube Shorts'),
        url: result.youtubeUrl,
      }).catch(() => { });

      return result;
    } else {
      const errorMsg = result.error || result.message;
      db.prepare(`
        UPDATE reels 
        SET youtube_status = 'failed', 
            youtube_post_url = COALESCE(?, youtube_post_url),
            youtube_debug_video_path = ?,
            youtube_screenshot_path = ?,
            youtube_error_message = ? 
        WHERE id = ?
      `).run(result.youtubeUrl || null, result.debugVideoPath || null, result.screenshotPath || null, errorMsg, id);
      logActivity('WARN', 'POST_YOUTUBE_SHORTS', `Xuất bản video YouTube Shorts thất bại: ${errorMsg}`);

      await sendServerPushNotification({
        type: 'reel_youtube' as any,
        status: 'failed',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'YouTube Shorts'),
        error: errorMsg,
      }).catch(() => { });

      return result;
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    db.prepare(`
      UPDATE reels 
      SET youtube_status = 'failed', youtube_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);
    logActivity('ERROR', 'POST_YOUTUBE_SHORTS', `Lỗi nghiêm trọng khi xuất bản YouTube Shorts: ${errorMsg}`);
    return {
      success: false,
      message: 'Lỗi xuất bản YouTube Shorts: ' + errorMsg,
      error: errorMsg,
    };
  }
}

/**
 * Xuất bản video Reel trực tiếp lên Zalo Video Creator
 */
export async function publishZaloReelById(
  id: string,
  options?: { headless?: boolean }
): Promise<PostZaloResult> {
  const reel = getReelById(id);
  if (!reel) {
    throw new Error(`Không tìm thấy Reel với ID: ${id}`);
  }

  // Kiểm tra kết nối tài khoản Zalo Video trước khi post
  const zlStatus = await checkZaloLoginStatus();
  if (!zlStatus.loggedIn) {
    const errorMsg = zlStatus.message || 'Chưa kết nối tài khoản Zalo Video Creator';
    db.prepare(`
      UPDATE reels 
      SET zalo_status = 'failed', 
          zalo_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);

    logActivity('WARN', 'POST_ZALO_VIDEO', `[Zalo Video] Bỏ qua đăng Zalo Video [${id}]: ${errorMsg}`);
    await sendServerPushNotification({
      type: 'reel_zalo' as any,
      status: 'failed',
      title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Zalo Video'),
      error: errorMsg,
    }).catch(() => { });

    return {
      success: false,
      message: errorMsg,
      error: errorMsg,
    };
  }

  logActivity('INFO', 'POST_ZALO_VIDEO', `Bắt đầu xuất bản thủ công Zalo Video cho Reel: ${id} (${reel.video_filename || 'video'})...`);
  db.prepare(`UPDATE reels SET zalo_status = 'publishing' WHERE id = ?`).run(id);

  const headless = resolveHeadless(options?.headless !== undefined ? options.headless : true);

  try {
    const result = await uploadZaloVideo({
      reelId: reel.id,
      filePath: reel.video_path,
      content: reel.caption || '',
      comment: reel.comment_content || '',
      headless,
    });

    if (result.success) {
      const zlCommentStatus = reel.comment_content
        ? (result.commentSuccess ? 'commented' : 'failed')
        : (reel.zalo_comment_status || 'idle');

      db.prepare(`
        UPDATE reels 
        SET zalo_post_url = ?, 
            zalo_status = 'published', 
            zalo_comment_status = ?,
            zalo_debug_video_path = ?,
            zalo_screenshot_path = ?,
            zalo_error_message = NULL 
        WHERE id = ?
      `).run(
        result.zaloUrl || null,
        zlCommentStatus,
        result.debugVideoPath || null,
        result.screenshotPath || null,
        id
      );
      logActivity(
        'SUCCESS',
        'POST_ZALO_VIDEO',
        `Xuất bản video Zalo Video thành công: ${reel.video_filename} ${result.zaloUrl ? `(Link: ${result.zaloUrl})` : ''}`
      );

      await sendServerPushNotification({
        type: 'reel_zalo' as any,
        status: 'success',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Zalo Video'),
        url: result.zaloUrl,
      }).catch(() => { });

      return result;
    } else {
      const errorMsg = result.error || result.message;
      db.prepare(`
        UPDATE reels 
        SET zalo_status = 'failed', 
            zalo_post_url = COALESCE(?, zalo_post_url),
            zalo_debug_video_path = ?,
            zalo_screenshot_path = ?,
            zalo_error_message = ? 
        WHERE id = ?
      `).run(result.zaloUrl || null, result.debugVideoPath || null, result.screenshotPath || null, errorMsg, id);
      logActivity('WARN', 'POST_ZALO_VIDEO', `Xuất bản video Zalo Video thất bại: ${errorMsg}`);

      await sendServerPushNotification({
        type: 'reel_zalo' as any,
        status: 'failed',
        title: reel.caption ? reel.caption.slice(0, 100) : (reel.video_filename || 'Zalo Video'),
        error: errorMsg,
      }).catch(() => { });

      return result;
    }
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    db.prepare(`
      UPDATE reels 
      SET zalo_status = 'failed', zalo_error_message = ? 
      WHERE id = ?
    `).run(errorMsg, id);
    logActivity('ERROR', 'POST_ZALO_VIDEO', `Lỗi nghiêm trọng khi xuất bản Zalo Video: ${errorMsg}`);
    return {
      success: false,
      message: 'Lỗi xuất bản Zalo Video: ' + errorMsg,
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

export type ReelPlatform = 'facebook' | 'tiktok' | 'youtube' | 'zalo';

interface PlatformCommentDef {
  name: string;
  logTag: string;
  getUrl: (reel: ReelItem) => string | null | undefined;
  noUrlMessage: string;
  runComment: (url: string, comment: string) => Promise<{
    success: boolean;
    message?: string;
    error?: string;
    debugVideoPath?: string | null;
    screenshotPath?: string | null;
    realReelUrl?: string | null;
  }>;
  onSuccess: (reelId: string, comment: string, res: any) => void;
  onFailure: (reelId: string, res: any) => void;
  successMessage: string;
}

const PLATFORM_COMMENT_MAP: Record<ReelPlatform, PlatformCommentDef> = {
  facebook: {
    name: 'Facebook Reel',
    logTag: 'COMMENT',
    getUrl: (r) => r.fb_post_url,
    noUrlMessage: 'Reel chưa có liên kết Facebook để bình luận',
    runComment: (url, comment) => commentFacebookReelOnly({ reelUrl: url, comment }),
    onSuccess: (id, comment, res) => {
      db.prepare(`
        UPDATE reels
        SET comment_content = ?,
            comment_status = 'commented',
            fb_post_url = COALESCE(?, fb_post_url)
        WHERE id = ?
      `).run(comment, res.realReelUrl || null, id);
    },
    onFailure: (id) => {
      db.prepare(`UPDATE reels SET comment_status = 'failed' WHERE id = ?`).run(id);
    },
    successMessage: 'Đã gửi bình luận thành công cho Reel Facebook!',
  },
  tiktok: {
    name: 'TikTok',
    logTag: 'COMMENT_TIKTOK',
    getUrl: (r) => r.tiktok_post_url,
    noUrlMessage: 'Video chưa có liên kết TikTok để bình luận',
    runComment: (url, comment) => commentTikTokVideoOnly(url, comment),
    onSuccess: (id, comment, res) => {
      db.prepare(`
        UPDATE reels
        SET comment_content = ?,
            tiktok_comment_status = 'commented',
            tiktok_debug_video_path = COALESCE(?, tiktok_debug_video_path)
        WHERE id = ?
      `).run(comment, res.debugVideoPath || null, id);
    },
    onFailure: (id, res) => {
      db.prepare(`
        UPDATE reels 
        SET tiktok_comment_status = 'failed',
            tiktok_debug_video_path = COALESCE(?, tiktok_debug_video_path),
            tiktok_screenshot_path = COALESCE(?, tiktok_screenshot_path),
            tiktok_error_message = ?
        WHERE id = ?
      `).run(res.debugVideoPath || null, res.screenshotPath || null, res.error || res.message, id);
    },
    successMessage: 'Đã gửi bình luận thành công cho video TikTok!',
  },
  youtube: {
    name: 'YouTube Shorts',
    logTag: 'COMMENT_YOUTUBE',
    getUrl: (r) => r.youtube_post_url,
    noUrlMessage: 'Video chưa có liên kết YouTube để bình luận',
    runComment: (url, comment) => commentYouTubeVideoOnly(url, comment),
    onSuccess: (id, comment, res) => {
      db.prepare(`
        UPDATE reels
        SET comment_content = ?,
            youtube_comment_status = 'commented',
            youtube_debug_video_path = COALESCE(?, youtube_debug_video_path)
        WHERE id = ?
      `).run(comment, res.debugVideoPath || null, id);
    },
    onFailure: (id, res) => {
      db.prepare(`
        UPDATE reels 
        SET youtube_comment_status = 'failed',
            youtube_debug_video_path = COALESCE(?, youtube_debug_video_path),
            youtube_screenshot_path = COALESCE(?, youtube_screenshot_path),
            youtube_error_message = ?
        WHERE id = ?
      `).run(res.debugVideoPath || null, res.screenshotPath || null, res.error || res.message, id);
    },
    successMessage: 'Đã gửi bình luận thành công cho video YouTube Shorts!',
  },
  zalo: {
    name: 'Zalo Video',
    logTag: 'COMMENT_ZALO',
    getUrl: (r) => r.zalo_post_url,
    noUrlMessage: 'Video chưa có liên kết Zalo để bình luận',
    runComment: (url, comment) => commentZaloVideoOnly(url, comment),
    onSuccess: (id, comment, res) => {
      db.prepare(`
        UPDATE reels
        SET comment_content = ?,
            zalo_comment_status = 'commented',
            zalo_debug_video_path = COALESCE(?, zalo_debug_video_path)
        WHERE id = ?
      `).run(comment, res.debugVideoPath || null, id);
    },
    onFailure: (id, res) => {
      db.prepare(`
        UPDATE reels 
        SET zalo_comment_status = 'failed',
            zalo_debug_video_path = COALESCE(?, zalo_debug_video_path),
            zalo_screenshot_path = COALESCE(?, zalo_screenshot_path),
            zalo_error_message = ?
        WHERE id = ?
      `).run(res.debugVideoPath || null, res.screenshotPath || null, res.error || res.message, id);
    },
    successMessage: 'Đã gửi bình luận thành công cho video Zalo Video!',
  },
};

/**
 * Thực hiện bình luận thủ công hoặc chạy lại bình luận cho một nền tảng video bất kỳ
 */
export async function postCommentToPlatform(
  platform: ReelPlatform,
  id: string,
  customComment?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  const config = PLATFORM_COMMENT_MAP[platform];
  if (!config) {
    return { success: false, message: `Nền tảng không hỗ trợ: ${platform}` };
  }

  const reel = getReelById(id);
  if (!reel) {
    return { success: false, message: 'Reel không tồn tại' };
  }

  const rawComment = customComment || reel.comment_content;
  if (!rawComment) {
    return { success: false, message: 'Reel chưa có nội dung bình luận' };
  }
  const commentToPost = convertCommentLinks(rawComment);

  const targetUrl = config.getUrl(reel);
  if (!targetUrl) {
    return { success: false, message: config.noUrlMessage };
  }

  const result = await config.runComment(targetUrl, commentToPost);

  if (result.success) {
    config.onSuccess(id, commentToPost, result);
    logActivity('SUCCESS', config.logTag, `Bình luận thành công cho ${config.name} [${id}]: ${commentToPost}`);
    return { success: true, message: config.successMessage };
  } else {
    config.onFailure(id, result);
    logActivity('WARN', config.logTag, `Bình luận cho ${config.name} [${id}] thất bại: ${result.error || result.message}`);
    return { success: false, message: result.message || result.error || 'Bình luận thất bại', error: result.error };
  }
}

/**
 * Thực hiện bình luận thủ công hoặc chạy lại bình luận cho Reel đã xuất bản
 */
export async function postCommentToReel(
  id: string,
  customComment?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return postCommentToPlatform('facebook', id, customComment);
}

/**
 * Thực hiện bình luận thủ công hoặc chạy lại bình luận cho video TikTok
 */
export async function postCommentToTikTokReel(
  id: string,
  customComment?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return postCommentToPlatform('tiktok', id, customComment);
}

/**
 * Thực hiện bình luận thủ công hoặc chạy lại bình luận cho video YouTube Shorts
 */
export async function postCommentToYouTubeReel(
  id: string,
  customComment?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return postCommentToPlatform('youtube', id, customComment);
}

/**
 * Thực hiện bình luận thủ công hoặc chạy lại bình luận cho video Zalo Video
 */
export async function postCommentToZaloReel(
  id: string,
  customComment?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return postCommentToPlatform('zalo', id, customComment);
}

/**
 * Gửi bình luận đến tất cả các nền tảng đã có liên kết bài đăng của Reel
 */
export async function postCommentToAllPlatforms(
  id: string,
  customComment?: string
): Promise<{
  facebook?: { success: boolean; message: string; error?: string };
  tiktok?: { success: boolean; message: string; error?: string };
  youtube?: { success: boolean; message: string; error?: string };
  zalo?: { success: boolean; message: string; error?: string };
}> {
  const reel = getReelById(id);
  if (!reel) {
    throw new Error('Reel không tồn tại');
  }

  const results: any = {};
  if (reel.fb_post_url) {
    results.facebook = await postCommentToPlatform('facebook', id, customComment);
  }
  if (reel.tiktok_post_url) {
    results.tiktok = await postCommentToPlatform('tiktok', id, customComment);
  }
  if (reel.youtube_post_url) {
    results.youtube = await postCommentToPlatform('youtube', id, customComment);
  }
  if (reel.zalo_post_url) {
    results.zalo = await postCommentToPlatform('zalo', id, customComment);
  }
  return results;
}

export { cleanOldReelsStorage } from './storage-cleanup';

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

