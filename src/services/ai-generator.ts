import { GoogleGenAI } from '@google/genai';
import { TrendItem, PostItem, NewsArticle } from '@/types';
import db, { getSetting, logActivity } from '@/lib/db';
import { findExactNewsSources } from './crawler';
import { findDuplicatePost } from './dedup';
import crypto from 'crypto';

export async function generateSocialPost(trend: TrendItem, customTone?: string, options?: { force?: boolean }): Promise<PostItem> {
  const apiKey = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY || '';
  const tone = customTone || getSetting('post_tone', 'finance_news');

  // DEDUPLICATION GUARD: Prevent creating duplicate posts for trends that already have posts
  if (!options?.force) {
    const dup = findDuplicatePost(trend);
    if (dup.isDuplicate && dup.matchedPost) {
      if (dup.matchedPost.status === 'published') {
        const err = `Xu hướng "${trend.title}" đã được xuất bản trên Facebook trước đó (${dup.matchedPost.published_at || ''}). Không thể tạo bài mới để tránh trùng lặp.`;
        logActivity('WARN', 'GENERATE', err);
        throw new Error(err);
      }
      logActivity(
        'INFO',
        'GENERATE',
        `Xu hướng "${trend.title}" đã có bản thảo (ID: ${dup.matchedPost.id}). Trả về bản thảo hiện có để tránh tạo bài trùng lặp.`
      );
      return dup.matchedPost;
    }
  }

  // STRICT REQUIREMENT: Only use exact publisher source links, filter out ANY google.com / google trend URLs
  let exactArticles: NewsArticle[] = (trend.articles || []).filter(
    (a) => a.url && !a.url.includes('google.com')
  );

  // If no exact press articles exist for this trend yet, search and find exact publisher links on-demand
  if (exactArticles.length === 0) {
    logActivity('INFO', 'GENERATE', `Đang tìm kiếm liên kết nguồn báo chí chính thống cho: "${trend.title}"...`);
    exactArticles = await findExactNewsSources(trend.title, trend.geo, 3);
    if (exactArticles.length > 0) {
      trend.articles = exactArticles;
      // Persist the discovered real news sources to SQLite
      db.prepare('UPDATE trends SET articles_json = ? WHERE id = ?').run(
        JSON.stringify(exactArticles),
        trend.id
      );
      logActivity('SUCCESS', 'GENERATE', `Đã tìm thấy ${exactArticles.length} liên kết báo chí nguồn cho "${trend.title}".`);
    }
  }

  const sourceUrls = exactArticles.map((a) => a.url).filter(Boolean);

  // STRICT REQUIREMENT: Chỉ cho phép tạo bài nếu có source link báo chí chính thống!
  if (sourceUrls.length === 0) {
    logActivity('WARN', 'GENERATE', `Từ chối tạo bài cho xu hướng "${trend.title}": Không có liên kết nguồn (source link) báo chí chính thống.`);
    throw new Error(`Chỉ cho phép tạo bài khi có liên kết nguồn (source link). Xu hướng "${trend.title}" hiện chưa tìm thấy link bài báo nguồn.`);
  }

  logActivity('INFO', 'GENERATE', `Generating post for trend: "${trend.title}" with ${sourceUrls.length} source links (Tone: ${tone})`);

  let postContent = '';
  let commentContent = '';

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Bạn là một chuyên gia sáng tạo nội dung mạng xã hội chuyên nghiệp, có tư duy báo chí chuẩn mực, chuyên viết về tin tức thị trường, kinh tế, tài chính và các xu hướng nóng.

Hãy viết 1 bài đăng Facebook dựa trên thông tin xu hướng Google Trends sau đây:
- Chủ đề: "${trend.title}"
- Lượt tìm kiếm ước tính: ${trend.approx_traffic}
- Khu vực: ${trend.geo}
- Các bài báo chính thống ghi nhận (BẮT BUỘC DÙNG LIÊN KẾT NGUỒN NÀY, TUYỆT ĐỐI KHÔNG DÙNG LINK GOOGLE HAY GOOGLE TRENDS):
${exactArticles.map((a, i) => `${i + 1}. [${a.source}] ${a.title} - URL: ${a.url}`).join('\n')}

══════════════════════════════════════════════════════════════════════
🚨 3 NGUYÊN TẮC BẮT BUỘC KHI VIẾT NỘI DUNG (TUYỆT ĐỐI TUÂN THỦ):
══════════════════════════════════════════════════════════════════════
1. KHÔNG COPY-PASTE CÂU CHỮ:
   - Nội dung bài đăng phải do bạn TỰ TỔNG HỢP VÀ VIẾT LẠI hoàn toàn bằng văn phong tự nhiên, súc tích.
   - TUYỆT ĐỐI KHÔNG sao chép nguyên văn các câu văn, tiêu đề báo giật gân hoặc trích dẫn độc quyền của bài báo lên caption.

2. THÔNG TIN PHẢI CHÍNH XÁC VỚI NGUỒN:
   - Nội dung bạn diễn đạt lại KHÔNG ĐƯỢC bóp méo sự thật, KHÔNG suy diễn sai lệch so với bản tin gốc của báo chính thống.
   - Giữ chuẩn xác mọi số liệu, tên sự kiện, mốc thời gian và bối cảnh khách quan.

3. KHÔNG THÊM THẮT TIN GIẢ, XÚC PHẠM CÁ NHÂN / TỔ CHỨC:
   - Bình luận, gợi mở thảo luận phải văn minh, tôn trọng pháp luật và đạo đức mạng xã hội.
   - TUYỆT ĐỐI KHÔNG lợi dụng thông tin để vu khống, xúc phạm danh dự, nhân phẩm của bất kỳ cá nhân hay tổ chức nào; không kích động thù hằn, không xuyên tạc.

══════════════════════════════════════════════════════════════════════
QUY CÁCH ĐỊNH DẠNG:
1. BÀI ĐĂNG FACEBOOK (post_content):
   - Hook mở đầu cuốn hút, có biểu tượng cảm xúc (emoji).
   - Tóm lược 3-4 ý chính được tổng hợp lại bằng lời của bạn (gạch đầu dòng rõ ràng).
   - 1 câu hỏi tương tác văn minh kích thích bạn đọc chia sẻ quan điểm.
   - 3-5 hashtag phù hợp (#TinTuc #XuHuong #${trend.category === 'finance' ? 'TaiChinh #KinhDoanh' : 'XaHoi'}).
   - TUYỆT ĐỐI KHÔNG chèn link bài báo vào caption bài viết (nhằm giữ tối đa phân phối Reach của Facebook). Kết bài bằng câu: "👇 Chi tiết các bài báo gốc và nguồn tin được để ở phần bình luận đầu tiên!".

2. BÌNH LUẬN ĐẦU TIÊN (comment_content):
   - Bình luận chứa đầy đủ danh sách các liên kết nguồn gốc bài báo chính thống được cung cấp ở trên để độc giả kiểm chứng (TUYỆT ĐỐI KHÔNG DÙNG LINK GOOGLE HAY GOOGLE TRENDS):
   Ví dụ:
   "🔗 Nguồn tin và bài viết chi tiết để bạn đọc tham khảo:
   1. [Tên báo]: [URL báo chí thật]
   2. [Tên báo]: [URL báo chí thật]"

Trả về duy nhất JSON hợp lệ (không kèm markdown \`\`\`json):
{
  "post_content": "nội dung bài viết Facebook ở đây",
  "comment_content": "nội dung bình luận nguồn ở đây"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const responseText = response.text || '';
      try {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        postContent = json.post_content;
        commentContent = json.comment_content;
      } catch (parseErr) {
        postContent = responseText;
      }
    } catch (apiErr: any) {
      logActivity('WARN', 'GENERATE', `Gemini API call failed, falling back to smart template: ${apiErr?.message}`);
    }
  }

  // Fallback template adhering strictly to the 3 principles
  if (!postContent) {
    const topicUpper = trend.title.toUpperCase();
    const articleSummaries = exactArticles.length > 0
      ? exactArticles.slice(0, 3).map((a) => `• Ghi nhận theo ${a.source || 'báo chí'}: Tình hình xoay quanh "${a.title}" đang thu hút sự chú ý lớn từ dư luận.`).join('\n')
      : `• Diễn biến liên quan đến "${trend.title}" đang được các phương tiện truyền thông cập nhật liên tục.`;

    postContent = `🔥 [ĐIỂM TIN XU HƯỚNG] ${topicUpper} 🔥

📈 Xu hướng đang thu hút lượng tìm kiếm và quan tâm lớn hôm nay (${trend.approx_traffic || 'hàng nghìn lượt quan tâm'}).

📌 Tóm tắt các diễn biến chính (tổng hợp từ báo chí chính thống):
${articleSummaries}

💡 Nhận định khách quan: Các cơ quan báo chí chính thống đang tiếp tục cập nhật thông tin chuẩn xác về diễn biến này. Độc giả nên tham khảo thông tin từ các nguồn uy tín để có cái nhìn toàn diện nhất.

👉 Bạn đánh giá thế nào về diễn biến này? Hãy để lại ý kiến bình luận văn minh bên dưới nhé!
👇 Chi tiết các bài báo gốc và nguồn tin được để ở phần bình luận đầu tiên!

#TinNong #XuHuong #${trend.category === 'finance' ? 'TaiChinh #KinhDoanh' : 'XaHoi #CapNhat'}`;
  }

  if (!commentContent) {
    const linksList = exactArticles.length > 0
      ? exactArticles.map((a, i) => `${i + 1}. [${a.source || 'Báo chí'}]: ${a.url}`).join('\n')
      : sourceUrls.map((url, i) => `${i + 1}. Nguồn bài viết: ${url}`).join('\n');

    commentContent = `🔗 Nguồn tin và bài viết chi tiết để bạn đọc tham khảo:\n${linksList}\n\n#NguonTin #BaoChi #ThongTinChinhXac`;
  }

  const postId = 'post_' + crypto.randomUUID().substring(0, 8);
  const newPost: PostItem = {
    id: postId,
    trend_id: trend.id,
    trend_title: trend.title,
    post_content: postContent,
    comment_content: commentContent,
    source_urls: sourceUrls,
    status: 'draft',
  };

  // Save to database
  db.prepare(`
    INSERT INTO posts (id, trend_id, trend_title, post_content, comment_content, source_urls, status)
    VALUES (@id, @trend_id, @trend_title, @post_content, @comment_content, @source_urls, @status)
  `).run({
    id: newPost.id,
    trend_id: newPost.trend_id || null,
    trend_title: newPost.trend_title,
    post_content: newPost.post_content,
    comment_content: newPost.comment_content,
    source_urls: JSON.stringify(newPost.source_urls),
    status: newPost.status,
  });

  // Mark trend status as drafted
  db.prepare(`UPDATE trends SET status = 'drafted' WHERE id = ?`).run(trend.id);
  db.prepare(`UPDATE trends SET status = 'drafted' WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))`).run(trend.title);
  trend.status = 'drafted';

  logActivity('SUCCESS', 'GENERATE', `Generated post ${postId} for "${trend.title}" with verified publisher sources.`);
  return newPost;
}
