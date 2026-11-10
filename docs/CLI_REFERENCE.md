# Bảng Tra cứu Lệnh Dòng Lệnh (CLI Reference)

Tài liệu hướng dẫn chi tiết toàn bộ các tập lệnh CLI (Command Line Interface) có sẵn trong dự án **TrendPulse**.

---

## 1. Danh sách Lệnh trong `package.json`

| Lệnh | File thực thi | Mô tả |
|---|---|---|
| `pnpm dev` | `next dev` | Chạy máy chủ Next.js phát triển tại cổng 3000 |
| `pnpm build` | `scripts/clean-locks.js` + `next build` | Tự động làm sạch lock cũ và build production |
| `pnpm start` | `next start` | Khởi chạy máy chủ Next.js đã build |
| `pnpm fb:login` | `scripts/fb-login.ts` | Đăng nhập tài khoản Facebook để lấy session cookie |
| `pnpm auto-cycle` | `scripts/auto-cycle.ts` | Chạy chu kỳ cào Google Trends và tạo bài viết |
| `pnpm post-reel` | `scripts/post-reel.ts` | Đăng video ngắn (Reel) lên Facebook & TikTok |
| `pnpm cron-daemon` | `scripts/cron-daemon.ts` | Daemon chạy ngầm chu kỳ và quét video hẹn giờ |

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

### 2.2. Chu kỳ Tự động hóa (`scripts/auto-cycle.ts`)

Cào dữ liệu từ Google Trends, phân loại tin tức, dùng Gemini viết bài và đưa vào database hoặc xuất bản ngay.

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

### 2.3. Đăng Video Reel / TikTok (`scripts/post-reel.ts`)

Đăng video ngắn lên Facebook Reels và tùy chọn đồng bộ sang TikTok Web.

```bash
# 1. Chế độ tương tác từng bước (Interactive prompt)
pnpm post-reel

# 2. Đăng nhanh bằng cờ tham số
pnpm post-reel --file "/path/to/video.mp4" --content "Tiêu đề video #hashtag"

# 3. Hẹn giờ đăng video
pnpm post-reel -f "./video.mp4" -c "Tin tức kinh tế" --schedule "2026-11-20 18:30"

# 4. Lưu bản nháp (không đăng ngay)
pnpm post-reel -f "./video.mp4" -c "Video nháp" --draft

# 5. Chạy ẩn danh không mở cửa sổ (Headless mode)
pnpm post-reel -f "./video.mp4" -c "Nội dung" --headless
```

**Các tham số hỗ trợ:**
- `-f`, `--file <path>`: Đường dẫn tới file video (`.mp4`, `.mov`, `.webm`). Hỗ trợ đường dẫn có khoảng trắng hoặc dấu `~`.
- `-c`, `--content <caption>`: Tiêu đề hoặc chú thích đính kèm hashtag cho video.
- `-s`, `--schedule <datetime>`: Thời gian hẹn giờ đăng (định dạng `YYYY-MM-DD HH:mm`).
- `--draft`: Lưu video vào hàng đợi ở trạng thái nháp (`draft`).
- `--headless`: Chạy Chromium ở chế độ ẩn (khuyên dùng khi chạy trên VPS).

---

### 2.4. Daemon Chạy ngầm (`scripts/cron-daemon.ts`)

Tiến trình chạy nền 24/7 thực hiện 2 nhiệm vụ song song:
1. Chạy chu kỳ cào tin và đăng bài định kỳ (mặc định mỗi 60 phút).
2. Quét hàng đợi video Reel hẹn giờ mỗi 30 giây để xuất bản tự động khi đến giờ.

```bash
# Chạy daemon với tính năng tự động xuất bản Facebook
pnpm cron-daemon --publish

# Tùy chỉnh chu kỳ lặp lại (ví dụ: mỗi 30 phút chạy 1 lần)
pnpm cron-daemon --publish --interval 30

# Giới hạn số bài đăng mỗi lần chạy
pnpm cron-daemon --publish --limit 2 --interval 60
```

**Các tham số hỗ trợ:**
- `--publish`: Kích hoạt chế độ đăng thật lên Facebook cho các chu kỳ.
- `--interval <minutes>` hoặc `-i <minutes>`: Khoảng thời gian lặp lại tính bằng phút.
- `--limit <count>` hoặc `-l <count>`: Số lượng bài viết tối đa cho mỗi chu kỳ.

---

### 2.5. Tiện ích Cào HTML chống Memory Leak (`scripts/playwright.js`)

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
