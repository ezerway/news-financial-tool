'use client';

import React from 'react';
import { Flame, Play, RefreshCw, CheckCircle2, AlertTriangle, Sparkles, LogOut } from 'lucide-react';
import FacebookIcon from './FacebookIcon';

interface HeaderProps {
  fbStatus: { loggedIn: boolean; username?: string; message: string };
  onRunCycle: (dryRun: boolean) => void;
  onRefresh: () => void;
  onConnectFb: () => void;
  isRunning: boolean;
}

export default function Header({
  fbStatus,
  onRunCycle,
  onRefresh,
  onConnectFb,
  isRunning,
}: HeaderProps) {
  const handleLogout = async () => {
    if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?')) {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
      } catch {
        window.location.href = '/login';
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/85 border-b border-slate-800/80 shadow-2xl pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand identity */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          <div className="relative group shrink-0">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                TrendPulse
              </h1>
              <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                PWA • AI
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Facebook Connection Status Button */}
          {(() => {
            let label = 'Kết nối FB';
            if (fbStatus.loggedIn) {
              if (fbStatus.username) {
                if (fbStatus.username.includes('[Fanpage:')) {
                  const match = fbStatus.username.match(/\[Fanpage:\s*([^\]]+)\]/);
                  label = match ? match[1] : 'Fanpage';
                } else {
                  label = fbStatus.username;
                }
              } else {
                label = 'Đã kết nối';
              }
            }
            return (
              <button
                onClick={onConnectFb}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold border backdrop-blur-md transition-all shadow-sm ${
                  fbStatus.loggedIn
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/40'
                    : 'bg-amber-950/40 text-amber-300 border-amber-500/40 hover:bg-amber-900/40'
                }`}
                title={fbStatus.message}
              >
                <div className="relative flex items-center">
                  <FacebookIcon className="w-4 h-4 text-inherit" />
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                      fbStatus.loggedIn ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                    }`}
                  />
                </div>
                <span className="hidden sm:inline max-w-[120px] truncate">{label}</span>
                {fbStatus.loggedIn ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                )}
              </button>
            );
          })()}

          {/* Refresh Data */}
          <button
            onClick={onRefresh}
            disabled={isRunning}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800 shadow-sm transition active:scale-95 disabled:opacity-50"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isRunning ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Dry Run Test */}
          <button
            onClick={() => onRunCycle(true)}
            disabled={isRunning}
            className="flex items-center gap-1.5 p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-amber-300 text-xs font-semibold border border-amber-500/30 shadow-sm transition active:scale-95 disabled:opacity-50"
            title="Chạy thử (Dry Run)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Chạy thử</span>
          </button>

          {/* Run Full Automation Cycle */}
          <button
            onClick={() => onRunCycle(false)}
            disabled={isRunning}
            className="relative group flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isRunning ? 'Chạy...' : 'Chạy tự động'}</span>
            <span className="sm:hidden">{isRunning ? '...' : 'Chạy'}</span>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 hover:bg-rose-950/40 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 border border-slate-800 shadow-sm transition active:scale-95 group"
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
