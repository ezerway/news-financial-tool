# Hướng dẫn Vận hành & Triển khai VPS (Production Deployment Guide)

Tài liệu này cung cấp quy trình từng bước thiết lập, vận hành, bảo mật và khắc phục sự cố khi triển khai hệ thống **TrendPulse** trên môi trường máy chủ Linux VPS (Ubuntu / Debian).

---

## 1. Yêu cầu Hệ thống Tối thiểu (System Requirements)

- **Hệ điều hành**: Ubuntu 22.04 LTS hoặc Ubuntu 24.04 LTS (Khuyên dùng 64-bit)
- **CPU**: Tối thiểu 1 vCPU (Khuyên dùng 2 vCPU trở lên)
- **RAM**: Tối thiểu 1.5 GB RAM (Khuyên dùng 2 GB RAM + 2 GB Swap để Chromium chạy ổn định)
- **Ổ cứng**: Tối thiểu 15 GB SSD (dành cho Chromium, SQLite và video ghi hình)
- **Môi trường**: Node.js v20.x trở lên, pnpm v9+, PM2

---

## 2. Chuẩn bị VPS & Cài đặt Môi trường

### Bước 1: Cập nhật hệ thống & Tạo Swap RAM (Nếu VPS có 1GB - 2GB RAM)
```bash
sudo apt update && sudo apt upgrade -y

# Kiểm tra và tạo 2GB Swap nếu chưa có
if [ $(swapon --show | wc -l) -le 1 ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
```

### Bước 2: Cài đặt Node.js 20, pnpm và PM2
```bash
# Cài đặt Node.js 20.x từ NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Cài đặt pnpm và PM2 toàn cục
sudo npm install -g pnpm pm2
```

### Bước 3: Cài đặt thư viện hệ thống cho Playwright Chromium
```bash
sudo apt install -y \
  libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libasound2t64 || sudo apt install -y libasound2
```

---

## 3. Cài đặt Mã nguồn & Cấu hình Biến Môi trường

```bash
# 1. Kéo repository về thư mục ứng dụng
cd /home
sudo git clone https://github.com/ezerway/news-financial-tool.git trendpulse
sudo chown -R $USER:$USER /home/trendpulse
cd /home/trendpulse

# 2. Cài đặt dependencies
pnpm install

# 3. Cài đặt Chromium của Playwright kèm các dependency còn thiếu
npx playwright install --with-deps chromium

# 4. Thiết lập file .env
cp .env.example .env
nano .env
```

**Mẫu cấu hình `.env` cho Production:**
```env
PORT=3000
NODE_ENV=production

# Mật khẩu quản trị Dashboard
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mat_khau_bao_mat_cua_ban_123
AUTH_SECRET=chuoi_khoa_bi_mat_32_ky_tu_ngau_nhien_tai_day

# Google Gemini API Key
GEMINI_API_KEY=AIzaSy...

# Cấu hình thông báo (Tùy chọn)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=-100123456789
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## 4. Thiết lập Phiên Đăng nhập Facebook & TikTok trên VPS

Vì VPS không có màn hình (headless), bạn có 2 cách thiết lập phiên làm việc:

### Cách 1: Sử dụng CLI Đăng nhập Cookie (Khuyên dùng)
```bash
pnpm fb:login
```
- Khi chạy trên VPS, script sẽ nhận diện môi trường không có GUI và hiển thị yêu cầu:
  - Dán cookie `c_user`
  - Dán cookie `xs`
*(Hai cookie này lấy dễ dàng bằng cách mở Facebook trên máy cá nhân $\to$ F12 $\to$ tab Application $\to$ Cookies).*
- Script sẽ tự động tạo file `storage/fb-session.json`.

### Cách 2: Tải file `fb-session.json` qua Web Dashboard
1. Khởi chạy Dashboard.
2. Đăng nhập vào trang quản trị.
3. Vào tab **Cài đặt** $\to$ mục **Sao lưu & Khôi phục** $\to$ Tải file `fb-session.json` tạo từ máy cá nhân lên.

---

## 5. Build Ứng dụng & Quản lý bằng PM2

```bash
# 1. Build ứng dụng Next.js
pnpm build

