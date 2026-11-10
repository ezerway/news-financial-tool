'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  Key,
  Check,
  Sparkles,
  Sliders,
  ExternalLink,
  Smartphone,
  Download,
  Lock,
  HardDrive,
  Layers,
  Terminal,
  Trash2,
  RefreshCw,
  Loader2,
  Image as ImageIcon,
  Video,
  Bell,
  Send,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import TikTokIcon from './TikTokIcon';
import BackupRestoreSection from './BackupRestoreSection';
import AdminSecuritySection from './AdminSecuritySection';
import { useI18n } from '@/context/I18nThemeContext';
import {
  isBrowserNotificationSupported,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  showBrowserNotification,
} from '@/lib/browser-notifications';

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
  const [activeSection, setActiveSection] = useState<'all' | 'facebook' | 'tiktok' | 'notifications' | 'ai' | 'storage' | 'security' | 'backup' | 'pwa'>('all');
  const [form, setForm] = useState<Record<string, string>>({
    gemini_api_key: settings.gemini_api_key || '',
    fb_target_type: settings.fb_target_type || 'page',
    fb_page_url: settings.fb_page_url || (settings.fb_target_url && !settings.fb_target_url.endsWith('facebook.com/') ? settings.fb_target_url : ''),
    fb_page_name: settings.fb_page_name || '',
    fb_target_url: settings.fb_target_url || 'https://www.facebook.com/',
    target_geo: settings.target_geo || 'VN',
    post_tone: settings.post_tone || 'finance_news',
    auto_mode: settings.auto_mode || 'false',
    developer_mode: settings.developer_mode || 'false',
    tiktok_auto_post: settings.tiktok_auto_post || 'true',
    browser_notify_enabled: settings.browser_notify_enabled || 'true',
    telegram_notify_enabled: settings.telegram_notify_enabled || 'false',
    telegram_bot_token: settings.telegram_bot_token || '',
    telegram_chat_id: settings.telegram_chat_id || '',
    slack_notify_enabled: settings.slack_notify_enabled || 'false',
    slack_webhook_url: settings.slack_webhook_url || '',
    notify_on_success: settings.notify_on_success || 'true',
    notify_on_failure: settings.notify_on_failure || 'true',
    filter_keywords:
      settings.filter_keywords ||
      'tài chính, chứng khoán, ngân hàng, bất động sản, kinh tế, crypto, usd, vàng, lạm phát',
    crawler_interval_minutes: settings.crawler_interval_minutes || '60',
    posts_per_cycle: settings.posts_per_cycle || '1',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      gemini_api_key: settings.gemini_api_key ?? prev.gemini_api_key,
      fb_target_type: settings.fb_target_type ?? prev.fb_target_type,
      fb_page_url: settings.fb_page_url ?? prev.fb_page_url,
      fb_page_name: settings.fb_page_name ?? prev.fb_page_name,
      fb_target_url: settings.fb_target_url ?? prev.fb_target_url,
      target_geo: settings.target_geo ?? prev.target_geo,
      post_tone: settings.post_tone ?? prev.post_tone,
      auto_mode: settings.auto_mode ?? prev.auto_mode,
      developer_mode: settings.developer_mode ?? prev.developer_mode,
      tiktok_auto_post: settings.tiktok_auto_post ?? prev.tiktok_auto_post,
      browser_notify_enabled: settings.browser_notify_enabled ?? prev.browser_notify_enabled,
      telegram_notify_enabled: settings.telegram_notify_enabled ?? prev.telegram_notify_enabled,
      telegram_bot_token: settings.telegram_bot_token ?? prev.telegram_bot_token,
      telegram_chat_id: settings.telegram_chat_id ?? prev.telegram_chat_id,
      slack_notify_enabled: settings.slack_notify_enabled ?? prev.slack_notify_enabled,
      slack_webhook_url: settings.slack_webhook_url ?? prev.slack_webhook_url,
      notify_on_success: settings.notify_on_success ?? prev.notify_on_success,
      notify_on_failure: settings.notify_on_failure ?? prev.notify_on_failure,
      filter_keywords: settings.filter_keywords ?? prev.filter_keywords,
      crawler_interval_minutes: settings.crawler_interval_minutes ?? prev.crawler_interval_minutes,
      posts_per_cycle: settings.posts_per_cycle ?? prev.posts_per_cycle,
    }));
  }, [settings]);

  const [showKey, setShowKey] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpeningBrowser, setIsOpeningBrowser] = useState(false);
  const [browserMsg, setBrowserMsg] = useState<string | null>(null);

  // TikTok session states
  const [tiktokStatus, setTiktokStatus] = useState<{ loggedIn: boolean; username?: string; message: string }>({
    loggedIn: false,
    message: 'Đang kiểm tra...',
  });
  const [isOpeningTiktok, setIsOpeningTiktok] = useState(false);
  const [tiktokMsg, setTiktokMsg] = useState<string | null>(null);
  const [showTiktokCookieInput, setShowTiktokCookieInput] = useState(false);
  const [rawTiktokCookies, setRawTiktokCookies] = useState('');
  const [isSavingTiktokCookies, setIsSavingTiktokCookies] = useState(false);

  const fetchTiktokStatus = async () => {
    try {
      const res = await fetch('/api/tiktok-session');
      const data = await res.json();
      if (data.status) {
        setTiktokStatus(data.status);
      }
    } catch {}
  };

  useEffect(() => {
    fetchTiktokStatus();
  }, []);

  const handleOpenTiktokBrowser = async () => {
    setIsOpeningTiktok(true);
    setTiktokMsg(null);
    try {
      const res = await fetch('/api/tiktok-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        setTiktokMsg(lang === 'vi' ? 'Trình duyệt TikTok đang mở...' : 'TikTok browser is opening...');
        setTimeout(() => setTiktokMsg(null), 8000);
        setTimeout(fetchTiktokStatus, 10000);
      } else {
        setTiktokMsg(data.error || 'Không thể mở trình duyệt');
      }
    } catch (err: any) {
      setTiktokMsg('Lỗi kết nối: ' + err.message);
    } finally {
      setIsOpeningTiktok(false);
    }
  };

  const handleSaveTiktokCookies = async () => {
    if (!rawTiktokCookies.trim()) return;
    setIsSavingTiktokCookies(true);
    try {
      const res = await fetch('/api/tiktok-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawCookies: rawTiktokCookies }),
      });
      const data = await res.json();
      if (data.success) {
        setTiktokMsg(data.message);
        setShowTiktokCookieInput(false);
        setRawTiktokCookies('');
        if (data.status) setTiktokStatus(data.status);
      } else {
        alert(data.error || data.message || 'Lỗi lưu cookie');
      }
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setIsSavingTiktokCookies(false);
    }
  };

  // Notification states
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestMsg, setTelegramTestMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [slackTestMsg, setSlackTestMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isBrowserNotificationSupported()) {
      setNotificationPermission(getBrowserNotificationPermission());
    }
  }, []);

  const handleRequestBrowserPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      await showBrowserNotification('🔔 TrendPulse - Đã kích hoạt thông báo!', {
        body: 'Thông báo đẩy trình duyệt đã sẵn sàng nhận kết quả đăng bài & Reel.',
      });
    }
  };

  const handleTestBrowserNotification = async () => {
    const success = await showBrowserNotification('🔔 TrendPulse - Thử nghiệm thông báo đẩy', {
      body: 'Thông báo hoạt động tốt! Bạn sẽ nhận được tin nhắn khi đăng bài thành công hoặc gặp sự cố.',
      url: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    if (!success && notificationPermission !== 'granted') {
      await handleRequestBrowserPermission();
    }
  };

  const handleTestTelegramNotification = async () => {
    if (!form.telegram_bot_token.trim() || !form.telegram_chat_id.trim()) {
      setTelegramTestMsg({
        text: lang === 'vi' ? 'Vui lòng nhập cả Telegram Bot Token và Chat ID trước.' : 'Please enter both Telegram Bot Token and Chat ID.',
        type: 'error',
      });
      return;
    }

    setIsTestingTelegram(true);
    setTelegramTestMsg(null);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'telegram',
          botToken: form.telegram_bot_token.trim(),
          chatId: form.telegram_chat_id.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramTestMsg({ text: data.message, type: 'success' });
      } else {
        setTelegramTestMsg({ text: data.error || data.message || 'Lỗi gửi tin nhắn Telegram', type: 'error' });
      }
    } catch (err: any) {
      setTelegramTestMsg({ text: 'Lỗi kết nối: ' + err.message, type: 'error' });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleTestSlackNotification = async () => {
    if (!form.slack_webhook_url.trim()) {
      setSlackTestMsg({
        text: lang === 'vi' ? 'Vui lòng nhập Slack Incoming Webhook URL trước.' : 'Please enter Slack Incoming Webhook URL.',
        type: 'error',
      });
      return;
    }

    setIsTestingSlack(true);
    setSlackTestMsg(null);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'slack',
          webhookUrl: form.slack_webhook_url.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSlackTestMsg({ text: data.message, type: 'success' });
      } else {
        setSlackTestMsg({ text: data.error || data.message || 'Lỗi gửi tin nhắn Slack', type: 'error' });
      }
    } catch (err: any) {
      setSlackTestMsg({ text: 'Lỗi kết nối: ' + err.message, type: 'error' });
    } finally {
      setIsTestingSlack(false);
    }
  };

  // Storage cleanup states
  const [storageStats, setStorageStats] = useState<{
    screenshots: { count: number; sizeFormatted: string };
    videos: { count: number; sizeFormatted: string };
    totalCount: number;
    totalFormatted: string;
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [isCleaningStorage, setIsCleaningStorage] = useState(false);
  const [storageMsg, setStorageMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [showConfirmClean, setShowConfirmClean] = useState(false);

  const fetchStorageStats = async () => {
    setIsLoadingStorage(true);
    try {
      const res = await fetch('/api/storage/clean');
      const data = await res.json();
      if (data.success) {
        setStorageStats(data);
      }
    } catch {}
    finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchStorageStats();
  }, []);

  const handleCleanStorage = async () => {
    setIsCleaningStorage(true);
    setStorageMsg(null);
    try {
      const res = await fetch('/api/storage/clean', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStorageMsg({ text: data.message, type: 'success' });
        setShowConfirmClean(false);
        fetchStorageStats();
        if (onRefreshData) onRefreshData();
      } else {
        setStorageMsg({ text: data.error || 'Lỗi khi dọn dẹp', type: 'error' });
      }
    } catch (err: any) {
      setStorageMsg({ text: 'Lỗi: ' + err.message, type: 'error' });
    } finally {
      setIsCleaningStorage(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    await onSaveSettings({
      ...form,
      fb_target_type: 'page',
      fb_target_url: form.fb_page_url || form.fb_target_url || 'https://www.facebook.com/',
    });
    setIsSaving(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handleOpenFanpageBrowser = async () => {
    setIsOpeningBrowser(true);
    setBrowserMsg(null);
    try {
      const target = form.fb_page_url?.trim() || undefined;
      const res = await fetch('/api/fb-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await res.json();
      if (data.success) {
        setBrowserMsg(lang === 'vi' ? 'Trình duyệt đang được mở...' : 'Browser is opening...');
        setTimeout(() => setBrowserMsg(null), 6000);
        if (onRefreshData) onRefreshData();
      } else {
        onConnectFb(target);
      }
    } catch {
      onConnectFb(form.fb_page_url?.trim() || undefined);
    } finally {
      setIsOpeningBrowser(false);
    }
  };

  const sections = [
    { id: 'all', label: lang === 'vi' ? 'Tất cả' : 'All', icon: Layers },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon },
    { id: 'tiktok', label: 'TikTok', icon: TikTokIcon },
    { id: 'notifications', label: lang === 'vi' ? 'Thông báo' : 'Notifications', icon: Bell },
    { id: 'ai', label: 'Gemini AI', icon: Sparkles },
    { id: 'storage', label: lang === 'vi' ? 'Bộ nhớ' : 'Storage', icon: Trash2 },
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
        {(activeSection === 'all' || activeSection === 'facebook' || activeSection === 'notifications' || activeSection === 'ai') && (
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
        {/* SECTION: FACEBOOK FANPAGE */}
        {(activeSection === 'all' || activeSection === 'facebook') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center shadow-xs shrink-0">
                  <FacebookIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-inherit">{t('settings_target_title')}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t('settings_target_desc')}</p>
                </div>
              </div>

              <div className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold app-tag shrink-0">
                {fbStatus.loggedIn ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {lang === 'vi' ? '● Đã kết nối' : '● Connected'}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {lang === 'vi' ? '○ Chưa kết nối' : '○ Disconnected'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-inherit mb-1 flex items-center justify-between">
                  <span>{lang === 'vi' ? 'Đường dẫn Fanpage URL *' : 'Fanpage URL *'}</span>
                  <span className="text-[10px] text-blue-500 font-semibold">{lang === 'vi' ? 'Bắt buộc' : 'Required'}</span>
                </label>
                <input
                  type="text"
                  value={form.fb_page_url}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({ ...form, fb_page_url: val, fb_target_url: val });
                  }}
                  placeholder="https://www.facebook.com/ten-fanpage-cua-ban"
                  className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 {lang === 'vi' ? 'Dán link Fanpage bạn làm quản trị viên (Ví dụ: https://www.facebook.com/tintuc247)' : 'Paste your Fanpage link where you are admin'}
                </p>
              </div>

              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenFanpageBrowser}
                  disabled={isOpeningBrowser}
                  className="btn btn-md btn-primary"
                >
                  <FacebookIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>
                    {isOpeningBrowser
                      ? (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...')
                      : (lang === 'vi' ? 'Mở trình duyệt Fanpage' : 'Open Fanpage Browser')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onConnectFb(form.fb_page_url || undefined)}
                  className="btn btn-md btn-ghost text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  title={lang === 'vi' ? 'Nhập cookie c_user/xs hoặc tải file session' : 'Import cookies or session file'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Tuỳ chọn phiên (Cookie / File)' : 'Session Options (Cookie/File)'}</span>
                </button>

                {browserMsg && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                    ✓ {browserMsg}
                  </span>
                )}
                {!browserMsg && fbStatus.message && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    ({fbStatus.message})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2B: TIKTOK INTEGRATION */}
        {(activeSection === 'all' || activeSection === 'tiktok') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 dark:bg-rose-600/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 flex items-center justify-center shadow-xs shrink-0">
                  <TikTokIcon className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-inherit">
                    {lang === 'vi' ? 'Tài khoản TikTok' : 'TikTok Account'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'vi'
                      ? 'Đăng nhập để tự động tải và đăng video lên TikTok khi xuất bản Reel'
                      : 'Login to auto upload and publish video to TikTok when posting Reel'}
                  </p>
                </div>
              </div>

              <div className="self-start sm:self-auto px-2.5 py-0.5 rounded-full text-xs font-semibold app-tag shrink-0">
                {tiktokStatus.loggedIn ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {lang === 'vi' ? '● Đã kết nối' : '● Connected'}
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {lang === 'vi' ? '○ Chưa kết nối' : '○ Disconnected'}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Toggle Tự động đăng Reel lên TikTok */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-[var(--app-border)]">
                <div className="space-y-0.5 pr-4">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {lang === 'vi' ? 'Tự động đăng lên TikTok khi xuất bản Reel' : 'Auto post to TikTok when posting Reel'}
                  </span>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === 'vi'
                      ? 'Mỗi khi xuất bản Reel thành công lên Facebook, hệ thống sẽ tự động đồng bộ đăng lên kênh TikTok của bạn.'
                      : 'When publishing Reel to Facebook, automatically post it to your TikTok channel as well.'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.tiktok_auto_post === 'true'}
                    onChange={(e) => setForm({ ...form, tiktok_auto_post: e.target.checked ? 'true' : 'false' })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-500"></div>
                </label>
              </div>

              {/* Status message */}
              {tiktokStatus.message && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/60 dark:bg-slate-800/40 p-2.5 rounded-lg border border-[var(--app-border)]">
                  💡 {tiktokStatus.message}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenTiktokBrowser}
                  disabled={isOpeningTiktok}
                  className="btn btn-md bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs border-rose-500 shadow-xs"
                >
                  <TikTokIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>
                    {isOpeningTiktok
                      ? (lang === 'vi' ? 'Đang mở trình duyệt...' : 'Opening browser...')
                      : (lang === 'vi' ? 'Mở trình duyệt đăng nhập TikTok' : 'Open TikTok Login Browser')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowTiktokCookieInput(!showTiktokCookieInput)}
                  className="btn btn-md btn-ghost text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  title={lang === 'vi' ? 'Nhập cookie TikTok từ Cookie-Editor' : 'Import cookies from Cookie-Editor'}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Nhập Cookie (Thủ công / VPS)' : 'Import Cookies (Manual/VPS)'}</span>
                </button>

                {tiktokMsg && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                    ✓ {tiktokMsg}
                  </span>
                )}
              </div>

              {/* Collapsible Cookie Input Box */}
              {showTiktokCookieInput && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-[var(--app-border)] space-y-2.5 animate-in fade-in">
                  <label className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {lang === 'vi' ? 'Dán Cookie TikTok (JSON từ Cookie-Editor hoặc Name=Value):' : 'Paste TikTok Cookies (JSON or Name=Value):'}
                  </label>
                  <textarea
                    rows={3}
                    value={rawTiktokCookies}
                    onChange={(e) => setRawTiktokCookies(e.target.value)}
                    placeholder='[{"name": "sessionid", "value": "..."}, ...]'
                    className="w-full p-2 app-input rounded-lg text-xs font-mono placeholder-slate-400"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTiktokCookieInput(false)}
                      className="btn btn-sm btn-ghost text-xs"
                    >
                      {lang === 'vi' ? 'Hủy' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveTiktokCookies}
                      disabled={isSavingTiktokCookies || !rawTiktokCookies.trim()}
                      className="btn btn-sm btn-primary text-xs"
                    >
                      {isSavingTiktokCookies ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...') : (lang === 'vi' ? 'Lưu Cookie' : 'Save Cookies')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION: PUSH NOTIFICATIONS (Browser & Telegram) */}
        {(activeSection === 'all' || activeSection === 'notifications') && (
          <div className="p-4 sm:p-6 rounded-2xl app-card shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2.5 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 dark:bg-purple-600/15 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center shadow-xs shrink-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-inherit">
                    {lang === 'vi' ? 'Thông báo đẩy (Push Notifications)' : 'Push Notifications'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'vi'
                      ? 'Nhận thông báo ngay lập tức qua Trình duyệt & Telegram khi đăng bài thành công hoặc thất bại'
                      : 'Get instant alerts via Browser & Telegram on post success or failure'}
                  </p>
                </div>
              </div>
            </div>

            {/* Notification Filter Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-[var(--app-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {lang === 'vi' ? 'Thông báo khi THÀNH CÔNG' : 'Alert on SUCCESS'}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'vi' ? 'Gửi thông báo khi bài viết hoặc video đăng xong' : 'Send notification when post or reel succeeds'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={form.notify_on_success === 'true'}
                    onChange={(e) => setForm({ ...form, notify_on_success: e.target.checked ? 'true' : 'false' })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    {lang === 'vi' ? 'Thông báo khi THẤT BẠI' : 'Alert on FAILURE'}
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {lang === 'vi' ? 'Gửi cảnh báo kèm lỗi khi đăng bài gặp sự cố' : 'Send error alert when post or reel fails'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2 shrink-0">
                  <input
                    type="checkbox"
                    checked={form.notify_on_failure === 'true'}
                    onChange={(e) => setForm({ ...form, notify_on_failure: e.target.checked ? 'true' : 'false' })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-500"></div>
                </label>
              </div>
            </div>

            {/* CHANNEL 1: Browser Web Push Notifications */}
            <div className="p-4 rounded-xl border border-[var(--app-border)] space-y-3 bg-white dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs sm:text-sm font-bold text-inherit">
                    {lang === 'vi' ? '1. Thông báo đẩy trên Trình duyệt / Thiết bị' : '1. Browser / Device Push Notifications'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {notificationPermission === 'granted' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                      ● {lang === 'vi' ? 'Đã cho phép' : 'Granted'}
                    </span>
                  ) : notificationPermission === 'denied' ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
                      ✕ {lang === 'vi' ? 'Bị chặn' : 'Blocked'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                      ○ {lang === 'vi' ? 'Chưa cấp quyền' : 'Not Granted'}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === 'vi'
                  ? 'Hiển thị thông báo native của hệ điều hành (macOS, Windows, Android, iOS PWA) ngay cả khi bạn đang mở tab khác hoặc chạy nền.'
                  : 'Displays OS-level native notifications (macOS, Windows, Android, iOS PWA) even when using other apps or running in background.'}
              </p>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {notificationPermission !== 'granted' && (
                  <button
                    type="button"
                    onClick={handleRequestBrowserPermission}
                    className="btn btn-sm btn-primary"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Cấp quyền thông báo' : 'Grant Permission'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleTestBrowserNotification}
                  className="btn btn-sm btn-secondary"
                >
                  <Send className="w-3 h-3 text-indigo-500" />
                  <span>{lang === 'vi' ? 'Thử thông báo trình duyệt' : 'Test Browser Alert'}</span>
                </button>
              </div>
            </div>

            {/* CHANNEL 2: Telegram Bot Notifications */}
            <div className="p-4 rounded-xl border border-[var(--app-border)] space-y-3.5 bg-white dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px]">
                    TG
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-inherit">
                      {lang === 'vi' ? '2. Thông báo qua Telegram Bot' : '2. Telegram Bot Notifications'}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400 font-normal">
                      ({lang === 'vi' ? 'Khuyên dùng cho Cron / Chạy ngầm' : 'Recommended for Cron / Headless'})
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.telegram_notify_enabled === 'true'}
                    onChange={(e) => setForm({ ...form, telegram_notify_enabled: e.target.checked ? 'true' : 'false' })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-500"></div>
                </label>
              </div>

              {form.telegram_notify_enabled === 'true' && (
                <div className="space-y-3 pt-1 border-t border-[var(--app-border)] animate-in fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-inherit mb-1">
                        Telegram Bot Token <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showTelegramToken ? 'text' : 'password'}
                          value={form.telegram_bot_token}
                          onChange={(e) => setForm({ ...form, telegram_bot_token: e.target.value })}
                          placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz..."
                          className="w-full h-9 pl-3 pr-10 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTelegramToken(!showTelegramToken)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        >
                          {showTelegramToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-inherit mb-1">
                        Telegram Chat ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.telegram_chat_id}
                        onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                        placeholder="Ví dụ: 123456789 hoặc -100123456789"
                        className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Quick Guide */}
                  <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-900/30 text-[11px] text-blue-900 dark:text-blue-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      💡 {lang === 'vi' ? 'Cách lấy Bot Token và Chat ID trong 1 phút:' : 'How to get Bot Token & Chat ID:'}
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-[10.5px] opacity-90 pl-1">
                      <li>{lang === 'vi' ? 'Mở Telegram tìm @BotFather, gửi lệnh /newbot để tạo bot và copy Bot Token.' : 'Open Telegram, chat with @BotFather, send /newbot and copy Bot Token.'}</li>
                      <li>{lang === 'vi' ? 'Tìm bot của bạn và ấn Start. Sau đó mở @userinfobot để xem Chat ID của bạn.' : 'Search your bot and press Start. Then open @userinfobot to get your Chat ID.'}</li>
                    </ol>
                  </div>

                  {/* Test Telegram Button */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleTestTelegramNotification}
                      disabled={isTestingTelegram}
                      className="btn btn-sm btn-primary bg-blue-600 hover:bg-blue-700 text-white border-blue-500"
                    >
                      {isTestingTelegram ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{lang === 'vi' ? 'Đang gửi thử nghiệm...' : 'Sending test...'}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          <span>{lang === 'vi' ? 'Gửi thử tin nhắn Telegram' : 'Test Telegram Message'}</span>
                        </>
                      )}
                    </button>

                    {telegramTestMsg && (
                      <span
                        className={`text-xs font-medium ${
                          telegramTestMsg.type === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {telegramTestMsg.type === 'success' ? '✓ ' : '✕ '}
                        {telegramTestMsg.text}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* CHANNEL 3: Slack Incoming Webhook */}
            <div className="p-4 rounded-xl border border-[var(--app-border)] space-y-3.5 bg-white dark:bg-slate-900/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                    #
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-inherit">
                      {lang === 'vi' ? '3. Thông báo qua Slack Incoming Webhook' : '3. Slack Incoming Webhook'}
                    </span>
                    <span className="ml-2 text-[10px] text-slate-400 font-normal">
                      ({lang === 'vi' ? 'Gửi vào Channel Slack' : 'Send to Slack Channel'})
                    </span>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={form.slack_notify_enabled === 'true'}
                    onChange={(e) => setForm({ ...form, slack_notify_enabled: e.target.checked ? 'true' : 'false' })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {form.slack_notify_enabled === 'true' && (
                <div className="space-y-3 pt-1 border-t border-[var(--app-border)] animate-in fade-in">
                  <div>
                    <label className="block text-xs font-semibold text-inherit mb-1">
                      Slack Webhook URL <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={form.slack_webhook_url}
                      onChange={(e) => setForm({ ...form, slack_webhook_url: e.target.value })}
                      placeholder="https://hooks.slack.com/services/T.../B.../..."
                      className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  {/* Quick Guide */}
                  <div className="p-2.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 text-[11px] text-emerald-900 dark:text-emerald-300 space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      💡 {lang === 'vi' ? 'Cách tạo Slack Webhook URL trong 1 phút:' : 'How to get Slack Webhook URL:'}
                    </div>
                    <ol className="list-decimal list-inside space-y-0.5 text-[10.5px] opacity-90 pl-1">
                      <li>{lang === 'vi' ? 'Truy cập https://api.slack.com/apps và chọn Create New App (From scratch).' : 'Go to https://api.slack.com/apps and click Create New App.'}</li>
                      <li>{lang === 'vi' ? 'Bật tính năng "Incoming Webhooks" ➔ Bấm "Add New Webhook to Workspace" ➔ Chọn kênh nhận tin và Copy Webhook URL.' : 'Enable "Incoming Webhooks", click "Add New Webhook to Workspace", choose your channel, and copy the URL.'}</li>
                    </ol>
                  </div>

                  {/* Test Slack Button */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleTestSlackNotification}
                      disabled={isTestingSlack}
                      className="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-500"
                    >
                      {isTestingSlack ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{lang === 'vi' ? 'Đang gửi thử nghiệm...' : 'Sending test...'}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3 h-3" />
                          <span>{lang === 'vi' ? 'Gửi thử tin nhắn Slack' : 'Test Slack Message'}</span>
                        </>
                      )}
                    </button>

                    {slackTestMsg && (
                      <span
                        className={`text-xs font-medium ${
                          slackTestMsg.type === 'success'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {slackTestMsg.type === 'success' ? '✓ ' : '✕ '}
                        {slackTestMsg.text}
                      </span>
                    )}
                  </div>
                </div>
              )}
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

            {/* Developer Mode Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl app-tag gap-3 border border-amber-500/20 bg-amber-500/5">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-inherit flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{lang === 'vi' ? 'Chế độ Developer (Mở trình duyệt)' : 'Developer Mode (Show Browser)'}</span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {lang === 'vi'
                    ? 'Mặc định là TẮT (chạy ngầm headless). Khi BẬT, mọi tác vụ Playwright (đăng bài, reels, bình luận, cào tin) sẽ mở cửa sổ trình duyệt (headless = false) để bạn quan sát và gỡ lỗi.'
                    : 'Default is OFF (headless). When ON, all Playwright operations run with visible browser window (headless = false) for debugging.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, developer_mode: form.developer_mode === 'true' ? 'false' : 'true' })}
                className={`w-12 h-6 sm:w-14 sm:h-7 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 ${
                  form.developer_mode === 'true' ? 'bg-amber-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
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
        {(activeSection === 'all' || activeSection === 'facebook' || activeSection === 'notifications' || activeSection === 'ai') && (
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

      {/* SECTION: STORAGE CLEANUP (SCREENSHOTS & VIDEOS) */}
      {(activeSection === 'all' || activeSection === 'storage') && (
        <div className="app-card p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-app-border">
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-amber-50 dark:bg-amber-600/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shadow-xs shrink-0">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{lang === 'vi' ? 'Dọn dẹp bộ nhớ (Screenshot & Video)' : 'Storage Cleanup (Screenshots & Videos)'}</span>
                  {storageStats && (
                    <span className="app-tag text-[10px] font-bold px-2 py-0.5 rounded-md text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20">
                      {storageStats.totalFormatted}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {lang === 'vi'
                    ? 'Xóa toàn bộ ảnh đối soát bài đăng và video quay màn hình Playwright để giải phóng dung lượng ổ cứng (VPS).'
                    : 'Delete all post screenshots and Playwright videos to free up disk space on the server.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={fetchStorageStats}
              disabled={isLoadingStorage}
              className="btn btn-sm btn-ghost text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 self-start sm:self-auto cursor-pointer"
              title={lang === 'vi' ? 'Làm mới dung lượng' : 'Refresh storage stats'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStorage ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{lang === 'vi' ? 'Kiểm tra' : 'Check'}</span>
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="app-subcard p-3 rounded-xl flex items-center justify-between gap-3 border border-[var(--app-border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">
                    {lang === 'vi' ? 'Ảnh chụp màn hình (Screenshots)' : 'Audit Screenshots'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    storage/screenshots
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  {storageStats?.screenshots.count ?? 0} {lang === 'vi' ? 'file' : 'files'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storageStats?.screenshots.sizeFormatted ?? '0 B'}
                </div>
              </div>
            </div>

            <div className="app-subcard p-3 rounded-xl flex items-center justify-between gap-3 border border-[var(--app-border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs">
                    {lang === 'vi' ? 'Video Playwright ghi lại' : 'Playwright Videos'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    storage/videos
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  {storageStats?.videos.count ?? 0} {lang === 'vi' ? 'file' : 'files'}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {storageStats?.videos.sizeFormatted ?? '0 B'}
                </div>
              </div>
            </div>
          </div>

          {/* Notification Messages */}
          {storageMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                storageMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <span>{storageMsg.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{storageMsg.text}</span>
            </div>
          )}

          {/* Delete Action Bar */}
          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">
              💡 {lang === 'vi'
                ? 'Thao tác sẽ xóa các file ảnh/video tạm và gỡ liên kết trong bài viết/reel, không ảnh hưởng đến dữ liệu văn bản.'
                : 'This deletes temporary image/video files and resets database references without touching text data.'}
            </p>

            {showConfirmClean ? (
              <div className="flex items-center gap-2 self-end sm:self-auto animate-in fade-in">
                <button
                  type="button"
                  onClick={() => setShowConfirmClean(false)}
                  disabled={isCleaningStorage}
                  className="btn btn-sm btn-ghost text-xs"
                >
                  {lang === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleCleanStorage}
                  disabled={isCleaningStorage}
                  className="btn btn-sm bg-rose-600 hover:bg-rose-700 text-white border-rose-500 text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isCleaningStorage ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === 'vi' ? 'Đang xóa...' : 'Deleting...'}</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Xác nhận xóa hết' : 'Confirm Delete All'}</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowConfirmClean(true)}
                disabled={(storageStats?.totalCount ?? 0) === 0 || isCleaningStorage}
                className="btn btn-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 text-xs font-semibold self-start sm:self-auto cursor-pointer inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {lang === 'vi' ? 'Xóa hết Screenshot & Video' : 'Delete All Screenshots & Videos'}
                  {storageStats?.totalCount ? ` (${storageStats.totalCount})` : ''}
                </span>
              </button>
            )}
          </div>
        </div>
      )}

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
