import { NextRequest, NextResponse } from 'next/server';
import db, { isAutoVideoPublishAfterPostEnabled, logActivity } from '@/lib/db';
import { executePublishAndComment } from '@/services/playwright/fb-automation';
import { handleAutoVideoGenerationAndPublishing } from '@/services/video/auto-video-publisher';
import { PostItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { postId, headless, force } = await req.json();

    if (!postId) {
      return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId) as any;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const post: PostItem = {
      ...row,
      source_urls: row.source_urls ? JSON.parse(row.source_urls) : [],
    };

    if (post.status === 'published' && !Boolean(force)) {
      return NextResponse.json({
        success: false,
        error: `Bài viết "${post.trend_title}" đã được xuất bản trước đó vào ${post.published_at || 'trước đây'}. Không thể đăng lại để tránh trùng lặp bài viết.`,
      }, { status: 400 });
    }

    const result = await executePublishAndComment(post, {
      headless: headless !== undefined ? Boolean(headless) : true,
      force: Boolean(force),
    });

    // Nếu bài viết xuất bản thành công và bật setting tự động tạo & đăng video
    if (result.success && post.trend_id && isAutoVideoPublishAfterPostEnabled()) {
      handleAutoVideoGenerationAndPublishing(post.trend_id, {
        headless: headless !== undefined ? Boolean(headless) : true,
      }).catch((vErr) => {
        logActivity('WARN', 'AUTO_VIDEO', `[Background] Lỗi tự tạo/đăng video cho xu hướng [${post.trend_id}]: ${vErr.message}`);
      });
    }

    return NextResponse.json({ success: result.success, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