# 2. Khởi chạy bằng file cấu hình ecosystem có sẵn
pm2 start ecosystem.config.js

# 3. Cấu hình tự khởi động cùng hệ thống khi VPS reboot
pm2 save
pm2 startup
```

### Các lệnh vận hành PM2 hàng ngày:
```bash
# Kiểm tra tình trạng hoạt động
pm2 status

# Theo dõi nhật ký thời gian thực
pm2 logs

# Chỉ xem log của daemon tự động cào và đăng bài
pm2 logs trendpulse-cron

# Khởi động lại hệ thống
pm2 restart ecosystem.config.js

# Dừng toàn bộ hệ thống
pm2 stop all
```

---

## 6. Cấu hình Nginx Reverse Proxy & HTTPS (Chứng chỉ SSL)

Trình duyệt di động (Chrome, Safari) bắt buộc phải có kết nối **HTTPS** an toàn để kích hoạt tính năng **Cài đặt Ứng dụng PWA (Add to Home Screen)**.

### Bước 1: Tạo file cấu hình Nginx
```bash
sudo nano /etc/nginx/sites-available/trendpulse
```

Dán nội dung sau (thay `yourdomain.com` bằng tên miền của bạn):
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    client_max_body_size 100M; # Cho phép upload video Reels dung lượng lớn

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

### Bước 2: Kích hoạt site & Cấp chứng chỉ SSL miễn phí
```bash
sudo ln -s /etc/nginx/sites-available/trendpulse /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Cài đặt Certbot và cấp SSL tự động
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 7. Quy trình Cập nhật Code mới (CI/CD / Redeploy)

Khi có bản cập nhật hoặc sửa lỗi mới từ Git:

```bash
cd /home/trendpulse

# 1. Kéo mã nguồn mới nhất
git pull

# 2. Cài đặt các gói thư viện mới (nếu có)
pnpm install

# 3. Build lại ứng dụng Next.js
pnpm build

# 4. Khởi động lại PM2 mà không mất dữ liệu
pm2 reload ecosystem.config.js
```

---

## 8. Khắc phục Sự cố Thường gặp (Troubleshooting)

### 1. Lỗi `RESULT_CODE_KILLED_BAD_MESSAGE` hoặc Chromium bị Crash
- **Nguyên nhân**: Chromium sử dụng phân vùng bộ nhớ chia sẻ `/dev/shm` mặc định của Linux (thường chỉ 64MB).
- **Khắc phục**: Hệ thống TrendPulse đã tích hợp sẵn cờ `--disable-dev-shm-usage` và `--disable-gpu` trong `session.ts`. Đảm bảo VPS có tối thiểu 2GB Swap RAM.

### 2. Phiên Facebook hết hạn (`Session Expired` / `Chưa đăng nhập`)
- **Triệu chứng**: Bot báo lỗi "Không thể điều hướng hoặc chưa đăng nhập Facebook".
- **Khắc phục**:
  1. Chạy lại `pnpm fb:login` để cập nhật lại 2 cookie `c_user` và `xs`.
  2. Xóa cache profile cũ nếu bị lỗi: `rm -rf storage/browser-profile`.

### 3. Tràn dung lượng ổ đĩa do Video & Screenshot
- **Khắc phục**:
  - Truy cập Web Dashboard $\to$ tab **Cài đặt** $\to$ bấm **"Dọn dẹp ảnh & video cũ hơn 7 ngày"**.
  - Hoặc thêm cronjob tự động dọn dẹp hàng tuần:
    ```bash
    find /home/trendpulse/storage/videos -type f -mtime +14 -delete
    find /home/trendpulse/storage/screenshots -type f -mtime +14 -delete
    ```

### 4. Không thấy nút Cài đặt PWA trên điện thoại
- Đảm bảo trang web được truy cập qua giao thức **`https://`** với chứng chỉ SSL hợp lệ (không có cảnh báo bảo mật trình duyệt).
