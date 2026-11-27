# Tài liệu Tham chiếu REST API (API Reference)

TrendPulse cung cấp hệ thống REST API toàn diện phục vụ Web Dashboard, ứng dụng PWA và các công cụ tự động hóa bên ngoài. Mọi endpoint đều trả về định dạng **JSON**.

---

## 1. Xác thực & Quản trị phiên (`/api/auth`)

### 1.1. Đăng nhập (`POST /api/auth/login`)
Xác thực người dùng quản trị và thiết lập HTTP-Only Cookie.
- **Request Body**:
  ```json
  {
    "username": "admin",
    "password": "your_password",
    "rememberMe": true
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "username": "admin",
    "message": "Đăng nhập thành công!"
  }
  ```

### 1.2. Kiểm tra phiên (`GET /api/auth/session`)
- **Response (200 OK)**:
  ```json
  {
    "authenticated": true,
    "username": "admin"
  }
  ```

### 1.3. Đăng xuất (`POST /api/auth/logout`)
- Xóa cookie xác thực và hủy phiên làm việc.

### 1.4. Đổi mật khẩu (`POST /api/auth/change-password`)
- **Request Body**:
  ```json
  {
    "currentPassword": "old_password",
    "newPassword": "new_password_min_6_chars"
  }
  ```

---

## 2. Quản lý Xu hướng (`/api/trends`)

### 2.1. Lấy danh sách xu hướng (`GET /api/trends`)
- **Query Parameters**:
  - `geo`: Vùng địa lý (`VN`, `US`, `SG`... - Mặc định theo DB)
  - `category`: Chuyên mục (`finance`, `all`...)
  - `status`: Lọc theo trạng thái (`discovered`, `drafted`, `published`)
- **Response**:
  ```json
  {
    "success": true,
    "trends": [
      {
        "id": "trend_e2a8...",
        "title": "Giá vàng miếng SJC hôm nay",
        "approx_traffic": "50K+",
        "pub_date": "2026-11-10T10:00:00.000Z",
        "category": "finance",
        "status": "discovered",
        "articles": [
          {
            "title": "Giá vàng hôm nay 10/11: Tiếp đà tăng mạnh",
            "url": "https://vnexpress.net/...",
            "source": "VnExpress"
          }
        ]
      }
    ]
  }
  ```

### 2.2. Kích hoạt cào xu hướng thủ công (`POST /api/trends`)
- **Request Body**:
  ```json
  {
    "geo": "VN"
  }
  ```

### 2.3. Tìm lại link báo chí cho xu hướng (`POST /api/trends/find-sources`)
- Tìm kiếm nguồn tin chính thống bổ sung khi từ khóa bị thiếu source link.

### 2.4. Xóa xu hướng (`DELETE /api/trends`)
Hỗ trợ xóa một xu hướng cụ thể, xóa theo trạng thái hoặc xóa toàn bộ xu hướng trong cơ sở dữ liệu.
- **Query Parameters**:
  - `all`: Truyền `all=true` để xóa toàn bộ bản ghi trong bảng `trends`.
  - `id`: ID của xu hướng cần xóa.
  - `status`: Xóa các xu hướng có trạng thái tương ứng (`discovered`, `drafted`...).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa tất cả xu hướng"
  }
  ```
- **Request Body**:
  ```json
  {
    "trendId": "trend_e2a8..."
  }
  ```

### 2.4. Thử lại đăng bài cho các xu hướng thiếu nguồn (`POST /api/trends/retry-publish`)
- **Request Body**:
  ```json
  {
    "trendId": "trend_e2a8...", // Tùy chọn, để trống nếu muốn quét tất cả
    "allMissing": true,
    "limit": 5
  }
  ```

### 2.5. Xóa xu hướng theo mã ID (`DELETE /api/trends/[id]`)
- Xóa một xu hướng cụ thể. Tự động kiểm tra các bài viết liên kết (`posts`): nếu bài viết là bản nháp hoặc lỗi thì xóa kèm dọn dẹp file screenshot/video; nếu bài viết đã xuất bản thành công trên Fanpage thì giữ lại lịch sử bài viết và chỉ gỡ liên kết `trend_id`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa xu hướng thành công"
  }
  ```

