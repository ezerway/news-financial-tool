import { crawlGoogleTrends, getStoredTrends } from './crawler';
import { generateSocialPost } from './ai-generator';
import { executePublishAndComment } from './playwright/fb-automation';
import db, { getSetting, logActivity } from '@/lib/db';
import { TrendItem } from '@/types';
import { findDuplicatePost, getExistingPosts } from './dedup';

export interface AutomationCycleOptions {
  forcePublish?: boolean;
  dryRun?: boolean;
  limit?: number;
}

export async function runAutomationCycle(options?: AutomationCycleOptions) {
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

    const tryAdd = (t: TrendItem) => {
      if (candidates.length >= targetLimit) return false;
      if (usedIds.has(t.id)) return false;
      if (isEligible(t, candidates)) {
        candidates.push(t);
        usedIds.add(t.id);
        return true;
      }
      return false;
    };

    // 1. Fresh crawl: Finance first, then others
    for (const t of trends.filter((item) => item.category === 'finance')) {
      tryAdd(t);
    }
    for (const t of trends.filter((item) => item.category !== 'finance')) {
      tryAdd(t);
    }

    // 2. If still below targetLimit, look in stored discovered trends
    if (candidates.length < targetLimit) {
      const stored = getStoredTrends({ status: 'discovered', limit: 40 });
      for (const t of stored.filter((item) => item.category === 'finance')) {
        tryAdd(t);
      }
      for (const t of stored.filter((item) => item.category !== 'finance')) {
        tryAdd(t);
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
