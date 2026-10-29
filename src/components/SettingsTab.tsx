'use client';

import React, { useState } from 'react';
import { Save, Key, Check, Sparkles, Sliders, ShieldCheck, Megaphone, User, ExternalLink, Globe, Smartphone, Download } from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import BackupRestoreSection from './BackupRestoreSection';
import AdminSecuritySection from './AdminSecuritySection';

interface SettingsTabProps {
  settings: Record<string, string>;
  fbStatus: {
    loggedIn: boolean;
    username?: string;
    message: string;
    targetType?: string;
    pageUrl?: string;
    pageName?: string;
  };
  onSaveSettings: (newSettings: Record<string, string>) => Promise<void>;
  onConnectFb: (url?: string) => void;
  onRefreshData?: () => Promise<void>;
}

export default function SettingsTab({
  settings,
  fbStatus,
  onSaveSettings,
  onConnectFb,
  onRefreshData,
}: SettingsTabProps) {
  const [form, setForm] = useState<Record<string, string>>({
    gemini_api_key: settings.gemini_api_key || '',
    fb_target_type: settings.fb_target_type || 'page',
    fb_page_url: settings.fb_page_url || (settings.fb_target_url && !settings.fb_target_url.endsWith('facebook.com/') ? settings.fb_target_url : ''),
    fb_page_name: settings.fb_page_name || '',
    fb_target_url: settings.fb_target_url || 'https://www.facebook.com/',
    target_geo: settings.target_geo || 'VN',
    post_tone: settings.post_tone || 'finance_news',
    auto_mode: settings.auto_mode || 'false',
    filter_keywords:
      settings.filter_keywords ||
      'tài chính, chứng khoán, ngân hàng, bất động sản, kinh tế, crypto, usd, vàng, lạm phát',
    crawler_interval_minutes: settings.crawler_interval_minutes || '60',
    posts_per_cycle: settings.posts_per_cycle || '1',
  });

  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSaveSettings(form);
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target Destination: Fanpage vs Personal Profile */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
              <Megaphone className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Chế độ xuất bản: Đăng lên Fanpage hoặc Trang cá nhân</h3>
              <p className="text-xs text-slate-400 font-medium">Lựa chọn tư cách đăng bài Facebook và cấu hình Fanpage nhận bài tự động.</p>
            </div>
          </div>

          <span className="self-start sm:self-auto px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0 whitespace-nowrap">
            {form.fb_target_type === 'page' ? '📢 Đang chọn Fanpage' : '👤 Đang chọn Trang cá nhân'}
          </span>
        </div>

        {/* Target Type Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setForm({ ...form, fb_target_type: 'page' })}
            className={`p-4 rounded-2xl border text-left transition-all relative ${
              form.fb_target_type === 'page'
                ? 'bg-blue-950/40 border-blue-500/60 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <Megaphone className="w-4 h-4 text-blue-400" /> Đăng lên Fanpage (Facebook Page)
              </span>
              {form.fb_target_type === 'page' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tự động đăng bài và bình luận link nguồn dưới tư cách Trang / Fanpage bạn làm quản trị viên. Tối ưu thương hiệu &amp; bảo vệ tài khoản cá nhân.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setForm({ ...form, fb_target_type: 'profile' })}
            className={`p-4 rounded-2xl border text-left transition-all relative ${
              form.fb_target_type === 'profile'
                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                <User className="w-4 h-4 text-indigo-400" /> Đăng lên Trang cá nhân (Timeline)
              </span>
              {form.fb_target_type === 'profile' && (
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>
              )}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Đăng trực tiếp lên bảng tin cá nhân của tài khoản Facebook đã đăng nhập.
            </p>
          </button>
        </div>

        {/* Fanpage Details Config */}
        {form.fb_target_type === 'page' && (
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-4 animate-in fade-in duration-200">
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5 flex items-center justify-between">
                <span>Đường dẫn Fanpage (Facebook Page URL) *</span>
                <span className="text-[11px] text-blue-400 font-normal">Bắt buộc khi đăng lên Fanpage</span>
              </label>
              <input
                type="text"
                value={form.fb_page_url}
                onChange={(e) => setForm({ ...form, fb_page_url: e.target.value })}
                placeholder="https://www.facebook.com/ten-fanpage-cua-ban hoặc https://www.facebook.com/profile.php?id=..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                💡 <strong>Cách lấy link:</strong> Mở Facebook trên trình duyệt, vào Fanpage của bạn và sao chép đường link trên thanh địa chỉ dán vào đây (Ví dụ: <code className="text-blue-300">https://www.facebook.com/tintuctaichinh247</code>).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1.5">
                Tên Fanpage (Gợi nhớ để hiển thị)
              </label>
              <input
                type="text"
                value={form.fb_page_name}
                onChange={(e) => setForm({ ...form, fb_page_name: e.target.value })}
                placeholder="Ví dụ: Tin Tức Tài Chính 247, Điểm Tin Thị Trường..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onConnectFb(form.fb_page_url || undefined)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition active:scale-95"
              >
                <FacebookIcon className="w-4 h-4" />
                <span>Mở Fanpage trên trình duyệt để kiểm tra &amp; chuyển quyền</span>
              </button>
              <span className="text-[11px] text-slate-400">
                (Trình duyệt sẽ mở đến đúng trang Fanpage để bạn bấm &quot;Chuyển ngay&quot; sang tư cách Page nếu cần)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Facebook Session Management Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl">
        <div className="flex items-center justify-between pb-5 border-b border-slate-800/80 mb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/15 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
              <FacebookIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Quản lý phiên đăng nhập Facebook</h3>
              <p className="text-xs text-slate-400 font-medium">Playwright sử dụng Persistent Session để tự động đăng bài &amp; comment an toàn.</p>
            </div>
          </div>

          <div
            className={`px-3.5 py-1 rounded-full text-xs font-bold border shrink-0 whitespace-nowrap ${
              fbStatus.loggedIn
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {fbStatus.loggedIn ? '● Đang hoạt động' : '○ Chưa kết nối'}
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Trạng thái hiện tại: <span className="font-mono text-white font-semibold">{fbStatus.message}</span>
          </p>

          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300 leading-relaxed shadow-inner">
            💡 <strong>Hướng dẫn đăng nhập:</strong> Bấm nút bên dưới để mở cửa sổ trình duyệt Chromium. Hãy đăng nhập tài khoản Facebook có quyền quản trị Fanpage của bạn. Cửa sổ sẽ giữ mở để bạn chuyển đổi hoặc kiểm tra Fanpage, và hệ thống sẽ tự động lưu phiên làm việc để chạy nền vĩnh viễn khi bạn đóng cửa sổ.
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onConnectFb(form.fb_target_type === 'page' && form.fb_page_url ? form.fb_page_url : undefined)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <FacebookIcon className="w-4 h-4" />
              <span>Mở trình duyệt quản lý phiên Facebook &amp; Page</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI & Automation Configurations */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl space-y-5">
        <div className="flex items-center gap-3.5 pb-5 border-b border-slate-800/80">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">Cấu hình Gemini AI &amp; Tự động hóa</h3>
            <p className="text-xs text-slate-400 font-medium">Thiết lập API key và phong cách viết bài đăng cho bot.</p>
          </div>
        </div>

        {/* Gemini API Key */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Google Gemini API Key
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.gemini_api_key}
              onChange={(e) => setForm({ ...form, gemini_api_key: e.target.value })}
              placeholder="Nhập GEMINI_API_KEY (hoặc để trống để dùng mẫu thông minh tích hợp sẵn)..."
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono pr-20 shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white"
            >
              {showKey ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Dùng để tạo nội dung phân tích sâu sắc, phong cách hấp dẫn kèm icon và định dạng bài Facebook chuẩn SEO.
          </p>
        </div>

        {/* Auto Mode Toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-inner">
          <div className="max-w-xl">
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Chế độ Auto-Pilot hoàn toàn (Tự động đăng ngay không cần duyệt tay)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Khi bật: bot cào Google Trends xong sẽ tự viết bài và đăng ngay lập tức. Khi tắt: bài viết sẽ nằm ở bản thảo để bạn xem &amp; sửa trước khi bấm Đăng.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setForm({ ...form, auto_mode: form.auto_mode === 'true' ? 'false' : 'true' })}
            className={`w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-200 ${
              form.auto_mode === 'true' ? 'bg-indigo-600 justify-end' : 'bg-slate-800 justify-start'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-white shadow-md"></div>
          </button>
        </div>

        {/* Posts Per Automation Cycle */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 shadow-inner flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>Số lượng bài đăng mỗi lần chạy tự động (trendpulse-cron / Auto-cycle)</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Số bài viết AI tự động cào và xuất bản trong mỗi chu kỳ chạy tự động. Khi chọn từ 2 bài trở lên, hệ thống sẽ tự động nghỉ 25 giây giữa các bài để bảo vệ tài khoản Facebook khỏi spam.
            </p>
          </div>
          <select
            value={form.posts_per_cycle}
            onChange={(e) => setForm({ ...form, posts_per_cycle: e.target.value })}
            className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 shadow-inner cursor-pointer shrink-0"
          >
            <option value="1">1 bài / lần chạy</option>
            <option value="2">2 bài / lần chạy</option>
            <option value="3">3 bài / lần chạy</option>
            <option value="4">4 bài / lần chạy</option>
            <option value="5">5 bài / lần chạy</option>
          </select>
        </div>

        {/* Tone & Region */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Phong cách viết bài (AI Tone)
            </label>
            <select
              value={form.post_tone}
              onChange={(e) => setForm({ ...form, post_tone: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="finance_news">Phân tích Tài chính &amp; Kinh tế Chuyên nghiệp</option>
              <option value="breaking_news">Điểm tin Nhanh &amp; Nóng hổi (Breaking)</option>
              <option value="viral_engaging">Tương tác Cộng đồng &amp; Thảo luận Sôi nổi</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Khu vực Google Trends mặc định
            </label>
            <select
              value={form.target_geo}
              onChange={(e) => setForm({ ...form, target_geo: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="VN">Việt Nam (VN)</option>
              <option value="US">Hoa Kỳ (US)</option>
              <option value="SG">Singapore (SG)</option>
              <option value="GB">Vương quốc Anh (GB)</option>
              <option value="JP">Nhật Bản (JP)</option>
            </select>
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Từ khóa ưu tiên Tài chính / Kinh tế (Phân tách bởi dấu phẩy)
          </label>
          <input
            type="text"
            value={form.filter_keywords}
            onChange={(e) => setForm({ ...form, filter_keywords: e.target.value })}
            className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Các xu hướng khớp với từ khóa này sẽ tự động được gắn thẻ Tài chính &amp; ưu tiên xử lý trước.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {isSaved && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold animate-pulse">
            <Check className="w-4 h-4" /> Đã lưu cấu hình thành công!
          </span>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-xl shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? 'Đang lưu...' : 'Lưu tất cả cấu hình'}</span>
        </button>
      </div>
    </form>

      {/* PWA Mobile & Desktop App Section */}
      <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10 shrink-0">
              <Smartphone className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Cài đặt Ứng dụng Di động (PWA)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Mobile &amp; PC
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">Cài đặt TrendPulse lên màn hình chính điện thoại hoặc máy tính để dùng mượt như App gốc.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent('trendpulse:install-pwa'));
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition active:scale-95 shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>Cài đặt Ứng dụng</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>📱 Hướng dẫn trên iPhone / iPad (Safari)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Mở Safari &gt; Bấm nút <strong>Chia sẻ (Share 📤)</strong> ở thanh dưới &gt; Chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <span>🤖 Hướng dẫn trên Android / Chrome / Edge</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Bấm nút <strong>&quot;Cài đặt Ứng dụng&quot;</strong> ở trên, hoặc bấm <strong>menu (⋮)</strong> &gt; Chọn <strong>Cài đặt ứng dụng</strong> hoặc <strong>Thêm vào màn hình chính</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Admin Security: Change credentials on VPS */}
      <AdminSecuritySection />

      {/* Backup & Restore Section */}
      <BackupRestoreSection onRefreshData={onRefreshData} />
    </div>
  );
}
