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

console.log('[Xvfb] Khởi chạy màn hình ảo :99 (1440x900x24) cho Playwright...');
const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1440x900x24', '-ac'], {
  stdio: 'inherit',
});

let vncProcess = null;

// Khởi chạy x11vnc để hỗ trợ kết nối tương tác trực tiếp
setTimeout(() => {
  console.log('[x11vnc] Khởi chạy VNC Server trên cổng 5900 cho màn hình :99...');
  vncProcess = spawn(
    'x11vnc',
    ['-display', ':99', '-forever', '-shared', '-rfbport', '5900', '-localhost', '-nopw'],
    {
      stdio: 'ignore',
    }
  );

  vncProcess.on('error', (err) => {
    console.warn('[x11vnc] Cảnh báo x11vnc:', err.message);
  });
}, 1500);

xvfb.on('error', (err) => {
  console.warn('[Xvfb] Cảnh báo: Không thể khởi chạy Xvfb. Hãy đảm bảo đã cài đặt (sudo apt install -y xvfb):', err.message);
  // Không exit 1 để PM2 không restart loop nếu server chưa cài Xvfb
  setTimeout(() => process.exit(0), 10000);
});

xvfb.on('exit', (code) => {
  console.log('[Xvfb] Tiến trình Xvfb kết thúc với mã:', code);
  if (vncProcess) {
    try { vncProcess.kill('SIGTERM'); } catch {}
  }
  process.exit(code || 0);
});

process.on('SIGTERM', () => {
  if (vncProcess) {
    try { vncProcess.kill('SIGTERM'); } catch {}
  }
  try { xvfb.kill('SIGTERM'); } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  if (vncProcess) {
    try { vncProcess.kill('SIGINT'); } catch {}
  }
  try { xvfb.kill('SIGINT'); } catch {}
  process.exit(0);
});