### 2.6. Xóa xu hướng theo trạng thái hoặc hàng loạt (`DELETE /api/trends`)
- **Query Parameters**:
  - `status`: Lọc xóa theo trạng thái (`discovered`, `drafted`, `published`)
  - `all`: `true` nếu muốn xóa toàn bộ xu hướng trong database
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa 12 xu hướng có trạng thái discovered"
  }
  ```

### 2.7. Tạo video ngắn 9:16 từ từ khóa xu hướng (`POST /api/trends/[id]/generate-video`)
- Tự động sinh kịch bản Slide (Gemini AI hoặc Smart Fallback) và render MP4 dọc 9:16 (720x1280) bằng HyperFrames/Playwright engine.
- Tự động cập nhật `trends` (`video_generated = 1`, `video_path`) và tạo bản nháp trong `reels`.
- **Request Body**:
  ```json
  {
    "force": false, // true nếu muốn ghi đè tạo lại dù đã có video
    "templateId": "editorial_magazine", // Tùy chọn mẫu video
    "script": { ... } // Tùy chọn: truyền trực tiếp kịch bản slide đã xem trước/chỉnh sửa
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "videoPath": "storage/videos/trend_test_1795484749653.mp4",
    "reelId": "reel_8ca8eebf",
    "alreadyExisted": false
  }
  ```

### 2.8. Xem trước và sinh kịch bản Slide Video (`GET / POST /api/trends/[id]/slide-preview`)
- `GET`: Sinh và trả về kịch bản Slide đầy đủ (`VideoSlideScript`) gồm: Slide Intro, Headline, các nhóm Slide nội dung kèm số liệu và Slide Outro.
- `POST`: Gửi yêu cầu AI đọc lại báo chí và sinh lại kịch bản Slide mới (`{ "force": true }`).
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "script": {
      "intro": { "categoryLabel": "BẢN TIN", "mainTitle": "...", "tagline": "..." },
      "slide1": { "category": "Kinh Tế", "headline": "...", "timestamp": "Hôm nay" },
      "contentSlides": [
        { "title": "Diễn biến chính", "fragments": ["..."] }
      ],
      "outro": { "ctaText": "...", "subText": "..." }
    }
  }
  ```

### 2.9. Tạo video hàng loạt cho các xu hướng chưa có video (`POST /api/trends/generate-videos`)
- Quét danh sách xu hướng và tạo video tự động cho các xu hướng chưa được tạo video.
- **Request Body**:
  ```json
  {
    "limit": 5, // Tối đa số lượng video tạo trong lần gọi này (mặc định: 5)
    "force": false
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 3,
    "results": [
      { "trendId": "trend_1", "videoPath": "storage/videos/trend_1_xxx.mp4", "reelId": "reel_1", "alreadyExisted": false }
    ]
  }
  ```

---

## 3. Sáng tạo Nội dung AI (`/api/generate`)

### 3.1. Tạo bài viết & bình luận bằng Gemini (`POST /api/generate`)
- **Request Body**:
  ```json
  {
    "trendId": "trend_e2a8...",
    "trendTitle": "Thị trường chứng khoán VN-Index",
    "articles": [
      { "title": "Báo cáo thị trường", "url": "https://...", "source": "Báo Đầu Tư" }
    ],
    "tone": "finance_news" // finance_news | viral_engaging | concise
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "post_content": "🔥 [ĐIỂM TIN TÀI CHÍNH] VN-Index vượt ngưỡng...\n\n👉 Chi tiết nguồn tin bên dưới phần bình luận!",
      "comment_content": "📌 Nguồn tin trích dẫn tham khảo:\n1. Báo cáo thị trường: https://...\n(Nguồn: Báo Đầu Tư)"
    }
  }
  ```

---

## 4. Quản lý Bài viết & Xuất bản (`/api/posts`, `/api/publish`)

### 4.1. Lấy danh sách bài viết (`GET /api/posts`)
- **Query Parameters**:
  - `status`: `draft` | `scheduled` | `published` | `failed`
  - `page`: Trang hiện tại (Mặc định: 1)
  - `limit`: Số bài mỗi trang (Mặc định: 10)

