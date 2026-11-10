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
    "comment_content": "Nội dung bình luận nguồn...",
    "record_video": true,
    "scheduled_at": "2026-11-15T09:00:00" // Tùy chọn
  }
  ```

### 4.3. Xuất bản bài viết lên Facebook (`POST /api/publish`)
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

### 4.4. Kích hoạt toàn bộ chu kỳ tự động (`POST /api/run-cycle`)
- **Request Body**:
  ```json
  {
    "forcePublish": true,
    "limit": 2
  }
  ```

---

## 5. Facebook Reels & TikTok Video (`/api/reels`)

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
- **Response**: Danh sách các Reels kèm trạng thái xuất bản trên Facebook và TikTok.

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

### 5.5. Quét video hẹn giờ (`POST /api/reels/check-scheduled`)
- Kích hoạt kiểm tra và đăng tất cả các Reel đã đến giờ hẹn.

---

## 6. Phiên làm việc Mạng Xã Hội (`/api/fb-session`, `/api/tiktok-session`)

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
- Hỗ trợ lưu qua cookies dạng JSON hoặc nhập chuỗi `c_user` và `xs`.

### 6.3. Kiểm tra trạng thái TikTok (`GET /api/tiktok-session`)
- **Response**:
  ```json
  {
    "isSessionAvailable": true,
    "loggedIn": true,
    "username": "@ezerway_finance"
  }
  ```

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
    "posts_per_cycle": "2"
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

### 7.4. Lấy nhật ký hoạt động (`GET /api/logs`)
- **Query Parameters**: `level`, `action`, `limit`, `page`.

---

## 8. Sao lưu & Bảo trì Bộ nhớ (`/api/backup`, `/api/storage`)

### 8.1. Thống kê dung lượng (`GET /api/backup/stats`)
- Trả về dung lượng file SQLite (`app.db`), số lượng ảnh screenshot, video recording và kích thước thư mục profile.

### 8.2. Tải bản sao lưu (`GET /api/backup/db`, `GET /api/backup/full`)
- Tải về trực tiếp file `app.db` hoặc file `.zip` chứa toàn bộ session và database.

### 8.3. Dọn dẹp bộ nhớ tạm (`POST /api/storage/clean`)
- **Request Body**:
  ```json
  {
    "cleanScreenshots": true,
    "cleanVideos": true,
    "olderThanDays": 7
  }
  ```
