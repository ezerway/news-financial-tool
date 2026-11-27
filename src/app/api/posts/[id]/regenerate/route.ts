import { NextRequest, NextResponse } from 'next/server';
import db, { logActivity } from '@/lib/db';
import { generateSocialPost } from '@/services/ai-generator';
import { PostItem, TrendItem } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const customTone = body.customTone as string | undefined;

    // 1. Tìm thông tin bài viết hiện tại
    const postRow = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
    if (!postRow) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy bài viết với ID: ${id}` },
        { status: 404 }
      );
    }

    // 2. Tìm trend tương ứng
    let trendRow: any = null;
    if (postRow.trend_id) {
      trendRow = db.prepare('SELECT * FROM trends WHERE id = ?').get(postRow.trend_id);
    }
    if (!trendRow && postRow.trend_title) {
      trendRow = db.prepare('SELECT * FROM trends WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))').get(postRow.trend_title);
    }

    let trend: TrendItem;
    if (trendRow) {
      trend = {
        ...trendRow,
        articles: trendRow.articles_json ? JSON.parse(trendRow.articles_json) : [],
      };
    } else {
      // Fallback nếu không có record trend trong database
      const existingUrls = postRow.source_urls ? JSON.parse(postRow.source_urls) : [];
      trend = {
        id: postRow.trend_id || 'trend_temp_' + Date.now(),
        title: postRow.trend_title,
        approx_traffic: 'Hàng nghìn lượt quan tâm',
        geo: 'VN',
        category: 'finance',
        status: 'discovered',
        pub_date: new Date().toISOString(),
        articles: existingUrls.map((u: string) => ({
          title: postRow.trend_title,
          snippet: '',
          url: u,
          source: 'Báo chí chính thống',
        })),
        created_at: new Date().toISOString(),
      };
    }

    logActivity('INFO', 'REGENERATE_POST', `Người dùng yêu cầu viết lại nội dung bài đăng [${id}] cho: "${trend.title}"...`);

    // 3. Gọi hàm sinh bài viết mới với force: true
    const newPostData = await generateSocialPost(trend, customTone, { force: true });

    // 4. Cập nhật trực tiếp vào record bài viết hiện tại
    db.prepare(`
      UPDATE posts 
      SET post_content = ?, comment_content = ?, source_urls = ?, error_message = NULL, status = 'draft'
      WHERE id = ?
    `).run(
      newPostData.post_content,
      newPostData.comment_content,
      JSON.stringify(newPostData.source_urls || []),
      id
    );

    const updatedRow = db.prepare('SELECT * FROM posts WHERE id = ?').get(id) as any;
    const updatedPost: PostItem = {
      ...updatedRow,
      source_urls: updatedRow.source_urls ? JSON.parse(updatedRow.source_urls) : [],
    };

    logActivity('SUCCESS', 'REGENERATE_POST', `Đã viết lại bài đăng [${id}] thành công cho: "${trend.title}".`);

    return NextResponse.json({
      success: true,
      message: 'Đã tạo lại nội dung bài viết thành công!',
      post: updatedPost,
    });
  } catch (err: any) {
    logActivity('ERROR', 'REGENERATE_POST', `Lỗi khi viết lại bài đăng: ${err.message}`);
    return NextResponse.json(
      { success: false, error: err.message || 'Lỗi khi viết lại bài viết' },
      { status: 500 }
    );
  }
}
