'use client';

import React, { useState } from 'react';
import {
  Flame,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  LogOut,
  Loader2,
  ChevronDown,
  Check,
  Sun,
  Moon,
  Globe,
  Radio,
  TrendingUp,
  FileText,
  Activity,
  Settings,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import { useI18n } from '@/context/I18nThemeContext';

export interface HeaderProps {
  fbStatus: { loggedIn: boolean; username?: string; message: string };
  onRunCycle: (dryRun: boolean) => void;
  onRefresh: () => void;
  onConnectFb: () => void;
  isRunning: boolean;
  autoRefreshInterval: number;
  onChangeAutoRefresh: (seconds: number) => void;
  secondsUntilRefresh: number;
  activeTab: 'overview' | 'trends' | 'posts' | 'logs' | 'settings';
  onSelectTab: (tab: 'overview' | 'trends' | 'posts' | 'logs' | 'settings') => void;
  tabCounts?: { trends?: number; posts?: number; logs?: number };
}

export default function Header({
  fbStatus,
  onRunCycle,
  onRefresh,
  onConnectFb,
  isRunning,
  autoRefreshInterval,
  onChangeAutoRefresh,
  secondsUntilRefresh,
  activeTab,
  onSelectTab,
  tabCounts,
}: HeaderProps) {
  const { t, lang, toggleLang, theme, toggleTheme } = useI18n();
  const [isRefreshMenuOpen, setIsRefreshMenuOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const executeLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Continue navigation even if network error occurs
    }
    // Navigate with ?logout=1 to force proxy and browser to clear session and prevent redirect bounce
    window.location.href = '/login?logout=1';
  };

  const refreshOptions = [
    { label: t('refresh_off'), value: 0 },
    { label: t('refresh_15s'), value: 15 },
    { label: t('refresh_30s'), value: 30 },
    { label: t('refresh_60s'), value: 60 },
    { label: t('refresh_120s'), value: 120 },
  ];

  let fbLabel = t('connect_fb');
  if (fbStatus.loggedIn) {
    if (fbStatus.username) {
      if (fbStatus.username.includes('[Fanpage:')) {
        const match = fbStatus.username.match(/\[Fanpage:\s*([^\]]+)\]/);
        fbLabel = match ? match[1] : 'Fanpage';
      } else {
        fbLabel = fbStatus.username;
      }
    } else {
      fbLabel = t('connected');
    }
  }

  const tabs: Array<{
    id: 'overview' | 'trends' | 'posts' | 'logs' | 'settings';
    label: string;
    icon: any;
    count?: number;
  }> = [
    { id: 'overview', label: t('tab_overview'), icon: Sparkles },
    { id: 'trends', label: t('tab_trends'), icon: TrendingUp, count: tabCounts?.trends },
    { id: 'posts', label: t('tab_posts'), icon: FileText, count: tabCounts?.posts },
    { id: 'logs', label: t('tab_logs'), icon: Activity, count: tabCounts?.logs },
    { id: 'settings', label: t('tab_settings'), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 app-card border-t-0 border-x-0 backdrop-blur-xl shadow-xs transition-colors duration-150">
      {/* Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-14 sm:h-16 flex items-center justify-between gap-3">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight select-none brand-title">
                {t('app_name')}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded app-tag">
                <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse" />
                FinTech AI
              </span>
            </div>
          </div>


          {/* Center: Facebook Status Pill */}
          <div className="hidden lg:flex items-center">
            <button
              onClick={onConnectFb}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                fbStatus.loggedIn
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50'
              }`}
              title={fbStatus.message}
            >
              <FacebookIcon className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="max-w-[140px] truncate">{fbLabel}</span>
              {fbStatus.loggedIn ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
            </button>
          </div>

          {/* Right: Controls & Actions */}
          <div className="flex items-center gap-2">
            {/* Mobile FB button */}
            <button
              onClick={onConnectFb}
              className="lg:hidden h-8 w-8 flex items-center justify-center rounded-lg app-tag relative"
              title={fbStatus.message}
            >
              <FacebookIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span
                className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${
                  fbStatus.loggedIn ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
            </button>

            {/* Refresh & Auto-Refresh dropdown */}
            <div className="relative">
              <div className="h-8 flex items-center rounded-lg app-tag overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRunning}
                  className="h-full px-2.5 flex items-center text-inherit hover:opacity-80 transition disabled:opacity-50"
                  title={t('refresh_now')}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-indigo-500' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setIsRefreshMenuOpen(!isRefreshMenuOpen)}
                  className="hidden sm:flex h-full items-center gap-1 px-2 border-l border-[var(--app-border)] hover:opacity-80 transition font-mono text-[11px]"
                  title={t('auto_refresh')}
                >
                  {autoRefreshInterval > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <span>{secondsUntilRefresh}s</span>
                    </span>
                  ) : (
                    <span>Off</span>
                  )}
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>

              {/* Interval Popover Menu */}
              {isRefreshMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsRefreshMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl app-card shadow-xl p-1 text-xs">
                    <div className="px-2.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-[var(--app-border)] mb-1">
                      {t('auto_refresh')}
                    </div>
                    {refreshOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          onChangeAutoRefresh(opt.value);
                          setIsRefreshMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition ${
                          autoRefreshInterval === opt.value
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold'
                            : 'text-inherit hover:opacity-80'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {autoRefreshInterval === opt.value && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-8 w-8 rounded-lg app-tag inline-flex items-center justify-center transition-colors hover:border-slate-400"
              title={theme === 'dark' ? t('theme_light') : t('theme_dark')}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-500" />
              )}
            </button>

            {/* Language Toggle */}
            <button
              type="button"
              onClick={toggleLang}
              className="h-8 px-2.5 rounded-lg app-tag text-xs font-semibold inline-flex items-center gap-1.5 transition-colors hover:border-slate-400"
              title={t('lang_switch')}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>{lang === 'vi' ? 'VI' : 'EN'}</span>
            </button>

            {/* Logout */}
            <button
              type="button"
              onClick={() => setShowLogoutModal(true)}
              disabled={isLoggingOut}
              className="h-8 w-8 rounded-lg app-tag shrink-0 inline-flex items-center justify-center hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900 transition-colors disabled:opacity-50"
              title={t('logout')}
              aria-label={t('logout')}
            >
              {isLoggingOut ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Integrated Desktop Tab Navigation (Linear / Vercel style) */}
      <div className="hidden md:block border-t border-[var(--app-border)] bg-[var(--app-bg)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1 -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onSelectTab(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition-colors duration-150 ${
                    isActive
                      ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'opacity-60'}`} />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-full ${
                        isActive
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                          : 'app-tag'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Custom Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="w-full max-w-sm rounded-2xl app-card shadow-2xl p-5 border border-[var(--app-border)] space-y-4 animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('logout')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {t('logout_confirm')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--app-border)]">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-3.5 py-1.5 rounded-lg app-tag text-xs font-semibold hover:opacity-80 transition disabled:opacity-50"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={executeLogout}
                disabled={isLoggingOut}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {isLoggingOut ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('logging_out')}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('logout')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

