# 🚀 TrendPulse - Google Trends, Facebook, TikTok, YouTube Shorts & Zalo Video Automation Tool

**TrendPulse** là nền tảng tự động hóa toàn diện giúp theo dõi xu hướng, bóc tách nội dung báo chí toàn văn, sáng tạo nội dung tin tức tài chính chuyên sâu bằng AI và tự động xuất bản đa nền tảng (**Facebook Post, Facebook Reels, TikTok Video, YouTube Shorts, Zalo Video**) với cơ chế chống checkpoint, ghi hình kiểm soát, bộ nhớ đệm thông minh và thông báo tức thời.

---

## 📚 Tài liệu Chi tiết (Detailed Documentation)

Để tìm hiểu sâu hơn về từng khía cạnh kỹ thuật của dự án, vui lòng tham khảo các tài liệu chuyên sâu trong thư mục [`docs/`](docs/):

- 🏛️ **[Kiến trúc Hệ thống (Architecture)](docs/ARCHITECTURE.md)**: Sơ đồ kiến trúc, luồng dữ liệu tự động hóa, thiết kế SQLite WAL, cơ chế chống checkpoint và dọn dẹp bộ nhớ.
- 💻 **[Tra cứu Lệnh CLI (CLI Reference)](docs/CLI_REFERENCE.md)**: Hướng dẫn chi tiết từng tham số dòng lệnh cho `auto-cycle`, `post-reel`, `cron-daemon`, `fb-login`, `playwright.js`.
- 🔌 **[Đặc tả REST API (API Reference)](docs/API.md)**: Danh mục toàn bộ các REST endpoints (Auth, Trends, Posts, Reels, TikTok, Notifications, Backups).
- 🚀 **[Hướng dẫn Triển khai VPS (Deployment & Ops)](docs/DEPLOYMENT.md)**: Hướng dẫn cài đặt Ubuntu VPS từ A-Z, cấu hình Swap, PM2, Nginx Reverse Proxy, SSL HTTPS và xử lý sự cố thường gặp.

---

## 🌟 Điểm nổi bật & Tính năng chính

1. **Cào & Phân tích xu hướng (Google Trends Real-time)**:
   - Tự động trích xuất các xu hướng nóng theo từng quốc gia (Việt Nam `VN`, Mỹ `US`, Singapore `SG`...).
   - Bộ lọc thông minh chuyên biệt cho chủ đề **Tài chính / Kinh tế / Chứng khoán / Bất động sản / Vàng & Ngoại tệ**.
   - Tự động tìm kiếm và trích xuất liên kết các bài báo nguồn chính thống (Publisher News Sources).
   - Cơ chế tự động sửa lỗi bất đồng bộ (`DB Auto-Repair`) và lọc bài trùng lặp trong phạm vi 24 giờ (`withinDays = 1`).

2. **Sáng tạo nội dung với AI & Bóc tách toàn văn bài báo (Article Content Extractor)**:
   - **Tự động đọc bài báo nguồn**: Module `article-extractor` sử dụng Cheerio kết hợp dự phòng Playwright Headless để tự động bóc tách toàn văn tiêu đề, đoạn dẫn (Sapo) và các đoạn nội dung chứa số liệu thực tế từ các link bài báo nguồn chính thống (VnExpress, Dân Trí, Tuổi Trẻ, CafeF...).
   - **Google Gemini thế hệ mới (`gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.8-flash`)**: Đọc hiểu sâu nội dung, đối chiếu đa chiều giữa các bài báo để trích xuất số liệu, mốc thời gian, trích dẫn phát ngôn chuẩn xác.
   - **Tự tổng hợp bài đăng Facebook chuẩn SEO & Engagement**: Viết lại hoàn toàn bằng văn phong tự nhiên (Hook, bullet points điểm tin có số liệu, CTA, hashtag), không copy nguyên văn để giữ tối đa phân phối và tránh vi phạm bản quyền.
   - **Chiến lược giữ Reach**: Tuyệt đối không chèn link vào bài viết chính để thuật toán Facebook không bóp tương tác. Toàn bộ link nguồn được đưa vào bình luận đầu tiên.
   - **Bộ nhớ đệm (Caching)**: Dữ liệu bài báo đã trích xuất được lưu vào SQLite `trends.articles_json`, giúp tái sử dụng ngay khi đổi tone giọng hoặc tạo lại bài mà không cần cào lại mạng.

