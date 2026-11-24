# Kiến trúc Hệ thống TrendPulse (System Architecture)

Tài liệu này mô tả chi tiết kiến trúc kỹ thuật, luồng dữ liệu (data flow), vòng đời tự động hóa, cấu trúc cơ sở dữ liệu và các cơ chế an toàn của hệ thống **TrendPulse**.

---

## 1. Sơ đồ Kiến trúc Tổng thể (High-level Architecture)

```
                 +-----------------------------------------+
                 |            NGUỒN DỮ LIỆU NGOÀI          |
                 |  Google Trends (Category 3 - Finance)   |
                 |     Báo chí chính thống (DuckDuckGo)    |
                 +--------------------+--------------------+
                                      |
                                      v
                        [ 1. Crawler & Dedup Service ]
                         - Cào từ khóa & traffic thời gian thực
                         - Bóc tách link bài báo gốc (Publisher News)
                         - Lọc chống trùng lặp theo cửa sổ 24 giờ
                                      |
                                      v
                        [ 2. Article Content Extractor ]
                         - Trích xuất nội dung toàn văn bài báo
                         - Cheerio bóc tách nhanh qua HTML meta/selectors
                         - Playwright fallback vượt tường lửa/JavaScript
                                      |
                                      v
                         [ 3. AI Generator Service ]
                         - Google Gemini (3.5-flash-lite, 3.5-flash, 3.8-flash)
                         - Phân tích insight từ full văn bản báo chí
                         - Viết bài chuẩn Hook & Insight tài chính
                         - Tách riêng link báo làm chuỗi Comment
                                      |
                                      v
                        [ 4. Local SQLite Database ]
                         - Chế độ WAL (Write-Ahead-Log)
                         - Bảng trends, posts, reels, logs, settings
                         - Tự động bảo trì & giải phóng xu hướng cũ
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
 [ 5. Playwright Browser Engine ]                     [ 6. Web UI & Dashboard ]
  - Persistent User Profiles (4 kênh)                  - Next.js 16 App Router (Turbopack)
    * Facebook (fb-session.json)                       - Meta Astryx Design System
    * TikTok (tiktok-session.json)                     - PWA (Progressive Web App)
    * YouTube Shorts (youtube-session.json)            - Studio Duyệt bài & Hẹn giờ Reels 4 kênh
    * Zalo Video (zalo-session.json)                   - Ghi hình Video & Xem lại Screenshot
  - Anti-detect & Stealth Flags                        - API Endpoints & CLI quản trị đa năng
  - Xvfb Virtual Display (:99) & x11vnc Server
  - Tự động hóa đăng bài & chuỗi comment 4 nền tảng
  - Tự động giải mã OTP Gmail cho TikTok 2FA
            |
            v
 [ 7. Notification Service ]
  - Telegram Bot Channel
  - Slack Incoming Webhook
  - Browser Web Push Notification
```

---

## 2. Luồng Dữ liệu Tự động hóa (Automation Lifecycle)

### A. Chu kỳ Đăng bài Viết (Post Cycle)

1. **Thu thập xu hướng (`crawler.ts`)**:
   - Truy vấn trang thịnh hành Google Trends chuyên mục Kinh tế / Tài chính theo vùng (`VN`, `US`, `SG`...). Hỗ trợ cơ chế dự phòng tự động chuyển sang Google Trends RSS Feed khi môi trường đám mây bị chặn IP web (chống `RpcError`).
   - Với mỗi xu hướng, hệ thống mở panel tin tức để trích xuất danh sách bài báo liên quan (`NewsArticle`). Nếu Google Trends không trả về link báo, hệ thống sử dụng DuckDuckGo HTML search để tìm nguồn báo chí thực tế.

