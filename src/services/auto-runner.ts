import { crawlGoogleTrends, getStoredTrends } from './crawler';
import { generateSocialPost } from './ai-generator';
import { executePublishAndComment } from './playwright/fb-automation';
import db, { getSetting, logActivity } from '@/lib/db';
import { TrendItem } from '@/types';
import { findDuplicatePost, getExistingPosts } from './dedup';

export async function runAutomationCycle(options?: { forcePublish?: boolean; dryRun?: boolean }) {
  logActivity('INFO', 'AUTO', 'Starting automation cycle...');

  const geo = getSetting('target_geo', 'VN');
  const autoMode = getSetting('auto_mode', 'false') === 'true';
  const shouldPublish = options?.forcePublish ?? autoMode;
  const dryRun = options?.dryRun ?? false;

  try {
    // Step 1: Crawl latest Google Trends Business & Finance (category=3)
    const trends = await crawlGoogleTrends(geo);
    if (!trends || trends.length === 0) {
      logActivity('WARN', 'AUTO', 'No new trends found during cycle.');
      return { success: false, message: 'No trends found' };
    }

    // Step 2: Pick the highest priority un-drafted, un-published trend that HAS verified source links AND is not duplicate
    const hasSource = (t: any) =>
      Array.isArray(t.articles) &&
      t.articles.some((a: any) => a.url && !a.url.includes('google.com'));

    const existingPosts = getExistingPosts();

    const isEligible = (t: TrendItem) => {
      if (!hasSource(t)) return false;
      if (t.status !== 'discovered') return false;
      const dup = findDuplicatePost(t, existingPosts);
      if (dup.isDuplicate) {
        logActivity('INFO', 'AUTO', `[Chống trùng lặp] Bỏ qua "${t.title}": ${dup.reason}`);
        return false;
      }
      return true;
    };

    // Prefer finance category if available
    let candidate = trends.find((t) => t.category === 'finance' && isEligible(t));
    if (!candidate) {
      candidate = trends.find((t) => isEligible(t));
    }

    if (!candidate) {
      // Look in stored trends
      const stored = getStoredTrends({ status: 'discovered', limit: 30 });
      candidate = stored.find((t) => t.category === 'finance' && isEligible(t)) || stored.find((t) => isEligible(t));
    }

    if (!candidate) {
      logActivity('INFO', 'AUTO', 'Tất cả xu hướng hiện tại đều đã được tạo bài hoặc xuất bản trước đó. Dừng chu kỳ để không đăng bài trùng lặp.');
      return {
        success: true,
        skipped: true,
        message: 'Tất cả các xu hướng hiện tại đều đã được đăng bài hoặc có bản thảo. Đã dừng chu kỳ để tránh đăng trùng lặp.',
      };
    }

    // Step 3: Generate post and source comment with AI
    logActivity('INFO', 'AUTO', `Selected trend for auto-post: "${candidate.title}"`);
    const post = await generateSocialPost(candidate);

    // Step 4: Publish if in auto mode or forced
    if (shouldPublish) {
      logActivity('INFO', 'AUTO', `Auto-publishing post ${post.id} to Facebook...`);
      const result = await executePublishAndComment(post, { dryRun });
      return {
        success: result.success,
        trend: candidate,
        post,
        publishResult: result,
      };
    } else {
      logActivity('SUCCESS', 'AUTO', `Post ${post.id} drafted and queued for approval.`);
      return {
        success: true,
        trend: candidate,
        post,
        message: 'Draft created in Post Studio awaiting approval',
      };
    }
  } catch (err: any) {
    logActivity('ERROR', 'AUTO', `Automation cycle failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}