3. **Tự động đăng bài Facebook & Auto-Comment nguồn (Playwright)**:
   - Tự động đăng lên **Trang cá nhân (Profile)** hoặc **Fanpage**.
   - **Tự động bình luận nguồn tin (First-Comment Links)**: Ngay khi bài viết đăng thành công, bot tự động vào bình luận chính bài viết đó để đính kèm link bài báo gốc minh bạch.
   - **Hỗ trợ chuỗi bình luận nhiều lần (Multi-comments separated by `|`)**: Tách chuỗi theo dấu `|` để tự động gửi nhiều bình luận tuần tự thay vì dồn vào một bình luận duy nhất.
   - **Sửa liên kết thủ công (Manual Link Correction)**: Hỗ trợ chỉnh sửa hoặc bù đắp liên kết bài viết Facebook trực tiếp trên Dashboard nếu cần lưu vết thủ công.
   - Cơ chế đóng pop-up thông minh (`Not now`, `Chuyển sang trang...`) và mô phỏng thao tác người dùng tự nhiên (Anti-detection).

4. **Tạo Video Dọc 9:16 Tự Động từ Xu Hướng (HyperFrames & Headless Chromium Engine)**:
   - **Tạo video tự động từ từ khóa (1-click hoặc Hàng loạt)**: Biến mỗi từ khóa xu hướng thành video bản tin dọc 9:16 chuyên nghiệp (thời lượng 15 - 30 giây) chuẩn phong cách tài chính hiện đại.
   - **Cấu trúc Slide 3 phần chuẩn truyền hình**:
     - **Intro**: Xuất hiện mượt mà với tiêu đề thương hiệu `Financial News` và chuyên mục `BẢN TIN THỊ TRƯỜNG`.
     - **Slide nội dung (Headline & Diễn biến)**: Slide 1 hiển thị Headline giật tít sắc bén; các slide sau trình bày các block thông tin chắt lọc số liệu. Tự động chia thêm slide khi nội dung dài (tối đa 2 ý/slide, font chữ tối thiểu 40px), không đánh số thứ tự rườm rà, bọc class chống ngắt dòng số liệu (`.metric-nowrap`).
     - **Outro tinh gọn**: Lời cảm ơn `CẢM ƠN BẠN ĐÃ THEO DÕI`, nút CTA nổi bật `⚪ Đăng ký để nhận tin mỗi ngày ➔` và hàng icon nhận diện 4 kênh video ngắn (*Facebook Reels*, *TikTok*, *Shorts*, *Zalo Video*).
   - **Cơ chế 3 tầng phòng thủ kịch bản (Fault-Tolerant)**:
     - Tầng 1: Google Gemini API (`@google/genai`).
     - Tầng 2: Alternate AI Models.
     - Tầng 3: `Smart Extractor Fallback` 100% offline, tự động trích lọc câu chứa số liệu thực tế từ bài báo khi API AI không khả dụng hoặc hết quota.
   - **Tự động liên kết kho Reels**: Video render xong được tự động lưu vào `storage/videos/`, cập nhật cờ `video_generated = 1` trên bảng `trends`, đồng thời tạo bản ghi nháp tương ứng trong bảng `reels` sẵn sàng lên lịch đăng đa kênh.

5. **Hệ thống Chuyển đổi Link Redirect Proxy (`/go/?to=[target_url]`)**:
   - **Tự động chuẩn hóa liên kết nguồn**: Mọi URL bài báo trong phần bình luận (cả bài viết và Reels) đều được tự động chuyển đổi sang dạng `https://financial-news.ezerway.com/go/?to=[target_url]`.
   - **Cơ chế loại trừ thông minh (Domain Exemption)**: Tự động giữ nguyên các liên kết thuộc cùng domain `financial-news.ezerway.com` hoặc `ezerway.com` để tránh bọc link lặp lại.
   - **Endpoint `/go` an toàn**: Cung cấp route Next.js tiếp nhận và redirect 302 trực tiếp đến bài báo đích.