### 4.2. Lưu hoặc sửa bài viết (`POST /api/posts`, `PATCH /api/posts/[id]`)
- **Request Body**:
  ```json
  {
    "trend_id": "trend_e2a8...",
    "trend_title": "VN-Index",
    "post_content": "Nội dung bài viết...",
    "comment_content": "Nội dung bình luận nguồn...", // Hỗ trợ chuỗi tách bằng '|' để bình luận nhiều lần
    "record_video": true,
    "scheduled_at": "2026-11-15T09:00:00", // Tùy chọn
    "fb_post_url": "https://www.facebook.com/permalink.php?story_fbid=..." // Hỗ trợ sửa/bù đắp link Facebook thủ công
  }
  ```

### 4.3. Viết lại bài viết bằng AI (`POST /api/posts/[id]/regenerate`)
- Kích hoạt AI (Gemini hoặc Ollama dự phòng) đọc lại toàn văn báo chí nguồn và sinh lại toàn bộ nội dung bài đăng Facebook cùng bình luận nguồn tin.
- **Request Body** (tùy chọn):
  ```json
  {
    "customTone": "chuyên gia phân tích tài chính"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã tạo lại nội dung bài viết thành công!",
    "post": {
      "id": "post_1234...",
      "trend_title": "VN-Index",
      "post_content": "🔥 [ĐIỂM TIN XU HƯỚNG MỚI] ...",
      "comment_content": "🔗 Nguồn tin và bài viết chi tiết ...",
      "status": "draft"
    }
  }
  ```

### 4.4. Xuất bản bài viết lên Facebook (`POST /api/publish`)
- **Request Body**:
  ```json
  {
    "postId": "post_1234...",
    "post_content": "Nội dung bài đăng...",
    "comment_content": "Bình luận nguồn...",
    "record_video": true
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "fb_post_url": "https://www.facebook.com/permalink.php?story_fbid=...",
    "fb_post_id": "123456789",
    "comment_id": "987654321",
    "screenshot_path": "storage/screenshots/screenshot_123.png",
    "video_path": "storage/videos/post_123.mp4"
  }
  ```

### 4.4. Gửi bình luận nguồn cho bài viết đã đăng (`POST /api/comment`)
- Kích hoạt trình tự động Playwright truy cập trực tiếp vào bài viết Facebook đã đăng (hoặc theo URL truyền vào) để gửi bình luận nguồn tin.
- **Request Body**:
  ```json
  {
    "postId": "post_1234...",
    "postUrl": "https://www.facebook.com/permalink.php?story_fbid=...", // Tùy chọn, ưu tiên dùng link này nếu truyền
    "headless": true
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "result": {
      "success": true,
      "commentId": "987654321",
      "screenshotPath": "storage/screenshots/comment_123.png"
    }
  }
  ```

### 4.5. Xóa một bài viết cụ thể (`DELETE /api/posts/[id]`)
- Xóa bài viết khỏi cơ sở dữ liệu và tự động dọn dẹp các tệp ảnh screenshot và video liên quan trong thư mục `storage/`.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã xóa bài viết thành công"
  }
  ```

### 4.6. Xóa danh sách bài viết theo trạng thái (`DELETE /api/posts`)
- **Query Parameters**:
  - `status`: Lọc trạng thái cần xóa (`draft`, `scheduled`, `failed`, hoặc `all` - mặc định: `failed`)
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 5,
    "message": "Đã xóa 5 bài viết và dọn dẹp file thành công"
  }
  ```

### 4.7. Kích hoạt toàn bộ chu kỳ tự động (`POST /api/run-cycle`)
- **Request Body**:
  ```json
  {
    "forcePublish": true,
    "limit": 2
  }
  ```

---

## 5. Đăng Video Đa Nền Tảng: Facebook Reels, TikTok, YouTube Shorts & Zalo Video (`/api/reels`)

### 5.1. Tải file video lên server (`POST /api/reels/upload`)
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (File video `.mp4`, `.mov`, `.webm`)
- **Response**:
  ```json
  {
    "success": true,
    "filePath": "/path/to/storage/videos/reel_173123456_myvideo.mp4",
    "filename": "reel_173123456_myvideo.mp4",
    "size": 15420120
  }
  ```

### 5.2. Lấy danh sách Reels (`GET /api/reels`)
- **Query Parameters**:
  - `status`: `draft` | `scheduled` | `published` | `failed`
- **Response**: Danh sách các Reels kèm trạng thái xuất bản độc lập trên cả 4 nền tảng (Facebook, TikTok, YouTube Shorts, Zalo Video).

