const { spawn } = require('child_process');
const fs = require('fs');

if (process.platform !== 'linux') {
  console.log('[Xvfb] Không phải hệ điều hành Linux (macOS/Windows đã có màn hình vật lý). Bỏ qua Xvfb.');
  process.exit(0);
}

// Dọn dẹp file lock cũ nếu có do lần tắt trước bị ngắt đột ngột
const lockFiles = ['/tmp/.X99-lock', '/tmp/.X11-unix/X99'];
for (const file of lockFiles) {
  try {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch {}
}

console.log('[Xvfb] Khởi chạy màn hình ảo :99 (1280x800x24) cho Playwright...');
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x800x24', '-ac'], {
  stdio: 'inherit',
});

xvfb.on('error', (err) => {
  console.warn('[Xvfb] Cảnh báo: Không thể khởi chạy Xvfb. Hãy đảm bảo đã cài đặt (sudo apt install -y xvfb):', err.message);
  // Không exit 1 để PM2 không restart loop nếu server chưa cài Xvfb
  setTimeout(() => process.exit(0), 10000);
});

xvfb.on('exit', (code) => {
  console.log('[Xvfb] Tiến trình Xvfb kết thúc với mã:', code);
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  try { xvfb.kill('SIGTERM'); } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  try { xvfb.kill('SIGINT'); } catch {}
  process.exit(0);
});