6. **Studio Đăng Đa Nền Tảng (Facebook Reels, TikTok, YouTube Shorts, Zalo Video)**:
   - Quản lý kho video ngắn, tải lên trực tiếp từ Dashboard hoặc qua CLI `pnpm post-reel`.
   - Hỗ trợ **hẹn giờ đăng tự động (Scheduled Reels)** chạy ngầm bởi daemon.
   - **Đăng đồng thời hoặc độc lập lên 4 nền tảng**:
     - **Facebook Reels**: Tự động tải video, chọn nhạc nền, đăng lên Page/Cá nhân và bình luận nguồn.
     - **TikTok Video**: Tự động chèn nhạc nền thịnh hành từ thư viện TikTok Studio, đăng video và tự động bình luận. Hỗ trợ giải mã 2FA qua Gmail.
     - **YouTube Shorts**: Tự động tải video lên YouTube Studio, thiết lập tiêu đề/mô tả và gửi bình luận đầu tiên.
     - **Zalo Video**: Tự động tải video lên Zalo Video Creator (`https://video.zalo.me/creator/video`), theo dõi trạng thái xử lý video cho đến khi thành công, trích xuất link phân tích và gửi bình luận tự động.
   - **Kiểm tra trạng thái độc lập**: Mỗi kênh được kiểm tra kết nối độc lập trước khi đăng, không phụ thuộc vào việc kênh khác thành công hay thất bại.
   - **Giao diện lưới 2x2 hiện đại & Nhãn `✓ Đã cmt`**: Thiết kế 4 hộp nền tảng cân xứng không bị co cụm chữ (`whitespace-nowrap`), hiển thị trực quan huy hiệu `✓ Đã cmt` khi hoàn tất bình luận.
   - **Sửa link thủ công cả 4 kênh**: Cho phép nhập link trực tiếp cho Facebook Reel, TikTok, YouTube Shorts và Zalo Video kèm tùy chọn đánh dấu "Đã xuất bản".
   - **Xem video debug riêng biệt**: Nút `Video FB`, `Video TT`, `Video YT`, `Video Zalo` để đối soát toàn bộ quá trình tự động hóa của từng kênh.

7. **Ghi hình & Chụp ảnh đối soát (Audit Trail)**:
   - Tùy chọn bật/tắt ghi video (MP4) và chụp ảnh màn hình (Screenshot) toàn bộ phiên tự động hóa để kiểm tra, xem lại trực tiếp trên Dashboard.
   - **Tự động bảo toàn video debug khi gặp lỗi**: Khi bình luận TikTok gặp lỗi hoặc dính xác thực Captcha, video quá trình luôn được lưu lại để phục vụ đối soát và khắc phục sự cố.

8. **Hệ thống thông báo tức thời (Multi-Channel Notifications)**:
   - Gửi thông báo kết quả đăng bài (kèm link bài viết, ảnh, thời gian hoặc chi tiết lỗi) qua **Telegram Bot**, **Slack Incoming Webhook**, và **Browser Web Push Notifications**.

9. **Dashboard quản trị PWA, Trang Tổng Quan & Đa ngôn ngữ (i18n)**:
   - **Trang Tổng quan (Overview) toàn diện**:
     - Thẻ KPI 5 chỉ số: Xu hướng, Bản thảo bài viết AI, **Video Reels 9:16**, Đã xuất bản Fanpage, và Nhật ký thời gian thực.
     - **Mục Video Reels 9:16 Mới Nhất**: Hiển thị lưới video 9:16 gần nhất kèm trình xem trước tương tác (video player preview popup), thanh trạng thái đa kênh (Facebook, TikTok, Shorts, Zalo) và nút tạo video nhanh từ Trend.
   - Hỗ trợ đầy đủ **Đa ngôn ngữ (Tiếng Việt & English)** với nút chuyển đổi tức thì trên Header và Form đăng nhập.
   - Giao diện Dark Mode chuẩn hiện đại, responsive hoàn hảo cho cả Mobile & Desktop.
   - **Thanh điều hướng Mobile tối ưu**: Hiển thị đầy đủ số lượng bài viết, xu hướng, reels mà không bị rút gọn `99+`.
   - Hỗ trợ cài đặt như ứng dụng di động **PWA (Progressive Web App)** không cần thông qua App Store.
   - Phân quyền bảo mật xác thực Admin, hệ thống Backup & Restore SQLite 1-click.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ |
|---|---|
| **Runtime & Language** | Node.js v20+ / TypeScript / TSX |
| **Framework & UI** | Next.js 16 (App Router) + Tailwind CSS v4 + Astryx Design System + Lucide Icons |
| **Tự động hóa trình duyệt** | Playwright (Persistent Context, Stealth flags, Resource blocker) |
| **Cơ sở dữ liệu** | SQLite (Better-SQLite3) chạy chế độ WAL (Zero-config, tốc độ cao, siêu nhẹ) |
| **Trí tuệ nhân tạo** | Google Gemini API (`@google/genai`) kèm Fallback Templates |
| **Thông báo & Tích hợp** | Telegram Bot API, Slack Incoming Webhooks, Web Push API |
| **Quản lý tiến trình** | PM2 (`ecosystem.config.js`) / Cron Daemon |

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### 1. Chuẩn bị môi trường & Cài đặt dependencies

```bash
# Clone repository
git clone https://github.com/ezerway/news-financial-tool.git
cd news-financial-tool

# Cài đặt thư viện
pnpm install

# Cài đặt trình duyệt Chromium và thư viện hệ thống cho Playwright
npx playwright install --with-deps chromium
```

### 2. Cấu hình biến môi trường (`.env`)

Sao chép từ file mẫu:
```bash
cp .env.example .env
```

Thiết lập các biến môi trường quan trọng:
```env
PORT=3000
NODE_ENV=production

# Google Gemini API Key (Hoặc cấu hình qua tab Cài đặt trên Web)
GEMINI_API_KEY=your_gemini_api_key_here

# Tài khoản đăng nhập Dashboard quản trị (mặc định: admin / admin123456)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
AUTH_SECRET=your_random_secret_key_at_least_32_chars_here

# Thông báo (Tùy chọn)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SLACK_WEBHOOK_URL=
```

### 3. Khởi chạy Dashboard phát triển (Local)

```bash
pnpm dev
```
Mở trình duyệt tại: **`http://localhost:3000`**

---

## 🔑 Kết nối Tài khoản (Facebook, TikTok, YouTube & Zalo)

### 1. Kết nối Facebook
Hệ thống lưu trữ phiên làm việc trong `storage/fb-session.json`. Có 2 cách kết nối linh hoạt:
- **Cách 1 (Mở trình duyệt trực tiếp)**: Chạy lệnh `pnpm fb:login` hoặc bấm nút **"Mở trình duyệt quản lý Facebook"** trong tab **Cài đặt**. Trình duyệt sẽ mở Fanpage/Profile để bạn đăng nhập và xác thực 2FA. Session sẽ tự động được lưu.
- **Cách 2 (Trên Linux VPS - Nhập Cookie CLI)**: Chạy `pnpm fb:login`. Script phát hiện môi trường VPS không GUI và hiển thị prompt để bạn dán 2 cookie `c_user` và `xs`.

### 2. Kết nối TikTok
- Chạy `pnpm tiktok:login` để mở trình duyệt đăng nhập TikTok và lưu session vào `storage/tiktok-session.json`.
- Hoặc đăng nhập trực tiếp qua nút kết nối trong tab **Reels & Video** trên Dashboard.

### 3. Kết nối YouTube Studio
- Chạy `pnpm youtube:login` để mở trình duyệt Chromium và đăng nhập vào `https://studio.youtube.com/`. Phiên được lưu trữ an toàn trong `storage/browser-profile` dùng chung.

### 4. Kết nối Zalo Video Creator
- Chạy `pnpm zalo:login` để mở trình duyệt truy cập `https://video.zalo.me/creator/video`. Quét mã QR hoặc đăng nhập tài khoản Zalo. Session được lưu trữ vĩnh viễn trong `storage/zalo_sessions`.

### 5. Kiểm tra tình trạng kết nối toàn bộ 4 nền tảng
- Chạy lệnh kiểm tra nhanh:
  ```bash
  pnpm connection:status
  # hoặc: pnpm status
  ```
  Script sẽ kiểm tra và hiển thị bảng trạng thái kết nối trực tiếp của **Facebook**, **TikTok**, **YouTube Shorts** và **Zalo Video**.

---