### 5.3. Đăng Reel lên Facebook (`POST /api/reels/[id]/publish`)
- **Response**:
  ```json
  {
    "success": true,
    "fb_post_url": "https://www.facebook.com/reel/123456789",
    "screenshot_path": "storage/screenshots/reel_fb_123.png"
  }
  ```

### 5.4. Đăng Reel lên TikTok (`POST /api/reels/[id]/publish-tiktok`)
- **Response**:
  ```json
  {
    "success": true,
    "tiktok_post_url": "https://www.tiktok.com/@user/video/123456789",
    "screenshot_path": "storage/screenshots/reel_tiktok_123.png"
  }
  ```

### 5.5. Đăng Reel lên YouTube Shorts (`POST /api/reels/[id]/publish-youtube`)
- Tự động mở YouTube Studio (`https://studio.youtube.com/`), tải video lên, điền tiêu đề/mô tả kèm hashtag `#Shorts` và bấm xuất bản công khai.
- **Tự động thêm nhạc YouTube Studio Editor**: Sau khi xuất bản và lấy `videoId`, bot tự động điều hướng sang `https://studio.youtube.com/video/[video-id]/editor`, mở Audio Library (`#entrypoint-audio-row a`), chọn ngẫu nhiên bài nhạc từ bảng `ytve-audioswap-track-row`, bấm thêm bài hát (`#add-track-button`), bấm Save và tự động xác nhận hộp thoại `tp-yt-paper-dialog` (tích checkbox `id="checkbox"` và bấm `[aria-label="Confirm changes"]`).
- **Response**:
  ```json
  {
    "success": true,
    "youtube_post_url": "https://www.youtube.com/shorts/abcd1234xyz",
    "debug_video_path": "storage/videos/debug_yt_123.mp4"
  }
  ```

### 5.6. Đăng Reel lên Zalo Video (`POST /api/reels/[id]/publish-zalo`)
- Tự động mở Zalo Video Creator (`https://video.zalo.me/creator/video`), tải video lên, điền nội dung chú thích, bấm "Đăng video", theo dõi trạng thái xử lý cho tới khi 'Thành công' và trích xuất link xem phân tích.
- **Response**:
  ```json
  {
    "success": true,
    "zalo_post_url": "https://video.zalo.me/creator/phan-tich/noi-dung/video-12345.html",
    "debug_video_path": "storage/videos/debug_zalo_123.mp4"
  }
  ```

### 5.7. Quét video hẹn giờ (`POST /api/reels/check-scheduled`)
- Kích hoạt kiểm tra và đăng tất cả các Reel đã đến giờ hẹn trên các kênh đã kết nối.

### 5.8. Gửi bình luận vào Reel Facebook (`POST /api/reels/[id]/comment`)
- Tự động điều hướng đến liên kết công khai của Reel Facebook (hoặc tự trích xuất qua Content Library / Insights) và gửi bình luận đầu tiên.
- **Hỗ trợ Multi-comments**: Tách chuỗi theo dấu `|` để gửi nhiều bình luận tuần tự.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã gửi bình luận vào Facebook Reel thành công!"
  }
  ```

### 5.9. Gửi bình luận vào video TikTok (`POST /api/reels/[id]/comment-tiktok`)
- Tự động mở TikTok Studio hoặc link công khai của video để gửi bình luận, hỗ trợ multi-comments tách bởi dấu `|`.

### 5.10. Gửi bình luận vào YouTube Shorts (`POST /api/reels/[id]/comment-youtube`)
- Mở link xem YouTube Shorts, kích hoạt ô bình luận và gửi bình luận nguồn tin.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã gửi bình luận vào YouTube Shorts thành công!"
  }
  ```

