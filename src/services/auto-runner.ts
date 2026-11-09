import { crawlGoogleTrends, getStoredTrends, findExactNewsSources } from './crawler';
import { generateSocialPost } from './ai-generator';
import { executePublishAndComment } from './playwright/fb-automation';
import db, { getSetting, logActivity, repairInconsistentTrendStatuses } from '@/lib/db';
import { TrendItem, NewsArticle } from '@/types';
import { findDuplicatePost, getExistingPosts } from './dedup';

export interface AutomationCycleOptions {
  forcePublish?: boolean;
  dryRun?: boolean;
  limit?: number;
}

export async function runAutomationCycle(options?: AutomationCycleOptions) {
  // Tự động kiểm tra và sửa trạng thái các xu hướng lỗi trước khi chạy
  repairInconsistentTrendStatuses(db);

  const configuredLimit = parseInt(getSetting('posts_per_cycle', '1'), 10) || 1;
  const targetLimit = Math.max(1, options?.limit ?? configuredLimit);

  logActivity('INFO', 'AUTO', `Bắt đầu chu kỳ tự động hóa (Mục tiêu: tối đa ${targetLimit} bài)...`);

  const geo = getSetting('target_geo', 'VN');
  const autoMode = getSetting('auto_mode', 'false') === 'true';
  const shouldPublish = options?.forcePublish ?? autoMode;
  const dryRun = options?.dryRun ?? false;

  try {
    // Step 1: Crawl latest Google Trends Business & Finance (category=3)
    const trends = await crawlGoogleTrends(geo);
    if (!trends || trends.length === 0) {
      logActivity('WARN', 'AUTO', 'Không tìm thấy xu hướng mới trong chu kỳ này.');
      return { success: false, message: 'No trends found' };
    }

    // Step 2: Select up to targetLimit eligible, non-duplicate trends
    const hasSource = (t: any) =>
      Array.isArray(t.articles) &&
      t.articles.some((a: any) => a.url && !a.url.includes('google.com'));

    let currentExistingPosts = getExistingPosts();

    const ensureSources = async (t: TrendItem): Promise<boolean> => {
      if (hasSource(t)) return true;
      try {
        logActivity('INFO', 'AUTO', `[Tự động tìm nguồn] Xu hướng "${t.title}" chưa có source link. Đang tìm bài báo nguồn...`);
        const sources = await findExactNewsSources(t.title, t.geo || 'VN', 3);
        if (sources.length > 0) {
          t.articles = sources;
          db.prepare('UPDATE trends SET articles_json = ? WHERE id = ?').run(JSON.stringify(sources), t.id);
          logActivity('SUCCESS', 'AUTO', `[Tự động tìm nguồn] Đã tìm thấy ${sources.length} bài báo nguồn cho "${t.title}".`);
          return true;
        }
      } catch (err: any) {
        logActivity('WARN', 'AUTO', `Lỗi khi tự động tìm nguồn cho "${t.title}": ${err.message}`);
      }
      return false;
    };

    const isEligible = (t: TrendItem, selectedCandidates: TrendItem[]) => {
      if (!hasSource(t)) return false;
      if (t.status !== 'discovered') return false;

      // Check against database posts
      const dup = findDuplicatePost(t, currentExistingPosts);
      if (dup.isDuplicate) {
        logActivity('INFO', 'AUTO', `[Chống trùng lặp] Bỏ qua "${t.title}": ${dup.reason}`);
        return false;
      }

      // Check against other candidates selected in this same batch
      const dupInBatch = selectedCandidates.some((sc) => {
        const titleA = (sc.title || '').toLowerCase().trim();
        const titleB = (t.title || '').toLowerCase().trim();
        return titleA === titleB;
      });
      if (dupInBatch) {
        return false;
      }

      return true;
    };

    const candidates: TrendItem[] = [];
    const usedIds = new Set<string>();

    const tryAdd = async (t: TrendItem) => {
      if (candidates.length >= targetLimit) return false;
      if (usedIds.has(t.id)) return false;
      if (!hasSource(t)) {
        await ensureSources(t);
      }
      if (isEligible(t, candidates)) {
        candidates.push(t);
        usedIds.add(t.id);
        return true;
      }
      return false;
    };

    // 1. Fresh crawl: Finance first, then others
    for (const t of trends.filter((item) => item.category === 'finance')) {
      await tryAdd(t);
    }
    for (const t of trends.filter((item) => item.category !== 'finance')) {
      await tryAdd(t);
    }

    // 2. If still below targetLimit, look in stored discovered trends
    if (candidates.length < targetLimit) {
      const stored = getStoredTrends({ status: 'discovered', limit: 40 });
      for (const t of stored.filter((item) => item.category === 'finance')) {
        await tryAdd(t);
      }
      for (const t of stored.filter((item) => item.category !== 'finance')) {
        await tryAdd(t);
      }
    }

    if (candidates.length === 0) {
      logActivity(
        'INFO',
        'AUTO',
        'Tất cả xu hướng hiện tại đều đã được tạo bài hoặc xuất bản trước đó. Dừng chu kỳ để không đăng bài trùng lặp.'
      );
      return {
        success: true,
        skipped: true,
        message: 'Tất cả các xu hướng hiện tại đều đã được đăng bài hoặc có bản thảo. Đã dừng chu kỳ để tránh trùng lặp.',
      };
    }

    logActivity('INFO', 'AUTO', `Đã chọn ${candidates.length}/${targetLimit} xu hướng phù hợp để tiến hành viết bài.`);

    // Step 3 & 4: Process each candidate
    const results = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const progressLabel = `[${i + 1}/${candidates.length}]`;

      logActivity('INFO', 'AUTO', `${progressLabel} Đang tạo nội dung AI cho xu hướng: "${candidate.title}"`);
      const post = await generateSocialPost(candidate);

      // Keep in-memory existing posts fresh to guard against any subsequent race
      currentExistingPosts.push(post);

      if (shouldPublish) {
        logActivity('INFO', 'AUTO', `${progressLabel} Đang tự động xuất bản bài viết ${post.id} lên Facebook...`);
        const pubResult = await executePublishAndComment(post, { dryRun });
        results.push({
          success: pubResult.success,
          trend: candidate,
          post,
          publishResult: pubResult,
        });

        // Delay between posts to protect Facebook account from spam triggers
        if (i < candidates.length - 1) {
          const pauseSec = dryRun ? 2 : 25;
          logActivity(
            'INFO',
            'AUTO',
            `[Chống spam Facebook] Nghỉ ${pauseSec}s trước khi xuất bản bài tiếp theo (${i + 2}/${candidates.length})...`
          );
          await new Promise((resolve) => setTimeout(resolve, pauseSec * 1000));
        }
      } else {
        logActivity('SUCCESS', 'AUTO', `${progressLabel} Đã tạo bản thảo bài viết ${post.id} thành công.`);
        results.push({
          success: true,
          trend: candidate,
          post,
          message: 'Draft created in Post Studio awaiting approval',
        });
      }
    }

    const successfulCount = results.filter((r) => r.success).length;
    logActivity('SUCCESS', 'AUTO', `Hoàn thành chu kỳ tự động hóa: ${successfulCount}/${candidates.length} bài thành công.`);

    return {
      success: successfulCount > 0,
      totalRequested: targetLimit,
      totalProcessed: candidates.length,
      successfulCount,
      results,
    };
  } catch (err: any) {
    logActivity('ERROR', 'AUTO', `Automation cycle failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

export interface RetryTrendOptions {
  trendId?: string;
  allMissing?: boolean;
  forcePublish?: boolean;
  dryRun?: boolean;
  limit?: number;
}

/**
 * Cơ chế chạy lại tìm kiếm source link báo chí và đăng bài lên Facebook.
 * Tự động sửa chữa các xu hướng chưa có nguồn báo chí và hỗ trợ cả từng bài hoặc hàng loạt.
 */
export async function retryTrendSourcesAndPublish(options: RetryTrendOptions): Promise<any> {
  // Sửa chữa các xu hướng bị đánh dấu nhầm 'published' khi thiếu source link
  repairInconsistentTrendStatuses(db);

  const dryRun = options.dryRun ?? false;
  const forcePublish = options.forcePublish ?? true;

  // Trường hợp 1: Chạy lại cho 1 xu hướng cụ thể
  if (options.trendId) {
    const trendRow = db.prepare('SELECT * FROM trends WHERE id = ?').get(options.trendId) as any;
    if (!trendRow) {
      throw new Error(`Không tìm thấy xu hướng có ID: ${options.trendId}`);
    }

    let articles: NewsArticle[] = [];
    try {
      articles = JSON.parse(trendRow.articles_json || '[]');
    } catch { }

    const hasValidSources = (arts: NewsArticle[]) =>
      Array.isArray(arts) && arts.some((a) => a.url && !a.url.includes('google.com'));

    // B1: Nếu chưa có nguồn báo chí chính thống, tự động tìm kiếm ngay
    if (!hasValidSources(articles)) {
      logActivity('INFO', 'RETRY', `[Chạy lại] Đang tìm kiếm bài báo nguồn cho xu hướng: "${trendRow.title}"...`);
      const foundSources = await findExactNewsSources(trendRow.title, trendRow.geo || 'VN', 3);
      if (!hasValidSources(foundSources)) {
        throw new Error(`Không tìm thấy bài báo nguồn nào cho "${trendRow.title}". Không thể đăng bài khi thiếu source link.`);
      }
      articles = foundSources;
      db.prepare(`UPDATE trends SET articles_json = ?, status = 'discovered' WHERE id = ?`).run(
        JSON.stringify(articles),
        trendRow.id
      );
      logActivity('SUCCESS', 'RETRY', `[Chạy lại] Đã tìm thấy ${articles.length} bài báo nguồn cho "${trendRow.title}".`);
    }

    const trendItem: TrendItem = {
      id: trendRow.id,
      title: trendRow.title,
      geo: trendRow.geo || 'VN',
      approx_traffic: trendRow.approx_traffic || '500+',
      pub_date: trendRow.pub_date || new Date().toISOString(),
      articles,
      category: trendRow.category || 'finance',
      status: 'discovered',
    };

    // B2: Tạo bài viết AI với các link nguồn vừa tìm được (force: true để ghi đè bài lỗi cũ nếu có)
    logActivity('INFO', 'RETRY', `[Chạy lại] Đang tạo bài viết AI mới cho xu hướng "${trendItem.title}"...`);
    const post = await generateSocialPost(trendItem, undefined, { force: true });

    // B3: Đăng bài lên Facebook Fanpage (hoặc lưu nháp nếu không bật forcePublish)
    if (forcePublish) {
      logActivity('INFO', 'RETRY', `[Chạy lại] Đang xuất bản bài viết ${post.id} lên Facebook Fanpage...`);
      const pubResult = await executePublishAndComment(post, { dryRun });
      return {
        success: pubResult.success,
        trend: trendItem,
        post,
        publishResult: pubResult,
        message: pubResult.success
          ? `Đã tìm nguồn và xuất bản thành công bài viết lên Facebook!`
          : `Đã tìm nguồn nhưng xuất bản thất bại: ${pubResult.error}`,
      };
    } else {
      return {
        success: true,
        trend: trendItem,
        post,
        message: 'Đã tìm nguồn và tạo bản thảo bài viết thành công trong Studio!',
      };
    }
  }

  // Trường hợp 2: Chạy lại hàng loạt cho các xu hướng chưa có nguồn / chưa đăng được
  if (options.allMissing) {
    const limit = Math.max(1, options.limit || 5);
    logActivity('INFO', 'RETRY', `[Chạy lại hàng loạt] Bắt đầu quét tìm nguồn & đăng bài cho các xu hướng còn thiếu (Tối đa: ${limit} xu hướng)...`);

    const rows = db.prepare(`SELECT * FROM trends ORDER BY created_at DESC`).all() as any[];
    const candidates: TrendItem[] = [];

    for (const r of rows) {
      if (candidates.length >= limit) break;
      let arts: NewsArticle[] = [];
      try { arts = JSON.parse(r.articles_json || '[]'); } catch { }
      const hasSrc = Array.isArray(arts) && arts.some((a) => a.url && !a.url.includes('google.com'));

      const publishedPost = db.prepare(`
        SELECT id, fb_post_url FROM posts 
        WHERE trend_id = ? AND status = 'published' AND fb_post_url IS NOT NULL
      `).get(r.id);

      // Nếu chưa có bài đăng thành công thực tế hoặc chưa có source link
      if (!publishedPost || !hasSrc || r.status !== 'published') {
        candidates.push({
          id: r.id,
          title: r.title,
          geo: r.geo || 'VN',
          approx_traffic: r.approx_traffic || '500+',
          pub_date: r.pub_date || new Date().toISOString(),
          articles: arts,
          category: r.category || 'finance',
          status: 'discovered',
        });
      }
    }

    if (candidates.length === 0) {
      return {
        success: true,
        message: 'Không có xu hướng nào bị thiếu nguồn hoặc cần chạy lại.',
        processed: 0,
        results: [],
      };
    }

    logActivity('INFO', 'RETRY', `[Chạy lại hàng loạt] Đã chọn được ${candidates.length} xu hướng cần xử lý.`);
    const results = [];

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      try {
        const res = await retryTrendSourcesAndPublish({
          trendId: c.id,
          forcePublish,
          dryRun,
        });
        results.push(res);
      } catch (err: any) {
        logActivity('ERROR', 'RETRY', `Lỗi khi xử lý xu hướng "${c.title}": ${err.message}`);
        results.push({
          success: false,
          trend: c,
          error: err.message,
        });
      }

      // Giãn cách giữa các bài để bảo vệ tài khoản Facebook khỏi checkpoint
      if (i < candidates.length - 1 && forcePublish) {
        const pauseSec = dryRun ? 2 : 25;
        logActivity(
          'INFO',
          'RETRY',
          `[Chống spam Facebook] Nghỉ ${pauseSec}s trước khi xử lý bài tiếp theo (${i + 2}/${candidates.length})...`
        );
        await new Promise((r) => setTimeout(r, pauseSec * 1000));
      }
    }

    const successfulCount = results.filter((r) => r.success).length;
    return {
      success: successfulCount > 0,
      totalRequested: limit,
      processed: candidates.length,
      successfulCount,
      results,
    };
  }

  throw new Error('Vui lòng cung cấp trendId hoặc allMissing: true');
}