## 💻 Bảng tra cứu Lệnh CLI (CLI Reference)

| Lệnh | Mô tả chi tiết |
|---|---|
| `pnpm dev` | Khởi chạy Next.js development server (Port 3000) |
| `pnpm build` | Làm sạch lock cũ (`prebuild`) và build production bundle |
| `pnpm start` | Khởi chạy Next.js production server |
| `pnpm fb:login` | Đăng nhập tài khoản Facebook để lấy session (hỗ trợ GUI và Cookie CLI) |
| `pnpm tiktok:login` | Đăng nhập tài khoản TikTok để lấy session (nhập cookie chuỗi hoặc JSON) |
| `pnpm youtube:login` | Mở trình duyệt đăng nhập YouTube Studio lưu phiên đăng Shorts |
| `pnpm zalo:login` | Mở trình duyệt đăng nhập Zalo Video Creator (`video.zalo.me`) |
| `pnpm connection:status` / `pnpm status` | Kiểm tra tình trạng kết nối 4 nền tảng (Facebook, TikTok, YouTube, Zalo) |
| `pnpm auto-cycle` | Chạy 1 chu kỳ cào Google Trends $\to$ đọc bài báo nguồn $\to$ AI viết bài $\to$ lưu bản nháp vào Database |
| `pnpm auto-cycle --publish` | Chạy 1 chu kỳ hoàn chỉnh và **đăng ngay lập tức** lên Facebook |
| `pnpm auto-cycle --limit 3` | Giới hạn xử lý tối đa 3 xu hướng trong chu kỳ này |
| `pnpm auto-cycle --retry` | Chạy lại tìm kiếm link báo chí và xuất bản cho các xu hướng chưa có nguồn |
| `pnpm auto-cycle --trend <id>` | Chạy riêng cho một xu hướng cụ thể theo mã ID |
| `pnpm post-reel` | CLI đăng Reels lên Facebook, TikTok, YouTube Shorts & Zalo Video (hỏi - đáp tương tác) |
| `pnpm post-reel -f <video> -c "Cap"` | Đăng nhanh một video Reel qua tham số dòng lệnh |
| `pnpm post-reel -f <video> --schedule "2026-11-15 10:00"` | Hẹn giờ đăng video Reel |
| `pnpm cron-daemon --publish` | Khởi chạy Daemon chạy ngầm liên tục theo chu kỳ cấu hình |
| `pnpm pm2:start` | Khởi chạy toàn bộ hệ thống bằng PM2 (`trendpulse-xvfb`, `trendpulse-web`, `trendpulse-cron`) |
| `pnpm pm2:restart` | Khởi động lại toàn bộ các dịch vụ PM2 sau khi cập nhật code |
| `pnpm pm2:stop` | Tạm dừng toàn bộ các tiến trình PM2 |
| `node scripts/playwright.js <url> [sel]` | Tiện ích cào DOM/HTML chống rò rỉ bộ nhớ (zero memory leak) |

---

## 🎬 Quản lý Đăng Video Ngắn Đa Nền Tảng (Reels, TikTok, Shorts, Zalo)

Dự án cung cấp bộ công cụ toàn diện cho Video ngắn:
- **Tải lên & Xem trước**: Hỗ trợ định dạng MP4/MOV, tỉ lệ 9:16 tối ưu cho Reels/Shorts/TikTok/Zalo.
- **Hẹn giờ đăng tự động (Scheduler)**:
  - Bạn có thể đặt lịch đăng cho từng video qua giao diện Web hoặc lệnh `--schedule`.
  - Tiến trình `cron-daemon` tự động kiểm tra mỗi 30 giây và xuất bản video đúng thời điểm.
- **Đăng chéo 4 nền tảng (Facebook Reels, TikTok, YouTube Shorts, Zalo Video)**:
  - Tự động tải video lên Facebook Reels (Page hoặc cá nhân).
  - Tự động đăng lên TikTok Web và chèn nhạc nền thịnh hành từ thư viện TikTok Studio.
  - Tự động đăng lên YouTube Shorts và gửi bình luận đầu tiên.
  - Tự động tải video lên Zalo Video Creator, đợi xử lý hoàn tất, lấy link phân tích và bình luận.
  - Đăng độc lập từng kênh: Mỗi kênh tự kiểm tra kết nối và không phụ thuộc vào việc kênh khác thành công hay thất bại.
  - Ghi hình video debug và ảnh screenshot đối soát kết quả đăng trên cả 4 nền tảng.
  - **Tự động dọn dẹp bộ nhớ**: Tiến trình `cron-daemon` tự động dọn video và ảnh screenshot của các post Reel đã tạo từ 2 ngày trước khi khởi động và sau mỗi chu kỳ để tiết kiệm dung lượng ổ cứng VPS.

