import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updates: string[] = [];
    const values: any[] = [];

    if (body.post_content !== undefined) {
      updates.push('post_content = ?');
      values.push(body.post_content);
    }
    if (body.comment_content !== undefined) {
      updates.push('comment_content = ?');
      values.push(body.comment_content);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.record_video !== undefined) {
      updates.push('record_video = ?');
      values.push(body.record_video ? 1 : 0);
    }

    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes provided' });
    }

    values.push(id);
    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

import path from 'path';
import fs from 'fs';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Lấy thông tin bài viết để xóa ảnh và video liên quan
    const post = db.prepare('SELECT trend_id, screenshot_path, video_path FROM posts WHERE id = ?').get(id) as {
      trend_id?: string;
      screenshot_path?: string;
      video_path?: string;
    } | undefined;

    if (post?.trend_id) {
      db.prepare("UPDATE trends SET status = 'discovered' WHERE id = ?").run(post.trend_id);
    }

    const screenshotsDir = path.join(process.cwd(), 'storage', 'screenshots');
    const videosDir = path.join(process.cwd(), 'storage', 'videos');

    // 1. Xóa ảnh screenshot theo đường dẫn lưu trong db
    if (post?.screenshot_path) {
      try {
        const imgPath = path.join(screenshotsDir, path.basename(post.screenshot_path));
        if (fs.existsSync(imgPath)) {
          fs.unlinkSync(imgPath);
        }
      } catch {}
    }

    // Xóa tất cả ảnh screenshot liên quan đến ID bài viết (phòng trường hợp thử nhiều lần)
    try {
      if (fs.existsSync(screenshotsDir)) {
        const files = fs.readdirSync(screenshotsDir);
        for (const file of files) {
          if (file.includes(id)) {
            try { fs.unlinkSync(path.join(screenshotsDir, file)); } catch {}
          }
        }
      }
    } catch {}

    // 2. Xóa video theo đường dẫn lưu trong db
    if (post?.video_path) {
      try {
        const vidPath = path.join(videosDir, path.basename(post.video_path));
        if (fs.existsSync(vidPath)) {
          fs.unlinkSync(vidPath);
        }
      } catch {}
    }

    // Xóa tất cả video liên quan đến ID bài viết
    try {
      if (fs.existsSync(videosDir)) {
        const files = fs.readdirSync(videosDir);
        for (const file of files) {
          if (file.includes(id)) {
            try { fs.unlinkSync(path.join(videosDir, file)); } catch {}
          }
        }
      }
    } catch {}

    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    return NextResponse.json({ success: true, message: 'Post and associated media deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
