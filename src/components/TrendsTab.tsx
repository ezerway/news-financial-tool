'use client';

import React, { useState } from 'react';
import { TrendItem, PostItem } from '@/types';
import {
  TrendingUp,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Search,
  CheckCircle2,
  FileEdit,
  ChevronDown,
  ChevronUp,
  Link2,
  Zap,
  AlertTriangle,
  Eye,
  FileText,
  Trash2,
  Film,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import Pagination from './Pagination';
import TrendPostModal from './TrendPostModal';
import SlidePreviewModal from './SlidePreviewModal';
import { useI18n } from '@/context/I18nThemeContext';

interface TrendsTabProps {
  trends: TrendItem[];
  posts?: PostItem[];
  onCrawl: (geo: string) => Promise<void>;
  onGenerate: (trendId: string, force?: boolean) => Promise<void>;
  onFindSources?: (trendId: string) => Promise<void>;
  onRetryAndPublish?: (trendId?: string, allMissing?: boolean) => Promise<void>;
  onPublishPost?: (postId: string, force?: boolean) => Promise<void>;
  onNavigateToPostsTab?: (postId?: string) => void;
  onDeleteTrend?: (trendId: string) => Promise<void>;
  onGenerateVideo?: (trendId: string, force?: boolean, templateId?: string, customScript?: any) => Promise<void>;
  generatingVideoId?: string | null;
  onBatchGenerateVideos?: (templateId?: string, limit?: number) => Promise<void>;
  isBatchGeneratingVideos?: boolean;
  isCrawling: boolean;
  generatingId: string | null;
  retryingId?: string | null;
  isRetryingAll?: boolean;
  publishingId?: string | null;
}

export default function TrendsTab({
  trends,
  posts = [],
  onCrawl,
  onGenerate,
  onFindSources,
  onRetryAndPublish,
  onPublishPost,
  onNavigateToPostsTab,
  onDeleteTrend,
  onGenerateVideo,
  generatingVideoId,
  onBatchGenerateVideos,
  isBatchGeneratingVideos,
  isCrawling,
  generatingId,
  retryingId,
  isRetryingAll,
  publishingId,
}: TrendsTabProps) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedGeo, setSelectedGeo] = useState('VN');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'drafted' | 'unprocessed'>('all');
  const [expandedTrendIds, setExpandedTrendIds] = useState<Record<string, boolean>>({});
  const [searchingSourceId, setSearchingSourceId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [viewingTrend, setViewingTrend] = useState<TrendItem | null>(null);
  const [playingVideoPath, setPlayingVideoPath] = useState<string | null>(null);
  const [previewSlideTrend, setPreviewSlideTrend] = useState<TrendItem | null>(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchLimit, setBatchLimit] = useState(5);
  const [batchTemplate, setBatchTemplate] = useState('random');
  const [templateDropdownTrendId, setTemplateDropdownTrendId] = useState<string | null>(null);
  const [templateDropdownForce, setTemplateDropdownForce] = useState(false);

  const VIDEO_TEMPLATE_CHOICES = [
    { id: 'random', name: '🎲 Ngẫu nhiên thông minh', desc: 'Luân phiên tự động các mẫu' },
    { id: 'modern_dark', name: '🌌 Hiện đại & Tối giản', desc: 'Navy Blue & Kính mờ sang trọng' },
    { id: 'bloomberg_terminal', name: '📈 Wall Street Terminal', desc: 'Tone đen sâu & Vàng tài chính' },
    { id: 'editorial_magazine', name: '💎 Tạp chí Sang trọng', desc: 'Obsidian & Vàng Champagne' },
    { id: 'neon_cyber', name: '⚡ Cyberpunk Neon', desc: 'Cyan & Magenta FinTech tương lai' },
    { id: 'crimson_breaking', name: '🚨 Thời sự & Khẩn cấp', desc: 'Đỏ Crimson rực lửa & Báo động nóng' },
    { id: 'emerald_wealth', name: '👑 Thịnh vượng & Đầu tư', desc: 'Xanh ngọc lục bảo & Vàng Gold quý phái' },
    { id: 'sunset_gradient', name: '🌅 TikTok GenZ Sunset', desc: 'Cam san hô & Tím Neon sôi động bắt mắt' },
  ];

  const toggleExpand = (id: string) => {
    setExpandedTrendIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper tìm bài viết tương ứng với xu hướng
  const findPostForTrend = (tr: TrendItem): PostItem | null => {
    if (!posts || posts.length === 0) return null;
    return (
      posts.find(
        (p) =>
          p.trend_id === tr.id ||
          p.trend_title?.trim().toLowerCase() === tr.title?.trim().toLowerCase()
      ) || null
    );
  };

  // Helper kiểm tra bài báo nguồn thực tế
  const hasValidSources = (tr: TrendItem) =>
    Array.isArray(tr.articles) &&
    tr.articles.some((a) => a.url && !a.url.includes('google.com'));

  // Filter trends by selected country
  const geoTrends = selectedGeo === 'all' ? trends : trends.filter((tr) => tr.geo === selectedGeo);

  // Filter trends by status
  const statusFilteredTrends = geoTrends.filter((tr) => {
    const hasSrc = hasValidSources(tr);
    // Chỉ tính là 'published' nếu thực sự có source link
    if (statusFilter === 'published') return tr.status === 'published' && hasSrc;
    if (statusFilter === 'drafted') return tr.status === 'drafted';
    if (statusFilter === 'unprocessed') return !tr.status || tr.status === 'discovered' || !hasSrc;
    return true;
  });

  // Filter trends by search keyword
  const filteredTrends = statusFilteredTrends.filter((tr) => {
    const q = search.toLowerCase();
    return (
      tr.title.toLowerCase().includes(q) ||
      (tr.articles || []).some((a) => a.title?.toLowerCase().includes(q) || a.source?.toLowerCase().includes(q))
    );
  });

  const totalItems = filteredTrends.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTrends = filteredTrends.slice(startIndex, startIndex + pageSize);

  // Handle switching country
  const handleGeoChange = async (newGeo: string) => {
    setSelectedGeo(newGeo);
    setCurrentPage(1);
    if (newGeo !== 'all') {
      const exists = trends.some((tr) => tr.geo === newGeo);
      if (!exists) {
        await onCrawl(newGeo);
      }
    }
  };

  const publishedCount = geoTrends.filter((t) => t.status === 'published' && hasValidSources(t)).length;
  const draftedCount = geoTrends.filter((t) => t.status === 'drafted').length;
  const unprocessedCount = geoTrends.filter((t) => !t.status || t.status === 'discovered' || !hasValidSources(t)).length;
  const missingSourcesCount = geoTrends.filter((t) => !hasValidSources(t)).length;

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Toolbar */}
      <div className="p-3 sm:p-4 rounded-xl app-card shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder={t('search_trends_placeholder')}
            className="w-full h-9.5 sm:h-9 pl-9 pr-3 app-input rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Right: Country Select & Action Buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={selectedGeo}
              onChange={(e) => handleGeoChange(e.target.value)}
              className="flex-1 sm:w-36 app-input h-9.5 sm:h-9 text-xs font-semibold rounded-lg px-2.5 sm:px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer min-w-0"
            >
              <option value="VN">🇻🇳 {lang === 'vi' ? 'Việt Nam' : 'Vietnam'}</option>
              <option value="US">🇺🇸 {lang === 'vi' ? 'Hoa Kỳ' : 'United States'}</option>
              <option value="SG">🇸🇬 Singapore</option>
              <option value="GB">🇬🇧 {lang === 'vi' ? 'Anh' : 'UK'}</option>
              <option value="JP">🇯🇵 {lang === 'vi' ? 'Nhật Bản' : 'Japan'}</option>
              <option value="all">{t('region_all')}</option>
            </select>

            <button
              onClick={() => onCrawl(selectedGeo === 'all' ? 'VN' : selectedGeo)}
              disabled={isCrawling || isRetryingAll}
              className="flex-1 sm:flex-initial btn btn-md btn-emerald justify-center h-9.5 sm:h-9 whitespace-nowrap active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
              <span>{isCrawling ? t('crawling') : t('crawl_btn')}</span>
            </button>
          </div>

          {onBatchGenerateVideos && (
            <button
              onClick={() => setShowBatchModal(true)}
              disabled={isBatchGeneratingVideos || isCrawling}
              className="w-full sm:w-auto btn btn-md btn-secondary justify-center h-9.5 sm:h-9 shadow-xs active:scale-[0.98] px-3 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40"
              title={lang === 'vi' ? 'Tự động tạo video dọc 9:16 cho các xu hướng chưa có video' : 'Batch create 9:16 short videos'}
            >
              <Film className={`w-3.5 h-3.5 shrink-0 ${isBatchGeneratingVideos ? 'animate-spin' : ''}`} />
              <span className="truncate">
                {isBatchGeneratingVideos
                  ? (lang === 'vi' ? 'Đang tạo video...' : 'Creating...')
                  : (lang === 'vi' ? 'Tạo Video hàng loạt' : 'Batch Create Videos')}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Status Sub-filters (Smooth Mobile Touch Scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 touch-pan-x text-xs">
        <button
          onClick={() => {
            setStatusFilter('all');
            setCurrentPage(1);
          }}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'all'
              ? 'btn-secondary font-bold ring-1 ring-slate-400/40 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Tất cả' : 'All'} ({geoTrends.length})
        </button>

        <button
          onClick={() => {
            setStatusFilter('unprocessed');
            setCurrentPage(1);
          }}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'unprocessed'
              ? 'btn-secondary font-bold ring-1 ring-slate-400/40 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Chưa tạo bài' : 'New'} ({unprocessedCount})
        </button>

        <button
          onClick={() => {
            setStatusFilter('drafted');
            setCurrentPage(1);
          }}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'drafted'
              ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-300 dark:border-cyan-800 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Bản thảo sẵn' : 'Drafted'} ({draftedCount})
        </button>

        <button
          onClick={() => {
            setStatusFilter('published');
            setCurrentPage(1);
          }}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'published'
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Đã xuất bản' : 'Published'} ({publishedCount})
        </button>
      </div>

      {/* Dense Rows Data View */}
      {filteredTrends.length === 0 ? (
        <div className="p-8 sm:p-10 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <TrendingUp className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {lang === 'vi' ? 'Không tìm thấy xu hướng phù hợp' : 'No matching trends found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {t('no_trends_desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl app-card divide-y divide-[var(--app-border)] overflow-hidden shadow-xs">
            {paginatedTrends.map((trend, index) => {
              const isGenerating = generatingId === trend.id;
              const isSearchingSource = searchingSourceId === trend.id;
              const isRetryingThis = retryingId === trend.id;
              const validArticles = (trend.articles || []).filter((a) => a.url && !a.url.includes('google.com'));
              const hasSourceLinks = validArticles.length > 0;
              const isTrulyPublished = trend.status === 'published' && hasSourceLinks;
              const isFalsePublished = trend.status === 'published' && !hasSourceLinks;
              const isExpanded = !!expandedTrendIds[trend.id];
              const post = findPostForTrend(trend);

              return (
                <div
                  key={trend.id}
                  className="p-3 sm:p-4 hover:bg-[var(--app-card-hover)] transition-colors"
                >
                  {/* Main Row Content: Mobile stacked, Tablet/Desktop aligned to top */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    {/* Left: Rank & Title & Source Pills */}
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {/* Rank & Traffic Styled Badge */}
                      <div className="shrink-0 flex flex-col items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-center">
                        <div className="text-[10px] font-mono text-slate-400 font-semibold leading-none">#{startIndex + index + 1}</div>
                      <div className="text-[11px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-none mt-1">
                        {trend.approx_traffic || '10K+'}
                      </div>
                    </div>

                    {/* Title & Tags */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setViewingTrend(trend)}
                          className="font-bold text-sm sm:text-base text-inherit capitalize leading-snug hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors inline-flex items-center gap-1.5 group text-left cursor-pointer"
                          title={lang === 'vi' ? 'Bấm để xem bài viết của xu hướng này' : 'Click to view post for this trend'}
                        >
                          <span>{trend.title}</span>
                          <Eye className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 text-indigo-500 transition-opacity shrink-0" />
                        </button>

                        {/* Status badge - Clickable to view post */}
                        {isTrulyPublished && (
                          <button
                            type="button"
                            onClick={() => setViewingTrend(trend)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                            title={lang === 'vi' ? 'Bấm để xem bài viết đã đăng' : 'Click to view published post'}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            <span>{lang === 'vi' ? 'Đã đăng Fanpage' : 'Published'}</span>
                          </button>
                        )}
                        {isFalsePublished && (
                          <button
                            type="button"
                            onClick={() => setViewingTrend(trend)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition cursor-pointer"
                            title="Chưa có link nguồn báo chí, thực tế chưa thể đăng bài"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                            <span>{t('missing_sources_badge')} ({t('not_published_hint')})</span>
                          </button>
                        )}
                        {!isTrulyPublished && !isFalsePublished && trend.status === 'drafted' && (
                          <button
                            type="button"
                            onClick={() => setViewingTrend(trend)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 transition cursor-pointer"
                            title={lang === 'vi' ? 'Bấm để xem bản thảo bài viết' : 'Click to view draft post'}
                          >
                            <FileEdit className="w-2.5 h-2.5 text-cyan-500" />
                            <span>{lang === 'vi' ? 'Bản thảo sẵn' : 'Draft Ready'}</span>
                          </button>
                        )}

                        {/* Quick View Post Action Pill if post exists (only when not published yet) */}
                        {post && !isTrulyPublished && (
                          <button
                            type="button"
                            onClick={() => setViewingTrend(trend)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 transition cursor-pointer shadow-2xs"
                            title={lang === 'vi' ? 'Xem bài viết của xu hướng này' : 'View post for this trend'}
                          >
                            <Eye className="w-3 h-3 text-indigo-500" />
                            <span>{lang === 'vi' ? 'Xem bài viết' : 'View Post'}</span>
                          </button>
                        )}

                        {/* Video status badge */}
                        {trend.video_generated === 1 && trend.video_path && (
                          <button
                            type="button"
                            onClick={() => setPlayingVideoPath(trend.video_path || null)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition cursor-pointer shadow-2xs"
                            title={lang === 'vi' ? 'Bấm để xem video 9:16' : 'Click to watch 9:16 video'}
                          >
                            <Film className="w-2.5 h-2.5 text-purple-500" />
                            <span>{lang === 'vi' ? 'Đã có video' : 'Video Ready'}</span>
                          </button>
                        )}
                      </div>

                      {/* Source Domain Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {hasSourceLinks ? (
                          <>
                            {validArticles.slice(0, 2).map((art, aIdx) => (
                              <a
                                key={aIdx}
                                href={art.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] app-tag hover:border-indigo-500 px-2 py-0.5 rounded-md transition"
                                title={art.title}
                              >
                                <span className="max-w-[100px] sm:max-w-none truncate">{art.source || 'Nguồn báo'}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60 shrink-0" />
                              </a>
                            ))}

                            {validArticles.length > 2 && (
                              <button
                                onClick={() => toggleExpand(trend.id)}
                                className="text-[10px] text-slate-500 font-medium hover:underline py-0.5 px-1"
                              >
                                +{validArticles.length - 2} {lang === 'vi' ? 'nguồn khác' : 'more'}
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400">
                            {lang === 'vi' ? 'Chưa có link báo nguồn' : 'No news sources'}
                          </span>
                        )}

                        {hasSourceLinks && (
                          <button
                            onClick={() => toggleExpand(trend.id)}
                            className="inline-flex items-center gap-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline ml-auto sm:ml-1 py-0.5"
                          >
                            <span>{isExpanded ? (lang === 'vi' ? 'Thu gọn' : 'Less') : (lang === 'vi' ? 'Chi tiết nguồn' : 'Details')}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions (Full-width on mobile, top-aligned on desktop) */}
                  <div className="w-full sm:w-auto shrink-0 sm:self-start pt-1 sm:pt-0">
                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                      {isTrulyPublished ? (
                        <button
                          type="button"
                          onClick={() => setViewingTrend(trend)}
                          className="flex-1 sm:flex-initial h-9 sm:h-8 px-3 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition cursor-pointer"
                          title={lang === 'vi' ? 'Bấm để xem bài viết' : 'Click to view post'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t('status_published')} • {lang === 'vi' ? 'Xem bài' : 'View'}</span>
                        </button>
                      ) : hasSourceLinks ? (
                        <button
                          onClick={() => onGenerate(trend.id)}
                          disabled={isGenerating || isRetryingThis}
                          className="btn btn-md sm:btn-sm btn-primary flex-1 sm:flex-initial justify-center font-semibold text-xs shadow-xs active:scale-[0.98]"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                          <span>
                            {isGenerating
                              ? t('generating_post')
                              : trend.status === 'drafted'
                              ? (lang === 'vi' ? 'Xem / Viết lại' : 'View / Rewrite')
                              : t('generate_post_btn')}
                          </span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                          {onRetryAndPublish && (
                            <button
                              onClick={() => onRetryAndPublish(trend.id)}
                              disabled={isRetryingThis || isGenerating}
                              className="btn btn-md sm:btn-sm btn-primary flex-1 sm:flex-initial justify-center font-semibold text-xs bg-amber-600 hover:bg-amber-700 text-white border-amber-500 shadow-xs active:scale-[0.98]"
                              title={lang === 'vi' ? 'Tự động tìm kiếm nguồn báo chí chính thống và xuất bản lên Facebook Fanpage' : 'Find sources and publish to Facebook'}
                            >
                              <Zap className={`w-3.5 h-3.5 ${isRetryingThis ? 'animate-spin' : ''}`} />
                              <span>{isRetryingThis ? t('retrying_sources_and_publish') : t('find_sources_and_publish_btn')}</span>
                            </button>
                          )}
                          {onFindSources && (
                            <button
                              onClick={async () => {
                                setSearchingSourceId(trend.id);
                                try {
                                  await onFindSources(trend.id);
                                } finally {
                                  setSearchingSourceId(null);
                                }
                              }}
                              disabled={isSearchingSource || isRetryingThis}
                              className="btn btn-md sm:btn-sm btn-secondary justify-center font-semibold text-xs shadow-xs active:scale-[0.98]"
                              title={lang === 'vi' ? 'Chỉ tìm kiếm link bài báo nguồn' : 'Only find sources'}
                            >
                              <Search className={`w-3.5 h-3.5 ${isSearchingSource ? 'animate-spin' : ''}`} />
                              <span className="hidden sm:inline">{isSearchingSource ? t('searching_sources') : t('find_sources_btn')}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* 9:16 Video Action Button with Template Selector & Slide Preview */}
                      {onGenerateVideo && (
                        trend.video_generated === 1 && trend.video_path ? (
                          <div className="flex items-center gap-1 relative">
                            <button
                              type="button"
                              onClick={() => setPlayingVideoPath(trend.video_path || null)}
                              className="btn btn-md sm:btn-sm btn-secondary justify-center font-semibold text-xs shadow-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                              title={lang === 'vi' ? 'Xem video dọc 9:16' : 'Watch 9:16 video'}
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{lang === 'vi' ? 'Xem Video' : 'Watch'}</span>
                            </button>

                            {/* Nút Xem trước Slide kịch bản */}
                            <button
                              type="button"
                              onClick={() => setPreviewSlideTrend(trend)}
                              className="btn btn-md sm:btn-sm btn-secondary justify-center font-semibold text-xs shadow-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                              title={lang === 'vi' ? 'Xem trước & chỉnh sửa kịch bản Slide trước khi tạo lại video' : 'Preview & edit slide script before regenerating video'}
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span className="hidden xl:inline">{lang === 'vi' ? 'Xem Slide' : 'Slides'}</span>
                            </button>
                            
                            {/* Split-button Tạo lại Video */}
                            <div className="inline-flex items-stretch rounded-lg border border-amber-300 dark:border-amber-700/80 bg-amber-50/70 dark:bg-amber-950/40 shadow-xs overflow-hidden shrink-0">
                              <button
                                type="button"
                                onClick={() => onGenerateVideo(trend.id, true)}
                                disabled={generatingVideoId === trend.id}
                                className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 font-semibold text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition cursor-pointer border-r border-amber-300 dark:border-amber-700/80 disabled:opacity-50 active:scale-[0.98]"
                                title={lang === 'vi' ? 'Tạo lại video mới cho xu hướng này (dùng mẫu mặc định)' : 'Re-create video'}
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${generatingVideoId === trend.id ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">
                                   {generatingVideoId === trend.id
                                    ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...')
                                    : (lang === 'vi' ? 'Tạo lại' : 'Re-create')}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (templateDropdownTrendId === trend.id && templateDropdownForce) {
                                    setTemplateDropdownTrendId(null);
                                  } else {
                                    setTemplateDropdownTrendId(trend.id);
                                    setTemplateDropdownForce(true);
                                  }
                                }}
                                disabled={generatingVideoId === trend.id}
                                className="h-8 px-1.5 inline-flex items-center justify-center text-amber-700 dark:text-amber-300 hover:bg-amber-100/80 dark:hover:bg-amber-900/50 transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                                title={lang === 'vi' ? 'Chọn mẫu giao diện cụ thể hoặc xem trước slide' : 'Select template or preview slides'}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Dropdown Menu Template */}
                            {templateDropdownTrendId === trend.id && templateDropdownForce && (
                              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTemplateDropdownTrendId(null);
                                    setPreviewSlideTrend(trend);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition flex items-center gap-1.5 mb-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <span>{lang === 'vi' ? 'Xem trước nội dung Slide...' : 'Preview Slide Content...'}</span>
                                </button>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  {lang === 'vi' ? 'Chọn mẫu tạo lại' : 'Select Template'}
                                </div>
                                {VIDEO_TEMPLATE_CHOICES.map((choice) => (
                                  <button
                                    key={choice.id}
                                    type="button"
                                    onClick={() => {
                                      setTemplateDropdownTrendId(null);
                                      onGenerateVideo(trend.id, true, choice.id);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition group flex flex-col"
                                  >
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                      {choice.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{choice.desc}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 relative">
                            {/* Nút Xem trước Slide kịch bản */}
                            <button
                              type="button"
                              onClick={() => setPreviewSlideTrend(trend)}
                              className="btn btn-md sm:btn-sm btn-secondary justify-center font-semibold text-xs shadow-xs text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                              title={lang === 'vi' ? 'Xem trước & chỉnh sửa kịch bản Slide trước khi tạo video' : 'Preview & edit slide script before generating video'}
                            >
                              <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span className="hidden xl:inline">{lang === 'vi' ? 'Xem Slide' : 'Slides'}</span>
                            </button>

                            <div className="inline-flex items-stretch rounded-lg border border-purple-300 dark:border-purple-700/80 bg-purple-50/70 dark:bg-purple-950/40 shadow-xs overflow-hidden shrink-0">
                              <button
                                type="button"
                                onClick={() => onGenerateVideo(trend.id)}
                                disabled={generatingVideoId === trend.id}
                                className="h-8 px-2.5 inline-flex items-center justify-center gap-1.5 font-semibold text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/50 transition cursor-pointer border-r border-purple-300 dark:border-purple-700/80 disabled:opacity-50 active:scale-[0.98]"
                                title={lang === 'vi' ? 'Tạo video ngắn 9:16 (15-30s) từ xu hướng này' : 'Create 9:16 short video'}
                              >
                                <Film className={`w-3.5 h-3.5 ${generatingVideoId === trend.id ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">
                                  {generatingVideoId === trend.id
                                    ? (lang === 'vi' ? 'Đang tạo...' : 'Creating...')
                                    : (lang === 'vi' ? 'Tạo Video' : 'Create Video')}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (templateDropdownTrendId === trend.id && !templateDropdownForce) {
                                    setTemplateDropdownTrendId(null);
                                  } else {
                                    setTemplateDropdownTrendId(trend.id);
                                    setTemplateDropdownForce(false);
                                  }
                                }}
                                disabled={generatingVideoId === trend.id}
                                className="h-8 px-1.5 inline-flex items-center justify-center text-purple-700 dark:text-purple-300 hover:bg-purple-100/80 dark:hover:bg-purple-900/50 transition cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                                title={lang === 'vi' ? 'Chọn mẫu video cụ thể hoặc xem trước slide' : 'Select template or preview slides'}
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Dropdown Menu Template */}
                            {templateDropdownTrendId === trend.id && !templateDropdownForce && (
                              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-30 p-1.5 animate-in fade-in duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTemplateDropdownTrendId(null);
                                    setPreviewSlideTrend(trend);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold hover:bg-purple-100 dark:hover:bg-purple-900/40 transition flex items-center gap-1.5 mb-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <span>{lang === 'vi' ? 'Xem trước nội dung Slide...' : 'Preview Slide Content...'}</span>
                                </button>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  {lang === 'vi' ? 'Chọn mẫu giao diện' : 'Select Template'}
                                </div>
                                {VIDEO_TEMPLATE_CHOICES.map((choice) => (
                                  <button
                                    key={choice.id}
                                    type="button"
                                    onClick={() => {
                                      setTemplateDropdownTrendId(null);
                                      onGenerateVideo(trend.id, false, choice.id);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition group flex flex-col"
                                  >
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                                      {choice.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{choice.desc}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      )}

                      {/* Delete Trend Button */}
                      {onDeleteTrend && (
                        confirmDeleteId === trend.id ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setIsDeletingId(trend.id);
                                try {
                                  await onDeleteTrend(trend.id);
                                } finally {
                                  setIsDeletingId(null);
                                  setConfirmDeleteId(null);
                                }
                              }}
                              disabled={isDeletingId === trend.id}
                              className="btn btn-sm btn-danger px-2 text-[11px] h-9 sm:h-8"
                            >
                              {isDeletingId === trend.id ? '...' : (t('btn_delete') || 'Xóa')}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(null);
                              }}
                              className="btn btn-sm btn-secondary px-2 text-[11px] h-9 sm:h-8"
                            >
                              {t('btn_cancel') || 'Hủy'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(trend.id);
                            }}
                            className="h-9 w-9 sm:h-8 sm:w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                            title={lang === 'vi' ? 'Xóa bản ghi xu hướng này' : 'Delete this trend'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer: Full news source articles with snippets */}
                {isExpanded && validArticles.length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{lang === 'vi' ? 'Bài báo nguồn đã kiểm chứng cho xu hướng:' : 'Verified news source articles:'}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {validArticles.map((art, aIdx) => (
                        <a
                          key={aIdx}
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition block group active:scale-[0.99]"
                        >
                          <div className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 line-clamp-2 sm:line-clamp-1 leading-snug">
                            {art.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                            <span className="font-medium text-slate-600 dark:text-slate-400">{art.source}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {art.content && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium">
                                  ✓ {lang === 'vi' ? 'Đã đọc' : 'Parsed'}
                                </span>
                              )}
                              <span className="text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-0.5">
                                Đọc báo <ExternalLink className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 15, 25, 50]}
          />
        </div>
      )}

      {/* Modal View bài viết của xu hướng */}
      <TrendPostModal
        isOpen={!!viewingTrend}
        onClose={() => setViewingTrend(null)}
        trend={viewingTrend}
        post={viewingTrend ? findPostForTrend(viewingTrend) : null}
        onGenerate={onGenerate}
        onRetryAndPublish={onRetryAndPublish}
        onPublishPost={onPublishPost}
        onNavigateToPostsTab={onNavigateToPostsTab}
        onDeleteTrend={onDeleteTrend}
        isGenerating={!!generatingId && viewingTrend?.id === generatingId}
        isPublishing={!!publishingId && (findPostForTrend(viewingTrend!)?.id === publishingId)}
      />

      {/* Modal Xem Video Dọc 9:16 */}
      {playingVideoPath && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPlayingVideoPath(null)}
        >
          <div
            className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full pb-3 border-b border-slate-800 text-sm font-bold text-white">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-purple-400" />
                <span>Bản tin video 9:16</span>
              </div>
              <button
                type="button"
                onClick={() => setPlayingVideoPath(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 w-full aspect-[9/16] max-h-[68vh] rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-800">
              <video
                controls
                autoPlay
                src={`/api/videos/${encodeURIComponent(playingVideoPath.split('/').pop() || '')}`}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-400 gap-2">
              <button
                type="button"
                onClick={() => {
                  const currentTrend = trends.find((t) => t.video_path === playingVideoPath);
                  if (currentTrend && onGenerateVideo) {
                    setPlayingVideoPath(null);
                    onGenerateVideo(currentTrend.id, true);
                  }
                }}
                className="text-amber-400 hover:text-amber-300 hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                title="Tạo lại video mới cho xu hướng này"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Tạo lại video này' : 'Re-create video'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlayingVideoPath(null);
                  if (onNavigateToPostsTab) onNavigateToPostsTab();
                }}
                className="text-purple-400 hover:text-purple-300 hover:underline font-semibold cursor-pointer"
              >
                {lang === 'vi' ? 'Xem trong tab Reels ↗' : 'View in Reels tab ↗'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cấu hình Tạo Video Hàng Loạt */}
      {showBatchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowBatchModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {lang === 'vi' ? 'Tạo Video Hàng Loạt' : 'Batch Create Videos'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {lang === 'vi'
                      ? `Hiện có ${trends.filter((t) => !t.video_generated || !t.video_path).length} xu hướng chưa có video`
                      : `${trends.filter((t) => !t.video_generated || !t.video_path).length} trends without video`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chọn số lượng */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {lang === 'vi' ? 'Số lượng video cần tạo:' : 'Number of videos:'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setBatchLimit(num)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      batchLimit === num
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {num} {lang === 'vi' ? 'video' : 'videos'}
                  </button>
                ))}
              </div>
            </div>

            {/* Chọn Mẫu Video */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {lang === 'vi' ? 'Mẫu giao diện video:' : 'Template style:'}
              </label>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {VIDEO_TEMPLATE_CHOICES.map((choice) => (
                  <div
                    key={choice.id}
                    onClick={() => setBatchTemplate(choice.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      batchTemplate === choice.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-slate-900 dark:text-white'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>{choice.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{choice.desc}</div>
                    </div>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        batchTemplate === choice.id
                          ? 'border-purple-600 bg-purple-600 text-white'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {batchTemplate === choice.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {lang === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowBatchModal(false);
                  if (onBatchGenerateVideos) {
                    onBatchGenerateVideos(batchTemplate, batchLimit);
                  }
                }}
                disabled={isBatchGeneratingVideos}
                className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 border-purple-500 text-white flex items-center gap-1.5"
              >
                <Film className="w-3.5 h-3.5" />
                <span>{lang === 'vi' ? 'Bắt đầu tạo ngay' : 'Start Batch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slide Preview Modal */}
      {previewSlideTrend && (
        <SlidePreviewModal
          isOpen={!!previewSlideTrend}
          onClose={() => setPreviewSlideTrend(null)}
          trend={previewSlideTrend}
          onRenderVideo={onGenerateVideo || (async () => {})}
          isRendering={generatingVideoId === previewSlideTrend?.id}
        />
      )}
    </div>
  );
}
