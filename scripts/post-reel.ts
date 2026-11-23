import readline from 'readline';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { uploadFacebookReel } from '../src/services/playwright/fb-reel';
import { uploadTikTokVideo } from '../src/services/playwright/tiktok-reel';
import { uploadYouTubeShortVideo } from '../src/services/playwright/youtube-reel';
import { createReel } from '../src/services/reels';
import db, { logActivity, resolveHeadless, isDeveloperMode, isTikTokAutoPostEnabled, isYouTubeAutoPostEnabled } from '../src/lib/db';

function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

function cleanInputPath(input: string): string {
  let cleaned = input.trim();
  // Strip outer quotes if dragged & dropped from Finder/file manager
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Expand tilde ~ to user home directory
  if (cleaned.startsWith('~')) {
    cleaned = path.join(os.homedir(), cleaned.slice(1));
  }
  return path.resolve(cleaned);
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  let filePath = '';
  let content = '';
  let comment: string | undefined;
  let headless = false;
  let scheduledAt: string | undefined;
  let isDraft = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headless') {
      headless = true;
    } else if (arg === '--draft') {
      isDraft = true;
    } else if (arg.startsWith('--schedule=')) {
      scheduledAt = arg.slice(11);
    } else if (arg === '--schedule' || arg === '-s') {
      scheduledAt = args[i + 1] || '';
      i++;
    } else if (arg.startsWith('--file=')) {
      filePath = arg.slice(7);
    } else if (arg === '-f' || arg === '--file') {
      filePath = args[i + 1] || '';
      i++;
    } else if (arg.startsWith('--content=')) {
      content = arg.slice(10);
    } else if (arg === '-c' || arg === '--content') {
      content = args[i + 1] || '';
      i++;
    } else if (arg.startsWith('--comment=')) {
      comment = arg.slice(10);
    } else if (arg === '-cm' || arg === '--comment') {
      comment = args[i + 1] || '';
      i++;
    } else if (!arg.startsWith('-') && !filePath) {
      filePath = arg;
    }
  }

  return { filePath, content, comment, headless, scheduledAt, isDraft };
}

