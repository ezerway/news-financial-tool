'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import TrendsTab from '@/components/TrendsTab';
import PostsTab from '@/components/PostsTab';
import LogsTab from '@/components/LogsTab';
import SettingsTab from '@/components/SettingsTab';
import FacebookConnectModal from '@/components/FacebookConnectModal';
import { TrendItem, PostItem, ActivityLog } from '@/types';
import { formatTime } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';
import { Toast } from '@astryxdesign/core/Toast';
import {
  TrendingUp,
  FileText,
  Activity,
  Settings,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Play,
  Info,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'posts' | 'logs' | 'settings'>('overview');
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [fbStatus, setFbStatus] = useState({
    loggedIn: false,
    username: '',
    message: 'Đang kiểm tra...',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCycle, setIsRunningCycle] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [commentingId, setCommentingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [isFbModalOpen, setIsFbModalOpen] = useState(false);
  const [fbTargetUrlForModal, setFbTargetUrlForModal] = useState<string | undefined>(undefined);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all dashboard data
  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const [trendsRes, postsRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/trends'),
        fetch('/api/posts'),
        fetch('/api/logs?limit=50'),
        fetch('/api/settings'),
      ]);

      if (trendsRes.ok) {
        const data = await trendsRes.json();
        setTrends(data.trends || []);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
      }
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings || {});
        if (data.fbStatus) setFbStatus(data.fbStatus);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  // Auto-refresh interval (in seconds: 0 = off, 15, 30, 60, 120)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState<number>(30);

  // Load saved preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('trendpulse_auto_refresh');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        setAutoRefreshInterval(val);
        setSecondsUntilRefresh(val > 0 ? val : 0);
      }
    }
  }, []);

  const handleChangeAutoRefresh = (seconds: number) => {
    setAutoRefreshInterval(seconds);
    setSecondsUntilRefresh(seconds);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trendpulse_auto_refresh', seconds.toString());
    }
    if (seconds > 0) {
      showToast(`Đã bật tự động làm mới: mỗi ${seconds >= 60 ? `${seconds / 60} phút` : `${seconds}s`}`, 'info');
    } else {
      showToast('Đã tắt tự động làm mới', 'info');
    }
  };

  // Timer loop for auto-refresh
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    setSecondsUntilRefresh(autoRefreshInterval);

    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      setSecondsUntilRefresh((prev) => {
        if (prev <= 1) {
          fetchData(true);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, fetchData]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && autoRefreshInterval > 0) {
        fetchData(true);
        setSecondsUntilRefresh(autoRefreshInterval);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [autoRefreshInterval, fetchData]);

  useEffect(() => {
    fetchData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['overview', 'trends', 'posts', 'logs', 'settings'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, [fetchData]);

  // Crawl trends handler
  const handleCrawl = async (geo: string) => {
    setIsCrawling(true);
    showToast(
      `Đang cào xu hướng Kinh doanh & Tài chính cho ${geo}...`,
      'info'
    );
    try {
      const res = await fetch('/api/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geo }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Đã cào thành công ${data.count} xu hướng Kinh doanh & Tài chính!`,
          'success'
        );
        await fetchData();
      } else {
        showToast(`Lỗi cào dữ liệu: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi mạng: ${err.message}`, 'error');
    } finally {
      setIsCrawling(false);
    }
  };

  // Generate AI post handler
  const handleGenerate = async (trendId: string) => {
    setGeneratingId(trendId);
    showToast('Đang tạo bài viết và comment nguồn bằng Gemini AI...', 'info');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã tạo xong bài viết và bình luận nguồn!', 'success');
        await fetchData();
        setActiveTab('posts');
      } else {
        showToast(`Lỗi tạo bài viết: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi mạng: ${err.message}`, 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  // Find sources for trend handler
  const handleFindSources = async (trendId: string) => {
    showToast('Đang tìm bài báo nguồn cho xu hướng...', 'info');
    try {
      const res = await fetch('/api/trends/find-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Đã tìm thấy ${data.count} liên kết báo chí nguồn!`, 'success');
        await fetchData();
      } else {
        showToast(data.error || 'Không tìm thấy link nguồn', 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  // Publish handler
  const handlePublish = async (postId: string, dryRun: boolean) => {
    setPublishingId(postId);
    showToast(dryRun ? 'Đang chạy mô phỏng Playwright (Dry Run)...' : 'Đang mở Playwright để đăng bài & auto-comment...', 'info');
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, dryRun }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(dryRun ? 'Chạy thử mô phỏng thành công!' : 'Đã xuất bản bài viết và bình luận nguồn thành công!', 'success');
        await fetchData();
      } else {
        showToast(`Lỗi xuất bản: ${data.error || data.result?.error}`, 'error');
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err.message}`, 'error');
    } finally {
      setPublishingId(null);
    }
  };

  // Comment-only handler for existing posts
  const handleCommentOnly = async (postId: string, postUrl?: string) => {
    setCommentingId(postId);
    showToast('Đang gửi bình luận link nguồn vào bài viết...', 'info');
    try {
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, postUrl }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi bình luận link nguồn thành công!', 'success');
        await fetchData();
      } else {
        showToast(`Lỗi gửi bình luận: ${data.error || data.result?.error}`, 'error');
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err.message}`, 'error');
    } finally {
      setCommentingId(null);
    }
  };

  // Update post edits
  const handleUpdatePost = async (postId: string, postContent: string, commentContent: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_content: postContent, comment_content: commentContent }),
      });
      if (res.ok) {
        showToast('Đã lưu bài viết thành công!', 'success');
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Lỗi lưu: ${err.message}`, 'error');
    }
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('Đã xóa bài viết thành công!', 'success');
        await fetchData();
      } else {
        showToast(`Lỗi xóa: ${data.error || 'Không thể xóa bài viết'}`, 'error');
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Lỗi xóa: ${err.message}`, 'error');
      await fetchData();
    }
  };

  // Run full cycle
  const handleRunCycle = async (dryRun: boolean) => {
    setIsRunningCycle(true);
    showToast(dryRun ? 'Đang chạy chu kỳ tự động (Mô phỏng)...' : 'Đang thực thi chu kỳ: Cào -> Viết -> Đăng...', 'info');
    try {
      const res = await fetch('/api/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, forcePublish: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Chu kỳ tự động hoàn tất thành công!', 'success');
        await fetchData();
      } else {
        showToast(`Lỗi chu kỳ: ${data.error || data.result?.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi mạng: ${err.message}`, 'error');
    } finally {
      setIsRunningCycle(false);
    }
  };

  // Clear activity logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/logs', { method: 'DELETE' });
      showToast('Đã dọn dẹp nhật ký hoạt động!', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  // Save settings
  const handleSaveSettings = async (newSettings: Record<string, string>) => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      if (res.ok) {
        showToast('Đã cập nhật cài đặt!', 'success');
        await fetchData();
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const handleConnectFb = (url?: string) => {
    setFbTargetUrlForModal(url);
    setIsFbModalOpen(true);
  };

  const tabItems: Array<{
    id: 'overview' | 'trends' | 'posts' | 'logs' | 'settings';
    label: string;
    icon: any;
    count?: number;
  }> = [
    { id: 'overview', label: t('tab_overview'), icon: Sparkles },
    { id: 'trends', label: t('tab_trends'), icon: TrendingUp, count: trends.length },
    { id: 'posts', label: t('tab_posts'), icon: FileText, count: posts.length },
    { id: 'logs', label: t('tab_logs'), icon: Activity, count: logs.length },
    { id: 'settings', label: t('tab_settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-150" style={{ backgroundColor: 'var(--app-bg)', color: 'var(--app-text)' }}>
      {/* Astryx Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Toast
            body={
              <div className="flex items-center gap-2">
                {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                {toastMessage.type === 'info' && <Info className="w-4 h-4 text-indigo-500 shrink-0" />}
                <span className="text-xs font-semibold">{toastMessage.text}</span>
              </div>
            }
            type={toastMessage.type === 'error' ? 'error' : 'info'}
            isAutoHide={true}
            autoHideDuration={4000}
            onDismiss={() => setToastMessage(null)}
          />
        </div>
      )}

      {/* Header with Integrated Tab Navigation */}
      <Header
        fbStatus={fbStatus}
        onRunCycle={handleRunCycle}
        onRefresh={() => fetchData(false)}
        onConnectFb={handleConnectFb}
        isRunning={isRunningCycle || isLoading}
        autoRefreshInterval={autoRefreshInterval}
        onChangeAutoRefresh={handleChangeAutoRefresh}
        secondsUntilRefresh={secondsUntilRefresh}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        tabCounts={{
          trends: trends.length,
          posts: posts.length,
          logs: logs.length,
        }}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-5 pb-24 md:pb-8">
        {/* Tab Content Display */}
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* KPI Stat Cards */}
              <StatsCards trends={trends} posts={posts} logs={logs} />

              {/* Quick Actions & System Info Banner */}
              <div className="p-4 rounded-xl app-card shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                      AI FinTech Automation
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      Google Trends Kinh Doanh & Tài Chính
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tự động cào xu hướng nóng, tạo bài viết tài chính và xuất bản Fanpage kèm bình luận link báo nguồn.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                  <button
                    onClick={() => handleCrawl('VN')}
                    disabled={isCrawling}
                    className="btn btn-md btn-secondary flex-1 md:flex-initial"
                  >
                    <TrendingUp className={`w-3.5 h-3.5 text-blue-500 ${isCrawling ? 'animate-spin' : ''}`} />
                    <span>{isCrawling ? t('crawling') : 'Cào Trends VN'}</span>
                  </button>

                  <button
                    onClick={() => handleRunCycle(false)}
                    disabled={isRunningCycle}
                    className="btn btn-md btn-primary flex-1 md:flex-initial"
                  >
                    <Play className={`w-3.5 h-3.5 fill-current ${isRunningCycle ? 'animate-spin' : ''}`} />
                    <span>{isRunningCycle ? 'Đang chạy...' : 'Chạy toàn chu kỳ'}</span>
                  </button>
                </div>
              </div>

              {/* Two Column Layout: Recent Published Posts & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                {/* Left: Recent Published Posts */}
                <div className="rounded-xl app-card shadow-xs p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)] mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" /> {t('recent_published_title')}
                      </h3>
                      <button
                        onClick={() => setActiveTab('posts')}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t('view_all')} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {posts.filter((p) => p.status === 'published').length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        {t('no_published_posts')}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {posts
                          .filter((p) => p.status === 'published')
                          .slice(0, 3)
                          .map((p) => (
                            <div
                              key={p.id}
                              className="p-3 rounded-lg app-tag space-y-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold capitalize text-inherit">
                                  {p.trend_title}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-slate-400" suppressHydrationWarning>
                                    {formatTime(p.published_at || p.created_at)}
                                  </span>
                                  {p.fb_post_url && (
                                    <a
                                      href={p.fb_post_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                    >
                                      Xem FB ↗
                                    </a>
                                  )}
                                </div>
                              </div>

                              <p className="line-clamp-2 text-xs leading-relaxed text-inherit opacity-90">
                                {p.post_content}
                              </p>

                              {/* Comment bubble */}
                              <div className="p-2 rounded bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-1.5 font-mono">
                                <span className="shrink-0 font-bold text-emerald-600">💬 Nguồn:</span>
                                <span className="line-clamp-1 opacity-80 text-[10px]">
                                  {p.comment_content.replace(/\n/g, ' ')}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Recent Activity Log */}
                <div className="rounded-xl app-card shadow-xs p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)] mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-500" /> {t('tab_logs')}
                      </h3>
                      <button
                        onClick={() => setActiveTab('logs')}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {t('view_all')} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {logs.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">{t('no_logs_title')}</div>
                    ) : (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                        {logs.slice(0, 6).map((l) => (
                          <div
                            key={l.id}
                            className="flex items-start gap-2.5 p-2 rounded-lg app-tag text-xs"
                          >
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-500 shrink-0">
                              {l.action}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] truncate text-inherit">
                                {l.message}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono" suppressHydrationWarning>
                                {formatTime(l.created_at)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}



          {activeTab === 'trends' && (
            <TrendsTab
              trends={trends}
              onCrawl={handleCrawl}
              onGenerate={handleGenerate}
              onFindSources={handleFindSources}
              isCrawling={isCrawling}
              generatingId={generatingId}
            />
          )}

          {activeTab === 'posts' && (
            <PostsTab
              posts={posts}
              onPublish={handlePublish}
              onComment={handleCommentOnly}
              onUpdate={handleUpdatePost}
              onDelete={handleDeletePost}
              publishingId={publishingId}
              commentingId={commentingId}
            />
          )}

          {activeTab === 'logs' && <LogsTab logs={logs} onClearLogs={handleClearLogs} />}

          {activeTab === 'settings' && (
            <SettingsTab
              settings={settings}
              fbStatus={fbStatus}
              onSaveSettings={handleSaveSettings}
              onConnectFb={handleConnectFb}
              onRefreshData={fetchData}
            />
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 border-t border-slate-200 dark:border-slate-800 backdrop-blur-xl px-2 py-1.5 flex items-center justify-around shadow-lg">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-indigo-600 text-[9px] font-bold text-white flex items-center justify-center">
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[56px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Facebook Connect Modal */}
      <FacebookConnectModal
        isOpen={isFbModalOpen}
        onClose={() => setIsFbModalOpen(false)}
        onSuccess={() => {
          fetchData();
          showToast('Đã lưu phiên đăng nhập Facebook thành công!', 'success');
        }}
        fbStatus={fbStatus}
        initialTargetUrl={fbTargetUrlForModal}
      />
    </div>
  );
}
