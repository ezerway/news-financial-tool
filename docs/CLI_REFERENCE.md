# Bảng Tra cứu Lệnh Dòng Lệnh (CLI Reference)

Tài liệu hướng dẫn chi tiết toàn bộ các tập lệnh CLI (Command Line Interface) có sẵn trong dự án **TrendPulse**.

---

## 1. Danh sách Lệnh trong `package.json`

| Lệnh | File thực thi | Mô tả |
|---|---|---|
| `pnpm dev` | `next dev` | Chạy máy chủ Next.js phát triển tại cổng 3000 |
| `pnpm build` | `scripts/clean-locks.js` + `next build` | Tự động làm sạch lock cũ và build production |
| `pnpm start` | `next start` | Khởi chạy máy chủ Next.js production đã build |
| `pnpm fb:login` | `scripts/fb-login.ts` | Đăng nhập tài khoản Facebook để lấy session cookie |
| `pnpm tiktok:login` | `scripts/tiktok-login.ts` | Đăng nhập tài khoản TikTok Web để lưu session cookie |
| `pnpm auto-cycle` | `scripts/auto-cycle.ts` | Chạy chu kỳ cào Google Trends và tạo bài viết |
| `pnpm post-reel` | `scripts/post-reel.ts` | Đăng video ngắn (Reel) lên Facebook & TikTok |
| `pnpm cron-daemon` | `scripts/cron-daemon.ts` | Daemon chạy ngầm chu kỳ và quét video hẹn giờ |
| `./deploy.sh` | `deploy.sh` | Script triển khai 1 lệnh tự động từ máy local lên VPS qua SSH |
| `pnpm pm2:start` | `pm2 start ecosystem.config.js` | Khởi chạy toàn bộ hệ thống bằng PM2 |
| `pnpm pm2:restart`| `pm2 restart ecosystem.config.js` | Khởi động lại toàn bộ dịch vụ PM2 |
| `pnpm pm2:stop` | `pm2 stop ecosystem.config.js` | Dừng toàn bộ dịch vụ PM2 |

---

## 2. Chi tiết từng Script

### 2.1. Đăng nhập Facebook (`scripts/fb-login.ts`)

Lưu trữ phiên đăng nhập vào `storage/fb-session.json`.

```bash
pnpm fb:login
```

**Hành vi:**
- **Môi trường GUI (Desktop macOS / Windows)**: Mở trình duyệt Chromium có giao diện. Bạn đăng nhập tài khoản Facebook và xác thực 2FA. Khi đăng nhập xong, nhấn Enter tại terminal để lưu session.
- **Môi trường VPS không màn hình (Headless)**: Script tự động phát hiện và yêu cầu bạn nhập cookie `c_user` và `xs`.

---

### 2.2. Đăng nhập TikTok (`scripts/tiktok-login.ts`)

Lưu trữ phiên làm việc TikTok vào `storage/tiktok-session.json` và thư mục user data `storage/tiktok-user-data`.

```bash
pnpm tiktok:login
```

**Hành vi:**
- Khởi chạy Chromium (hỗ trợ hiển thị trên Desktop hoặc qua màn hình ảo Xvfb trên VPS).
- Mở trang đăng nhập `https://www.tiktok.com/login`.
- Bạn tiến hành đăng nhập bằng mã QR, tài khoản hoặc Google.
- Script tự động theo dõi khi bạn đăng nhập thành công vào trang cá nhân TikTok, tự động trích xuất danh sách cookies cần thiết và lưu vào file `storage/tiktok-session.json`.

---

### 2.3. Đăng nhập YouTube Studio (`scripts/youtube-login.ts`)

Lưu trữ và quản lý phiên YouTube Studio trên profile dùng chung `storage/browser-profile`.

```bash
pnpm youtube:login
```

**Hành vi:**
- Khởi chạy Chromium (hỗ trợ hiển thị trên Desktop hoặc qua màn hình ảo Xvfb trên VPS).
- Mở trang kênh mục tiêu hoặc `https://studio.youtube.com/`.
- Bạn đăng nhập tài khoản Google và chuyển đúng kênh Shorts cần đăng.
- Phiên được lưu trữ vĩnh viễn trên `browser-profile` dùng chung.

---

### 2.4. Đăng nhập Zalo Video Creator (`scripts/zalo-login.ts`)

Mở trình duyệt quản lý và lưu phiên làm việc trên Zalo Video Creator.

```bash
pnpm zalo:login
```