### 5.11. Gửi bình luận vào Zalo Video (`POST /api/reels/[id]/comment-zalo`)
- Điều hướng tới dòng video trong bảng Zalo Video Creator, mở hộp thoại bình luận và nhập nội dung.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Đã gửi bình luận vào Zalo Video thành công!"
  }
  ```

### 5.12. Cập nhật nội dung & Sửa link Reel thủ công (`PUT /api/reels/[id]`, `PATCH /api/reels/[id]`)
- Cho phép chỉnh sửa caption, chuỗi bình luận, lịch hẹn giờ hoặc bù đắp liên kết video cho cả 4 kênh thủ công.
- **Request Body**:
  ```json
  {
    "caption": "Tiêu đề video mới...",
    "comment_content": "Link 1 | Link 2",
    "scheduled_at": "2026-11-20T10:00:00.000Z",
    "status": "published",
    "fb_post_url": "https://www.facebook.com/reel/123456789",
    "tiktok_post_url": "https://www.tiktok.com/@channel/video/7428123456789",
    "tiktok_status": "published",
    "youtube_post_url": "https://www.youtube.com/shorts/abcd1234xyz",
    "youtube_status": "published",
    "zalo_post_url": "https://video.zalo.me/creator/phan-tich/noi-dung/video-12345.html",
    "zalo_status": "published"
  }
  ```

### 5.13. Xóa một video Reel (`DELETE /api/reels/[id]`)
- Xóa bản ghi video Reel trong database và tự động xóa file video gốc trong `storage/videos/` nếu có.
- **Response (200 OK)**:
  ```json
  {
    "success": true
  }
  ```

### 5.14. Xóa toàn bộ video Reel (`DELETE /api/reels?all=true`)
Xóa hàng loạt toàn bộ danh sách Reel trong database và tự động dọn dẹp các tệp tin video gốc, video debug, ảnh screenshot liên quan.
- **Query Parameters**:
  - `all=true` hoặc `status=all`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "count": 16,
    "message": "Đã xóa toàn bộ 16 video ngắn (Reels) và các file liên quan thành công!"
  }
  ```

---

## 6. Phiên làm việc Mạng Xã Hội (`/api/fb-session`, `/api/tiktok-session`, `/api/youtube-session`, `/api/zalo-session`)

### 6.1. Kiểm tra trạng thái Facebook (`GET /api/fb-session`)
- **Response**:
  ```json
  {
    "isSessionAvailable": true,
    "loggedIn": true,
    "username": "Nguyễn Văn A",
    "targetType": "page",
    "pageName": "Tin Tức Tài Chính 24/7"
  }
  ```

### 6.2. Nhập Session Facebook (`POST /api/fb-session`)
- Mở trình duyệt tương tác đăng nhập Facebook hoặc lưu session vào `storage/fb-session.json`.

### 6.3. Kiểm tra trạng thái TikTok (`GET /api/tiktok-session`)
- **Response**:
  ```json
  {
    "success": true,
    "status": {
      "isSessionAvailable": true,
      "loggedIn": true,
      "username": "@ezerway_finance",
      "avatarUrl": "https://..."
    },
    "isHeadless": false
  }
  ```

### 6.4. Mở trình duyệt đăng nhập TikTok (`POST /api/tiktok-session`)
- Mở Chromium điều hướng tới `https://www.tiktok.com/login` để quét mã QR / đăng nhập. Session được lưu vào `storage/tiktok-session.json`.

### 6.5. Trạng thái & Đăng nhập YouTube Studio (`GET /api/youtube-session`, `POST /api/youtube-session`)
- **GET**: Trả về tình trạng phiên đăng nhập YouTube Studio (`loggedIn: boolean`).
- **POST**: Mở Chromium truy cập `https://studio.youtube.com/` để đăng nhập Google Account lưu phiên vào `browser-profile`.

### 6.6. Trạng thái & Đăng nhập Zalo Video (`GET /api/zalo-session`, `POST /api/zalo-session`)
- **GET**: Kiểm tra phiên đăng nhập Zalo Video Creator (`loggedIn: boolean`, `message: string`).
- **POST**: Khởi chạy trình duyệt mở `https://video.zalo.me/creator/video` để quét QR hoặc đăng nhập số điện thoại, tự động lưu session vào `storage/zalo_sessions`.

---

## 7. Cấu hình & Nhật ký (`/api/settings`, `/api/logs`)

### 7.1. Lấy toàn bộ cấu hình (`GET /api/settings`)
- Trả về danh sách key-value (Gemini API key, target_geo, interval, notification settings...).

### 7.2. Cập nhật cấu hình (`POST /api/settings`)
- **Request Body**:
  ```json
  {
    "gemini_api_key": "AIzaSy...",
    "telegram_notify_enabled": "true",
    "telegram_bot_token": "123456:ABC...",
    "telegram_chat_id": "-100123456789",
    "posts_per_cycle": "2",
    "redirect_proxy_enabled": "true",
    "auto_video_publish_after_post": "true",
    "video_default_template": "random"
  }
  ```

