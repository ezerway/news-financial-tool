'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import StatsCards from '@/components/StatsCards';
import TrendsTab from '@/components/TrendsTab';
import PostsTab from '@/components/PostsTab';
import LogsTab from '@/components/LogsTab';
import SettingsTab from '@/components/SettingsTab';
import { TrendItem, PostItem, ActivityLog } from '@/types';
import { formatTime } from '@/lib/date';
import {
  TrendingUp,
  FileText,
  Activity,
  Settings,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle,
  Play,
  Info,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardPage() {
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

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch all dashboard data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

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
      `Đang mở Playwright cào xu hướng Kinh doanh & Tài chính (Category 3) cho ${geo}...`,
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
          `Đã cào thành công ${data.count} xu hướng Kinh doanh & Tài chính kèm link nguồn!`,
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
    showToast('Đang tạo bài viết và comment nguồn bằng AI...', 'info');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trendId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã tạo xong bài viết và comment nguồn!', 'success');
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
    showToast('Đang tìm kiếm bài báo nguồn cho xu hướng...', 'info');
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
    showToast('Đang mở Playwright để gửi bình luận link nguồn vào bài viết...', 'info');
    try {
      const res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, postUrl }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Đã gửi bình luận link nguồn vào bài viết thành công!', 'success');
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

  // Delete post (optimistic with server sync)
  const handleDeletePost = async (postId: string) => {
    // Optimistic UI update
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    showToast('Đang xóa bài viết...', 'info');

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

  // Launch interactive FB login or Page setup
  const handleConnectFb = async (url?: string) => {
    try {
      showToast(
        url
          ? 'Đang mở Fanpage trên trình duyệt để kiểm tra & chuyển quyền...'
          : 'Đang khởi chạy trình duyệt để đăng nhập Facebook / quản lý Page...',
        'info'
      );
      const res = await fetch('/api/fb-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
      }
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const tabItems: Array<{
    id: 'overview' | 'trends' | 'posts' | 'logs' | 'settings';
    label: string;
    icon: any;
    count?: number;
  }> = [
    { id: 'overview', label: 'Tổng quan', icon: Sparkles },
    { id: 'trends', label: 'Xu hướng', icon: TrendingUp, count: trends.length },
    { id: 'posts', label: 'Bài viết', icon: FileText, count: posts.length },
    { id: 'logs', label: 'Nhật ký', icon: Activity, count: logs.length },
    { id: 'settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-base-300 text-base-content">
      {/* daisyUI Toast Notification */}
      {toastMessage && (
        <div className="toast toast-end toast-bottom z-50">
          <div
            className={`alert ${
              toastMessage.type === 'success'
                ? 'alert-success'
                : toastMessage.type === 'error'
                ? 'alert-error'
                : 'alert-info'
            } shadow-lg text-xs font-semibold`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4" />}
            {toastMessage.type === 'info' && <Info className="w-4 h-4" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        fbStatus={fbStatus}
        onRunCycle={handleRunCycle}
        onRefresh={fetchData}
        onConnectFb={handleConnectFb}
        isRunning={isRunningCycle || isLoading}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-28 md:pb-8">
        {/* Desktop Tab Navigation (Floating Segmented Dock) */}
        <div className="hidden md:flex items-center justify-start overflow-x-auto pb-1">
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl shadow-xl">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 text-white shadow-lg shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content Display */}
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI Stat Cards */}
              <StatsCards trends={trends} posts={posts} logs={logs} />

              {/* Two Column Layout: Recent Published Posts & Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Recent Published Posts */}
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-base-200 mb-2">
                      <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-success" /> Bài viết vừa xuất bản
                      </h3>
                      <button
                        onClick={() => setActiveTab('posts')}
                        className="btn btn-xs btn-ghost text-primary gap-1"
                      >
                        Xem tất cả <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {posts.filter((p) => p.status === 'published').length === 0 ? (
                      <div className="p-8 text-center text-xs text-base-content/50">
                        Chưa có bài viết nào được xuất bản. Bấm &quot;Chạy ngay chu kỳ tự động&quot; để trải nghiệm.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {posts
                          .filter((p) => p.status === 'published')
                          .slice(0, 3)
                          .map((p) => (
                            <div key={p.id} className="p-3.5 rounded-xl bg-base-200/50 border border-base-200 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-base-content capitalize">{p.trend_title}</span>
                                <span className="text-[10px] text-base-content/50" suppressHydrationWarning>
                                  {formatTime(p.published_at || p.created_at)}
                                </span>
                              </div>
                              <p className="text-base-content/80 line-clamp-2 text-[11px] leading-relaxed mb-2">
                                {p.post_content}
                              </p>
                              <div className="p-2 rounded bg-base-300 text-[10px] text-success font-mono line-clamp-1">
                                💬 Auto-comment: {p.comment_content.replace(/\n/g, ' ')}
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Recent Activity Log */}
                <div className="card bg-base-100 border border-base-200 shadow-sm">
                  <div className="card-body p-5">
                    <div className="flex items-center justify-between pb-3 border-b border-base-200 mb-2">
                      <h3 className="font-bold text-sm text-base-content flex items-center gap-2">
                        <Activity className="w-4 h-4 text-secondary" /> Dòng thời gian hoạt động
                      </h3>
                      <button
                        onClick={() => setActiveTab('logs')}
                        className="btn btn-xs btn-ghost text-primary gap-1"
                      >
                        Xem toàn bộ log <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    {logs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-base-content/50">Chưa có nhật ký hoạt động nào.</div>
                    ) : (
                      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                        {logs.slice(0, 6).map((l) => (
                          <div key={l.id} className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-base-200/50 border border-base-200">
                            <span className="badge badge-neutral badge-xs font-mono shrink-0">
                              {l.action}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-base-content text-[11px] truncate">{l.message}</p>
                              <span className="text-[10px] text-base-content/50" suppressHydrationWarning>{formatTime(l.created_at)}</span>
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

      {/* Mobile Bottom Navigation Bar (PWA Dock) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800/80 backdrop-blur-2xl px-1.5 py-1.5 flex items-center justify-around shadow-2xl pb-[max(0.6rem,env(safe-area-inset-bottom))]">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-0.5 rounded-xl transition-all relative ${
                isActive ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[15px] h-3.5 px-1 rounded-full bg-indigo-600 text-[9px] font-black text-white flex items-center justify-center shadow-sm">
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-1 tracking-tight truncate max-w-[62px] ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
