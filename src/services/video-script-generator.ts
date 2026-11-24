import { GoogleGenAI } from '@google/genai';
import { TrendItem, NewsArticle } from '@/types';
import { getSetting, logActivity } from '@/lib/db';
import { resolveGeminiApiKey } from './ai-generator';
import { extractArticlesContent } from './article-extractor';
import { findExactNewsSources } from './crawler';

export interface VideoSlideScript {
  intro: {
    categoryLabel: string;
    mainTitle: string;
    tagline: string;
  };
  slide1: {
    category: string;
    headline: string;
    timestamp: string;
  };
  contentSlides: Array<{
    title: string;
    fragments: string[];
  }>;
  outro: {
    ctaText: string;
    subText: string;
  };
}

/**
 * Xóa sạch tất cả các từ cấm ("Google", "Slide", "Google Trends", "Trang trình bày")
 */
export function cleanForbiddenWords(text: string): string {
  if (!text) return '';
  return text
    .replace(/\bgoogle\s*trends\b/gi, 'Xu hướng thị trường')
    .replace(/\bgoogle\b/gi, '')
    .replace(/\bslide\s*\d*\b/gi, 'Bản tin')
    .replace(/\btrang\s*trình\s*bày\b/gi, 'Bản tin')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Bọc các cụm số liệu + đơn vị bằng class `metric-nowrap` để chống ngắt dòng
 * Ví dụ: "10.000 tỷ", "+15.8%", "500 triệu USD", "85.000 đồng"
 */
export function wrapMetricsInHtml(text: string): string {
  if (!text) return '';
  // Đã có class metric-nowrap thì bỏ qua
  if (text.includes('metric-nowrap')) return text;

  // Regex phát hiện số liệu và đơn vị đi kèm:
  // (dấu +/- nếu có)(chữ số có chấm/phẩy)(khoảng trắng tùy chọn)(đơn vị: tỷ, triệu, nghìn, USD, VND, %, điểm, đồng, tấn, thùng, cổ phiếu)
  const metricRegex = /([+\-–]?\d+(?:[.,]\d+)*(?:\s*(?:%|tỷ|triệu|nghìn|USD|VND|đồng|đô|điểm|cổ phiếu|tấn|thùng|căn|vé|người))(?:\s*(?:USD|VND|VNĐ|đồng))?)/gi;

  return text.replace(metricRegex, (match) => {
    return `<span class="metric-nowrap font-bold text-amber-400">${match.trim()}</span>`;
  });
}

/**
 * Tạo kịch bản Slide Video 9:16 đa tầng (Gemini -> Alternate AI -> Smart Extractor Fallback)
 */
export async function generateVideoSlideScript(trend: TrendItem): Promise<VideoSlideScript> {
  // 1. Chuẩn bị nguồn bài báo gốc
  let exactArticles: NewsArticle[] = (trend.articles || []).filter(
    (a) => a.url && !a.url.includes('google.com')
  );

  if (exactArticles.length === 0) {
    exactArticles = await findExactNewsSources(trend.title, trend.geo || 'VN', 3);
  }

  // Đọc nội dung bài báo nếu chưa có
  const needsExtraction = exactArticles.some((a) => !a.content || a.content.length < 100);
  if (needsExtraction && exactArticles.length > 0) {
    try {
      exactArticles = await extractArticlesContent(exactArticles);
    } catch {}
  }

  // 2. Tầng 1: Google Gemini API
  const geminiApiKey = resolveGeminiApiKey();
  if (geminiApiKey) {
    try {
      logActivity('INFO', 'VIDEO_SCRIPT', `Đang sinh kịch bản Slide bằng Gemini AI cho: "${trend.title}"...`);
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });

      const articlesContext = exactArticles
        .map((a, i) => `Bài báo ${i + 1} (${a.source || 'Báo chí'} - "${a.title}"):\n${a.content?.slice(0, 800) || a.snippet || ''}`)
        .join('\n\n');

      const prompt = `
Bạn là đạo diễn nội dung bản tin tài chính ngắn (15 - 30s) phong cách hiện đại, tối giản.
Hãy tạo kịch bản trình chiếu slide dọc 9:16 từ chủ đề xu hướng và bài báo sau:

Chủ đề: "${trend.title}"
Khu vực: ${trend.geo || 'VN'}
Thông tin bài báo:
${articlesContext || trend.title}

🚨 QUY TẮC BẮT BUỘC:
1. TUYỆT ĐỐI KHÔNG DÙNG TỪ "Google", "Slide", "Trang trình bày" trong bất kỳ đâu của phản hồi.
2. Cấu trúc gồm 3 phần:
   - intro: Tiêu đề cố định "Financial News", categoryLabel chuyên nghiệp ("BẢN TIN THỊ TRƯỜNG"), tagline súc tích.
   - slide1: Headline chính liên quan trực tiếp đến từ khóa, giật tít sắc bén, ngắn gọn dưới 16 từ.
   - contentSlides: Đúng 1 đến 2 slide tiếp theo. Mỗi slide có 2-3 gạch đầu dòng (fragments). PHẢI CHẮT LỌC SỐ LIỆU THỰC TẾ từ bài báo (tỷ lệ %, tiền tệ, số lượng).
   - outro: ctaText cố định "Đăng ký kênh để nhận tin mỗi ngày", subText "Cập nhật chuyển động kinh tế mỗi ngày".

Trả về DUY NHẤT một JSON hợp lệ dạng:
{
  "intro": {
    "categoryLabel": "BẢN TIN THỊ TRƯỜNG",
    "mainTitle": "Financial News",
    "tagline": "Chuyển động tài chính & kinh tế nóng nhất"
  },
  "slide1": {
    "category": "TIN NÓNG",
    "headline": "Tiêu đề hấp dẫn ngắn gọn",
    "timestamp": "Cập nhật mới nhất"
  },
  "contentSlides": [
    {
      "title": "Diễn biến trọng điểm",
      "fragments": [
        "Ý thứ nhất chứa số liệu cụ thể",
        "Ý thứ hai chứa diễn biến thị trường",
        "Ý thứ ba chứa nhận định chuyên gia"
      ]
    }
  ],
  "outro": {
    "ctaText": "Đăng ký kênh để nhận tin mỗi ngày",
    "subText": "Cập nhật xu hướng tài chính hàng ngày"
  }
}
`;

      const modelsToTry = [
        'gemini-3.5-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ];

      for (const modelName of modelsToTry) {
        try {
          const res = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
          });
          if (res.text) {
            const cleaned = res.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned) as VideoSlideScript;
            if (parsed.intro && parsed.slide1 && Array.isArray(parsed.contentSlides)) {
              logActivity('SUCCESS', 'VIDEO_SCRIPT', `Đã tạo kịch bản slide thành công qua Gemini (${modelName})`);
              return sanitizeAndFormatScript(parsed);
            }
          }
        } catch (mErr: any) {
          // Thử model tiếp theo
        }
      }
    } catch (apiErr: any) {
      logActivity('WARN', 'VIDEO_SCRIPT', `Gemini API không phản hồi: ${apiErr?.message}, chuyển sang tầng dự phòng.`);
    }
  }

  // 3. Tầng 3: Smart Extractor Fallback (100% Offline, không phụ thuộc API ngoài)
  logActivity('INFO', 'VIDEO_SCRIPT', `Sử dụng Smart Extractor Fallback để tạo kịch bản slide từ bài báo nguồn.`);
  return createSmartFallbackScript(trend, exactArticles);
}

