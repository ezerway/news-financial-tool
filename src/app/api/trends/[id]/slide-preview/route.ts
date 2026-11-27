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

    // 1. ƯU TIÊN TRẢ VỀ NGAY NẾU ĐÃ CÓ KỊCH BẢN SLIDE TRONG CSDL (từ lần tạo video trước hoặc preview trước)
    if (row.slide_script_json) {
      try {
        const existingScript = JSON.parse(row.slide_script_json);
        if (existingScript && existingScript.intro && existingScript.slide1) {
          return NextResponse.json({
            success: true,
            script: existingScript,
            fromCache: true,
            trend: {
              id: trend.id,
              title: trend.title,
              video_generated: trend.video_generated,
              video_path: trend.video_path,
            },
          });
        }
      } catch {}
    }

    // 2. Nếu chưa từng có kịch bản slide, mới gọi AI để tạo lần đầu
    logActivity('INFO', 'SLIDE_PREVIEW', `Chưa có kịch bản slide lưu sẵn, đang sinh kịch bản Slide cho: "${trend.title}"...`);
    const script = await generateVideoSlideScript(trend);

    // Lưu lại vào DB để các lần bấm xem sau không phải tạo lại
    try {
      db.prepare('UPDATE trends SET slide_script_json = ? WHERE id = ?').run(
        JSON.stringify(script),
        trend.id
      );
    } catch {}

    return NextResponse.json({
      success: true,
      script,
      fromCache: false,
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

    // Cập nhật kịch bản mới vừa sinh lại vào CSDL
    try {
      db.prepare('UPDATE trends SET slide_script_json = ? WHERE id = ?').run(
        JSON.stringify(script),
        trend.id
      );
    } catch {}

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

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (!body.script) {
      return NextResponse.json(
        { success: false, error: 'Thiếu nội dung script để lưu' },
        { status: 400 }
      );
    }

    db.prepare('UPDATE trends SET slide_script_json = ? WHERE id = ?').run(
      JSON.stringify(body.script),
      id
    );

    return NextResponse.json({
      success: true,
      message: 'Đã lưu chỉnh sửa kịch bản slide thành công!',
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi lưu kịch bản slide' },
      { status: 500 }
    );
  }
}
