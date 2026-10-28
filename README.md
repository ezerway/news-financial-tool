# 🚀 TrendPulse - Google Trends & Facebook Automation Tool

Một công cụ tự động hóa toàn diện giúp bạn:
1. **Cào các chủ đề thịnh hành (Google Trends)**: Tự động trích xuất các xu hướng nóng từ Google Trends (Việt Nam, US, SG...), phân loại các tin tức Tài chính / Kinh tế / Xã hội và lấy liên kết bài báo gốc.
2. **Sáng tạo nội dung với AI (Gemini)**: Viết bài đăng Facebook thu hút người xem (Hook, gạch đầu dòng điểm tin, kêu gọi hành động CTA, hashtag). **Tuyệt đối không chèn link vào bài đăng** để thuật toán Facebook không bóp tương tác (Reach).
3. **Tự động đăng bài lên Facebook (Playwright)**: Sử dụng Playwright với Persistent Session để tự động đăng lên Facebook cá nhân hoặc Fanpage.
4. **Tự động bình luận nguồn tin (Auto-Comment Source Links)**: Ngay sau khi bài viết được đăng, bot tự động vào ô bình luận của bài viết đó để comment đầy đủ các link nguồn gốc.
5. **Dashboard quản lý trực quan (Tailwind CSS)**: Quản lý xu hướng, studio duyệt bài, xem ảnh chụp màn hình đối soát (Audit Screenshots), theo dõi nhật ký hoạt động thời gian thực và cấu hình tài khoản.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

- **Ngôn ngữ & Runtime**: Node.js v20+ / TypeScript
- **Web Framework & UI**: Next.js 16 (App Router) + Tailwind CSS v4 + **daisyUI 5** + Lucide Icons
- **Tự động hóa trình duyệt**: Playwright (Persistent Context & Anti-detection)
- **Cơ sở dữ liệu**: SQLite (Better-SQLite3) chế độ WAL (Zero-config, chạy cục bộ siêu nhanh)
- **AI Content Generator**: Google Gemini API (`@google/genai`) kèm bộ template thông minh dự phòng

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Khởi chạy Dashboard trực quan
Chạy lệnh sau trong thư mục dự án:
```bash
pnpm dev
```
Sau đó mở trình duyệt tại: **`http://localhost:3000`**

### 2. Kết nối tài khoản Facebook (Chỉ cần 1 lần duy nhất)
Facebook có cơ chế bảo mật cao (2FA, Captcha, Checkpoint). Công cụ hỗ trợ 3 cách kết nối linh hoạt:

**Cách 1 (Trên máy cá nhân có màn hình - Mac/Windows):**
- Chạy `pnpm fb:login` trong terminal, hoặc bấm **"Mở trình duyệt quản lý phiên Facebook"** tại tab **Cài đặt**.
- Cửa sổ Chromium sẽ mở ra. Bạn chỉ cần đăng nhập tài khoản Facebook và xác thực 2FA.
- Sau khi xong, hệ thống tự động lưu file `storage/fb-session.json`.

**Cách 2 (Trên Linux VPS / Server không có giao diện GUI):**
- **Phương án A (Nhập Cookie qua CLI - Nhanh nhất)**: Chạy `pnpm fb:login`. Script sẽ tự động nhận diện VPS và yêu cầu bạn dán 2 cookie `c_user` và `xs` (lấy từ DevTools F12 hoặc extension Cookie-Editor trên trình duyệt cá nhân).
- **Phương án B (Tải file session lên Dashboard)**: Đăng nhập trên máy tính cá nhân bằng Cách 1 -> Mở Dashboard VPS -> vào tab **Cài đặt** -> phần **Sao lưu & Khôi phục** -> Tải file `fb-session.json` lên.
- **Phương án C (Dùng xvfb nếu có)**: `xvfb-run -a pnpm fb:login`

### 3. Cấu hình Gemini API Key
Bạn có thể cấu hình API key bằng 2 cách:
- **Cách 1**: Vào tab **"Cài đặt & Tài khoản FB"** trên Dashboard, nhập API key và bấm **"Lưu tất cả cấu hình"**.
- **Cách 2**: Tạo file `.env.local` ở thư mục gốc:
  ```env
  GEMINI_API_KEY=your_gemini_api_key_here
  ```
*(Lưu ý: Nếu chưa nhập API Key, công cụ vẫn hoạt động bình thường với bộ sinh nội dung thông minh tích hợp sẵn).*

---

## 💻 Các lệnh dòng lệnh (CLI Commands)

| Lệnh | Ý nghĩa |
|---|---|
| `pnpm dev` | Khởi động máy chủ Next.js và Dashboard quản trị |
| `pnpm fb:login` | Mở trình duyệt để đăng nhập tài khoản Facebook và lưu session |
| `pnpm auto-cycle` | Chạy 1 chu kỳ hoàn chỉnh: Cào Google Trends -> Viết bài -> Đưa vào hàng đợi |
| `pnpm auto-cycle --dry-run` | Chạy thử mô phỏng toàn bộ chu kỳ mà không đăng thật lên Facebook |
| `pnpm auto-cycle --publish` | Tự động cào, viết bài và xuất bản thật ngay lập tức lên Facebook |

---

## ⏰ Cài đặt chạy định kỳ tự động (Cron Job)

Nếu bạn muốn công cụ tự động cào và đăng bài mỗi 2 tiếng:
Mở crontab:
```bash
crontab -e
```
Thêm dòng sau:
```cron
0 */2 * * * cd /Volumes/KINGSTON/Code/news-financial-tool && pnpm auto-cycle --publish >> /Volumes/KINGSTON/Code/news-financial-tool/storage/cron.log 2>&1
```

---

## 📂 Cấu trúc thư mục

```text
news-financial-tool/
├── src/
│   ├── app/                     # Next.js App Router (Dashboard & API endpoints)
│   │   ├── api/                 # REST APIs: trends, generate, publish, logs, settings
│   │   ├── page.tsx             # Trang Dashboard chính
│   │   └── layout.tsx           # Layout & Theme
│   ├── components/              # Các thành phần UI (Header, Stats, Trends, Posts Studio...)
│   ├── lib/                     # SQLite database & Logging helper (db.ts)
│   ├── services/
│   │   ├── crawler.ts           # Cào Google Trends Category 3 (Business & Finance) & lấy link nguồn In the news
│   │   ├── ai-generator.ts      # Tạo bài đăng & comment nguồn tin bằng Gemini
│   │   ├── auto-runner.ts       # Điều phối chu kỳ tự động
│   │   └── playwright/          # Tự động hóa Facebook & chụp ảnh đối soát
│   └── types/                   # Định nghĩa TypeScript
├── scripts/                     # Các CLI scripts (fb-login, auto-cycle)
├── storage/                     # Thư mục lưu DB (app.db), session Facebook, ảnh chụp màn hình
├── package.json
└── README.md
```
