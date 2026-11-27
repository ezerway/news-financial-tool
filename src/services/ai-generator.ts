import { GoogleGenAI } from '@google/genai';
import { TrendItem, PostItem, NewsArticle } from '@/types';
import db, { getSetting, logActivity } from '@/lib/db';
import { findExactNewsSources } from './crawler';
import { findDuplicatePost } from './dedup';
import { extractArticlesContent } from './article-extractor';
import { convertCommentLinks } from '@/lib/link-redirect';
import { getOllamaConfig, generateFacebookPostWithOllama } from './ollama';
import crypto from 'crypto';

export function resolveGeminiApiKey(): string {
  const dbKey = (getSetting('gemini_api_key') || '').trim();
  const envKey = (process.env.GEMINI_API_KEY || '').trim();

  // Ưu tiên key chuẩn Google AI (luôn bắt đầu bằng 'AIza')
  if (dbKey.startsWith('AIza')) return dbKey;
  if (envKey.startsWith('AIza')) return envKey;

  // Nếu người dùng lỡ lưu mật khẩu autofill (như 'admin123') vào ô API key thì bỏ qua
  if (dbKey && dbKey !== 'admin123' && dbKey.length > 20) return dbKey;
  if (envKey && envKey !== 'admin123' && envKey.length > 20) return envKey;

  return dbKey || envKey;
}

