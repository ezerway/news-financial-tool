import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import db from '@/lib/db';
import { PostItem } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    let query = 'SELECT * FROM posts';
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const rows = db.prepare(query).all(...params) as any[];
    const posts: PostItem[] = rows.map((r) => ({
      ...r,
      source_urls: r.source_urls ? JSON.parse(r.source_urls) : [],
    }));

    return NextResponse.json({ success: true, posts });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'failed';

    let selectQuery = 'SELECT id, trend_id, screenshot_path, video_path FROM posts';
    const params: any[] = [];
    if (status !== 'all') {
      selectQuery += ' WHERE status = ?';
      params.push(status);
    }

    const postsToDelete = db.prepare(selectQuery).all(...params) as {
      id: string;
      trend_id?: string;
      screenshot_path?: string;
      video_path?: string;
    }[];

    if (postsToDelete.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'Không có bài viết nào để xóa' });
    }

    const screenshotsDir = path.join(process.cwd(), 'storage', 'screenshots');
    const videosDir = path.join(process.cwd(), 'storage', 'videos');

    for (const post of postsToDelete) {
      // 1. Reset trend status về 'discovered'
      if (post.trend_id) {
        db.prepare("UPDATE trends SET status = 'discovered' WHERE id = ?").run(post.trend_id);
      }

      // 2. Xóa ảnh screenshot liên quan
      if (post.screenshot_path) {
        try {
          const imgPath = path.join(screenshotsDir, path.basename(post.screenshot_path));
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        } catch {}
      }
      try {
        if (fs.existsSync(screenshotsDir)) {
          const files = fs.readdirSync(screenshotsDir);
          for (const file of files) {
            if (file.includes(post.id)) {
              try { fs.unlinkSync(path.join(screenshotsDir, file)); } catch {}
            }
          }
        }
      } catch {}

      // 3. Xóa video liên quan
      if (post.video_path) {
        try {
          const vidPath = path.join(videosDir, path.basename(post.video_path));
          if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
        } catch {}
      }
      try {
        if (fs.existsSync(videosDir)) {
          const files = fs.readdirSync(videosDir);
          for (const file of files) {
            if (file.includes(post.id)) {
              try { fs.unlinkSync(path.join(videosDir, file)); } catch {}
            }
          }
        }
      } catch {}
    }

    // Xóa các bài viết khỏi cơ sở dữ liệu
    let deleteQuery = 'DELETE FROM posts';
    if (status !== 'all') {
      deleteQuery += ' WHERE status = ?';
    }
    db.prepare(deleteQuery).run(...params);

    return NextResponse.json({
      success: true,
      count: postsToDelete.length,
      message: `Đã xóa thành công ${postsToDelete.length} bài viết và toàn bộ file ảnh/video liên quan`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