**Hành vi:**
- Mở Chromium điều hướng tới trang Zalo Video Creator (`https://video.zalo.me/creator/video`).
- Bạn tiến hành quét mã QR Zalo hoặc đăng nhập bằng số điện thoại.
- Trình duyệt tự động lưu trữ profile và cookies vào `storage/zalo_sessions`.

---

### 2.5. Kiểm tra Trạng thái Kết nối (`scripts/connection-status.ts`)

Kiểm tra nhanh tình trạng đăng nhập của cả 4 nền tảng mạng xã hội ngay trên Terminal.

```bash
pnpm connection:status
# hoặc:
pnpm status
```

**Hành vi:**
- Kiểm tra file session và cấu hình của **Facebook**, **TikTok**, **YouTube Shorts** và **Zalo Video**.
- In bảng tổng hợp kết quả (Connected / Missing Session) trực quan trên console để quản trị viên kiểm soát trước khi đăng bài.

---

### 2.6. Chu kỳ Tự động hóa (`scripts/auto-cycle.ts`)

Cào dữ liệu từ Google Trends, bóc tách bài báo nguồn toàn văn, phân loại tin tức tài chính, kiểm tra trùng lặp trong 24 giờ, dùng Gemini viết bài và đưa vào database hoặc xuất bản ngay.

```bash
# Cào và lưu bài nháp vào database (không đăng ngay)
pnpm auto-cycle

# Cào, viết bài và ĐĂNG NGAY LẬP TỨC lên Facebook
pnpm auto-cycle --publish

# Giới hạn số lượng bài viết xử lý trong một chu kỳ
pnpm auto-cycle --limit 3
pnpm auto-cycle --publish --limit 2

# Chạy lại tìm kiếm link báo chí và xuất bản cho các xu hướng chưa có nguồn
pnpm auto-cycle --retry
pnpm auto-cycle --retry-missing

# Chạy riêng cho một xu hướng cụ thể
pnpm auto-cycle --trend <TREND_ID>
pnpm auto-cycle --trend <TREND_ID> --publish
```

**Các tham số hỗ trợ:**
- `--publish`: Xuất bản trực tiếp lên Facebook sau khi tạo bài thay vì lưu nháp.
- `--limit <n>` hoặc `-l <n>`: Giới hạn số xu hướng xử lý (mặc định lấy theo cấu hình trong DB).
- `--retry` hoặc `--retry-missing`: Quét các xu hướng chưa có bài báo nguồn chính thống để tìm lại và đăng.
- `--trend <id>` hoặc `-t <id>`: Chỉ định chính xác ID của xu hướng cần tạo bài.

---

### 2.7. Đăng Video Đa Nền Tảng (`scripts/post-reel.ts`)

Đăng video ngắn lên **Facebook Reels**, **TikTok Video**, **YouTube Shorts** và **Zalo Video**.

```bash
# 1. Chế độ tương tác từng bước (Interactive prompt)
pnpm post-reel

# 2. Đăng nhanh bằng cờ tham số (kèm bình luận nguồn tự động)
pnpm post-reel --file "/path/to/video.mp4" --content "Tiêu đề video #Shorts #TikTok" --comment "Nguồn: https://... | Link 2: https://..."

# 3. Hẹn giờ đăng video
pnpm post-reel -f "./video.mp4" -c "Tin tức kinh tế" -m "Nguồn: https://..." --schedule "2026-11-20 18:30"

# 4. Lưu bản nháp (không đăng ngay)
pnpm post-reel -f "./video.mp4" -c "Video nháp" --draft

# 5. Chạy ẩn danh không mở cửa sổ (Headless mode)
pnpm post-reel -f "./video.mp4" -c "Nội dung" --headless
```

**Các tham số hỗ trợ:**
- `-f`, `--file <path>`: Đường dẫn tới file video (`.mp4`, `.mov`, `.webm`). Hỗ trợ đường dẫn có khoảng trắng hoặc dấu `~`.
- `-c`, `--content <caption>`: Tiêu đề hoặc chú thích đính kèm hashtag cho video.
- `-m`, `--comment <text>`: Nội dung bình luận tự động sau khi đăng (hỗ trợ tách nhiều bình luận liên tiếp bằng dấu `|`).
- `-s`, `--schedule <datetime>`: Thời gian hẹn giờ đăng (định dạng `YYYY-MM-DD HH:mm`).
- `--draft`: Lưu video vào hàng đợi ở trạng thái nháp (`draft`).
- `--headless`: Chạy Chromium ở chế độ ẩn (khuyên dùng khi chạy trên VPS).

