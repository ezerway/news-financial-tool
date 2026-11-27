import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { TrendItem } from '@/types';
import { renderTrendVideo } from '@/services/video/video-renderer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const force = body.force === true;
    const templateId = body.templateId as string | undefined;
    const script = body.script;

    // Lấy thông tin trend từ CSDL
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

    const result = await renderTrendVideo(trend, { force, templateId, script });

    return NextResponse.json({
      success: true,
      message: result.alreadyExisted
        ? 'Xu hướng này đã có video trước đó, trả về video hiện tại.'
        : 'Đã tạo video bản tin 9:16 thành công!',
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi tạo video từ xu hướng' },
      { status: 500 }
    );
  }
}
