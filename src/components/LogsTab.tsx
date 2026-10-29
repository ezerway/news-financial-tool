'use client';

import React, { useState } from 'react';
import { ActivityLog } from '@/types';
import { Activity, Trash2, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { formatDateTime } from '@/lib/date';

interface LogsTabProps {
  logs: ActivityLog[];
  onClearLogs: () => Promise<void>;
}

export default function LogsTab({ logs, onClearLogs }: LogsTabProps) {
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
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> SUCCESS
          </span>
        );
      case 'ERROR':
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" /> ERROR
          </span>
        );
      case 'WARN':
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3 text-amber-400" /> WARN
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Info className="w-3 h-3 text-blue-400" /> INFO
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls Bar */}
      {/* Controls Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
          {/* Level Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
            {(['all', 'SUCCESS', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(lvl)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 active:scale-95 ${
                  levelFilter === lvl
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lvl === 'all' ? 'Tất cả' : lvl}
              </button>
            ))}
          </div>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-950/80 border border-slate-800 text-xs font-medium text-slate-200 rounded-xl px-3 py-2 sm:py-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
          >
            <option value="all">Tất cả hành động</option>
            <option value="CRAWL">CRAWL (Cào tin)</option>
            <option value="GENERATE">GENERATE (AI Viết bài)</option>
            <option value="PUBLISH">PUBLISH (Đăng bài)</option>
            <option value="COMMENT">COMMENT (Bình luận nguồn)</option>
            <option value="AUTH">AUTH (Xác thực)</option>
            <option value="AUTO">AUTO (Tự động hóa)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onClearLogs}
          className="self-end sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 text-xs font-semibold transition shrink-0 active:scale-95"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa nhật ký</span>
        </button>
      </div>

      {/* Logs View */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800/80">
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Chưa có nhật ký hoạt động</h3>
          <p className="text-xs text-slate-400 mt-1.5">Các hoạt động cào tin, viết bài AI và tự động đăng sẽ được ghi nhận tại đây.</p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (lg:hidden) */}
          <div className="lg:hidden space-y-2.5">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 shadow-md space-y-2 backdrop-blur-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getLevelBadge(log.level)}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                      {log.action}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0" suppressHydrationWarning>
                    {formatDateTime(log.created_at)}
                  </span>
                </div>
                <div className="text-xs text-slate-200 leading-relaxed font-sans">{log.message}</div>
                {log.details_json && (
                  <pre className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-slate-400 overflow-x-auto font-mono no-scrollbar">
                    {log.details_json}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden lg:block) */}
          <div className="hidden lg:block rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-xl backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/90 text-slate-400 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-5">Thời gian</th>
                    <th className="py-3.5 px-5">Mức độ</th>
                    <th className="py-3.5 px-5">Hành động</th>
                    <th className="py-3.5 px-5">Nội dung chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-5 text-slate-500 whitespace-nowrap text-[11px]" suppressHydrationWarning>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap">{getLevelBadge(log.level)}</td>
                      <td className="py-3.5 px-5 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-slate-200">
                        <div className="font-sans leading-relaxed text-xs">{log.message}</div>
                        {log.details_json && (
                          <pre className="mt-1.5 p-2.5 rounded-xl bg-slate-950/90 border border-slate-800/80 text-[10px] text-slate-400 overflow-x-auto">
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
