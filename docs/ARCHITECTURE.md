# Kiến trúc Hệ thống TrendPulse (System Architecture)

Tài liệu này mô tả chi tiết kiến trúc kĩ thuật, luồng dữ liệu (data flow), vòng đời tự động hóa, cấu trúc cơ sở dữ liệu và các cơ chế an toàn của hệ thống **TrendPulse**.

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
                         - Cào từ khóa & traffic
                         - Bóc tách link bài báo gốc
                         - Lọc chống trùng lặp (MD5 + Jaccard)
                                      |
                                      v
                         [ 2. AI Generator Service ]
                         - Google Gemini 2.5 Flash
                         - Viết bài chuẩn Hook & Insight
                         - Tách riêng link báo làm Comment
                                      |
                                      v
                        [ 3. Local SQLite Database ]
                         - Chế độ WAL (Write-Ahead-Log)
                         - Bảng trends, posts, reels, logs
                                      |
            +-------------------------+-------------------------+
            |                                                   |
            v                                                   v
 [ 4. Playwright Browser Engine ]                     [ 5. Web UI & Dashboard ]
  - Persistent User Profiles                           - Next.js 16 App Router
  - Anti-detect & Stealth Flags                        - Meta Astryx Design System
  - Popup Dismissal Logic                              - PWA (Progressive Web App)
  - Auto-Publish Post & Comment                        - Rest APIs & Studio Duyệt bài
  - FB Reels & TikTok Uploader                         - Ghi hình & Xem lại Screenshot
            |
            v
 [ 6. Notification Service ]
  - Telegram Bot Channel
  - Slack Incoming Webhook
  - Browser Push Notification
```

---

## 2. Luồng Dữ liệu Tự động hóa (Automation Lifecycle)

### A. Chu kỳ Đăng bài Viết (Post Cycle)
1. **Thu thập xu hướng (`crawler.ts`)**:
   - Truy vấn trang thịnh hành Google Trends chuyên mục Kinh tế / Tài chính theo vùng (`VN`, `US`, `SG`...).
   - Với mỗi xu hướng, hệ thống mở panel tin tức để trích xuất danh sách bài báo liên quan (`NewsArticle`). Nếu Google Trends không trả về link báo, hệ thống sử dụng DuckDuckGo HTML search để tìm nguồn báo chí thực tế.
2. **Kiểm tra trùng lặp (`dedup.ts`)**:
   - So sánh tiêu đề xu hướng và liên kết bài báo với các bài viết đã từng xử lý trong SQLite. Nếu phát hiện trùng lặp, bỏ qua để bảo vệ tài khoản khỏi việc đăng nội dung lặp lại.
3. **Sáng tạo nội dung (`ai-generator.ts`)**:
   - Gửi tiêu đề xu hướng và ngữ cảnh bài báo tới Google Gemini API.
   - Nhận về:
     - `post_content`: Nội dung bài viết chính (tuyệt đối không chứa liên kết).
     - `comment_content`: Nội dung bình luận trích dẫn đầy đủ nguồn gốc.
4. **Đăng bài & Bình luận (`fb-automation.ts`)**:
   - Khởi chạy Chromium với phiên đăng nhập từ `storage/fb-session.json`.
   - Điều hướng tới trang cá nhân hoặc Fanpage mục tiêu.
   - Xử lý các pop-up cản trở (hộp thoại chuyển quyền, pop-up thông báo "Not now").
   - Nhập nội dung bài viết và nhấn **Đăng (Post)**.
   - Chờ bài viết xuất hiện trên bảng tin $\to$ mở ô bình luận đầu tiên $\to$ nhập `comment_content` $\to$ gửi bình luận.
   - Ghi lại URL bài viết, chụp ảnh screenshot và lưu video hành trình (nếu bật `record_video`).
5. **Gửi thông báo (`notifications.ts`)**:
   - Dispatch kết quả thành công hoặc thất bại kèm link bài viết tới Telegram, Slack và Browser.

---

### B. Chu kỳ Đăng Video Ngắn (Reel & TikTok Pipeline)
```
[ Video File ] 
      │
      ▼