2. **Kiểm tra trùng lặp trong phạm vi 24 giờ (`dedup.ts`)**:
   - Cơ chế kiểm tra trùng lặp **chỉ giới hạn trong phạm vi 1 ngày gần nhất (24 giờ)** (`datetime(COALESCE(published_at, created_at)) >= datetime('now', '-1 day')`).
   - So sánh qua 5 tầng:
     1. Khớp chính xác ID xu hướng (deterministic MD5).
     2. Khớp chính xác tiêu đề bài viết (Exact Title).
     3. Khớp tiêu đề không dấu (Loose Title, bỏ dấu tiếng Việt).
     4. Trùng lặp liên kết bài báo nguồn (Source URL Overlap).
     5. Độ tương đồng từ khóa cao (Token Jaccard Similarity $\ge$ 65%).
   - **Tự động giải phóng trạng thái cũ**: Các bài viết cũ hơn 1 ngày trước sẽ không chặn các chủ đề xuất hiện lại hôm nay; trình dọn dẹp `repairInconsistentTrendStatuses` tự động đưa các xu hướng cũ về lại `discovered`.

3. **Sáng tạo nội dung chuyên sâu (`article-extractor.ts` & `ai-generator.ts`)**:
   - Trước khi gửi bài cho AI, dịch vụ `article-extractor.ts` tự động cào và trích xuất toàn văn nội dung bài báo nguồn (sử dụng Cheerio để bóc tách nhanh các thẻ bài viết `article`, `.content-detail` và tự động fallback sang Playwright không đầu nếu gặp trang web SPA hoặc Cloudflare).
   - Nội dung bài báo đầy đủ được đưa vào prompt ngữ cảnh cho Google Gemini API (danh sách model hiện đại: `gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-3.8-flash`).
   - Nhận về:
     - `post_content`: Nội dung bài viết chính mang góc nhìn phân tích thị trường chuyên sâu, chuẩn công thức Hook & Insight (tuyệt đối không chứa liên kết để giữ reach tự nhiên).
     - `comment_content`: Nội dung bình luận trích dẫn đầy đủ nguồn gốc (hỗ trợ phân tách nhiều bình luận liên tiếp bằng ký tự `|`).

4. **Đăng bài & Bình luận (`fb-automation.ts`)**:
   - Khởi chạy Chromium với phiên đăng nhập từ `storage/fb-session.json` và cấp quyền clipboard (`permissions: ['clipboard-read', 'clipboard-write']`).
   - Điều hướng tới trang cá nhân hoặc Fanpage mục tiêu.
   - Xử lý các pop-up cản trở (hộp thoại chuyển quyền profile, pop-up thông báo "Not now").
   - Kích hoạt trình tạo bài viết ("Create post" / "Tạo bài viết").
   - Nhập nội dung qua `page.keyboard.insertText` tương thích với Lexical editor của Facebook.
   - Tự động đóng gợi ý tag ("Mentions suggestions") nếu xuất hiện.
   - Xử lý wizard đăng bài 2 bước: Bấm **Next** (hoặc **Tiếp**) nếu có $\to$ chờ tối đa 15s cho giao diện chuyển bước $\to$ bấm **Post** (hoặc **Đăng**) khi nút đã sẵn sàng (`aria-disabled !== 'true'`).
   - Sau khi đăng thành công, hệ thống điều hướng vào Content Library (`/professional_dashboard/content/content_library/`) để trích xuất URL bài viết công khai qua menu *Actions for this post* $\to$ *Copy link*.
   - Tự động gửi bình luận nguồn tin trực tiếp trên trang chi tiết bài viết (`/content/insights/?content_id=...`).
   - Ghi lại URL bài viết, chụp ảnh screenshot và lưu video hành trình (nếu bật `record_video`).

5. **Gửi thông báo (`notifications.ts`)**:
   - Dispatch kết quả thành công hoặc thất bại kèm link bài viết tới Telegram, Slack và Browser Web Push.

---

### B. Chu kỳ Tạo Video Dọc 9:16 Tự Động (HyperFrames & Playwright Video Pipeline)

