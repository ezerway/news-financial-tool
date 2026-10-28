import { NextRequest, NextResponse } from 'next/server';
import db, { logActivity } from '@/lib/db';
import { findExactNewsSources } from '@/services/crawler';
import { NewsArticle } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { trendId } = await req.json();
    if (!trendId) {
      return NextResponse.json({ success: false, error: 'trendId is required' }, { status: 400 });
    }

    const row = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId) as any;
    if (!row) {
      return NextResponse.json({ success: false, error: 'Trend not found' }, { status: 404 });
    }

    logActivity('INFO', 'CRAWL', `Đang tìm kiếm link nguồn báo chí cho xu hướng: "${row.title}"...`);
    const exactSources: NewsArticle[] = await findExactNewsSources(row.title, row.geo || 'VN', 3);

    if (exactSources.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Không tìm thấy bài báo nguồn nào cho "${row.title}". Không thể tạo bài khi thiếu source link.`,
      });
    }

    // Update database
    db.prepare('UPDATE trends SET articles_json = ? WHERE id = ?').run(
      JSON.stringify(exactSources),
      trendId
    );

    logActivity('SUCCESS', 'CRAWL', `Đã tìm thấy ${exactSources.length} link báo chí nguồn cho "${row.title}".`);

    return NextResponse.json({
      success: true,
      count: exactSources.length,
      articles: exactSources,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