---

## 🔔 Cấu hình Thông báo Tức thời

Bạn có thể kích hoạt thông báo khi có bài viết hoặc Reel mới được xuất bản:

### 1. Telegram Bot
1. Tạo bot qua [@BotFather](https://t.me/BotFather) để lấy `TELEGRAM_BOT_TOKEN`.
2. Lấy `TELEGRAM_CHAT_ID` của bạn (hoặc nhóm) qua [@userinfobot](https://t.me/userinfobot).
3. Nhập token và chat ID vào tab **Cài đặt** $\to$ **Cấu hình Thông báo** $\to$ Bấm **"Gửi tin nhắn thử nghiệm"** để kiểm tra.

### 2. Slack Webhook
1. Tạo một Incoming Webhook trên trang quản lý ứng dụng Slack (`https://api.slack.com/apps`).
2. Dán URL webhook (`https://hooks.slack.com/...`) vào cấu hình Slack trên Dashboard.

### 3. Web Push Notification
- Bật công tắc **"Nhận thông báo trên trình duyệt"** tại tab Cài đặt và cấp quyền cho trình duyệt.

---

## 🌐 Hướng dẫn Triển khai VPS (Production Deployment)

### 1. Cài đặt môi trường VPS (Ubuntu / Debian)

```bash
# 1. Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt Node.js 20.x và Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Cài đặt pnpm và PM2 toàn cục
sudo npm install -g pnpm pm2
```

### 2. Kéo mã nguồn & Cài đặt

```bash
git clone https://github.com/ezerway/news-financial-tool.git /home/ezerway-financial-news/news-financial-tool
cd /home/ezerway-financial-news/news-financial-tool

pnpm install
npx playwright install --with-deps chromium
```

### 3. Thiết lập cấu hình `.env` & Build

```bash
cp .env.example .env
nano .env   # Cập nhật thông tin bảo mật, GEMINI_API_KEY, ADMIN_PASSWORD
pnpm build
```

### 4. Quản lý dịch vụ bằng PM2 (`ecosystem.config.js`)

File `ecosystem.config.js` đã được tối ưu sẵn chạy đồng thời 3 dịch vụ:
- `trendpulse-xvfb`: Màn hình ảo Xvfb `:99` kèm VNC Server (port 5900)
- `trendpulse-web`: Ứng dụng Web Dashboard Next.js (port 3000)
- `trendpulse-cron`: Daemon chạy ngầm tự động theo dõi xu hướng và video hẹn giờ

```bash
# Khởi động toàn bộ hệ thống
pm2 start ecosystem.config.js

# Thiết lập tự động khởi động cùng hệ điều hành
pm2 save
pm2 startup
```

**Các lệnh giám sát thông dụng:**
```bash
pm2 status                  # Xem trạng thái hoạt động của 3 dịch vụ
pm2 logs                    # Xem toàn bộ logs
pm2 logs trendpulse-cron    # Xem logs chu kỳ tự động đăng bài
pm2 restart all             # Khởi động lại tất cả
```

> 💡 **Mẹo**: Nếu cần giải captcha hoặc quan sát màn hình ảo trên VPS, mở SSH tunnel từ máy cá nhân `ssh -L 5900:localhost:5900 root@<IP_VPS>` và kết nối VNC bằng `open vnc://localhost:5900` (mật khẩu: `trendpulse`).

### 5. Cấu hình Nginx Reverse Proxy & SSL (HTTPS cho PWA)

Tạo file cấu hình `/etc/nginx/sites-available/trendpulse`:
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Kích hoạt và cấp chứng chỉ Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/trendpulse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 📂 Cấu trúc thư mục

```text
news-financial-tool/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── api/                     # REST APIs (trends, generate, publish, reels, notifications, backup...)
│   │   ├── login/                   # Giao diện xác thực Admin
│   │   ├── page.tsx                 # Dashboard điều khiển trung tâm
│   │   └── layout.tsx               # Root layout, PWA metadata & theme
│   ├── components/                  # Giao diện thành phần (TrendsTab, PostsTab, ReelsTab, SettingsTab...)
│   ├── lib/                         # Core libraries
│   │   ├── db.ts                    # SQLite (Better-SQLite3) & Auto-repair schemas
│   │   ├── auth-server.ts           # Xác thực phiên Admin qua cookie/JWT
│   │   └── auth-token.ts            # Quản lý mã hóa token
│   ├── services/                    # Business Logic & Automations
│   │   ├── crawler.ts               # Cào Google Trends Tài chính & trích xuất tin tức gốc
│   │   ├── ai-generator.ts          # Tạo nội dung bài viết Facebook qua Gemini API
│   │   ├── auto-runner.ts           # Điều phối chu kỳ tự động (Crawl -> AI -> Publish)
│   │   ├── dedup.ts                 # Bộ lọc chống trùng lặp tin tức
│   │   ├── notifications.ts         # Thông báo qua Telegram, Slack & Web Push
│   │   ├── reels.ts                 # Quản lý hàng đợi và bộ xử lý Reel theo lịch
│   │   └── playwright/              # Tự động hóa trình duyệt
│   │       ├── session.ts           # Quản lý session Facebook, stealth flags, chống crash VPS
│   │       ├── fb-automation.ts     # Đăng bài Facebook & bình luận link nguồn
│   │       ├── fb-reel.ts           # Tự động hóa đăng Facebook Reels
│   │       ├── tiktok-session.ts    # Quản lý session TikTok
│   │       └── tiktok-reel.ts       # Tự động hóa đăng video TikTok Web
│   └── types/                       # TypeScript interfaces & types
├── public/                          # Static assets, PWA icons, manifest.json, sw.js
├── scripts/                         # CLI Automation Tools
│   ├── auto-cycle.ts                # CLI chạy chu kỳ tự động hóa
│   ├── cron-daemon.ts               # Background Daemon chạy chu kỳ & quét video hẹn giờ
│   ├── fb-login.ts                  # CLI đăng nhập và lưu session Facebook
│   ├── tiktok-login.ts              # CLI kết nối tài khoản TikTok qua cookie/JSON
│   ├── run-xvfb.js                  # Khởi chạy màn hình ảo Xvfb :99 và VNC Server
│   ├── post-reel.ts                 # CLI đăng Reel lên Facebook và TikTok
│   ├── playwright.js                # Công cụ cào DOM/HTML Playwright chống rò rỉ RAM
│   └── clean-locks.js               # Tiện ích dọn dẹp file lock trước khi build
├── storage/                         # Thư mục lưu trữ nội bộ (SQLite app.db, sessions, screenshots, videos)
├── docs/                            # Tài liệu chuyên sâu (Kiến trúc hệ thống, Tham chiếu CLI)
├── ecosystem.config.js              # Cấu hình PM2 chạy Web & Cron trên VPS
├── package.json
└── README.md
```

---

## 🛡️ Tối ưu hóa & Chống rò rỉ bộ nhớ (Memory Safety)

1. **Khắc phục triệt để Zombie Chromium**:
   - Tất cả các tác vụ Playwright (`fb-automation`, `fb-reel`, `tiktok-reel`, `scripts/playwright.js`) đều giải phóng tài nguyên trong khối `finally` (`page.close()` $\to$ `context.close()` $\to$ `browser.close()`).
   - Lắng nghe tín hiệu `SIGINT` / `SIGTERM` để đảm bảo đóng browser khi tiến trình bị dừng đột ngột.
2. **Ngăn chặn cạn kiệt `/dev/shm`**:
   - Sử dụng cờ `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-gpu` đảm bảo hoạt động bền bỉ trên VPS dung lượng RAM thấp (1GB - 2GB RAM).
3. **Chặn tài nguyên nặng khi cào dữ liệu**:
   - Tự động abort hình ảnh, video, font chữ và websockets trong các tác vụ crawl, giảm thiểu tới 85% RAM tiêu thụ.