```
[ Trend Hot từ Google Trends ] 
       │
       ▼
[ video-script-generator.ts ]
       ├──> Tầng 1: Google Gemini API (@google/genai)
       ├──> Tầng 2: Alternate AI Models
       └──> Tầng 3: Smart Extractor Fallback (100% Offline, lọc câu có số liệu thực tế)
       │
       ▼
[ Kịch bản Video JSON 3 phần ]
 (Intro 'Financial News' -> Content Slides 40px+ -> Outro Kêu gọi hành động & 4 Icon)
       │
       ▼
[ hyperframes-template.ts ] ──> Sinh mã HTML5 / CSS / Deterministic Timeline (seekTo)
       │
       ▼
[ video-renderer.ts ]
       ├──> Ưu tiên HyperFrames CLI nếu có sẵn trên hệ điều hành
       └──> Fallback: Playwright Headless Chromium (recordVideo) + FFmpeg H.264 MP4
       │
       ▼
[ storage/videos/ + DB Update ]
       ├──> trends: video_generated = 1, video_path = storage/videos/trend_xxx.mp4
       └──> reels: Tự động tạo bản nháp draft kèm caption & bình luận link nguồn

```

---

### C. Chu kỳ Đăng Video Ngắn Đa Kênh (4-Platform Video Pipeline)

```
[ Video File ] 
      │
      ▼
[ Lưu vào storage/videos/ + Tạo record trong DB ] 
      │
      ├──> Đăng ngay: Gọi fb-reel, tiktok-reel, youtube-reel, zalo-reel
      │
      └──> Hẹn giờ: Trạng thái 'scheduled'
            │
            ▼
      [ cron-daemon.ts ] (Quét mỗi 30 giây)
            │
            ├──> [ 1. Facebook Reel ] ──> uploadFacebookReel
            │         │
            │         └──> [ Auto-Comment ] ──> commentFacebookReelOnly
            │
            ├──> [ 2. TikTok Video ] ──> uploadTikTokVideo (Nhạc nền thịnh hành + 2FA Gmail)
            │         │
            │         └──> [ Auto-Comment ] ──> commentTikTokVideoOnly
            │
            ├──> [ 3. YouTube Shorts ] ──> uploadYouTubeShort (YouTube Studio)
            │         │
            │         └──> [ Auto-Comment ] ──> commentYouTubeShortOnly
            │
            └──> [ 4. Zalo Video ] ──> uploadZaloVideo (Zalo Video Creator Studio)
                      │
                      └──> [ Auto-Comment ] ──> commentZaloVideoOnly
            │
            ▼
      [ Chụp ảnh & Video đối soát ] ──> Lưu vào DB (fb/tiktok/youtube/zalo_debug_video_path)
            │
            ▼
      [ Gửi thông báo Telegram/Slack ]
```

