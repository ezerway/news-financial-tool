import db, { logActivity } from '@/lib/db';
import { TrendItem, PostItem, NewsArticle } from '@/types';

/**
 * Normalizes text keeping Vietnamese diacritics but stripping punctuation and collapsing whitespace.
 */
export function normalizeExact(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes text to ASCII (removing Vietnamese accents/diacritics) for fuzzy duplicate matching.
 */
export function normalizeLoose(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes URLs by removing protocol, www, trailing slashes, and analytics/tracking query params.
 */
export function normalizeUrl(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    const cleanParams = new URLSearchParams();
    for (const [key, val] of u.searchParams.entries()) {
      const k = key.toLowerCase();
      if (!k.startsWith('utm_') && k !== 'fbclid' && k !== 'ref' && k !== 'source' && k !== 'from') {
        cleanParams.append(key, val);
      }
    }
    const search = cleanParams.toString() ? `?${cleanParams.toString()}` : '';
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const pathname = u.pathname.replace(/\/+$/, '');
    return `${host}${pathname}${search}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const STOP_WORDS = new Set([
  'tin', 'tuc', 'moi', 'nhat', 'hom', 'nay', 've', 'cho', 'va', 'cua', 'tai', 'o',
  'la', 'cac', 'nhung', 'duoc', 'co', 'khi', 'de', 'den', 'news', 'the', 'and', 'in', 'at', 'on', 'to'
]);

/**
 * Computes token overlap similarity between two strings (0 to 1).
 */
export function calculateTokenSimilarity(strA: string, strB: string): number {
  const wordsA = normalizeLoose(strA)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const wordsB = normalizeLoose(strB)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));

  if (wordsA.length === 0 || wordsB.length === 0) return 0;

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let intersection = 0;
  for (const w of setA) {
    if (setB.has(w)) intersection++;
  }

  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  matchedPost?: PostItem;
  matchType?: 'id' | 'title_exact' | 'title_loose' | 'keyword_similarity' | 'source_url' | 'already_published';
}

/**
 * Retrieves all active posts from DB for deduplication comparison.
 */
export function getExistingPosts(): PostItem[] {
  try {
    const rows = db.prepare(`
      SELECT * FROM posts 
      WHERE status != 'failed'
      ORDER BY created_at DESC
    `).all() as any[];

    return rows.map((r) => ({
      ...r,
      source_urls: r.source_urls ? JSON.parse(r.source_urls) : [],
    }));
  } catch (err) {
    console.error('Error fetching existing posts for dedup:', err);
    return [];
  }
}

/**
 * Checks whether a candidate trend has already been processed or published in existing posts.
 */
export function findDuplicatePost(
  trend: { id?: string; title: string; articles?: NewsArticle[] },
  existingPostsList?: PostItem[]
): DuplicateCheckResult {
  const posts = existingPostsList || getExistingPosts();
  const trendTitleExact = normalizeExact(trend.title);
  const trendTitleLoose = normalizeLoose(trend.title);

  const candidateUrls = new Set(
    (trend.articles || [])
      .map((a) => normalizeUrl(a.url))
      .filter(Boolean)
  );

  for (const post of posts) {
    // 1. Direct ID match
    if (trend.id && post.trend_id === trend.id) {
      return {
        isDuplicate: true,
        reason: `Trùng ID xu hướng (${trend.id}) với bài viết [${post.id}] (Trạng thái: ${post.status})`,
        matchedPost: post,
        matchType: 'id',
      };
    }

    const postTitleExact = normalizeExact(post.trend_title);
    const postTitleLoose = normalizeLoose(post.trend_title);

    // 2. Exact Title match
    if (trendTitleExact && postTitleExact && trendTitleExact === postTitleExact) {
      return {
        isDuplicate: true,
        reason: `Tiêu đề xu hướng "${trend.title}" trùng khớp chính xác với bài viết [${post.id}]: "${post.trend_title}"`,
        matchedPost: post,
        matchType: 'title_exact',
      };
    }

    // 3. Loose Title match (ignoring accents)
    if (trendTitleLoose && postTitleLoose && trendTitleLoose === postTitleLoose) {
      return {
        isDuplicate: true,
        reason: `Tiêu đề xu hướng "${trend.title}" trùng nghĩa (không dấu) với bài viết [${post.id}]: "${post.trend_title}"`,
        matchedPost: post,
        matchType: 'title_loose',
      };
    }

    // 4. Source URL overlap (same underlying news link)
    if (candidateUrls.size > 0 && Array.isArray(post.source_urls)) {
      for (const pUrl of post.source_urls) {
        const normPostUrl = normalizeUrl(pUrl);
        if (normPostUrl && candidateUrls.has(normPostUrl)) {
          return {
            isDuplicate: true,
            reason: `Liên kết bài báo nguồn (${normPostUrl}) đã từng được đưa vào bài viết [${post.id}]: "${post.trend_title}"`,
            matchedPost: post,
            matchType: 'source_url',
          };
        }
      }
    }

    // 5. High keyword token similarity (> 60% keyword overlap)
    if (trendTitleLoose && postTitleLoose) {
      const similarity = calculateTokenSimilarity(trendTitleLoose, postTitleLoose);
      if (similarity >= 0.65) {
        return {
          isDuplicate: true,
          reason: `Từ khóa chính của xu hướng "${trend.title}" trùng lặp ${(similarity * 100).toFixed(0)}% với bài viết [${post.id}]: "${post.trend_title}"`,
          matchedPost: post,
          matchType: 'keyword_similarity',
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Checks whether an existing post can be published, preventing duplicate publishing.
 */
export function checkDuplicatePublish(
  post: PostItem,
  existingPostsList?: PostItem[]
): DuplicateCheckResult {
  // Check 1: Post itself is already published
  const currentDbPost = db.prepare('SELECT status, published_at, fb_post_url FROM posts WHERE id = ?').get(post.id) as any;
  if (currentDbPost?.status === 'published' || post.status === 'published') {
    return {
      isDuplicate: true,
      reason: `Bài viết [${post.id}] ("${post.trend_title}") đã được đăng thành công lên Facebook trước đó vào lúc ${currentDbPost?.published_at || post.published_at || 'trước đây'} (${currentDbPost?.fb_post_url || post.fb_post_url || ''}).`,
      matchedPost: post,
      matchType: 'already_published',
    };
  }

  // Check 2: Another post was already published with the same title or content or sources
  const posts = (existingPostsList || getExistingPosts()).filter(
    (p) => p.id !== post.id && p.status === 'published'
  );

  const postTitleLoose = normalizeLoose(post.trend_title);
  const postUrls = new Set((post.source_urls || []).map((u) => normalizeUrl(u)).filter(Boolean));

  for (const other of posts) {
    const otherTitleLoose = normalizeLoose(other.trend_title);

    // Identical trend title or loose match
    if (postTitleLoose && otherTitleLoose && postTitleLoose === otherTitleLoose) {
      return {
        isDuplicate: true,
        reason: `Đã có bài viết khác [${other.id}] ("${other.trend_title}") về cùng chủ đề được xuất bản vào lúc ${other.published_at}.`,
        matchedPost: other,
        matchType: 'title_loose',
      };
    }

    // Overlapping source URLs
    if (postUrls.size > 0 && Array.isArray(other.source_urls)) {
      for (const oUrl of other.source_urls) {
        const normOUrl = normalizeUrl(oUrl);
        if (normOUrl && postUrls.has(normOUrl)) {
          return {
            isDuplicate: true,
            reason: `Liên kết báo chí (${normOUrl}) đã được xuất bản trong bài viết [${other.id}] vào lúc ${other.published_at}.`,
            matchedPost: other,
            matchType: 'source_url',
          };
        }
      }
    }

    // High keyword similarity (> 70%)
    if (postTitleLoose && otherTitleLoose) {
      const sim = calculateTokenSimilarity(postTitleLoose, otherTitleLoose);
      if (sim >= 0.7) {
        return {
          isDuplicate: true,
          reason: `Chủ đề bài viết trùng lặp ${(sim * 100).toFixed(0)}% với bài viết đã xuất bản [${other.id}] ("${other.trend_title}").`,
          matchedPost: other,
          matchType: 'keyword_similarity',
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Syncs published status across posts and trends in SQLite
 */
export function markTrendAsPublished(trendIdOrTitle: { trend_id?: string | null; trend_title: string }): void {
  try {
    if (trendIdOrTitle.trend_id) {
      db.prepare("UPDATE trends SET status = 'published' WHERE id = ?").run(trendIdOrTitle.trend_id);
    }
    if (trendIdOrTitle.trend_title) {
      db.prepare(`
        UPDATE trends 
        SET status = 'published' 
        WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
      `).run(trendIdOrTitle.trend_title);
    }
  } catch (err: any) {
    console.error('Error marking trend as published:', err.message);
  }
}
