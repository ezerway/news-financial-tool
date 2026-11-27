import { NextRequest, NextResponse } from 'next/server';
import db, { logActivity } from '@/lib/db';
import { TrendItem } from '@/types';
import { generateVideoSlideScript } from '@/services/video-script-generator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const row = db.prepare('SELECT * FROM trends WHERE id = ?').get(id) as any;
    if (!row) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy xu hướng với ID: ${id}` },
        { status: 404 }
      );
    }

    const trend: TrendItem = {
      ...row,
      articles: row.articles_json ? JSON.parse(row.articles_json) : [],
    };

    logActivity('INFO', 'SLIDE_PREVIEW', `Đang tạo bản xem trước kịch bản Slide cho: "${trend.title}"...`);
    const script = await generateVideoSlideScript(trend);

    return NextResponse.json({
      success: true,
      script,
      trend: {
        id: trend.id,
        title: trend.title,
        video_generated: trend.video_generated,
        video_path: trend.video_path,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi tạo bản xem trước slide' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const row = db.prepare('SELECT * FROM trends WHERE id = ?').get(id) as any;
    if (!row) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy xu hướng với ID: ${id}` },
        { status: 404 }
      );
    }

    const trend: TrendItem = {
      ...row,
      articles: row.articles_json ? JSON.parse(row.articles_json) : [],
    };

    logActivity('INFO', 'SLIDE_PREVIEW', `Đang sinh lại kịch bản Slide (Regenerate) cho: "${trend.title}"...`);
    const script = await generateVideoSlideScript(trend);

    return NextResponse.json({
      success: true,
      message: 'Đã sinh lại kịch bản slide thành công!',
      script,
      trend: {
        id: trend.id,
        title: trend.title,
        video_generated: trend.video_generated,
        video_path: trend.video_path,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi sinh kịch bản slide' },
      { status: 500 }
    );
  }
}