#### Các Module Playwright chuyên biệt:
- **`uploadFacebookReel`**: Xử lý upload video, nhập caption, tự động tắt âm thanh gốc (Volume 0%), chọn nhạc nền Facebook Music Library, bấm đăng Reel và tự động bình luận đầu tiên.
- **`commentFacebookReelOnly`**: Tự động tìm liên kết công khai của Reel Facebook qua Content Library / Insights và bình luận nội dung. Hỗ trợ tách nhiều bình luận liên tiếp bằng dấu `|`.
- **`uploadTikTokVideo`**: Mở trang upload TikTok Creator Center, tải file video, tìm kiếm và chèn bài nhạc nền thịnh hành từ thư viện TikTok Studio, điều chỉnh âm lượng gốc/nhạc nền, xuất bản và bình luận tự động.
- **Tự động xử lý xác thực 2FA TikTok qua Gmail**: Khi TikTok hiển thị popup "Verify it's really you", bot tự động kích hoạt gửi mã OTP về Email, mở tab Gmail ngầm để đọc mã xác thực 6 số mới nhất và điền tự động.
- **`commentTikTokVideoOnly`**: Hỗ trợ bình luận trực tiếp qua trang quản lý nội dung TikTok Studio (`/tiktokstudio/content`) hoặc trang video TikTok công khai, tự động phân tách chuỗi bình luận bằng `|` để bình luận nhiều lần liên tiếp.
- **`uploadYouTubeShort` (`youtube-reel.ts`)**: Mở YouTube Studio (`studio.youtube.com`), tải video lên, nhập title/description, gắn nhãn Not for kids, chọn chế độ Public, trích xuất link dạng `https://youtube.com/shorts/{id}` và chờ render hoàn tất.
- **`commentYouTubeShortOnly` (`youtube-reel.ts`)**: Mở trực tiếp link Shorts, kích hoạt panel comment, nhập bình luận và tự động submit.
- **`uploadZaloVideo` (`zalo-reel.ts`)**: Mở Zalo Video Creator Studio (`video.zalo.me/creator/video`), kích hoạt modal đăng, upload file video, nhập caption vào contenteditable, ấn Đăng và theo dõi tiến độ xử lý video đến trạng thái "Thành công", trích xuất URL công khai.
- **`commentZaloVideoOnly` (`zalo-reel.ts`)**: Điều hướng danh sách video đã đăng, click mở bảng bình luận qua `data-row-key` và gửi comment tự động.
- **`executePublishAndComment` / `executeCommentOnly`**: Module tự động hóa bài viết văn bản Facebook (Profile & Fanpage), tự động đóng pop-up, đăng bài và gửi chuỗi bình luận nguồn tin tuần tự.

---

### D. Hệ thống Chuyển đổi Liên kết Proxy (`/go/?to=[target_url]`)

