'use client';

import React, { useState } from 'react';
import { TrendItem } from '@/types';
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
} from 'lucide-react';
import { useI18n } from '@/context/I18nThemeContext';

interface TrendsTabProps {
  trends: TrendItem[];
  onCrawl: (geo: string) => Promise<void>;
  onGenerate: (trendId: string) => Promise<void>;
  onFindSources?: (trendId: string) => Promise<void>;
  isCrawling: boolean;
  generatingId: string | null;
}

export default function TrendsTab({
  trends,
  onCrawl,
  onGenerate,
  onFindSources,
  isCrawling,
  generatingId,
}: TrendsTabProps) {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState('');
  const [selectedGeo, setSelectedGeo] = useState('VN');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'drafted' | 'unprocessed'>('all');
  const [expandedTrendIds, setExpandedTrendIds] = useState<Record<string, boolean>>({});
  const [searchingSourceId, setSearchingSourceId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedTrendIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter trends by selected country
  const geoTrends = selectedGeo === 'all' ? trends : trends.filter((tr) => tr.geo === selectedGeo);

  // Filter trends by status
  const statusFilteredTrends = geoTrends.filter((tr) => {
    if (statusFilter === 'published') return tr.status === 'published';
    if (statusFilter === 'drafted') return tr.status === 'drafted';
    if (statusFilter === 'unprocessed') return !tr.status || tr.status === 'discovered';
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

  // Handle switching country
  const handleGeoChange = async (newGeo: string) => {
    setSelectedGeo(newGeo);
    if (newGeo !== 'all') {
      const exists = trends.some((tr) => tr.geo === newGeo);
      if (!exists) {
        await onCrawl(newGeo);
      }
    }
  };

  const publishedCount = geoTrends.filter((t) => t.status === 'published').length;
  const draftedCount = geoTrends.filter((t) => t.status === 'drafted').length;
  const unprocessedCount = geoTrends.filter((t) => !t.status || t.status === 'discovered').length;

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search_trends_placeholder')}
            className="w-full h-9.5 sm:h-9 pl-9 pr-3 app-input rounded-lg text-xs placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Right: Country Select & Crawl Button */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedGeo}
            onChange={(e) => handleGeoChange(e.target.value)}
            className="flex-1 md:flex-initial app-input h-9.5 sm:h-9 text-xs font-semibold rounded-lg px-2.5 sm:px-3 focus:outline-hidden focus:border-indigo-500 cursor-pointer min-w-0"
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
            disabled={isCrawling}
            className="btn btn-md btn-emerald flex-1 md:flex-initial justify-center shrink-0 h-9.5 sm:h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
            <span className="whitespace-nowrap">{isCrawling ? t('crawling') : t('crawl_btn')}</span>
          </button>
        </div>
      </div>

      {/* Quick Status Sub-filters (Smooth Mobile Touch Scroll) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-1 px-1 touch-pan-x text-xs">
        <button
          onClick={() => setStatusFilter('all')}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'all'
              ? 'btn-secondary font-bold ring-1 ring-slate-400/40 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Tất cả' : 'All'} ({geoTrends.length})
        </button>

        <button
          onClick={() => setStatusFilter('unprocessed')}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'unprocessed'
              ? 'btn-secondary font-bold ring-1 ring-slate-400/40 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Chưa tạo bài' : 'New'} ({unprocessedCount})
        </button>

        <button
          onClick={() => setStatusFilter('drafted')}
          className={`btn btn-sm shrink-0 ${
            statusFilter === 'drafted'
              ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-300 dark:border-cyan-800 shadow-xs'
              : 'btn-ghost text-slate-500'
          }`}
        >
          {lang === 'vi' ? 'Bản thảo sẵn' : 'Drafted'} ({draftedCount})
        </button>

        <button
          onClick={() => setStatusFilter('published')}
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
        <div className="rounded-xl app-card divide-y divide-[var(--app-border)] overflow-hidden shadow-xs">
          {filteredTrends.map((trend, index) => {
            const isGenerating = generatingId === trend.id;
            const isSearchingSource = searchingSourceId === trend.id;
            const validArticles = (trend.articles || []).filter((a) => a.url && !a.url.includes('google.com'));
            const hasSourceLinks = validArticles.length > 0;
            const isExpanded = !!expandedTrendIds[trend.id];

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
                      <div className="text-[10px] font-mono text-slate-400 font-semibold leading-none">#{index + 1}</div>
                      <div className="text-[11px] sm:text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono tracking-tight leading-none mt-1">
                        {trend.approx_traffic || '10K+'}
                      </div>
                    </div>

                    {/* Title & Tags */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                        <span className="font-bold text-sm sm:text-base text-inherit capitalize leading-snug">
                          {trend.title}
                        </span>

                        {/* Status badge */}
                        {trend.status === 'published' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                            <span>{lang === 'vi' ? 'Đã đăng Fanpage' : 'Published'}</span>
                          </span>
                        )}
                        {trend.status === 'drafted' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800">
                            <FileEdit className="w-2.5 h-2.5 text-cyan-500" />
                            <span>{lang === 'vi' ? 'Bản thảo sẵn' : 'Draft Ready'}</span>
                          </span>
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
                    {trend.status === 'published' ? (
                      <span className="w-full sm:w-auto h-9 sm:h-8 px-3 rounded-lg text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{t('status_published')}</span>
                      </span>
                    ) : hasSourceLinks ? (
                      <button
                        onClick={() => onGenerate(trend.id)}
                        disabled={isGenerating}
                        className="btn btn-md sm:btn-sm btn-primary w-full sm:w-auto justify-center font-semibold text-xs shadow-xs active:scale-[0.98]"
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
                      onFindSources && (
                        <button
                          onClick={async () => {
                            setSearchingSourceId(trend.id);
                            try {
                              await onFindSources(trend.id);
                            } finally {
                              setSearchingSourceId(null);
                            }
                          }}
                          disabled={isSearchingSource}
                          className="btn btn-md sm:btn-sm btn-secondary w-full sm:w-auto justify-center font-semibold text-xs shadow-xs active:scale-[0.98]"
                        >
                          <Search className={`w-3.5 h-3.5 ${isSearchingSource ? 'animate-spin' : ''}`} />
                          <span>{isSearchingSource ? t('searching_sources') : t('find_sources_btn')}</span>
                        </button>
                      )
                    )}
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
                            <span className="text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-0.5 shrink-0">
                              Đọc báo <ExternalLink className="w-2.5 h-2.5" />
                            </span>
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
      )}
    </div>
  );
}
