'use client';

import React, { useState } from 'react';
import { ActivityLog } from '@/types';
import { Activity, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { formatDateTime } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';
interface LogsTabProps {
  logs: ActivityLog[];
  onClearLogs: () => Promise<void>;
}

export default function LogsTab({ logs, onClearLogs }: LogsTabProps) {
  const { t, lang } = useI18n();
  const [levelFilter, setLevelFilter] = useState<'all' | 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR'>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = logs.filter((l) => {
    const matchesLevel = levelFilter === 'all' || l.level === levelFilter;
    const matchesAction = actionFilter === 'all' || l.action === actionFilter;
    return matchesLevel && matchesAction;
  });

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
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          {/* Level Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            {(['all', 'SUCCESS', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
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
            onChange={(e) => setActionFilter(e.target.value)}
            className="app-input h-8 text-xs font-semibold rounded-lg px-2.5 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">{t('log_action_all')}</option>
            <option value="CRAWL">CRAWL ({lang === 'vi' ? 'Cào tin' : 'Crawl'})</option>
            <option value="GENERATE">GENERATE ({lang === 'vi' ? 'AI Viết bài' : 'AI Write'})</option>
            <option value="PUBLISH">PUBLISH ({lang === 'vi' ? 'Đăng bài' : 'Publish'})</option>
            <option value="COMMENT">COMMENT ({lang === 'vi' ? 'Bình luận nguồn' : 'Comment'})</option>
            <option value="AUTH">AUTH ({lang === 'vi' ? 'Xác thực' : 'Auth'})</option>
            <option value="AUTO">AUTO ({lang === 'vi' ? 'Tự động hóa' : 'Automation'})</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onClearLogs}
          className="btn btn-sm btn-secondary hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-900 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t('btn_clear_logs')}</span>
        </button>
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
            {filteredLogs.map((log) => (
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
                <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-sans">{log.message}</div>
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
                  {filteredLogs.map((log) => (
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
                        <div className="font-sans leading-relaxed text-xs">{log.message}</div>
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
        </>
      )}
    </div>
  );
}