[ Lưu vào storage/reels/ + Tạo record trong DB ] 
      │
      ├──> Đăng ngay: Gọi fb-reel.ts + tiktok-reel.ts
      │
      └──> Hẹn giờ: Trạng thái 'scheduled'
            │
            ▼
      [ cron-daemon.ts ] (Quét mỗi 30 giây)
            │
            ▼ (Đến giờ hẹn)
      [ uploadFacebookReel ] ──> Đăng lên Fanpage/Cá nhân
            │
            ▼ (Nếu bật TikTok Auto Post)
      [ uploadTikTokVideo ] ──> Đăng lên TikTok Web
            │
            ▼
      [ Chụp ảnh / Video đối soát ] ──> Lưu vào DB
            │
            ▼
      [ Gửi thông báo Telegram/Slack ]
```

---

## 3. Cấu trúc Cơ sở dữ liệu (SQLite WAL Mode)

Ứng dụng sử dụng SQLite thông qua thư viện `better-sqlite3` với cơ chế **Write-Ahead Logging (WAL)**:
- Cho phép nhiều tiến trình đọc cùng lúc mà không bị khóa (non-blocking reads).
- Tự động bảo trì và sửa lỗi bất đồng bộ trạng thái (`repairInconsistentTrendStatuses`).

### Các bảng dữ liệu chính:
- `trends`: Lưu danh sách từ khóa xu hướng, lượng tìm kiếm ước tính, bài báo nguồn JSON.
- `posts`: Lưu nội dung bài viết Facebook, nội dung bình luận nguồn, URL bài đăng, trạng thái (`draft`, `scheduled`, `published`, `failed`), đường dẫn ảnh screenshot và video debug.
- `reels`: Quản lý video ngắn, chú thích, lịch hẹn giờ đăng, trạng thái trên Facebook và TikTok, link bài viết và ảnh đối soát.
- `activity_logs`: Nhật ký hành động phân cấp theo cấp độ (`INFO`, `WARN`, `ERROR`) và module (`CRAWL`, `AI`, `FB_PUBLISH`, `REEL`, `CLEANUP`).
- `settings`: Cấu hình hệ thống động dạng Key-Value (API Keys, cờ bật/tắt, interval, bộ lọc từ khóa).

---

## 4. Cơ chế Chống Checkpoint & Chống Crash VPS

1. **Persistent Browser Session**:
   - Lưu trữ cookies và storage state tại `storage/fb-session.json` và `storage/browser-profile`. Không đăng nhập lại từ đầu bằng ID/Password mỗi lần đăng để tránh kích hoạt cơ chế bảo mật của Facebook.
2. **VPS Resource Safety**:
   - Cờ Chromium `--disable-dev-shm-usage`: Chuyển bộ nhớ đệm chia sẻ từ `/dev/shm` (thường chỉ 64MB trên VPS) sang `/tmp`, triệt tiêu lỗi `RESULT_CODE_KILLED_BAD_MESSAGE`.
   - Cờ `--disable-gpu`, `--disable-software-rasterizer`: Tiết kiệm RAM và tránh xung đột driver đồ họa trên Linux headless server.
3. **Memory Leak Prevention**:
   - Tất cả các script Playwright đều được bọc trong khối `try...finally` đảm bảo `browser.close()` được gọi kể cả khi timeout hoặc crash.
   - Bắt các tín hiệu hệ điều hành `SIGINT`, `SIGTERM` để dọn dẹp các tiến trình Chromium con (renderer, zygote) không để lại zombie process.
4. **Giãn cách an toàn (Rate Limiting & Human-like Delay)**:
   - Tự động nghỉ 25 - 30 giây giữa các lần đăng bài khi đăng số lượng nhiều.
   - Thao tác gõ phím ngẫu nhiên (typing delay) mô phỏng hành vi người dùng thật.
