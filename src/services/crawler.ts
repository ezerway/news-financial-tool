import crypto from 'crypto';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import db, { logActivity } from '@/lib/db';
import { TrendItem, NewsArticle } from '@/types';
import { getChromiumLaunchArgs } from '@/services/playwright/session';

function cleanHtmlText(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Find exact news article sources from publisher websites for a given trend query.
 * Strictly filters out any Google Trends, Google Search, or search engine links.
 */
export async function findExactNewsSources(
  query: string,
  geo = 'VN',
  limit = 3
): Promise<NewsArticle[]> {
  try {
    const isVn = geo === 'VN';
    const searchQuery = `${query} ${isVn ? 'tin tức' : 'news'}`;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const articles: NewsArticle[] = [];

    $('.result').each((_, el) => {
      if (articles.length >= limit) return false;

      const titleEl = $(el).find('.result__title .result__a');
      const snippetEl = $(el).find('.result__snippet');
      const rawUrl = titleEl.attr('href') || '';

      const title = cleanHtmlText(titleEl.text());
      const snippet = cleanHtmlText(snippetEl.text());

      let link = rawUrl;
      try {
        if (rawUrl.includes('uddg=')) {
          const params = new URLSearchParams(rawUrl.split('?')[1]);
          const decoded = params.get('uddg');
          if (decoded) link = decodeURIComponent(decoded);
        }
      } catch {}

      if (
        link &&
        link.startsWith('http') &&
        !link.includes('google.com') &&
        !link.includes('duckduckgo.com') &&
        !link.includes('bing.com') &&
        !link.includes('yahoo.com/search')
      ) {
        let source = '';
        try {
          const parsed = new URL(link);
          source = parsed.hostname.replace(/^www\./, '');
        } catch {
          source = isVn ? 'Báo chí' : 'News';
        }

        articles.push({
          title: title || query,
          snippet,
          url: link,
          source,
        });
      }
    });

    return articles;
  } catch (err: any) {
    return [];
  }
}

/**
 * Shared database upsert for trends
 */
export function saveTrendsToDatabase(trends: TrendItem[], geo: string): number {
  // Clear previous un-drafted trend items for this geo before saving newly crawled ones
  db.prepare(`
    DELETE FROM trends 
    WHERE geo = ? AND id NOT IN (SELECT trend_id FROM posts WHERE trend_id IS NOT NULL)
  `).run(geo);

  const insertStmt = db.prepare(`
    INSERT INTO trends (id, title, geo, approx_traffic, pub_date, articles_json, category, status)
    VALUES (@id, @title, @geo, @approx_traffic, @pub_date, @articles_json, @category, @status)
    ON CONFLICT(id) DO UPDATE SET
      approx_traffic = excluded.approx_traffic,
      articles_json = excluded.articles_json
  `);

  const tx = db.transaction((items: TrendItem[]) => {
    let count = 0;
    for (const t of items) {
      insertStmt.run({
        id: t.id,
        title: t.title,
        geo: t.geo,
        approx_traffic: t.approx_traffic,
        pub_date: t.pub_date,
        articles_json: JSON.stringify(t.articles),
        category: t.category,
        status: t.status,
      });
      count++;
    }
    return count;
  });

  return tx(trends);
}

/**
 * Primary Crawl Method:
 * Crawl Google Trends for Business & Finance (category=3) directly using Playwright.
 * Clicks on each trending row to extract the exact publisher source links under "In the news".
 */
export async function crawlGoogleTrendsCategory3(geo = 'VN'): Promise<TrendItem[]> {
  const targetGeo = geo === 'all' ? 'VN' : geo;
  const targetUrl = `https://trends.google.com/trending?category=3&geo=${encodeURIComponent(targetGeo)}&hl=en-US`;
  logActivity('INFO', 'CRAWL', `[Google Trends Finance] Đang mở danh mục Kinh doanh & Tài chính (category=3) cho ${targetGeo}: ${targetUrl}`);

  const browser = await chromium.launch({
    headless: true,
    args: getChromiumLaunchArgs(),
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1440, height: 900 },
    });

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(2000);

    // Handle Google cookie consent popup if present
    const consentBtn = page.getByRole('button', { name: /accept all|i agree|tôi đồng ý/i });
    if (await consentBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await consentBtn.click();
      await page.waitForTimeout(1000);
    }

    const rowLocators = page.locator('tbody tr').filter({ hasText: /\d+\+?/ });
    const count = await rowLocators.count();

    if (count === 0) {
      logActivity('WARN', 'CRAWL', `[Google Trends Finance] Không tìm thấy hàng dữ liệu nào tại ${targetUrl}`);
      return [];
    }

    logActivity('INFO', 'CRAWL', `[Google Trends Finance] Tìm thấy ${count} xu hướng. Đang trích xuất bài báo nguồn từ section "In the news"...`);

    const trendList: TrendItem[] = [];
    const limit = Math.min(count, 20);

    for (let i = 0; i < limit; i++) {
      const row = rowLocators.nth(i);

      // Extract row cell values (title and search volume)
      const rowData = await row.evaluate((tr) => {
        const tds = Array.from(tr.querySelectorAll('td'));
        const title = tds[1] ? tds[1].innerText.trim() : '';
        const traffic = tds[2] ? tds[2].innerText.split('\n')[0].trim() : '';
        return { title, traffic };
      });

      if (!rowData.title) continue;

      // Click row to open detail drawer / panel
      await row.scrollIntoViewIfNeeded();
      await row.click();
      await page.waitForTimeout(1000);

      // Extract real news publisher links under section "In the news"
      const articles: NewsArticle[] = await page.evaluate(() => {
        const allEls = Array.from(document.querySelectorAll('*'));
        const newsHeader = allEls.find((el) => {
          const text = (el.textContent || '').trim().toLowerCase();
          return (
            (text === 'in the news' || text === 'tin tức' || text === 'tin liên quan' || text.includes('in the news')) &&
            el.children.length === 0
          );
        });

        let container = newsHeader ? newsHeader.parentElement : null;
        while (container && container.querySelectorAll('a[href]').length === 0) {
          container = container.parentElement;
        }

        const searchRoot =
          container ||
          document.querySelector('aside, [role="complementary"], [role="dialog"], div[class*="detail" i]') ||
          document.body;

        const links = Array.from(searchRoot.querySelectorAll('a[target="_blank"][href]'))
          .filter(
            (a: any) =>
              a.href &&
              !a.href.includes('google.com') &&
              !a.href.includes('google.') &&
              a.innerText.trim().length > 3
          )
          .map((a: any) => {
            const lines = a.innerText.split('\n').map((s: string) => s.trim()).filter(Boolean);
            const title = lines[0] || '';
            let source = '';
            if (lines[1]) {
              const parts = lines[1].split('·');
              source = (parts[1] || parts[0]).trim();
            }
            if (!source) {
              try {
                source = new URL(a.href).hostname.replace(/^www\./, '');
              } catch {}
            }
            return {
              title,
              url: a.href,
              source: source || 'Báo chí',
              snippet: '',
            };
          });

        return links;
      });

      const id = 'trend_' + crypto.createHash('md5').update(`${targetGeo}_${rowData.title}`).digest('hex').substring(0, 12);

      trendList.push({
        id,
        title: rowData.title,
        geo: targetGeo,
        approx_traffic: rowData.traffic || '500+',
        pub_date: new Date().toISOString(),
        articles,
        category: 'finance',
        status: 'discovered',
      });
    }

    const savedCount = saveTrendsToDatabase(trendList, targetGeo);
    logActivity('SUCCESS', 'CRAWL', `[Google Trends Finance] Đã cào và lưu thành công ${savedCount} xu hướng Kinh doanh & Tài chính kèm đầy đủ link nguồn báo chí.`);

    return trendList;
  } catch (err: any) {
    logActivity('ERROR', 'CRAWL', `[Google Trends Finance] Lỗi khi cào dữ liệu: ${err.message}`);
    throw err;
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Main crawl entry point
 */
export async function crawlGoogleTrends(geo = 'VN', _method?: string): Promise<TrendItem[]> {
  return crawlGoogleTrendsCategory3(geo);
}

export function getStoredTrends(options?: { geo?: string; category?: string; status?: string; limit?: number }): TrendItem[] {
  let query = 'SELECT * FROM trends WHERE 1=1';
  const params: any[] = [];

  if (options?.geo && options.geo !== 'all') {
    query += ' AND geo = ?';
    params.push(options.geo);
  }

  if (options?.category && options.category !== 'all') {
    query += ' AND category = ?';
    params.push(options.category);
  }

  if (options?.status && options.status !== 'all') {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(options?.limit || 100);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map((r) => ({
    ...r,
    articles: r.articles_json ? JSON.parse(r.articles_json) : [],
  }));
}
