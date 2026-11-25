import db, {
  logActivity,
  isFbReelAutoPostEnabled,
  isTikTokAutoPostEnabled,
  isYouTubeAutoPostEnabled,
  isZaloAutoPostEnabled,
} from '@/lib/db';
import { TrendItem } from '@/types';
import { renderTrendVideo } from './video-renderer';
import {
  publishReelById,
  publishTikTokReelById,
  publishYouTubeReelById,
  publishZaloReelById,
  getReelById,
} from '../reels';

/**
 * Tự động tạo Video 9:16 và xuất bản lên các mạng xã hội đã kích hoạt
 * (Facebook Reels, YouTube Shorts, TikTok, Zalo Video)
 * sau khi bài viết được xuất bản thành công.
 */
export async function handleAutoVideoGenerationAndPublishing(
  trendId: string | number,
  options: { headless?: boolean } = {}
): Promise<{ success: boolean; reelId?: string; videoPath?: string; error?: string }> {
  try {
    const trendRow = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId) as any;
    if (!trendRow) {
      logActivity('WARN', 'AUTO_VIDEO', `Không tìm thấy xu hướng có ID: ${trendId} để tạo video.`);
      return { success: false, error: 'Trend not found' };
    }

    const trend: TrendItem = {
      ...trendRow,
      articles: trendRow.articles_json ? JSON.parse(trendRow.articles_json) : [],
    };

    logActivity(
      'INFO',
      'AUTO_VIDEO',
      `[Tự động tạo & đăng Video] Bắt đầu xử lý cho xu hướng: "${trend.title}"...`
    );

    // 1. Render Video 9:16 (tự động tóm tắt 3-7 ý và render template)
    const renderResult = await renderTrendVideo(trend, {
      force: false,
    });

    const reelId = renderResult.reelId;
    if (!reelId) {
      logActivity('WARN', 'AUTO_VIDEO', `Không lấy được reelId sau khi render video cho: "${trend.title}"`);
      return { success: false, error: 'Reel ID not found' };
    }

    logActivity(
      'INFO',
      'AUTO_VIDEO',
      `Video đã sẵn sàng (${renderResult.videoPath}). Bắt đầu tự động xuất bản lên các nền tảng video ngắn...`
    );

    const headless = options.headless !== undefined ? options.headless : true;
    let reel = getReelById(reelId);
    if (!reel) {
      return { success: false, error: 'Reel record missing' };
    }

    // 2. Xuất bản lên Facebook Reels (nếu bật cấu hình)
    if (isFbReelAutoPostEnabled() && reel.status !== 'published') {
      try {
        logActivity('INFO', 'AUTO_VIDEO', `[Facebook Reel] Đang tự động đăng video [${reelId}]...`);
        const fbRes = await publishReelById(reelId, { headless, syncOtherPlatforms: false });
        if (fbRes.success) {
          logActivity('SUCCESS', 'AUTO_VIDEO', `[Facebook Reel] Đăng thành công! Link: ${fbRes.reelUrl || 'N/A'}`);
        } else {
          logActivity('WARN', 'AUTO_VIDEO', `[Facebook Reel] Không thể đăng: ${fbRes.error || fbRes.message}`);
        }
      } catch (fbErr: any) {
        logActivity('WARN', 'AUTO_VIDEO', `[Facebook Reel] Lỗi ngoại lệ: ${fbErr.message}`);
      }
    } else if (!isFbReelAutoPostEnabled()) {
      logActivity('INFO', 'AUTO_VIDEO', '[Facebook Reel] Bỏ qua đăng Facebook Reel vì cấu hình đã tắt.');
    }

    // 3. Xuất bản lên TikTok (nếu bật cấu hình)
    reel = getReelById(reelId) || reel;
    if (isTikTokAutoPostEnabled() && reel.tiktok_status !== 'published') {
      try {
        logActivity('INFO', 'AUTO_VIDEO', `[TikTok] Đang tự động đăng video ngắn [${reelId}]...`);
        const ttRes = await publishTikTokReelById(reelId, { headless });
        if (ttRes.success) {
          logActivity('SUCCESS', 'AUTO_VIDEO', `[TikTok] Đăng thành công! Link: ${ttRes.tiktokUrl || 'N/A'}`);
        } else {
          logActivity('WARN', 'AUTO_VIDEO', `[TikTok] Không thể đăng: ${ttRes.error || ttRes.message}`);
        }
      } catch (ttErr: any) {
        logActivity('WARN', 'AUTO_VIDEO', `[TikTok] Lỗi ngoại lệ: ${ttErr.message}`);
      }
    }

    // 4. Xuất bản lên YouTube Shorts (nếu bật cấu hình - kèm tự chèn nhạc YouTube Studio)
    reel = getReelById(reelId) || reel;
    if (isYouTubeAutoPostEnabled() && reel.youtube_status !== 'published') {
      try {
        logActivity('INFO', 'AUTO_VIDEO', `[YouTube Shorts] Đang tự động đăng video ngắn [${reelId}]...`);
        const ytRes = await publishYouTubeReelById(reelId, { headless });
        if (ytRes.success) {
          logActivity('SUCCESS', 'AUTO_VIDEO', `[YouTube Shorts] Đăng thành công! Link: ${ytRes.youtubeUrl || 'N/A'}`);
        } else {
          logActivity('WARN', 'AUTO_VIDEO', `[YouTube Shorts] Không thể đăng: ${ytRes.error || ytRes.message}`);
        }
      } catch (ytErr: any) {
        logActivity('WARN', 'AUTO_VIDEO', `[YouTube Shorts] Lỗi ngoại lệ: ${ytErr.message}`);
      }
    }

    // 5. Xuất bản lên Zalo Video (nếu bật cấu hình)
    reel = getReelById(reelId) || reel;
    if (isZaloAutoPostEnabled() && reel.zalo_status !== 'published') {
      try {
        logActivity('INFO', 'AUTO_VIDEO', `[Zalo Video] Đang tự động đăng video [${reelId}]...`);
        const zaloRes = await publishZaloReelById(reelId, { headless });
        if (zaloRes.success) {
          logActivity('SUCCESS', 'AUTO_VIDEO', `[Zalo Video] Đăng thành công! Link: ${zaloRes.zaloUrl || 'N/A'}`);
        } else {
          logActivity('WARN', 'AUTO_VIDEO', `[Zalo Video] Không thể đăng: ${zaloRes.error || zaloRes.message}`);
        }
      } catch (zaloErr: any) {
        logActivity('WARN', 'AUTO_VIDEO', `[Zalo Video] Lỗi ngoại lệ: ${zaloErr.message}`);
      }
    }

    logActivity(
      'SUCCESS',
      'AUTO_VIDEO',
      `Hoàn thành chuỗi tự động tạo & đăng Video cho xu hướng: "${trend.title}"!`
    );

    return {
      success: true,
      reelId,
      videoPath: renderResult.videoPath,
    };
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    logActivity('ERROR', 'AUTO_VIDEO', `Lỗi chuỗi tự động tạo & đăng Video: ${errorMsg}`);
    return { success: false, error: errorMsg };
  }
}
