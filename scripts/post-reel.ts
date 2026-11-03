import readline from 'readline';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { uploadFacebookReel } from '../src/services/playwright/fb-reel';

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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headless') {
      headless = true;
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

  return { filePath, content, headless };
}

async function main() {
  console.log('\n======================================================');
  console.log('       Facebook Reel Automation - Upload Video        ');
  console.log('======================================================\n');

  const { filePath: cliPath, content: cliContent, headless } = parseCliArgs();

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
  console.log(`🖥️  Chế độ hiển thị: ${headless ? 'Headless (Chạy ẩn)' : 'Có giao diện (Hiện trình duyệt)'}`);
  console.log('------------------------------------------------------\n');

  try {
    const result = await uploadFacebookReel({
      filePath: selectedFilePath,
      content: selectedContent,
      headless,
      keepOpen: !headless,
    });

    if (result.success) {
      console.log('\n======================================================');
      console.log('🎉 THÀNH CÔNG: ' + result.message);
      console.log('======================================================\n');

      if (!headless) {
        console.log('💡 Trình duyệt đang được giữ mở để bạn kiểm tra nội dung hoặc bấm Đăng (Publish).');
        await askQuestion(rl, '👉 Nhấn Enter để đóng trình duyệt và hoàn tất...');
      }
    } else {
      console.error('\n❌ Thất bại:', result.message);
    }
  } catch (err: any) {
    console.error('\n❌ Lỗi:', err.message || err);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();