### 7.3. Thử nghiệm thông báo (`POST /api/notifications/test`)
- **Request Body**:
  ```json
  {
    "channel": "telegram", // "telegram" | "slack"
    "botToken": "...",
    "chatId": "...",
    "webhookUrl": "https://hooks.slack.com/..."
  }
  ```

### 7.4. Kiểm tra kết nối Ollama cục bộ VPS (`POST /api/settings/ollama-test`)
- Kiểm tra trạng thái máy chủ Ollama trên VPS và xác minh model đã sẵn sàng hoạt động (mặc định: `qwen2.5:3b`).
- **Request Body** (tùy chọn):
  ```json
  {
    "endpoint": "http://127.0.0.1:11434",
    "model": "qwen2.5:3b"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "ok": true,
    "hasRequestedModel": true,
    "models": ["qwen2.5:3b:latest"],
    "message": "Kết nối thành công! Model \"qwen2.5:3b\" đã sẵn sàng hoạt động trên VPS."
  }
  ```

### 7.5. Lấy nhật ký hoạt động (`GET /api/logs`)
- **Query Parameters**: `level`, `action`, `limit`, `page`.

---

## 8. Sao lưu & Bảo trì Bộ nhớ (`/api/backup`, `/api/storage`)

### 8.1. Thống kê dung lượng (`GET /api/backup/stats`)
- Trả về dung lượng file SQLite (`app.db`), số lượng ảnh screenshot, video recording và kích thước thư mục profile.

### 8.2. Tải bản sao lưu (`GET /api/backup/db`, `GET /api/backup/full`)
- Tải về trực tiếp file `app.db` hoặc file `.zip` chứa toàn bộ session và database.

### 8.3. Thống kê & Dọn dẹp bộ nhớ Storage (`GET /api/storage/clean`, `POST /api/storage/clean`)
- **Lấy thống kê tệp tin & dữ liệu (GET)**:
  Trả về số lượng và dung lượng chi tiết của ảnh chụp màn hình, video Playwright, kèm số lượng thực tế của các bản ghi database (Bài viết, Reels, Xu hướng).
  - **Response (200 OK)**:
    ```json
    {
      "success": true,
      "screenshots": { "count": 0, "sizeBytes": 0, "sizeFormatted": "0 B" },
      "videos": { "count": 20, "sizeBytes": 65849344, "sizeFormatted": "62.8 MB" },
      "totalCount": 20,
      "totalSizeBytes": 65849344,
      "totalFormatted": "62.8 MB",
      "postsCount": 4,
      "reelsCount": 16,
      "trendsCount": 5
    }
    ```

- **Thực hiện dọn dẹp bộ nhớ (POST)**:
  - **Dọn dẹp video & screenshot cũ (> X ngày)**:
    ```json
    {
      "type": "old_reels",
      "days": 2
    }
    ```
    *Tự động quét toàn bộ file video render (`trend_*.mp4`, `reel_*.mp4`) và screenshots cũ hơn 2 ngày, xóa file đĩa cứng và reset cờ `video_generated = 0` trong bảng `trends`.*
  - **Xóa toàn bộ screenshot & video tạm**:
    ```json
    {
      "type": "all"
    }
    ```

### 8.4. Xuất / Nhập Profile Session trình duyệt (`GET /api/backup/profile`, `POST /api/backup/profile`)
- **Xuất (GET)**:
  - `GET /api/backup/profile`: Tải về file `fb-session.json`.
  - `GET /api/backup/profile?type=zip`: Tải về gói `.zip` chứa toàn bộ thư mục `browser-profile`.
- **Nhập (POST)**:
  - `multipart/form-data` với trường `file`: Cho phép tải lên file JSON session hoặc file ZIP để khôi phục nhanh trên môi trường VPS mới.

---

## 9. Tài nguyên Đa phương tiện (`/api/screenshots`, `/api/videos`)

### 9.1. Lấy ảnh chụp màn hình đối soát (`GET /api/screenshots/[filename]`)
- Trả về hình ảnh bằng chứng (image/png) chụp màn hình sau mỗi phiên đăng bài Facebook, đăng Reel hoặc đăng TikTok.
- Hỗ trợ cache `public, max-age=3600` và kiểm tra chống Directory Traversal.

