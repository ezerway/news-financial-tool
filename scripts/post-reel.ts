import readline from 'readline';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { uploadFacebookReel } from '../src/services/playwright/fb-reel';
import { createReel } from '../src/services/reels';
import db, { logActivity, resolveHeadless, isDeveloperMode } from '../src/lib/db';

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
    } else if (!arg.startsWith('-') && !filePath) {
      filePath = arg;
    }
  }

  return { filePath, content, headless, scheduledAt, isDraft };
}

async function main() {
  console.log('\n======================================================');
  console.log('       Facebook Reel Automation - Upload Video        ');
  console.log('======================================================\n');

  const { filePath: cliPath, content: cliContent, headless, scheduledAt, isDraft } = parseCliArgs();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let selectedFilePath = cliPath;
  let selectedContent = cliContent;

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

  console.log(`\n📁 File video đã chọn: ${selectedFilePath}`);
  if (selectedContent) {
    console.log(`📝 Nội dung Reel: "${selectedContent}"`);
  } else {
    console.log('📝 Nội dung Reel: (Trống)');
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
    status: 'publishing',
  });
  console.log(`🎬 Đã tạo dữ liệu trong bảng reels: ID [${reel.id}] (Trạng thái: publishing)`);

  try {
    const result = await uploadFacebookReel({
      reelId: reel.id,
      filePath: selectedFilePath,
      content: selectedContent,
      headless: effectiveHeadless,
      keepOpen: !effectiveHeadless,
    });

    if (result.success) {
      db.prepare(`
        UPDATE reels
        SET status = 'published',
            published_at = CURRENT_TIMESTAMP,
            fb_post_url = ?,
            screenshot_path = NULL,
            debug_video_path = ?,
            error_message = NULL
        WHERE id = ?
      `).run(result.reelUrl || null, result.debugVideoPath || null, reel.id);

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

