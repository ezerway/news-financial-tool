'use client';

import React, { useState } from 'react';
import {
  Save,
  Key,
  Check,
  Sparkles,
  Sliders,
  Megaphone,
  User,
  Smartphone,
  Download,
  Lock,
  HardDrive,
  Layers,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import BackupRestoreSection from './BackupRestoreSection';
import AdminSecuritySection from './AdminSecuritySection';
import { useI18n } from '@/context/I18nThemeContext';

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
  const { t, lang } = useI18n();
  const [activeSection, setActiveSection] = useState<'all' | 'facebook' | 'ai' | 'security' | 'backup' | 'pwa'>('all');
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    await onSaveSettings(form);
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const sections = [
    { id: 'all', label: lang === 'vi' ? 'Tất cả' : 'All', icon: Layers },
    { id: 'facebook', label: 'Facebook', icon: Megaphone },
    { id: 'ai', label: 'Gemini AI', icon: Sparkles },
    { id: 'security', label: lang === 'vi' ? 'Bảo mật' : 'Security', icon: Lock },
    { id: 'backup', label: lang === 'vi' ? 'Sao lưu' : 'Backup', icon: HardDrive },
    { id: 'pwa', label: 'App PWA', icon: Smartphone },
  ] as const;

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 sm:space-y-6">
      {/* Category Pills Header on Mobile & Desktop */}
      <div className="sticky top-[58px] sm:top-[68px] z-30 p-1.5 rounded-2xl app-card backdrop-blur-xl shadow-xs flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {sections.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`btn btn-sm ${
                  isActive
                    ? 'btn-primary'
                    : 'btn-ghost text-slate-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Save Trigger */}
        {(activeSection === 'all' || activeSection === 'facebook' || activeSection === 'ai') && (
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isSaving}
            className="btn btn-sm btn-emerald shrink-0 ml-1"
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span className="hidden sm:inline">{lang === 'vi' ? 'Đã lưu' : 'Saved'}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? '...' : (lang === 'vi' ? 'Lưu' : 'Save')}</span>
              </>
            )}
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        {/* SECTION 1: FACEBOOK TARGET & FANPAGE */}
        {(activeSection === 'all' || activeSection === 'facebook') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shadow-xs shrink-0">
                  <Megaphone className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-inherit">{t('settings_target_title')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings_target_desc')}</p>
                </div>
              </div>

              <span className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold app-tag shrink-0">
                {form.fb_target_type === 'page'
                  ? (lang === 'vi' ? '📢 Fanpage' : '📢 Fanpage')
                  : (lang === 'vi' ? '👤 Trang cá nhân' : '👤 Profile')}
              </span>
            </div>

            {/* Target Type Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              <button
                type="button"
                onClick={() => setForm({ ...form, fb_target_type: 'page' })}
                className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all relative ${
                  form.fb_target_type === 'page'
                    ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/30'
                    : 'app-tag hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-inherit">
                    <Megaphone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" /> {t('target_page_btn')}
                  </span>
                  {form.fb_target_type === 'page' && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('target_page_desc')}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, fb_target_type: 'profile' })}
                className={`p-3.5 sm:p-4 rounded-xl border text-left transition-all relative ${
                  form.fb_target_type === 'profile'
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/30'
                    : 'app-tag hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="flex items-center gap-2 text-xs sm:text-sm font-bold text-inherit">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400" /> {t('target_profile_btn')}
                  </span>
                  {form.fb_target_type === 'profile' && (
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {t('target_profile_desc')}
                </p>
              </button>
            </div>

            {/* Fanpage Details Config */}
            {form.fb_target_type === 'page' && (
              <div className="p-4 rounded-xl app-tag space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-inherit mb-1 flex items-center justify-between">
                    <span>{lang === 'vi' ? 'Đường dẫn Fanpage URL *' : 'Fanpage URL *'}</span>
                    <span className="text-[10px] text-blue-500 font-semibold">{lang === 'vi' ? 'Bắt buộc' : 'Required'}</span>
                  </label>
                  <input
                    type="text"
                    value={form.fb_page_url}
                    onChange={(e) => setForm({ ...form, fb_page_url: e.target.value })}
                    placeholder="https://www.facebook.com/ten-fanpage-cua-ban"
                    className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    💡 {lang === 'vi' ? 'Dán link Fanpage bạn làm quản trị viên (Ví dụ: https://www.facebook.com/tintuc247)' : 'Paste your Fanpage link where you are admin'}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-inherit mb-1">
                    {lang === 'vi' ? 'Tên Fanpage (Gợi nhớ)' : 'Fanpage Display Name'}
                  </label>
                  <input
                    type="text"
                    value={form.fb_page_name}
                    onChange={(e) => setForm({ ...form, fb_page_name: e.target.value })}
                    placeholder="Ví dụ: Tin Tức Tài Chính 247"
                    className="w-full h-9 px-3 app-input rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                  />
                </div>

                <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onConnectFb(form.fb_page_url || undefined)}
                    className="btn btn-md btn-primary"
                  >
                    <FacebookIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>{lang === 'vi' ? 'Mở Fanpage kiểm tra quyền' : 'Open Fanpage to Verify'}</span>
                  </button>
                  <span className="text-[10px] text-slate-400">
                    {lang === 'vi' ? '(Mở trình duyệt để chuyển quyền Page)' : '(Opens browser to switch Page mode)'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: FACEBOOK SESSION */}
        {(activeSection === 'all' || activeSection === 'facebook') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shadow-xs shrink-0">
                  <FacebookIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-inherit">
                    {lang === 'vi' ? 'Phiên đăng nhập Facebook' : 'Facebook Session'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'vi' ? 'Playwright Persistent Session tự động đăng bài an toàn.' : 'Persistent Session for automated posting.'}
                  </p>
                </div>
              </div>

              <div className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold app-tag shrink-0">
                {fbStatus.loggedIn
                  ? (lang === 'vi' ? '● Đã kết nối' : '● Connected')
                  : (lang === 'vi' ? '○ Chưa kết nối' : '○ Disconnected')}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                <span>{lang === 'vi' ? 'Trạng thái:' : 'Status:'}</span>
                <span className="font-mono text-inherit font-semibold app-tag px-2 py-0.5 rounded">
                  {fbStatus.message}
                </span>
              </p>

              <div className="p-3 rounded-xl app-tag text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                💡 {lang === 'vi' ? 'Bấm nút bên dưới để mở cửa sổ trình duyệt Chromium đăng nhập tài khoản Facebook có quyền Fanpage. Hệ thống sẽ lưu phiên vĩnh viễn.' : 'Click below to open Chromium browser and log in with your Facebook account.'}
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onConnectFb(form.fb_target_type === 'page' && form.fb_page_url ? form.fb_page_url : undefined)}
                  className="btn btn-md btn-primary"
                >
                  <FacebookIcon className="w-4 h-4" />
                  <span>{lang === 'vi' ? 'Mở trình duyệt quản lý Facebook' : 'Open Facebook Browser'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: GEMINI AI & AUTOMATION */}
        {(activeSection === 'all' || activeSection === 'ai') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 sm:gap-3.5 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shadow-xs shrink-0">
                <Key className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-inherit">{t('settings_ai_title')}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings_ai_desc')}</p>
              </div>
            </div>

            {/* Gemini API Key */}
            <div>
              <label className="block text-xs font-semibold text-inherit mb-1">
                Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={form.gemini_api_key}
                  onChange={(e) => setForm({ ...form, gemini_api_key: e.target.value })}
                  placeholder={lang === 'vi' ? 'Nhập GEMINI_API_KEY...' : 'Enter GEMINI_API_KEY...'}
                  className="w-full h-9 pl-3 pr-14 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-sm btn-ghost text-xs"
                >
                  {showKey ? (lang === 'vi' ? 'Ẩn' : 'Hide') : (lang === 'vi' ? 'Hiện' : 'Show')}
                </button>
              </div>
            </div>

            {/* Auto Mode Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl app-tag gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-inherit flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">{lang === 'vi' ? 'Chế độ Auto-Pilot hoàn toàn' : 'Full Auto-Pilot Mode'}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {lang === 'vi' ? 'Tự động cào tin và đăng bài ngay mà không cần duyệt tay.' : 'Automatically crawls trends and publishes immediately.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, auto_mode: form.auto_mode === 'true' ? 'false' : 'true' })}
                className={`w-12 h-6 sm:w-14 sm:h-7 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                  form.auto_mode === 'true' ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                }`}
              >
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-md"></div>
              </button>
            </div>

            {/* Posts Per Automation Cycle */}
            <div className="p-3.5 rounded-xl app-tag flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <div className="text-xs font-bold text-inherit flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{lang === 'vi' ? 'Số bài đăng mỗi chu kỳ' : 'Posts Per Cycle'}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {lang === 'vi' ? 'Nghỉ 25s giữa các bài để bảo vệ tài khoản.' : 'Pauses 25s between posts to prevent spam.'}
                </p>
              </div>
              <select
                value={form.posts_per_cycle}
                onChange={(e) => setForm({ ...form, posts_per_cycle: e.target.value })}
                className="app-input h-9 px-3 text-xs font-semibold rounded-lg focus:outline-hidden focus:border-indigo-500 cursor-pointer"
              >
                <option value="1">1 {lang === 'vi' ? 'bài / lần' : 'post / run'}</option>
                <option value="2">2 {lang === 'vi' ? 'bài / lần' : 'posts / run'}</option>
                <option value="3">3 {lang === 'vi' ? 'bài / lần' : 'posts / run'}</option>
                <option value="4">4 {lang === 'vi' ? 'bài / lần' : 'posts / run'}</option>
                <option value="5">5 {lang === 'vi' ? 'bài / lần' : 'posts / run'}</option>
              </select>
            </div>

            {/* Tone & Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4">
              <div>
                <label className="block text-xs font-semibold text-inherit mb-1">
                  {lang === 'vi' ? 'Phong cách viết bài AI' : 'AI Writing Tone'}
                </label>
                <select
                  value={form.post_tone}
                  onChange={(e) => setForm({ ...form, post_tone: e.target.value })}
                  className="w-full h-9 px-3 app-input rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value="finance_news">{lang === 'vi' ? 'Phân tích Tài chính Chuyên sâu' : 'Deep Financial Analysis'}</option>
                  <option value="breaking_news">{lang === 'vi' ? 'Tin Nhanh Nóng Hổi (Breaking)' : 'Breaking News'}</option>
                  <option value="viral_engaging">{lang === 'vi' ? 'Tương tác Thảo luận Sôi nổi' : 'Viral Community Engaging'}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-inherit mb-1">
                  {lang === 'vi' ? 'Khu vực Trends mặc định' : 'Default Trends Geo'}
                </label>
                <select
                  value={form.target_geo}
                  onChange={(e) => setForm({ ...form, target_geo: e.target.value })}
                  className="w-full h-9 px-3 app-input rounded-lg text-xs focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                >
                  <option value="VN">🇻🇳 Việt Nam (VN)</option>
                  <option value="US">🇺🇸 Hoa Kỳ (US)</option>
                  <option value="SG">🇸🇬 Singapore (SG)</option>
                  <option value="GB">🇬🇧 Vương quốc Anh (GB)</option>
                  <option value="JP">🇯🇵 Nhật Bản (JP)</option>
                </select>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-xs font-semibold text-inherit mb-1">
                {lang === 'vi' ? 'Từ khóa lọc xu hướng' : 'Filter Keywords'}
              </label>
              <input
                type="text"
                value={form.filter_keywords}
                onChange={(e) => setForm({ ...form, filter_keywords: e.target.value })}
                className="w-full h-9 px-3 app-input rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Save Button for Form */}
        {(activeSection === 'all' || activeSection === 'facebook' || activeSection === 'ai') && (
          <div className="flex items-center justify-end gap-2.5 pt-1">
            {isSaved && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                <Check className="w-4 h-4" /> {lang === 'vi' ? 'Đã lưu cấu hình!' : 'Settings saved!'}
              </span>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="btn btn-lg btn-primary w-full sm:w-auto"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu tất cả cấu hình' : 'Save Settings')}</span>
            </button>
          </div>
        )}
      </form>

      {/* SECTION 4: PWA APP */}
      {(activeSection === 'all' || activeSection === 'pwa') && (
        <div className="app-card p-4 sm:p-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-app-border">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shadow-sm shrink-0">
                <Smartphone className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{lang === 'vi' ? 'Cài đặt App PWA' : 'Install PWA App'}</span>
                  <span className="app-tag text-[10px] font-bold px-2 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                    iOS • Android
                  </span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === 'vi' ? 'Cài TrendPulse lên màn hình chính dùng mượt như App gốc.' : 'Add to home screen for native app experience.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent('trendpulse:install-pwa'));
              }}
              className="btn btn-md btn-primary shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'vi' ? 'Cài đặt ngay' : 'Install Now'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
            <div className="app-subcard p-3.5 rounded-xl space-y-1">
              <div className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs flex items-center gap-1.5">
                <span>📱</span>
                <span>{lang === 'vi' ? 'iPhone / iPad (Safari)' : 'iPhone / iPad (Safari)'}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                {lang === 'vi' ? 'Mở Safari > Bấm nút Chia sẻ (Share 📤) > Chọn "Thêm vào MH chính" (Add to Home Screen).' : 'Open Safari > Tap Share (📤) > Tap "Add to Home Screen".'}
              </p>
            </div>

            <div className="app-subcard p-3.5 rounded-xl space-y-1">
              <div className="font-bold text-slate-900 dark:text-white text-[11px] sm:text-xs flex items-center gap-1.5">
                <span>🤖</span>
                <span>{lang === 'vi' ? 'Android / Chrome' : 'Android / Chrome'}</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                {lang === 'vi' ? 'Bấm nút "Cài đặt ngay" ở trên hoặc Menu (⋮) > Chọn Cài đặt ứng dụng.' : 'Tap "Install Now" or tap Menu (⋮) > Install App.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: ADMIN SECURITY */}
      {(activeSection === 'all' || activeSection === 'security') && (
        <AdminSecuritySection />
      )}

      {/* SECTION 6: BACKUP & RESTORE */}
      {(activeSection === 'all' || activeSection === 'backup') && (
        <BackupRestoreSection onRefreshData={onRefreshData} />
      )}
    </div>
  );
}