/**
 * Hậu kiểm và làm sạch kịch bản (Xóa từ cấm + Bọc metric chống ngắt dòng)
 */
function sanitizeAndFormatScript(script: VideoSlideScript): VideoSlideScript {
  return {
    intro: {
      categoryLabel: cleanForbiddenWords(script.intro.categoryLabel || 'BẢN TIN TÀI CHÍNH'),
      mainTitle: 'Financial News',
      tagline: cleanForbiddenWords(script.intro.tagline || 'Cập nhật tin tức thị trường mới nhất'),
    },
    slide1: {
      category: cleanForbiddenWords(script.slide1.category || 'TIN NÓNG THỊ TRƯỜNG'),
      headline: cleanForbiddenWords(script.slide1.headline),
      timestamp: cleanForbiddenWords(script.slide1.timestamp || 'Mới nhất'),
    },
    contentSlides: (script.contentSlides || []).map((slide) => ({
      title: cleanForbiddenWords(slide.title || 'Thông tin chi tiết'),
      fragments: (slide.fragments || []).map((frag) => wrapMetricsInHtml(cleanForbiddenWords(frag))),
    })),
    outro: {
      ctaText: 'Đăng ký kênh để nhận tin mỗi ngày',
      subText: cleanForbiddenWords(script.outro.subText || 'Theo dõi để cập nhật tin tài chính sớm nhất'),
    },
  };
}

