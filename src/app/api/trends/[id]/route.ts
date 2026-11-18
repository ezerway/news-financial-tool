import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const trend = db.prepare('SELECT id, title FROM trends WHERE id = ?').get(id) as {
      id: string;
      title: string;
    } | undefined;

    if (!trend) {
      return NextResponse.json({ success: false, error: 'Không tìm thấy xu hướng' }, { status: 404 });
    }

    const screenshotsDir = path.join(process.cwd(), 'storage', 'screenshots');
    const videosDir = path.join(process.cwd(), 'storage', 'videos');

    // Tìm các bài viết liên kết với xu hướng này
    const linkedPosts = db.prepare('SELECT id, status, screenshot_path, video_path FROM posts WHERE trend_id = ?').all(id) as {
      id: string;
      status: string;
      screenshot_path?: string;
      video_path?: string;
    }[];

    for (const post of linkedPosts) {
      // Nếu bài viết chưa xuất bản (bản thảo hoặc lỗi), xóa bài viết và dọn dẹp file
      if (post.status !== 'published') {
        if (post.screenshot_path) {
          try {
            const p = path.join(screenshotsDir, path.basename(post.screenshot_path));
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch {}
        }
        if (post.video_path) {
          try {
            const p = path.join(videosDir, path.basename(post.video_path));
            if (fs.existsSync(p)) fs.unlinkSync(p);
          } catch {}
        }
        db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
      } else {
        // Nếu bài viết đã xuất bản thành công trên Fanpage, giữ lại lịch sử bài viết và gỡ liên kết trend_id
        db.prepare('UPDATE posts SET trend_id = NULL WHERE id = ?').run(post.id);
      }
    }

    // Xóa bản ghi xu hướng
    db.prepare('DELETE FROM trends WHERE id = ?').run(id);

    return NextResponse.json({
      success: true,
      message: `Đã xóa xu hướng "${trend.title}" thành công!`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
