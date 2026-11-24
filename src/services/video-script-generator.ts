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
    .replace(/\.{2,}|…/g, '.') // Loại bỏ hoàn toàn dấu ba chấm (...) và dấu lửng (…)
    .replace(/\s*\.\s*\./g, '.')
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
        .map((a, i) => `Bài báo ${i + 1} (${a.source || 'Báo chí'} - "${a.title}"):\n${a.content?.slice(0, 3500) || a.snippet || ''}`)
        .join('\n\n');

      const prompt = `
Bạn là biên tập viên tin tức kinh tế & tài chính chuyên nghiệp.
Nhiệm vụ của bạn: ĐỌC KỸ TOÀN BỘ BÀI BÁO dưới đây và TÓM TẮT THÀNH ĐÚNG TỪ 3 ĐẾN 7 Ý CHÍNH quan trọng nhất (để làm slide video ngắn 9:16).

Chủ đề: "${trend.title}"
Khu vực: ${trend.geo || 'VN'}
Thông tin bài báo nguồn:
${articlesContext || trend.title}

🚨 QUY TẮC TÓM TẮT BẮT BUỘC:
1. Đọc hiểu toàn diện bài viết, sau đó cô đọng thành ĐÚNG TỪ 3 ĐẾN 7 Ý CHÍNH (tổng số fragments trong contentSlides phải từ 3 đến 7 ý):
   - Ý 1: Diễn biến/Sự kiện cốt lõi quan trọng nhất kèm số liệu chủ đạo.
   - Ý 2: Nguyên nhân, bối cảnh hoặc động thái từ cơ quan/doanh nghiệp liên quan.
   - Ý 3: Tác động trực tiếp đến thị trường, nhà đầu tư hoặc nền kinh tế.
   - Ý 4 - 7 (nếu có thêm thông tin): Số liệu chi tiết bổ sung, dự báo hoặc khuyến nghị chuyên gia.
2. Mỗi ý chính (fragment) PHẢI LÀ MỘT CÂU VĂN HOÀN CHỈNH, ngắn gọn, súc tích (15 - 30 từ), ngữ pháp chuẩn và kết thúc bằng dấu chấm.
3. TUYỆT ĐỐI KHÔNG DÙNG DẤU BA CHẤM (... hoặc …), không viết câu lửng, không cắt ngang ý.
4. TUYỆT ĐỐI KHÔNG DÙNG TỪ CẤM: "Google", "Slide", "Trang trình bày".
5. Cấu trúc kịch bản JSON chuẩn:
   - intro: Tiêu đề cố định "Financial News", categoryLabel chuyên nghiệp ("BẢN TIN THỊ TRƯỜNG"), tagline súc tích.
   - slide1: Headline sắc bén giật tít tóm tắt sự kiện chính (dưới 16 từ), timestamp ("Mới nhất" hoặc ngày giờ thực tế).
   - contentSlides: Chứa danh sách 3 đến 7 ý chính (fragments) đã tóm tắt ở trên.
   - outro: ctaText "Đăng ký kênh để nhận tin mỗi ngày", subText "Cập nhật chuyển động kinh tế mỗi ngày".

Trả về DUY NHẤT một JSON hợp lệ dạng:
{
  "intro": {
    "categoryLabel": "BẢN TIN THỊ TRƯỜNG",
    "mainTitle": "Financial News",
    "tagline": "Chuyển động tài chính & kinh tế nóng nhất"
  },
  "slide1": {
    "category": "TIN NÓNG",
    "headline": "Tiêu đề giật tít tóm tắt sự kiện",
    "timestamp": "Cập nhật mới nhất"
  },
  "contentSlides": [
    {
      "title": "Diễn biến trọng điểm & Số liệu",
      "fragments": [
        "Ý chính 1: Diễn biến sự kiện quan trọng nhất kèm số liệu cốt lõi.",
        "Ý chính 2: Nguyên nhân hoặc động thái từ các bên liên quan.",
        "Ý chính 3: Tác động đến thị trường và nhà đầu tư.",
        "Ý chính 4: Diễn biến mới nhất hoặc khuyến nghị phân tích."
      ]
    }
  ],
  "outro": {
    "ctaText": "Đăng ký kênh để nhận tin mỗi ngày",
    "subText": "Cảm ơn bạn đã theo dõi bản tin"
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
 * Hậu kiểm và làm sạch kịch bản (Xóa từ cấm + Bọc metric chống ngắt dòng + Chuẩn hóa 3-7 ý chính)
 */
function sanitizeAndFormatScript(script: VideoSlideScript): VideoSlideScript {
  // Gom và làm sạch tất cả fragments để đảm bảo đúng từ 3 đến 7 ý chính chất lượng
  const allFragments: string[] = [];
  for (const cs of script.contentSlides || []) {
    for (const f of cs.fragments || []) {
      if (!f) continue;
      let clean = cleanForbiddenWords(f.trim())
        .replace(/\.{2,}|…/g, '.')
        .replace(/\s*\.\s*\./g, '.')
        .replace(/\s+/g, ' ')
        .trim();

      if (clean.length >= 15) {
        if (!/[.!?]$/.test(clean)) {
          clean += '.';
        }
        if (!allFragments.includes(clean)) {
          allFragments.push(clean);
        }
      }
    }
  }

  // Chuẩn hóa: Giữ tối đa 7 ý chính quan trọng nhất
  const targetFragments = allFragments.slice(0, 7);

  // Đảm bảo tối thiểu 3 ý chính
  if (targetFragments.length < 3) {
    if (targetFragments.length === 1) {
      targetFragments.push('Các số liệu và dữ liệu liên quan đang tiếp tục được giới phân tích theo dõi sát sao.');
      targetFragments.push('Khuyến nghị theo dõi diễn biến tiếp theo để nắm bắt kịp thời các cơ hội thị trường.');
    } else if (targetFragments.length === 2) {
      targetFragments.push('Khuyến nghị theo dõi diễn biến tiếp theo để nắm bắt kịp thời các cơ hội thị trường.');
    } else if (targetFragments.length === 0) {
      targetFragments.push(`Chủ đề "${cleanForbiddenWords(script.slide1?.headline || '')}" đang thu hút sự chú ý đặc biệt.`);
      targetFragments.push('Các chỉ số kinh tế liên quan tiếp tục ghi nhận biến động đáng kể.');
      targetFragments.push('Nhà đầu tư được khuyến nghị thận trọng và theo sát các tín hiệu mới nhất.');
    }
  }

  return {
    intro: {
      categoryLabel: cleanForbiddenWords(script.intro?.categoryLabel || 'BẢN TIN TÀI CHÍNH'),
      mainTitle: 'Financial News',
      tagline: cleanForbiddenWords(script.intro?.tagline || 'Cập nhật tin tức thị trường mới nhất'),
    },
    slide1: {
      category: cleanForbiddenWords(script.slide1?.category || 'TIN NÓNG THỊ TRƯỜNG'),
      headline: cleanForbiddenWords(script.slide1?.headline || 'Tiêu điểm tài chính'),
      timestamp: cleanForbiddenWords(script.slide1?.timestamp || 'Mới nhất'),
    },
    contentSlides: [
      {
        title: cleanForbiddenWords(script.contentSlides?.[0]?.title || 'Diễn biến trọng điểm & Số liệu'),
        fragments: targetFragments.map((frag) => wrapMetricsInHtml(frag)),
      },
    ],
    outro: {
      ctaText: 'Đăng ký kênh để nhận tin mỗi ngày',
      subText: cleanForbiddenWords(script.outro?.subText || 'Theo dõi để cập nhật tin tài chính sớm nhất'),
    },
  };
}

/**
 * Thuật toán Extractive Summarization: Tự động đọc bài viết và tóm tắt thành đúng 3-7 ý chính
 * có trọng số cao nhất (dùng khi chạy Offline hoặc không có Gemini AI).
 */
function createSmartFallbackScript(trend: TrendItem, articles: NewsArticle[]): VideoSlideScript {
  const cleanTitle = cleanForbiddenWords(trend.title);
  const titleKeywords = cleanTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  interface ScoredSentence {
    text: string;
    score: number;
    originalOrder: number;
  }

  const scoredList: ScoredSentence[] = [];
  const seen = new Set<string>();
  let globalOrder = 0;

  // 1. Quét toàn bộ nội dung các bài báo nguồn
  for (const art of articles) {
    const rawText = (art.content || art.snippet || '').replace(/\r?\n+/g, ' ');
    const sentences = rawText.split(/(?<=[.!?])\s+/);

    for (let sIdx = 0; sIdx < sentences.length; sIdx++) {
      let clean = cleanForbiddenWords(sentences[sIdx].trim())
        .replace(/\.{2,}|…/g, '.')
        .replace(/\s*\.\s*\./g, '.')
        .replace(/\s+/g, ' ')
        .trim();

      // Lọc câu có độ dài chuẩn (từ 25 đến 160 ký tự) và không phải câu điều hướng
      if (clean.length < 25 || clean.length > 160) continue;
      if (/^(quảng cáo|chia sẻ|theo dõi|đọc thêm|xem thêm|bình luận|nguồn:|ảnh:|video:|liên quan:|bài viết)/i.test(clean)) continue;

      if (!/[.!?]$/.test(clean)) clean += '.';

      const norm = clean.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);

      let score = 0;

      // Điểm vị trí: Đoạn đầu (Sapo) của bài báo là tóm tắt quan trọng nhất
      if (sIdx === 0) score += 6;
      else if (sIdx <= 2) score += 4;
      else if (sIdx <= 5) score += 2;

      // Điểm số liệu tài chính (% / tỷ / triệu / USD / điểm / tăng / giảm...)
      if (/(\d+(?:[.,]\d+)?\s*(?:%|tỷ|triệu|nghìn|USD|VND|đồng|đô|điểm|cổ phiếu|tấn|thùng))/i.test(clean)) {
        score += 5;
      }
      if (/(tăng|giảm|đạt|vượt|lãi|lỗ|kỷ lục|phục hồi|doanh thu|lợi nhuận|dự báo|khuyến nghị)/i.test(clean)) {
        score += 3;
      }

      // Điểm khớp từ khóa xu hướng
      for (const kw of titleKeywords) {
        if (norm.includes(kw)) {
          score += 2;
        }
      }

      scoredList.push({
        text: clean,
        score,
        originalOrder: globalOrder++,
      });
    }
  }

  // 2. Bổ sung từ snippet hoặc tiêu đề bài báo nếu bài viết chưa đủ câu
  if (scoredList.length < 3 && articles.length > 0) {
    for (const art of articles) {
      let text = cleanForbiddenWords(art.snippet || art.title);
      if (text && text.length >= 25 && !seen.has(text.toLowerCase())) {
        if (!/[.!?]$/.test(text)) text += '.';
        seen.add(text.toLowerCase());
        scoredList.push({ text, score: 5, originalOrder: globalOrder++ });
      }
    }
  }

  // 3. Fallback tối thiểu nếu hoàn toàn không có bài báo
  if (scoredList.length === 0) {
    scoredList.push({
      text: `Chủ đề "${cleanTitle}" đang thu hút sự quan tâm lớn từ giới đầu tư và thị trường tài chính.`,
      score: 10,
      originalOrder: 0,
    });
    scoredList.push({
      text: `Các chỉ số và dữ liệu diễn biến liên tục được cập nhật theo sát các động thái mới nhất.`,
      score: 8,
      originalOrder: 1,
    });
    scoredList.push({
      text: `Giới chuyên gia khuyến nghị nhà đầu tư theo dõi sát các mốc biến động quan trọng.`,
      score: 6,
      originalOrder: 2,
    });
  }

  // Lấy top câu có điểm cao nhất: từ 3 đến tối đa 7 ý chính
  const targetCount = Math.max(3, Math.min(7, scoredList.length));
  const topScored = scoredList
    .sort((a, b) => b.score - a.score)
    .slice(0, targetCount);

  // Sắp xếp lại theo thứ tự ban đầu để đảm bảo mạch tin tức tự nhiên
  topScored.sort((a, b) => a.originalOrder - b.originalOrder);

  const fragments = topScored.map((item) => wrapMetricsInHtml(item.text));

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
        title: 'Diễn biến trọng điểm & Số liệu',
        fragments,
      },
    ],
    outro: {
      ctaText: 'Đăng ký kênh để nhận tin mỗi ngày',
      subText: 'Cảm ơn bạn đã theo dõi bản tin',
    },
  };
}