export async function generateSocialPost(
  trend: TrendItem,
  customTone?: string,
  options?: { force?: boolean; targetPostId?: string }
): Promise<PostItem> {
  const apiKey = resolveGeminiApiKey();
  const tone = customTone || getSetting('post_tone', 'finance_news');

  // Xác định bài viết mục tiêu nếu đã tồn tại để CẬP NHẬT đè thay vì tạo mới
  let targetPostId = options?.targetPostId;
  if (!targetPostId && trend.id) {
    const existingPost = db
      .prepare(`SELECT id, status FROM posts WHERE trend_id = ? ORDER BY created_at DESC LIMIT 1`)
      .get(trend.id) as { id: string; status: string } | undefined;

    if (existingPost) {
      if (!options?.force) {
        if (existingPost.status === 'published') {
          const err = `Xu hướng "${trend.title}" đã được xuất bản trên Facebook trước đó. Không thể tạo bài mới để tránh trùng lặp.`;
          logActivity('WARN', 'GENERATE', err);
          throw new Error(err);
        }
        logActivity(
          'INFO',
          'GENERATE',
          `Xu hướng "${trend.title}" đã có bản thảo (ID: ${existingPost.id}). Trả về bản thảo hiện có để tránh tạo bài trùng lặp.`
        );
        const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(existingPost.id) as any;
        return {
          ...p,
          source_urls: p.source_urls ? JSON.parse(p.source_urls) : [],
        };
      } else {
        // Khi force = true: gán targetPostId để ghi đè cập nhật lên bài viết này
        targetPostId = existingPost.id;
      }
    }
  }

  // Deduplication guard phụ phòng trường hợp trend_id khác nhưng cùng chủ đề
  if (!options?.force && !targetPostId) {
    const dup = findDuplicatePost(trend);
    if (dup.isDuplicate && dup.matchedPost) {
      if (dup.matchedPost.status === 'published' && dup.matchedPost.fb_post_url) {
        const err = `Xu hướng "${trend.title}" đã được xuất bản trên Facebook trước đó (${dup.matchedPost.published_at || ''}). Không thể tạo bài mới để tránh trùng lặp.`;
        logActivity('WARN', 'GENERATE', err);
        throw new Error(err);
      }
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

  // TỰ ĐỘNG ĐỌC VÀ TRÍCH XUẤT NỘI DUNG TỪ CÁC LINK NGUỒN BÁO CHÍ
  // Giúp AI đọc hiểu toàn văn, trích xuất chính xác số liệu, mốc thời gian và sự kiện thực tế
  const needsExtraction = exactArticles.some((a) => !a.content || a.content.length < 100);
  if (needsExtraction) {
    try {
      logActivity('INFO', 'GENERATE', `Đang đọc và trích xuất nội dung từ ${exactArticles.length} bài báo nguồn cho "${trend.title}"...`);
      exactArticles = await extractArticlesContent(exactArticles, trend.title);
      trend.articles = exactArticles;
      if (trend.id) {
        db.prepare('UPDATE trends SET articles_json = ? WHERE id = ?').run(
          JSON.stringify(exactArticles),
          trend.id
        );
      }
      logActivity('SUCCESS', 'GENERATE', `Đã hoàn tất trích xuất nội dung nguồn cho "${trend.title}".`);
    } catch (extErr: any) {
      logActivity('WARN', 'GENERATE', `Lỗi trong quá trình trích xuất nội dung bài báo: ${extErr?.message}`);
    }
  }

  logActivity('INFO', 'GENERATE', `Generating post for trend: "${trend.title}" with ${sourceUrls.length} source links (Tone: ${tone})`);

  let postContent = '';
  let commentContent = '';

  const ollamaConfig = getOllamaConfig();
  const buildOllamaArticlesContext = () =>
    exactArticles
      .slice(0, 3)
      .map((a, i) => `Bài báo ${i + 1} [${a.source || 'Báo chí'}] "${a.title}":\n${(a.content || a.snippet || '').slice(0, 700)}`)
      .join('\n\n');

  // ƯU TIÊN 1: Nếu người dùng cấu hình "Ưu tiên chạy Ollama" cho bài viết (Primary Mode)
  if (ollamaConfig.enabled && ollamaConfig.postMode === 'primary') {
    try {
      logActivity('INFO', 'GENERATE', `Chế độ Ollama Primary đang chạy (${ollamaConfig.postModel}) để tạo bài viết cho: "${trend.title}"...`);
      const res = await generateFacebookPostWithOllama(
        trend.title,
        buildOllamaArticlesContext(),
        sourceUrls,
        tone,
        ollamaConfig.postModel
      );
      if (res.postContent) {
        postContent = res.postContent;
        commentContent = res.commentContent || '';
        logActivity('SUCCESS', 'GENERATE', `Ollama Primary (${ollamaConfig.postModel}) đã tạo bài viết thành công.`);
      }
    } catch (ollamaPrimaryErr: any) {
      logActivity('WARN', 'GENERATE', `Ollama Primary gặp sự cố (${ollamaPrimaryErr?.message}), tự động chuyển sang Gemini.`);
    }
  }

  // TẦNG 2: Google Gemini AI (nếu chưa có bài viết từ Ollama Primary)
  if (!postContent && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const articlesContext = exactArticles
        .map((a, i) => {
          const bodySnippet = a.content || a.snippet || '(Không có nội dung chi tiết)';
          return `══════════════════════════════════════════════════════════════════════
BÀI BÁO ${i + 1}: [${a.source || 'Báo chí'}] "${a.title}"
URL nguồn: ${a.url}
NỘI DUNG CHI TIẾT BÀI BÁO:
${bodySnippet}
══════════════════════════════════════════════════════════════════════`;
        })
        .join('\n\n');

      const prompt = `
Bạn là một chuyên gia sáng tạo nội dung mạng xã hội chuyên nghiệp, có tư duy báo chí chuẩn mực, chuyên viết về tin tức thị trường, kinh tế, tài chính và các xu hướng nóng.

Hãy đọc và nghiên cứu kỹ NỘI DUNG CHI TIẾT từ các bài báo chính thống dưới đây để viết 1 bài đăng Facebook tổng hợp sâu sắc:
- Chủ đề xu hướng: "${trend.title}"
- Lượt tìm kiếm ước tính: ${trend.approx_traffic}
- Khu vực: ${trend.geo}
- Phong cách viết (Tone): ${tone}

${articlesContext}

══════════════════════════════════════════════════════════════════════
🚨 NGUYÊN TẮC BẮT BUỘC KHI TỔNG HỢP NỘI DUNG (TUYỆT ĐỐI TUÂN THỦ):
══════════════════════════════════════════════════════════════════════
1. ĐỌC HIỂU VÀ CHẮT LỌC SỐ LIỆU TỪ NỘI DUNG BÀI BÁO:
   - Phải khai thác các SỐ LIỆU THỰC TẾ, MỐC THỜI GIAN, TÊN TỔ CHỨC / CÁ NHÂN LIÊN QUAN, BỐI CẢNH đã được đề cập trong nội dung các bài báo phía trên (ví dụ: tỷ giá, số lượng, phần trăm, giá trị hợp đồng, kết luận thanh tra, diễn biến cụ thể).
   - Tổng hợp đa chiều từ các nguồn bài báo để người đọc có cái nhìn toàn diện, không phiến diện.

2. KHÔNG COPY-PASTE NGUYÊN VĂN CÂU CHỮ:
   - Nội dung bài đăng phải do bạn TỰ TỔNG HỢP VÀ VIẾT LẠI hoàn toàn bằng văn phong tự nhiên, mạch lạc, súc tích và hấp dẫn.
   - TUYỆT ĐỐI KHÔNG sao chép nguyên văn các câu văn hoặc đoạn văn của bài báo để tránh vi phạm bản quyền và tránh bị Facebook bóp tương tác.

3. THÔNG TIN CHUẨN XÁC, KHÔNG BỊA ĐẶT / SUY DIỄN SAI LỆCH:
   - Không bóp méo sự thật, không suy diễn sai lệch so với bản tin gốc của báo chí chính thống.
   - Bình luận, gợi mở thảo luận phải văn minh, tôn trọng pháp luật và đạo đức mạng xã hội; tuyệt đối không vu khống, xúc phạm danh dự của bất kỳ ai.

══════════════════════════════════════════════════════════════════════
QUY CÁCH ĐỊNH DẠNG:
1. BÀI ĐĂNG FACEBOOK (post_content):
   - Hook mở đầu cuốn hút, có biểu tượng cảm xúc (emoji) phù hợp với chủ đề.
   - Thân bài gồm 3-4 ý chính được tổng hợp lại bằng lời của bạn, chứa số liệu và dữ kiện thực tế từ bài báo (sử dụng gạch đầu dòng rõ ràng).
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

      let responseText = '';
      const modelsToTry = [
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash-lite',
        'gemini-3.6-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ];
      for (const modelName of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          if (response.text) {
            responseText = response.text;
            break;
          }
        } catch (modelErr: any) {
          logActivity('WARN', 'GENERATE', `Model ${modelName} gặp lỗi, thử model tiếp theo: ${modelErr?.message?.slice(0, 100)}`);
        }
      }
      try {
        const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(cleaned);
        postContent = json.post_content;
        commentContent = json.comment_content;
      } catch (parseErr) {
        postContent = responseText;
      }
    } catch (apiErr: any) {
      logActivity('WARN', 'GENERATE', `Gemini API call failed, attempting fallback: ${apiErr?.message}`);
    }
  }

  // TẦNG 3: Dự phòng Ollama cục bộ trên VPS (nếu chế độ postMode !== 'disabled' hoặc khi không có Gemini Key)
  if (!postContent) {
    try {
      if (ollamaConfig.enabled && (ollamaConfig.postMode !== 'disabled' || !apiKey)) {
        logActivity('INFO', 'GENERATE', `Kích hoạt Ollama (${ollamaConfig.postModel}) tạo bài viết thay thế cho "${trend.title}"...`);
        const articlesContext = buildOllamaArticlesContext();
        const fallbackRes = await generateFacebookPostWithOllama(
          trend.title,
          articlesContext,
          sourceUrls,
          tone,
          ollamaConfig.postModel
        );
        if (fallbackRes.postContent) {
          postContent = fallbackRes.postContent;
          if (fallbackRes.commentContent) {
            commentContent = fallbackRes.commentContent;
          }
          logActivity('SUCCESS', 'GENERATE', `Ollama (${ollamaConfig.postModel}) đã tạo bài viết thành công thay thế Gemini.`);
        }
      }
    } catch (ollamaFallbackErr: any) {
      logActivity('WARN', 'GENERATE', `Ollama fallback không thành công: ${ollamaFallbackErr?.message}`);
    }
  }

  // TẦNG 4: Mẫu định dạng dự phòng thông minh (nếu cả Gemini và Ollama đều không khả dụng)
  if (!postContent) {
    const topicUpper = trend.title.toUpperCase();
    const articleSummaries = exactArticles.length > 0
      ? exactArticles.slice(0, 3).map((a) => {
        // Nếu có nội dung trích xuất, lấy đoạn dẫn thực tế
        let summary = '';
        if (a.content && a.content.length > 50) {
          const firstPara = a.content.replace(/^Tiêu đề:.*?\n+/i, '').replace(/^Tóm tắt:.*?\n+/i, '').replace(/^Nội dung chi tiết:.*?\n+/i, '').trim();
          summary = firstPara.slice(0, 160).replace(/\n/g, ' ') + '...';
        }
        return `• Theo ${a.source || 'báo chí'}: ${summary || `Ghi nhận tình hình xoay quanh "${a.title}" đang thu hút sự chú ý lớn từ dư luận.`}`;
      }).join('\n')
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

  // Tự động chuyển đổi các link nguồn sang dạng https://financial-news.ezerway.com/go/?to=[target_url]
  if (commentContent) {
    commentContent = convertCommentLinks(commentContent);
  }

  let resultPost: PostItem;

  if (targetPostId) {
    // CẬP NHẬT TRỰC TIẾP LÊN BẢN GHI CŨ (Giữ nguyên ID, không tạo bản ghi mới)
    db.prepare(`
      UPDATE posts 
      SET post_content = @post_content,
          comment_content = @comment_content,
          source_urls = @source_urls,
          error_message = NULL,
          status = CASE WHEN status = 'published' THEN 'published' ELSE 'draft' END
      WHERE id = @id
    `).run({
      id: targetPostId,
      post_content: postContent,
      comment_content: commentContent,
      source_urls: JSON.stringify(sourceUrls),
    });

    const updatedRow = db.prepare('SELECT * FROM posts WHERE id = ?').get(targetPostId) as any;
    resultPost = {
      ...updatedRow,
      source_urls: updatedRow.source_urls ? JSON.parse(updatedRow.source_urls) : [],
    };
    logActivity('SUCCESS', 'GENERATE', `Đã cập nhật đè nội dung bài viết [${targetPostId}] cho "${trend.title}".`);
  } else {
    // TẠO BẢN GHI MỚI NẾU CHƯA CÓ BẢN GHI NÀO
    const postId = 'post_' + crypto.randomUUID().substring(0, 8);
    resultPost = {
      id: postId,
      trend_id: trend.id,
      trend_title: trend.title,
      post_content: postContent,
      comment_content: commentContent,
      source_urls: sourceUrls,
      status: 'draft',
    };

    db.prepare(`
      INSERT INTO posts (id, trend_id, trend_title, post_content, comment_content, source_urls, status)
      VALUES (@id, @trend_id, @trend_title, @post_content, @comment_content, @source_urls, @status)
    `).run({
      id: resultPost.id,
      trend_id: resultPost.trend_id || null,
      trend_title: resultPost.trend_title,
      post_content: resultPost.post_content,
      comment_content: resultPost.comment_content,
      source_urls: JSON.stringify(resultPost.source_urls),
      status: resultPost.status,
    });
    logActivity('SUCCESS', 'GENERATE', `Tạo bài viết mới ${postId} cho "${trend.title}".`);
  }

  // Mark trend status as drafted
  if (trend.id) {
    db.prepare(`UPDATE trends SET status = 'drafted' WHERE id = ?`).run(trend.id);
  }
  db.prepare(`UPDATE trends SET status = 'drafted' WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))`).run(trend.title);
  trend.status = 'drafted';

  return resultPost;
}
