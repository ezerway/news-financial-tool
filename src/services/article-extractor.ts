import * as cheerio from 'cheerio';
import { logActivity } from '@/lib/db';
import { NewsArticle } from '@/types';

function cleanWhitespace(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Trích xuất nội dung bài báo chính từ URL thông qua HTTP fetch + Cheerio.
 * Nếu bị chặn (403/Cloudflare/SPA), tự động dự phòng sang Playwright Headless.
 */
export async function extractSingleArticle(
  url: string,
  timeoutMs = 8000
): Promise<{ title?: string; sapo?: string; body?: string; fullText?: string }> {
  if (!url || !url.startsWith('http')) {
    return {};
  }

  // 1. Thử cào nhanh bằng fetch + Cheerio
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok) {
      const html = await res.text();
      const extracted = parseHtmlArticle(html);
      if (extracted.body && extracted.body.length >= 100) {
        return extracted;
      }
    }
  } catch (err: any) {
    // Nếu fetch timeout hoặc lỗi mạng, thử fallback sang Playwright
  }

  // 2. Dự phòng bằng Playwright Headless nếu fetch không lấy được nội dung (do Cloudflare hoặc JS render)
  try {
    const extracted = await extractWithPlaywright(url, timeoutMs);
    if (extracted.body && extracted.body.length >= 100) {
      return extracted;
    }
  } catch (pwErr: any) {
    // Bỏ qua nếu cả 2 phương thức đều không thành công
  }

  return {};
}

/**
 * Bóc tách nội dung bài báo từ chuỗi HTML bằng Cheerio
 */
function parseHtmlArticle(html: string): { title?: string; sapo?: string; body?: string; fullText?: string } {
  const $ = cheerio.load(html);

  // Loại bỏ các thẻ rác và vùng không thuộc nội dung bài báo
  $(
    'script, style, noscript, iframe, svg, nav, footer, header, aside, form, button, input, select'
  ).remove();
  $(
    '.ads, .ad, .banner, .box-category, .box-relate, .relate-news, .relate, .box-lienquan, ' +
    '.social-share, .share, .comment, .box-comment, .author-info, .sidebar, .tags, .breadcrumbs, ' +
    '.menu, .header, .footer, .sticky, .popup, .modal, .widget, .vne-banner, .dantri-ads'
  ).remove();

  // Tiêu đề
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1').first().text() ||
    $('title').text() ||
    '';

  // Sapo / Tóm tắt mở đầu
  const sapo =
    $('.sapo, .lead, .description, h2.sapo, .article-summary, .news-sapo, [itemprop="description"]')
      .first()
      .text() ||
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  // Khung chứa nội dung bài báo theo chuẩn của các báo Việt Nam & Quốc tế
  const contentSelectors = [
    'article',
    '[itemprop="articleBody"]',
    '.fck_detail',           // VnExpress
    '.detail__content',       // Dân Trí
    '.content_detail',        // Tuổi Trẻ
    '.detail-content',        // Thanh Niên
    '.detail-cmain',          // CafeF
    '.article__body',         // Zing / Znews
    '.story-body',            // BBC / Reuters
    '.post-content',
    '.entry-content',
    '.article-content',
    'main',
  ];

  let $contentContainer: any = null;
  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length > 0 && el.text().trim().length > 150) {
      $contentContainer = el.first();
      break;
    }
  }

  const paragraphs: string[] = [];
  if ($contentContainer) {
    $contentContainer.find('p').each((_: any, p: any) => {
      const pText = cleanWhitespace($(p).text());
      // Lọc các đoạn văn có ý nghĩa (tránh câu chú thích ảnh cụt hoặc thông báo bản quyền ngắn)
      if (pText.length > 35 && !pText.toLowerCase().includes('ảnh:') && !pText.toLowerCase().includes('theo nguồn')) {
        paragraphs.push(pText);
      }
    });
  }

  // Nếu bộ selector chưa gom được paragraphs, quét các thẻ p trong body
  if (paragraphs.length === 0) {
    $('p').each((_: any, p: any) => {
      const pText = cleanWhitespace($(p).text());
      if (pText.length > 45) {
        paragraphs.push(pText);
      }
    });
  }

  const cleanTitle = cleanWhitespace(title);
  const cleanSapo = cleanWhitespace(sapo);
  // Lấy tối đa khoảng 6-8 đoạn văn chính để đảm bảo súc tích, đủ dữ kiện
  const cleanBody = paragraphs.slice(0, 8).join('\n\n');

  const fullTextParts: string[] = [];
  if (cleanTitle) fullTextParts.push(`Tiêu đề: ${cleanTitle}`);
  if (cleanSapo && cleanSapo !== cleanTitle) fullTextParts.push(`Tóm tắt: ${cleanSapo}`);
  if (cleanBody) fullTextParts.push(`Nội dung chi tiết:\n${cleanBody}`);

  if (fullTextParts.length === 1) {
    fullTextParts[0] = cleanWhitespace(fullTextParts.at(0)?.split(':').at(1) ?? '');
  }

  const fullText = fullTextParts.join('\n\n');

  // Giới hạn tối đa ~2.000 ký tự cho mỗi bài để tối ưu token cho Gemini
  const truncatedFullText = fullText.length > 2200 ? fullText.slice(0, 2200) + '...' : fullText;

  return {
    title: cleanTitle,
    sapo: cleanSapo,
    body: cleanBody,
    fullText: truncatedFullText,
  };
}

