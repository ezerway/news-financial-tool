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
0 */2 * * * cd /home/ezerway-financial-news/news-financial-tool && pnpm auto-cycle --publish >> /home/ezerway-financial-news/logs/cron_debug.log 2>&1
```

---

---

## 🌐 Hướng dẫn Triển khai VPS (Production Deployment)

### 1. Chuẩn bị môi trường VPS (Ubuntu / Debian)

Cài đặt Node.js 20+, pnpm và các thư viện cần thiết cho Chromium Playwright:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Cài đặt pnpm và PM2 toàn cục
sudo npm install -g pnpm pm2
```

### 2. Kéo mã nguồn & Cài đặt dependencies

```bash
# Clone repository
git clone https://github.com/ezerway/news-financial-tool.git /home/ezerway-financial-news/news-financial-tool
cd /home/ezerway-financial-news/news-financial-tool

# Cài đặt gói thư viện dự án
pnpm install

# Cài đặt Chromium cùng các thư viện hệ thống cho Playwright trên Linux VPS
npx playwright install --with-deps chromium
```

### 3. Cấu hình biến môi trường (`.env`)

Sao chép và thiết lập file `.env`:
```bash
cp .env.example .env 2>/dev/null || touch .env
nano .env
```

Nội dung gợi ý trong file `.env`:
```env
PORT=3000
NODE_ENV=production

# Tài khoản đăng nhập Dashboard quản trị VPS
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
AUTH_SECRET=your_random_secret_key_32_characters_here

# Cấu hình AI
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Build ứng dụng

```bash
pnpm build
```

### 5. Khởi chạy bằng PM2 (`ecosystem.config.js`)

Dự án đã tích hợp sẵn file `ecosystem.config.js` quản lý cả **Web Dashboard** và **Cron Job tự động chạy mỗi 1 tiếng**:

```bash
# Khởi động cả Web và Cron tự động
pm2 start ecosystem.config.js

# Lưu trạng thái để tự khởi động lại khi VPS reboot
pm2 save
pm2 startup
```

**Các lệnh PM2 thông dụng:**
```bash
# Xem trạng thái các dịch vụ đang chạy
pm2 status

# Xem log thời gian thực (đặc biệt khi bot chạy chu kỳ)
pm2 logs
pm2 logs trendpulse-cron    # Chỉ xem log của cron
pm2 logs trendpulse-web     # Chỉ xem log của web

# Khởi động lại
pm2 restart ecosystem.config.js

# Dừng hệ thống
pm2 stop all
```

---

### 6. Quy trình Cập nhật Code mới (Redeploy / Update)

Khi có bản cập nhật hoặc sửa lỗi mới từ GitHub, chạy các lệnh sau trên VPS:

```bash
cd /home/ezerway-financial-news/news-financial-tool

# 1. Kéo code mới nhất về
git pull

# 2. Xóa cache browser profile cũ bị hỏng do các lần crash trước (nếu có)
rm -rf storage/browser-profile

# 3. Cài lại thư viện (nếu có thay đổi package.json) và build lại
pnpm install
pnpm build

# 4. Khởi động lại tiến trình PM2
pm2 restart ecosystem.config.js
```

---

### 7. Cấu hình Nginx & HTTPS để hỗ trợ PWA (Cài đặt trên Mobile)

> **Lưu ý quan trọng về PWA**: Trình duyệt di động (Chrome, Edge) chỉ hiển thị nút **"Cài đặt Ứng dụng" (Add to Home Screen)** khi trang web chạy qua giao thức **HTTPS (SSL)**.

Cấu hình mẫu Nginx Reverse Proxy (`/etc/nginx/sites-available/trendpulse`):

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

Kích hoạt và cấp chứng chỉ SSL miễn phí với Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/trendpulse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Cách cài đặt PWA trên điện thoại:**
- **Android / Chrome / Edge**: Truy cập `https://yourdomain.com`, bấm banner nổi **"Cài đặt TrendPulse"** hoặc bấm menu 3 chấm (⋮) chọn **"Cài đặt ứng dụng"**.
- **iPhone / iPad (Safari)**: Mở Safari truy cập web -> Bấm nút **Chia sẻ (Share icon 📤)** ở thanh dưới -> Chọn **"Thêm vào MH chính" (Add to Home Screen)**.

---

## 📂 Cấu trúc thư mục

```text
news-financial-tool/
├── src/
│   ├── app/                     # Next.js App Router (Dashboard, Login, API endpoints)
│   │   ├── api/                 # REST APIs: trends, generate, publish, logs, settings, backup, auth
│   │   ├── login/               # Trang xác thực quản trị viên
│   │   ├── page.tsx             # Trang Dashboard chính (Overview, Trends, Posts, Logs, Settings)
│   │   └── layout.tsx           # Layout, PWA Manifest, SEO & Fonts
│   ├── components/              # Các thành phần UI (Header, Stats, Trends, Posts Studio, PWA Manager...)
│   ├── lib/                     # SQLite database & Authentication (db.ts, auth-server.ts, auth-token.ts)
│   ├── services/
│   │   ├── crawler.ts           # Cào Google Trends Category 3 (Kinh tế & Tài chính) kèm link báo gốc
│   │   ├── ai-generator.ts      # Tạo bài đăng & comment nguồn tin bằng Gemini
│   │   ├── auto-runner.ts       # Điều phối chu kỳ tự động (Cào -> Viết -> Đăng)
│   │   └── playwright/          # Tự động hóa Facebook (Persistent Context, Chống crash VPS, Auto-comment)
│   └── types/                   # Định nghĩa TypeScript
├── public/                      # Static assets, PWA icons, manifest.json, sw.js
├── scripts/                     # Các CLI scripts (fb-login, auto-cycle, generate-icons)
├── storage/                     # Thư mục lưu DB (app.db), session Facebook, ảnh chụp màn hình
├── ecosystem.config.js          # Cấu hình PM2 chạy Web & Cron tự động trên VPS
├── package.json
└── README.md
```

