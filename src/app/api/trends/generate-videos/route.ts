import { NextRequest, NextResponse } from 'next/server';
import db, { logActivity } from '@/lib/db';
import { TrendItem } from '@/types';
import { renderTrendVideo } from '@/services/video/video-renderer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(parseInt(body.limit || '5', 10), 10); // Tối đa 10 video một lượt để tránh nghẽn server
    const templateId = body.templateId as string | undefined;

    // Lấy danh sách xu hướng chưa tạo video
    const rows = db
      .prepare(`
        SELECT * FROM trends 
        WHERE (video_generated IS NULL OR video_generated = 0 OR video_path IS NULL)
        ORDER BY created_at DESC 
        LIMIT ?
      `)
      .all(limit) as any[];

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        message: 'Tất cả các xu hướng hiện tại đều đã được tạo video!',
        results: [],
      });
    }

    logActivity('INFO', 'VIDEO_RENDER', `Bắt đầu tiến trình tạo video hàng loạt cho ${rows.length} xu hướng...`);

    const results = [];
    for (const row of rows) {
      const trend: TrendItem = {
        ...row,
        articles: row.articles_json ? JSON.parse(row.articles_json) : [],
      };

      try {
        const res = await renderTrendVideo(trend, { force: false, templateId });
        results.push({
          trendId: trend.id,
          title: trend.title,
          success: true,
          videoPath: res.videoPath,
          reelId: res.reelId,
          alreadyExisted: res.alreadyExisted,
        });
      } catch (err: any) {
        results.push({
          trendId: trend.id,
          title: trend.title,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      count: successCount,
      total: rows.length,
      message: `Đã hoàn thành tạo video cho ${successCount}/${rows.length} xu hướng.`,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi tạo video hàng loạt' },
      { status: 500 }
    );
  }
}