async function main() {
  console.log('\n======================================================');
  console.log('       Facebook Reel Automation - Upload Video        ');
  console.log('======================================================\n');

  const { filePath: cliPath, content: cliContent, comment: cliComment, headless, scheduledAt, isDraft } = parseCliArgs();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let selectedFilePath = cliPath;
  let selectedContent = cliContent;
  let selectedComment = cliComment;

  // Step 1: Prompt user for file path if not provided in CLI arguments
  if (!selectedFilePath) {
    while (!selectedFilePath) {
      console.log('👉 Bạn có thể kéo thả file video từ Finder/Thư mục vào terminal này.');
      const answer = await askQuestion(rl, '➤ Nhập đường dẫn file video Reel: ');
      const candidatePath = cleanInputPath(answer);

      if (!answer.trim()) {
        console.log('❌ Đường dẫn không được để trống. Vui lòng nhập lại.\n');
        continue;
      }

      if (!fs.existsSync(candidatePath)) {
        console.log(`❌ File không tồn tại: "${candidatePath}". Vui lòng kiểm tra lại.\n`);
        continue;
      }

      const stat = fs.statSync(candidatePath);
      if (!stat.isFile()) {
        console.log(`❌ "${candidatePath}" là thư mục chứ không phải file video. Vui lòng nhập lại.\n`);
        continue;
      }

      selectedFilePath = candidatePath;
    }
  } else {
    selectedFilePath = cleanInputPath(selectedFilePath);
    if (!fs.existsSync(selectedFilePath)) {
      console.error(`❌ File chỉ định không tồn tại: ${selectedFilePath}`);
      rl.close();
      process.exit(1);
    }
  }

  // Step 2: Prompt user for Reel content / caption if not provided in CLI arguments
  if (!selectedContent) {
    const contentAnswer = await askQuestion(
      rl,
      '➤ Nhập nội dung (caption) cho Reel (nhấn Enter nếu không có): '
    );
    selectedContent = contentAnswer.trim();
  }

  // Step 3: Prompt user for Reel comment (auto comment) if not provided in CLI arguments
  if (selectedComment === undefined) {
    const commentAnswer = await askQuestion(
      rl,
      '➤ Nhập nội dung bình luận tự động (auto comment, dùng | để tách nhiều bình luận, nhấn Enter nếu không có): '
    );
    selectedComment = commentAnswer.trim();
  }

  console.log(`\n📁 File video đã chọn: ${selectedFilePath}`);
  if (selectedContent) {
    console.log(`📝 Nội dung Reel: "${selectedContent}"`);
  } else {
    console.log('📝 Nội dung Reel: (Trống)');
  }
  if (selectedComment) {
    const splitComments = selectedComment.split('|').map((s) => s.trim()).filter(Boolean);
    if (splitComments.length > 1) {
      console.log(`💬 Bình luận tự động (${splitComments.length} bình luận):`);
      splitComments.forEach((c, idx) => console.log(`   ${idx + 1}. "${c}"`));
    } else {
      console.log(`💬 Bình luận tự động: "${selectedComment}"`);
    }
  } else {
    console.log('💬 Bình luận tự động: (Không)');
  }
  const effectiveHeadless = resolveHeadless(headless);
  const devNotice = isDeveloperMode() ? ' (Ghi đè bởi Developer Mode)' : '';
  console.log(`🖥️  Chế độ hiển thị: ${effectiveHeadless ? 'Headless (Chạy ẩn)' : 'Có giao diện (Hiện trình duyệt)'}${devNotice}`);
  console.log('------------------------------------------------------\n');

  // Trường hợp 1: Lưu dưới dạng Bản thảo (Draft)
  if (isDraft) {
    const reel = createReel({
      video_path: selectedFilePath,
      video_filename: path.basename(selectedFilePath),
      caption: selectedContent,
      comment_content: selectedComment || null,
      status: 'draft',
    });
    console.log('======================================================');
    console.log(`✅ Đã lưu Reel vào bảng reels dưới dạng Bản thảo (Draft): ID [${reel.id}]`);
    console.log('======================================================\n');
    rl.close();
    process.exit(0);
  }

  // Trường hợp 2: Lên lịch đăng trong bảng reels
  if (scheduledAt) {
    const reel = createReel({
      video_path: selectedFilePath,
      video_filename: path.basename(selectedFilePath),
      caption: selectedContent,
      comment_content: selectedComment || null,
      status: 'scheduled',
      scheduled_at: scheduledAt,
    });
    console.log('======================================================');
    console.log(`📅 Đã lên lịch Reel trong bảng reels: ID [${reel.id}] (Thời gian: ${scheduledAt})`);
    console.log('======================================================\n');
    rl.close();
    process.exit(0);
  }

  // Trường hợp 3: Xuất bản ngay - Tạo bản ghi trong bảng reels với trạng thái 'publishing'
  const reel = createReel({
    video_path: selectedFilePath,
    video_filename: path.basename(selectedFilePath),
    caption: selectedContent,
    comment_content: selectedComment || null,
    status: 'publishing',
  });
  console.log(`🎬 Đã tạo dữ liệu trong bảng reels: ID [${reel.id}] (Trạng thái: publishing)`);

  try {
    const result = await uploadFacebookReel({
      reelId: reel.id,
      filePath: selectedFilePath,
      content: selectedContent,
      comment: selectedComment || '',
      headless: effectiveHeadless,
      keepOpen: false,
    });

    if (result.success) {
      const commentStatus = selectedComment
        ? (result.commentSuccess ? 'commented' : 'failed')
        : null;

      db.prepare(`
        UPDATE reels
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            fb_post_url = ?,
            comment_status = COALESCE(?, comment_status),
            screenshot_path = NULL,
            debug_video_path = ?,
            error_message = NULL
        WHERE id = ?
      `).run(result.reelUrl || null, commentStatus, result.debugVideoPath || null, reel.id);

      logActivity(
        'SUCCESS',
        'POST_REEL',
        result.reelUrl
          ? `Xuất bản Reel Facebook thành công qua CLI [${reel.id}]: ${reel.video_filename} (Link: ${result.reelUrl})`
          : `Xuất bản Reel Facebook thành công qua CLI [${reel.id}]: ${reel.video_filename}`
      );

      console.log('\n======================================================');
      console.log('🎉 THÀNH CÔNG: ' + result.message);
      if (result.reelUrl) {
        console.log('🔗 Link Reel: ' + result.reelUrl);
      }
      if (result.debugVideoPath) {
        console.log('🎥 Video ghi lại quá trình đăng (Dev Mode): ' + result.debugVideoPath);
      }
      console.log(`📊 Bản ghi bảng reels [${reel.id}] đã được cập nhật: status = 'published'`);
      console.log('======================================================\n');

      if (isTikTokAutoPostEnabled()) {
        console.log('🎬 [TikTok] Đang đồng bộ đăng video lên TikTok...');
        try {
          db.prepare(`UPDATE reels SET tiktok_status = 'publishing' WHERE id = ?`).run(reel.id);
          const ttResult = await uploadTikTokVideo({
            reelId: reel.id,
            filePath: selectedFilePath,
            content: selectedContent,
            comment: selectedComment || '',
            headless,
          });

          if (ttResult.success) {
            const ttCommentStatus = selectedComment
              ? (ttResult.commentSuccess ? 'commented' : 'failed')
              : 'idle';
            db.prepare(`
              UPDATE reels 
              SET tiktok_post_url = ?, 
                  tiktok_status = 'published', 
                  tiktok_comment_status = ?,
                  tiktok_error_message = NULL 
              WHERE id = ?
            `).run(ttResult.tiktokUrl || null, ttCommentStatus, reel.id);
            console.log('🎉 [TikTok] Đăng TikTok thành công!');
            if (ttResult.tiktokUrl) {
              console.log('🔗 Link TikTok: ' + ttResult.tiktokUrl);
            }
          } else {
            db.prepare(`
              UPDATE reels 
              SET tiktok_status = 'failed', tiktok_error_message = ? 
              WHERE id = ?
            `).run(ttResult.error || ttResult.message, reel.id);
            console.warn('⚠️ [TikTok] Đăng TikTok thất bại:', ttResult.error || ttResult.message);
          }
        } catch (ttErr: any) {
          console.warn('⚠️ [TikTok] Lỗi ngoại lệ TikTok:', ttErr.message);
        }
      }

      if (isYouTubeAutoPostEnabled()) {
        console.log('🎬 [YouTube] Đang đồng bộ đăng video ngắn lên YouTube Shorts...');
        try {
          db.prepare(`UPDATE reels SET youtube_status = 'publishing' WHERE id = ?`).run(reel.id);
          const ytResult = await uploadYouTubeShortVideo({
            reelId: reel.id,
            filePath: selectedFilePath,
            content: selectedContent,
            comment: selectedComment || '',
            scheduledAt: scheduledAt,
            headless,
          });

          if (ytResult.success) {
            const ytCommentStatus = selectedComment
              ? (ytResult.commentSuccess ? 'commented' : 'failed')
              : 'idle';
            db.prepare(`
              UPDATE reels 
              SET youtube_post_url = ?, 
                  youtube_status = 'published', 
                  youtube_comment_status = ?,
                  youtube_error_message = NULL 
              WHERE id = ?
            `).run(ytResult.youtubeUrl || null, ytCommentStatus, reel.id);
            console.log('🎉 [YouTube] Đăng YouTube Shorts thành công!');
            if (ytResult.youtubeUrl) {
              console.log('🔗 Link YouTube Shorts: ' + ytResult.youtubeUrl);
            }
          } else {
            db.prepare(`
              UPDATE reels 
              SET youtube_status = 'failed', youtube_error_message = ? 
              WHERE id = ?
            `).run(ytResult.error || ytResult.message, reel.id);
            console.warn('⚠️ [YouTube] Đăng YouTube Shorts thất bại:', ytResult.error || ytResult.message);
          }
        } catch (ytErr: any) {
          console.warn('⚠️ [YouTube] Lỗi ngoại lệ YouTube Shorts:', ytErr.message);
        }
      }

      if (!headless) {
        console.log('💡 Trình duyệt đang được giữ mở để bạn kiểm tra nội dung hoặc bấm Đăng (Publish).');
        await askQuestion(rl, '👉 Nhấn Enter để đóng trình duyệt và hoàn tất...');
      }
    } else {
      const errorMsg = result.error || result.message;
      db.prepare(`
        UPDATE reels
        SET status = 'failed',
            error_message = ?,
            screenshot_path = ?,
            debug_video_path = ?
        WHERE id = ?
      `).run(errorMsg, result.screenshotPath || null, result.debugVideoPath || null, reel.id);

      logActivity('ERROR', 'POST_REEL', `Xuất bản Reel qua CLI [${reel.id}] thất bại: ${errorMsg}`);

      console.error('\n❌ Thất bại:', result.message);
      if (result.screenshotPath) {
        console.error('📸 Ảnh chụp màn hình lỗi:', result.screenshotPath);
      }
      if (result.debugVideoPath) {
        console.error('🎥 Video ghi lại thao tác lỗi:', result.debugVideoPath);
      }
      console.error(`📊 Bản ghi bảng reels [${reel.id}] đã được cập nhật: status = 'failed'`);
    }
  } catch (err: any) {
    const errorMsg = err.message || String(err);
    db.prepare(`
      UPDATE reels
      SET status = 'failed',
          error_message = ?
      WHERE id = ?
    `).run(errorMsg, reel.id);

    logActivity('ERROR', 'POST_REEL', `Lỗi nghiêm trọng khi xuất bản Reel qua CLI [${reel.id}]: ${errorMsg}`);
    console.error('\n❌ Lỗi:', errorMsg);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();