/**
 * Trích xuất dự phòng qua Playwright Headless cho các trang SPA / Cloudflare
 */
async function extractWithPlaywright(
  url: string,
  timeoutMs = 10000
): Promise<{ title?: string; sapo?: string; body?: string; fullText?: string }> {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  try {
    const page = await context.newPage();
    // Chặn tải hình ảnh, font, css để tải nhanh gấp 5 lần
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,eot,mp4,mp3}', (route) => route.abort());

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const html = await page.content();
    return parseHtmlArticle(html);
  } finally {
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
  }
}

/**
 * Đọc và trích xuất nội dung toàn văn cho một danh sách bài báo nguồn.
 * Tự động bỏ qua các bài đã có content hoặc liên kết không hợp lệ.
 */
export async function extractArticlesContent(articles: NewsArticle[]): Promise<NewsArticle[]> {
  if (!articles || articles.length === 0) return [];

  const validArticles = articles.filter(
    (a) => a.url && a.url.startsWith('http') && !a.url.includes('google.com')
  );

  const extractPromises = validArticles.map(async (art) => {
    // Nếu bài báo đã có content đầy đủ (từ cache), không cào lại
    if (art.content && art.content.length > 150) {
      return art;
    }

    try {
      logActivity('INFO', 'EXTRACTOR', `Đang đọc nội dung bài báo nguồn [${art.source || 'Báo chí'}]: ${art.url.slice(0, 60)}...`);
      const extracted = await extractSingleArticle(art.url, 8000);

      if (extracted.fullText && extracted.fullText.length > 100) {
        art.content = extracted.fullText;
        art.extracted_at = new Date().toISOString();
        if (extracted.title && (!art.title || art.title.length < 15)) {
          art.title = extracted.title;
        }
        logActivity('SUCCESS', 'EXTRACTOR', `Đã trích xuất ${art.content.length} ký tự nội dung từ: "${art.title.slice(0, 50)}..."`);
      } else {
        // Nếu không trích xuất được thân bài, dùng tạm snippet
        art.content = art.snippet ? `Tóm tắt: ${art.snippet}` : undefined;
      }
    } catch (err: any) {
      logActivity('WARN', 'EXTRACTOR', `Không thể trích xuất nội dung từ ${art.url}: ${err?.message}`);
      if (art.snippet) {
        art.content = `Tóm tắt: ${art.snippet}`;
      }
    }

    return art;
  });

  // Chạy song song tối đa các bài báo với Promise.allSettled
  await Promise.allSettled(extractPromises);
  return validArticles;
}