### 9.2. Xem hoặc tải video kiểm soát (`GET /api/videos/[filename]`)
- Phát trực tiếp video ghi hình quá trình Playwright tương tác (video/mp4) phục vụ kiểm tra và rà soát lỗi giao diện hoặc captcha.

---

## 10. Điều hướng Liên kết Trung gian (`/go`)

### 10.1. Proxy chuyển hướng bài báo nguồn (`GET /go/?to=[target_url]`)
- Tiếp nhận tham số `to` chứa link bài báo gốc và chuyển hướng 302 an toàn.
- Dùng cho toàn bộ liên kết nguồn trong bình luận tự động của Facebook Post, Facebook Reels, TikTok, YouTube Shorts, và Zalo Video.
- Tôn trọng cấu hình `redirect_proxy_enabled`: nếu tắt trong Cài đặt, link gốc sẽ được giữ nguyên không chuyển đổi.
- Nếu tham số `to` không hợp lệ hoặc thiếu giao thức `http/https`, tự động chuyển hướng về trang chủ `/`.

---

## 11. Mẫu Video HyperFrames 9:16 (`/api/video-templates`, `/api/trends/[id]/generate-video`)

### 11.1. Lấy danh sách Mẫu Video (`GET /api/video-templates`)
- Trả về danh sách metadata của tất cả mẫu giao diện và mẫu đang được đặt làm mặc định trong hệ thống.
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "templates": [
      {
        "id": "modern_dark",
        "name": "Hiện đại & Tối giản",
        "nameEn": "Modern Dark",
        "badge": "Phổ biến",
        "category": "Tin tức tổng hợp",
        "previewColor": "radial-gradient(...)",
        "accentColor": "#38BDF8",
        "features": ["..."]
      },
      { "id": "bloomberg_terminal", "name": "Wall Street Terminal" },
      { "id": "editorial_magazine", "name": "Tạp chí Sang trọng" },
      { "id": "neon_cyber", "name": "Cyberpunk Neon" }
    ],
    "defaultTemplate": "random"
  }
  ```

### 11.2. Tạo bản xem trước HTML thời gian thực (`POST /api/video-templates`)
- Trả về mã nguồn HTML5 độc lập, thời lượng video tính toán (`duration`) và thanh trượt thời gian `window.seekTo(t)` để nhúng vào iframe xem trước.
- **Request Body**:
  ```json
  {
    "templateId": "neon_cyber"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "templateId": "neon_cyber",
    "html": "<!DOCTYPE html>...",
    "duration": 29
  }
  ```

### 11.3. Tạo Video với lựa chọn Mẫu (`POST /api/trends/[id]/generate-video`)
- **Request Body**:
  ```json
  {
    "force": true,
    "templateId": "bloomberg_terminal"
  }
  ```
  *(Nếu `templateId` bỏ trống hoặc là `"random"`, hệ thống tự động hoán đổi luân phiên các mẫu)*.

### 11.4. Tạo Video Hàng Loạt với cấu hình (`POST /api/trends/generate-videos`)
- **Request Body**:
  ```json
  {
    "limit": 5,
    "templateId": "random"
  }
  ```

### 11.5. Thuật toán Tóm tắt 3-7 Ý chính & Tính Thời lượng Tự động (20s - 60s)
- **Tóm tắt bài báo (Extractive & Generative AI)**:
  - Gemini AI hoặc Smart Fallback Extractor đọc toàn văn bài báo và cô đọng thành **3 đến 7 ý chính (fragments)** cốt lõi có số liệu thực tế.
  - Mỗi ý là câu văn hoàn chỉnh, kết thúc bằng dấu chấm, không dùng ba chấm (`...`).
- **Phân trang thông minh (`paginateContentFragments`)**:
  - Tối đa 1-2 ý trên mỗi slide để chữ luôn to rõ (font 40px+), tự động tạo thêm slide khi cần.
- **Công thức thời lượng chuẩn Reels/TikTok/Shorts**:
  $$\text{Duration} = \max\Big(20, \min\Big(60, \text{round}(12 + \text{numPages} \times 5.5)\Big)\Big)$$
  - 12s cố định (Intro + Headline + Outro) + 5.5s cho mỗi slide nội dung.
  - Video dao động từ **20s đến 60s**, đồng bộ timeline trong cả 4 templates (`outroStartTime = DURATION - 4.5s`).