/**
 * Thuật toán Smart Extractor tự động chắt lọc số liệu từ bài báo khi không có AI
 */
function createSmartFallbackScript(trend: TrendItem, articles: NewsArticle[]): VideoSlideScript {
  const cleanTitle = cleanForbiddenWords(trend.title);

  // Tìm các câu có chứa số liệu hoặc từ khóa kinh tế trong bài báo
  const sentencesWithMetrics: string[] = [];

  for (const art of articles) {
    const rawText = (art.content || art.snippet || '').replace(/\r?\n+/g, ' ');
    const sentences = rawText.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      const clean = cleanForbiddenWords(sentence.trim());
      // Lọc các câu có độ dài vừa phải và có chứa số liệu hoặc từ khóa quan trọng
      if (clean.length >= 25 && clean.length <= 130) {
        if (/(\d+(?:[.,]\d+)?\s*(?:%|tỷ|triệu|nghìn|USD|VND|đồng|điểm|cổ phiếu|tăng|giảm|đạt|vượt))/i.test(clean)) {
          if (!sentencesWithMetrics.includes(clean)) {
            sentencesWithMetrics.push(clean);
          }
        }
      }
      if (sentencesWithMetrics.length >= 4) break;
    }
    if (sentencesWithMetrics.length >= 4) break;
  }

  // Nếu chưa đủ 4 câu, bổ sung các câu thông tin quan trọng khác từ bài báo
  if (sentencesWithMetrics.length < 4) {
    for (const art of articles) {
      const rawText = (art.content || art.snippet || '').replace(/\r?\n+/g, ' ');
      const sentences = rawText.split(/(?<=[.!?])\s+/);
      for (const sentence of sentences) {
        const clean = cleanForbiddenWords(sentence.trim());
        if (clean.length >= 25 && clean.length <= 130 && !sentencesWithMetrics.includes(clean)) {
          sentencesWithMetrics.push(clean);
          if (sentencesWithMetrics.length >= 4) break;
        }
      }
      if (sentencesWithMetrics.length >= 4) break;
    }
  }

  // Nếu vẫn không đủ câu, lấy các câu đầu của bài báo
  if (sentencesWithMetrics.length < 2 && articles.length > 0) {
    const fallbackSentence = cleanForbiddenWords(articles[0].snippet || articles[0].title);
    if (fallbackSentence && !sentencesWithMetrics.includes(fallbackSentence)) {
      sentencesWithMetrics.push(fallbackSentence);
    }
  }

  if (sentencesWithMetrics.length === 0) {
    sentencesWithMetrics.push(`Chủ đề "${cleanTitle}" đang thu hút sự quan tâm lớn từ giới đầu tư và thị trường.`);
    sentencesWithMetrics.push(`Các chỉ số và dữ liệu liên quan tiếp tục được các phương tiện truyền thông theo dõi sát sao.`);
  }

  // Lấy tối đa 4 fragments (sẽ tự động phân trang thành 2 slide, mỗi slide 2 block)
  const fragments = sentencesWithMetrics.slice(0, 4).map((s) => wrapMetricsInHtml(s));

  return {
    intro: {
      categoryLabel: 'BẢN TIN THỊ TRƯỜNG',
      mainTitle: 'Financial News',
      tagline: 'Cập nhật chuyển động kinh tế & thị trường',
    },
    slide1: {
      category: 'TIÊU ĐIỂM HÔM NAY',
      headline: cleanTitle,
      timestamp: 'Hôm nay',
    },
    contentSlides: [
      {
        title: 'Diễn biến & Số liệu chính',
        fragments: fragments,
      },
    ],
    outro: {
      ctaText: 'Đăng ký kênh để nhận tin mỗi ngày',
      subText: 'Bấm chuông để không bỏ lỡ các tin tức kinh tế nóng',
    },
  };
}