Để tối ưu quản lý lưu lượng, theo dõi truy cập và tránh rò rỉ phân phối trực tiếp từ bài viết, hệ thống tích hợp module chuẩn hóa link bình luận ([link-redirect.ts](file:///Users/ezerway/PhpstormProjects/ezerway/news-financial-tool/src/lib/link-redirect.ts)):
1. **Quy tắc chuyển đổi**:
   - Mọi URL bài báo nguồn bên ngoài trong bình luận đều được bọc tự động thành `https://financial-news.ezerway.com/go/?to=[target_url]`.
   - **Loại trừ cùng Domain**: Tự động bỏ qua các liên kết đã thuộc `financial-news.ezerway.com` hoặc `ezerway.com`.
2. **Endpoint xử lý redirect (`src/app/go/route.ts`)**:
   - Tiếp nhận tham số `to`, xác thực URL hợp lệ và trả về phản hồi HTTP `302 Found` chuyển hướng trực tiếp đến trang nguồn bài báo.

---

## 3. Cấu trúc Cơ sở dữ liệu (SQLite WAL Mode)

Ứng dụng sử dụng SQLite thông qua thư viện `better-sqlite3` với cơ chế **Write-Ahead Logging (WAL)**:
- Cho phép nhiều tiến trình đọc cùng lúc mà không bị khóa (non-blocking reads).
- Thiết lập `busy_timeout = 30000` chống lock database khi chạy đồng thời Next.js server và Cron daemon.
- **Cơ chế DB Auto-Repair (`repairInconsistentTrendStatuses`)**: 
  - Tự động phát hiện và chuyển các xu hướng không có source link hợp lệ từ `published` về lại `discovered`.
  - Tự động giải phóng các xu hướng đã xuất bản hoặc tạo bản thảo hơn 24 giờ về `discovered` nếu không có bài đăng nào trong vòng 1 ngày qua.

### Các bảng dữ liệu chính:
- `trends`: Lưu danh sách từ khóa xu hướng, vùng địa lý, lượng tìm kiếm ước tính, bài báo nguồn JSON, trạng thái (`discovered`, `drafted`, `published`), và cờ quản lý video 9:16 (`video_generated`, `video_path`, `video_created_at`).
- `posts`: Lưu nội dung bài viết Facebook, nội dung bình luận nguồn, URL bài đăng, trạng thái (`draft`, `publishing`, `published`, `failed`), đường dẫn ảnh screenshot và video debug.
- `reels`: Quản lý video ngắn, chú thích, lịch hẹn giờ đăng, liên kết xu hướng (`trend_id`), trạng thái xuất bản và bình luận trên cả 4 nền tảng:
  - Facebook: `status`, `comment_status`, `fb_post_url`, `debug_video_path`
  - TikTok: `tiktok_status`, `tiktok_comment_status`, `tiktok_post_url`, `tiktok_debug_video_path`
  - YouTube Shorts: `youtube_status`, `youtube_comment_status`, `youtube_post_url`, `youtube_debug_video_path`
  - Zalo Video: `zalo_status`, `zalo_comment_status`, `zalo_post_url`, `zalo_debug_video_path`
- `activity_logs`: Nhật ký hành động phân cấp theo cấp độ (`INFO`, `WARN`, `ERROR`, `SUCCESS`) và module (`CRAWL`, `AI`, `PUBLISH`, `COMMENT`, `POST_REEL`, `POST_TIKTOK`, `POST_YOUTUBE`, `POST_ZALO`, `VIDEO_RENDER`, `CLEANUP`).
- `settings`: Cấu hình hệ thống động dạng Key-Value (API Keys, cờ bật/tắt, interval, bộ lọc từ khóa, tài khoản Admin).

---

## 4. Cơ chế Chống Checkpoint, Màn hình ảo Xvfb & VPS Safety

1. **Persistent Browser Session (4 Nền tảng)**:
   - Lưu trữ cookies và storage state tách biệt tại:
     - `storage/fb-session.json`: Phiên Facebook
     - `storage/tiktok-session.json`: Phiên TikTok
     - `storage/youtube-session.json`: Phiên Google / YouTube Studio
     - `storage/zalo-session.json`: Phiên Zalo Video Creator
     - `storage/browser-profile`: Thư mục profile trình duyệt dùng chung
   - Không đăng nhập lại từ đầu bằng tài khoản mật khẩu mỗi lần đăng bài, tránh kích hoạt cơ chế checkpoint / phát hiện bất thường của các nền tảng.
   - Cung cấp CLI kiểm tra kết nối toàn diện: `pnpm connection:status`.

2. **Dịch vụ Màn hình ảo Xvfb & VNC Server (`trendpulse-xvfb`)**:
   - Trên Linux VPS, Playwright chạy giao diện có đầu đọc đồ họa thông qua **Xvfb** (màn hình ảo DISPLAY `:99`).
   - Tích hợp sẵn server **x11vnc** (cổng `5900`, mật khẩu `trendpulse`) cho phép quản trị viên kết nối trực tiếp từ xa (qua macOS Screen Sharing hoặc VNC Viewer) để xem trực quan tiến trình hoặc trực tiếp giải Captcha kéo hình khi TikTok yêu cầu.

3. **VPS Resource Safety & Memory Leak Prevention**:
   - Cờ Chromium `--disable-dev-shm-usage`: Chuyển bộ nhớ đệm chia sẻ từ `/dev/shm` (thường chỉ 64MB trên VPS) sang `/tmp`, triệt tiêu lỗi `RESULT_CODE_KILLED_BAD_MESSAGE`.
   - Cờ `--disable-gpu`, `--disable-software-rasterizer`: Tiết kiệm RAM và tránh xung đột driver đồ họa trên Linux server.
   - Tất cả các script Playwright đều được bọc trong khối `try...finally` đảm bảo giải phóng `page.close()`, `context.close()` và `browser.close()` kể cả khi timeout hoặc crash.
   - Bắt các tín hiệu hệ điều hành `SIGINT`, `SIGTERM` để dọn dẹp các tiến trình Chromium con không để lại zombie process.

4. **Giãn cách an toàn (Rate Limiting & Human-like Delay)**:
   - Tự động nghỉ 25 - 30 giây giữa các lần đăng bài khi đăng số lượng nhiều.
   - Thao tác nhập bàn phím ngẫu nhiên mô phỏng hành vi người dùng thật.
