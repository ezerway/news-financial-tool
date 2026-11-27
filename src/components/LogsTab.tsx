'use client';

import React, { useState, useMemo } from 'react';
import { ActivityLog } from '@/types';
import { Activity, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info, RefreshCw } from 'lucide-react';
import Pagination from './Pagination';
import { formatDateTime } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';

interface LogsTabProps {
  logs: ActivityLog[];
  onClearLogs: () => Promise<void>;
  limit?: string;
  onLimitChange?: (limit: string) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
}

const ACTION_GROUPS = [
  {
    labelVi: '📰 Báo chí & Bài viết',
    labelEn: '📰 News & Posts',
    actions: [
      { value: 'CRAWL', labelVi: 'Cào tin tức', labelEn: 'Crawl News' },
      { value: 'EXTRACTOR', labelVi: 'Trích xuất bài gốc', labelEn: 'Article Extractor' },
      { value: 'GENERATE', labelVi: 'AI Tạo bài viết', labelEn: 'AI Generate Post' },
      { value: 'REGENERATE_POST', labelVi: 'Tạo lại bài viết', labelEn: 'Regenerate Post' },
      { value: 'PUBLISH', labelVi: 'Đăng bài viết', labelEn: 'Publish Post' },
      { value: 'COMMENT', labelVi: 'Bình luận nguồn', labelEn: 'Comment Source' },
      { value: 'UPDATE_POST_LINK', labelVi: 'Cập nhật link bài', labelEn: 'Update Post Link' },
    ],
  },
  {
    labelVi: '🎬 Video 9:16 & Đa nền tảng',
    labelEn: '🎬 9:16 Video & Platforms',
    actions: [
      { value: 'SLIDE_PREVIEW', labelVi: 'Xem trước Slide', labelEn: 'Slide Preview' },
      { value: 'VIDEO_SCRIPT', labelVi: 'Soạn kịch bản Video', labelEn: 'Video Script' },
      { value: 'VIDEO_RENDER', labelVi: 'Render Video', labelEn: 'Video Render' },
      { value: 'AUTO_VIDEO', labelVi: 'Tự động tạo Video', labelEn: 'Auto Video' },
      { value: 'POST_REEL', labelVi: 'Đăng Facebook Reel', labelEn: 'Post Facebook Reel' },
      { value: 'POST_TIKTOK', labelVi: 'Đăng TikTok', labelEn: 'Post TikTok' },
      { value: 'COMMENT_TIKTOK', labelVi: 'Bình luận TikTok', labelEn: 'Comment TikTok' },
      { value: 'POST_YOUTUBE_SHORTS', labelVi: 'Đăng YouTube Shorts', labelEn: 'Post YouTube Shorts' },
      { value: 'POST_ZALO_VIDEO', labelVi: 'Đăng Zalo Video', labelEn: 'Post Zalo Video' },
      { value: 'UPDATE_REEL_LINK', labelVi: 'Cập nhật link Reel', labelEn: 'Update Reel Link' },
      { value: 'DELETE_REEL', labelVi: 'Xóa Reel', labelEn: 'Delete Reel' },
    ],
  },
  {
    labelVi: '🤖 Trí tuệ nhân tạo (AI Engine)',
    labelEn: '🤖 AI Engine',
    actions: [
      { value: 'OLLAMA', labelVi: 'Ollama AI cục bộ', labelEn: 'Local Ollama AI' },
      { value: 'OLLAMA_FALLBACK', labelVi: 'Ollama Fallback', labelEn: 'Ollama Fallback' },
    ],
  },
  {
    labelVi: '⚙️ Hệ thống & Tự động',
    labelEn: '⚙️ System & Automation',
    actions: [
      { value: 'AUTO', labelVi: 'Auto-Pilot Tự động', labelEn: 'Auto-Pilot Engine' },
      { value: 'AUTH', labelVi: 'Xác thực & Cookies', labelEn: 'Auth & Cookies' },
      { value: 'NOTIFICATION', labelVi: 'Thông báo Telegram', labelEn: 'Telegram Alert' },
      { value: 'BACKUP', labelVi: 'Sao lưu dữ liệu', labelEn: 'Data Backup' },
      { value: 'RETRY', labelVi: 'Thử lại tác vụ', labelEn: 'Task Retry' },
    ],
  },
];

