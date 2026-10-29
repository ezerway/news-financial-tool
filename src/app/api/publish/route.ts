import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { executePublishAndComment } from '@/services/playwright/fb-automation';
import { PostItem } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { postId, dryRun, headless } = await req.json();

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

    if (post.status === 'published' && !Boolean(dryRun)) {
      return NextResponse.json({
        success: false,
        error: `Bài viết "${post.trend_title}" đã được xuất bản trước đó vào ${post.published_at || 'trước đây'}. Không thể đăng lại để tránh trùng lặp bài viết.`,
      }, { status: 400 });
    }

    const result = await executePublishAndComment(post, {
      dryRun: Boolean(dryRun),
      headless: headless !== undefined ? Boolean(headless) : true,
    });

    return NextResponse.json({ success: result.success, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