---

### 2.8. Daemon Chạy ngầm (`scripts/cron-daemon.ts`)

Tiến trình chạy nền 24/7 thực hiện 3 nhiệm vụ song song:
1. Chạy chu kỳ cào tin và đăng bài định kỳ (mặc định mỗi 60 phút).
2. Quét hàng đợi video Reel hẹn giờ mỗi 30 giây để xuất bản tự động khi đến giờ.
3. Tự động dọn dẹp bộ nhớ: xóa video và ảnh screenshot của các post Reel đã tạo từ 2 ngày trước đó (chạy lúc khởi động daemon và sau mỗi chu kỳ).

```bash
# Chạy daemon với tính năng tự động xuất bản Facebook
pnpm cron-daemon --publish

# Tùy chỉnh chu kỳ lặp lại (ví dụ: mỗi 30 phút chạy 1 lần)
pnpm cron-daemon --publish --interval 30

# Giới hạn số bài đăng mỗi lần chạy
pnpm cron-daemon --publish --limit 2 --interval 60

# Tùy chỉnh số ngày dọn dẹp Reel cũ (mặc định: 2 ngày)
pnpm cron-daemon --publish --clean-days 2
```

**Các tham số hỗ trợ:**
- `--publish`: Kích hoạt chế độ đăng thật lên Facebook cho các chu kỳ.
- `--interval <minutes>` hoặc `-i <minutes>`: Khoảng thời gian lặp lại tính bằng phút.
- `--limit <count>` hoặc `-l <count>`: Số lượng bài viết tối đa cho mỗi chu kỳ.
- `--clean-days <days>` hoặc `-c <days>`: Số ngày lưu trữ video/screenshot Reel trước khi dọn dẹp (mặc định: `2`).

---

### 2.6. Màn hình ảo & VNC Server cho VPS (`scripts/run-xvfb.js`)

Khởi chạy màn hình ảo Xvfb trên DISPLAY `:99` (độ phân giải 1920x1080x24) và dịch vụ `x11vnc` trên cổng `5900` phục vụ giải Captcha và đối soát trực quan từ xa trên VPS Linux.

```bash
node scripts/run-xvfb.js
```
*Lưu ý: Script này được PM2 tự động quản lý qua service `trendpulse-xvfb` trong `ecosystem.config.js` trên môi trường Linux.*

---

### 2.7. Tiện ích Cào HTML chống Memory Leak (`scripts/playwright.js`)

Công cụ dòng lệnh độc lập sử dụng Chromium Playwright đã được tối ưu chống rò rỉ bộ nhớ, chống tiến trình mồ côi (zombie processes) và chặn tài nguyên nặng.

```bash
# Lấy toàn bộ HTML của một trang web
node scripts/playwright.js "https://example.com"

# Chỉ trích xuất innerHTML của một selector cụ thể
node scripts/playwright.js "https://vnexpress.net" "h1.title-detail"

# Sử dụng cờ tham số
node scripts/playwright.js --url="https://example.com" --selector="#main-content"
```

**Ưu điểm:**
- Luôn giải phóng context, page và browser trong khối `finally`.
- Lắng nghe tín hiệu `SIGINT` / `SIGTERM` của OS để diệt Chromium con.
- Tự động chặn hình ảnh, media, font và websocket để tiết kiệm tới 85% RAM.

---

### 2.8. Script Triển khai Tự động lên VPS (`deploy.sh`)

Script bash trên máy local tự động kết nối SSH đến VPS, nạp đầy đủ môi trường PATH của Node/NVM/PM2, kéo code mới, build production và khởi động lại PM2.

```bash
# 1. Chạy đầy đủ (pull -> build -> restart PM2)
./deploy.sh

# 2. Bỏ qua bước pnpm build (chỉ pull & restart PM2)
./deploy.sh --no-build       # hoặc: ./deploy.sh -nb

# 3. Bỏ qua bước restart PM2 (chỉ pull & build)
./deploy.sh --no-restart     # hoặc: ./deploy.sh -nr

# 4. Chỉ kéo code Git (không build, không restart)
./deploy.sh --no-build --no-restart   # hoặc: ./deploy.sh -nb -nr
```

**Đặc tính an toàn:**
- Tự động nạp NVM, `.profile`, `.bash_profile` trong phiên non-interactive SSH để tránh lỗi `pm2: command not found`.
- Tự động fallback sang `npx pm2` hoặc `pnpm exec pm2` nếu PM2 chưa có trong PATH toàn cục.