export default function LogsTab({
  logs,
  onClearLogs,
  limit = '200',
  onLimitChange,
  onRefresh,
  isLoading = false,
}: LogsTabProps) {
  const { t, lang } = useI18n();
  const [levelFilter, setLevelFilter] = useState<'all' | 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR'>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const knownActionSet = useMemo(() => {
    const set = new Set<string>();
    ACTION_GROUPS.forEach((g) => g.actions.forEach((a) => set.add(a.value)));
    return set;
  }, []);

  const otherActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action && !knownActionSet.has(l.action)) {
        set.add(l.action);
      }
    });
    return Array.from(set).sort();
  }, [logs, knownActionSet]);

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = levelFilter === 'all' || l.level === levelFilter;
    const matchesAction = actionFilter === 'all' || l.action === actionFilter;
    return matchesLevel && matchesAction;
  });

  const totalItems = filteredLogs.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>SUCCESS</span>
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25 whitespace-nowrap">
            <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>ERROR</span>
          </span>
        );
      case 'WARN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 whitespace-nowrap">
            <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>WARN</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25 whitespace-nowrap">
            <Info className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>INFO</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 backdrop-blur-md shadow-sm dark:shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0 flex-wrap">
          {/* Level Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            {(['all', 'SUCCESS', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => {
                  setLevelFilter(lvl);
                  setCurrentPage(1);
                }}
                className={`btn btn-sm ${
                  levelFilter === lvl
                    ? 'btn-primary'
                    : 'btn-ghost text-slate-500'
                }`}
              >
                {lvl === 'all' ? t('log_level_all') : lvl}
              </button>
            ))}
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="app-input h-8 text-xs font-semibold rounded-lg px-2.5 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">{t('log_action_all')}</option>
            {ACTION_GROUPS.map((group) => (
              <optgroup
                key={group.labelEn}
                label={lang === 'vi' ? group.labelVi : group.labelEn}
              >
                {group.actions.map((act) => (
                  <option key={act.value} value={act.value}>
                    {act.value} ({lang === 'vi' ? act.labelVi : act.labelEn})
                  </option>
                ))}
              </optgroup>
            ))}
            {otherActions.length > 0 && (
              <optgroup label={lang === 'vi' ? '⚡ Khác' : '⚡ Other'}>
                {otherActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          {/* Limit Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {lang === 'vi' ? 'Số lượng nạp:' : 'Fetch limit:'}
            </span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange?.(e.target.value);
                setCurrentPage(1);
              }}
              className="app-input h-8 text-xs font-semibold rounded-lg px-2.5 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
              <option value="all">{lang === 'vi' ? 'Tất cả' : 'All'}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {lang === 'vi' ? `${filteredLogs.length} / ${logs.length} bản ghi` : `${filteredLogs.length} / ${logs.length} items`}
          </span>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              title={lang === 'vi' ? 'Làm mới nhật ký' : 'Refresh logs'}
              className="btn btn-sm btn-secondary shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={onClearLogs}
            className="btn btn-sm btn-secondary hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-900 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('btn_clear_logs')}</span>
          </button>
        </div>
      </div>

      {/* Logs View */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{t('no_logs_title')}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t('no_logs_desc')}</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (lg:hidden) */}
          <div className="lg:hidden space-y-2.5">
            {paginatedLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-md space-y-2 backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getLevelBadge(log.level)}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {log.action}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0" suppressHydrationWarning>
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans break-all">{log.message}</div>
                {log.details_json && (
                  <pre className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] text-slate-700 dark:text-slate-400 overflow-x-auto font-mono no-scrollbar">
                    {log.details_json}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden lg:block) */}
          <div className="hidden lg:block rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/80 overflow-hidden shadow-sm dark:shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950/90 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">{lang === 'vi' ? 'Thời gian' : 'Time'}</th>
                    <th className="py-3.5 px-5">{lang === 'vi' ? 'Mức độ' : 'Level'}</th>
                    <th className="py-3.5 px-5">{lang === 'vi' ? 'Hành động' : 'Action'}</th>
                    <th className="py-3.5 px-5">{lang === 'vi' ? 'Nội dung chi tiết' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap text-[11px]" suppressHydrationWarning>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">{getLevelBadge(log.level)}</td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-800 dark:text-slate-200">
                        <div className="font-sans leading-relaxed text-xs break-all">{log.message}</div>
                        {log.details_json && (
                          <pre className="mt-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800/80 text-[10px] text-slate-700 dark:text-slate-400 overflow-x-auto">
                            {log.details_json}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[15, 25, 50, 100]}
          />
        </>
      )}
    </div>
  );
}
