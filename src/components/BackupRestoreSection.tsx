'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  Download,
  Upload,
  HardDrive,
  RefreshCw,
  FolderArchive,
  FileJson,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import { useI18n } from '@/context/I18nThemeContext';

interface BackupStats {
  db: {
    exists: boolean;
    sizeBytes: number;
    sizeFormatted: string;
    trendsCount: number;
    postsCount: number;
    logsCount: number;
    settingsCount: number;
  };
  profile: {
    sessionExists: boolean;
    sessionSizeBytes: number;
    sessionSizeFormatted: string;
    profileDirExists: boolean;
    cUser?: string;
    fbStatus: {
      loggedIn: boolean;
      username?: string;
      message: string;
    };
  };
}

interface BackupRestoreSectionProps {
  onRefreshData?: () => Promise<void>;
}

export default function BackupRestoreSection({ onRefreshData }: BackupRestoreSectionProps) {
  const { lang } = useI18n();
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Confirmation modal state for overwriting DB
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: 'db' | 'profile' | 'full';
    file: File | null;
    title: string;
    message: string;
  } | null>(null);

  const dbInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const fullInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch('/api/backup/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err: unknown) {
      console.error('Failed to load backup stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch('/api/backup/stats')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success) {
          setStats(data.stats);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load backup stats:', err);
      })
      .finally(() => {
        if (active) setIsLoadingStats(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Trigger file download helper
  const triggerDownload = (url: string, filename?: string) => {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export handlers
  const handleExportDb = async (format: 'sqlite' | 'json') => {
    setIsExporting(`db-${format}`);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = `/api/backup/db?format=${format}`;
      const filename = format === 'json' ? `trendpulse_db_${dateStr}.json` : `trendpulse_db_${dateStr}.db`;
      triggerDownload(url, filename);
      showToast(
        lang === 'vi'
          ? `Đang tải xuống bản sao lưu cơ sở dữ liệu (${format.toUpperCase()})...`
          : `Downloading database backup (${format.toUpperCase()})...`,
        'info'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(lang === 'vi' ? `Lỗi xuất DB: ${msg}` : `DB export error: ${msg}`, 'error');
    } finally {
      setTimeout(() => setIsExporting(null), 1000);
    }
  };

  const handleExportProfile = async (type: 'session' | 'zip') => {
    setIsExporting(`profile-${type}`);
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = `/api/backup/profile?type=${type}`;
      const filename = type === 'session' ? 'fb-session.json' : `fb_profile_${dateStr}.zip`;
      triggerDownload(url, filename);
      showToast(
        type === 'session'
          ? (lang === 'vi' ? 'Đang tải file fb-session.json...' : 'Downloading fb-session.json...')
          : (lang === 'vi' ? 'Đang tải gói sao lưu profile trình duyệt (.zip)...' : 'Downloading browser profile backup (.zip)...'),
        'info'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(lang === 'vi' ? `Lỗi xuất profile: ${msg}` : `Profile export error: ${msg}`, 'error');
    } finally {
      setTimeout(() => setIsExporting(null), 1000);
    }
  };

  const handleExportFull = async () => {
    setIsExporting('full');
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const url = '/api/backup/full';
      triggerDownload(url, `trendpulse_full_backup_${dateStr}.zip`);
      showToast(
        lang === 'vi'
          ? 'Đang tải gói sao lưu toàn bộ hệ thống (DB + Profile)...'
          : 'Downloading full system backup (DB + Profile)...',
        'info'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(lang === 'vi' ? `Lỗi xuất sao lưu: ${msg}` : `Backup export error: ${msg}`, 'error');
    } finally {
      setTimeout(() => setIsExporting(null), 1000);
    }
  };

  // Import selection handlers
  const handleDbFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show confirmation modal
    setConfirmModal({
      open: true,
      type: 'db',
      file,
      title: lang === 'vi' ? 'Xác nhận nạp cơ sở dữ liệu mới' : 'Confirm Import Database',
      message:
        lang === 'vi'
          ? `Bạn đang chuẩn bị nạp tập tin "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Cơ sở dữ liệu hiện tại sẽ được cập nhật. Hệ thống sẽ tự động sao lưu bản cũ vào app.db.bak trước khi thực hiện. Bạn có muốn tiếp tục?`
          : `You are about to import "${file.name}" (${(file.size / 1024).toFixed(1)} KB). The existing database will be replaced. The system will automatically backup current DB to app.db.bak first. Do you want to continue?`,
    });
    e.target.value = '';
  };

  const handleProfileFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmModal({
      open: true,
      type: 'profile',
      file,
      title: lang === 'vi' ? 'Xác nhận nạp Facebook Profile / Session' : 'Confirm Import Facebook Profile / Session',
      message:
        lang === 'vi'
          ? `Bạn đang chuẩn bị nạp tập tin "${file.name}". Phiên đăng nhập Facebook hiện tại sẽ được thay thế bằng dữ liệu trong tập tin này. Bạn có muốn tiếp tục?`
          : `You are about to import "${file.name}". Current Facebook session will be replaced by the data in this file. Do you want to continue?`,
    });
    e.target.value = '';
  };

  const handleFullFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmModal({
      open: true,
      type: 'full',
      file,
      title: lang === 'vi' ? 'Xác nhận khôi phục toàn bộ hệ thống' : 'Confirm Full System Restore',
      message:
        lang === 'vi'
          ? `Bạn đang chuẩn bị khôi phục toàn bộ dữ liệu từ "${file.name}". Toàn bộ cơ sở dữ liệu và phiên Facebook sẽ được khôi phục. Bạn có chắc chắn muốn tiếp tục?`
          : `You are about to restore all data from "${file.name}". All database records and Facebook session will be restored. Are you sure you want to proceed?`,
    });
    e.target.value = '';
  };

  // Perform upload after confirmation
  const executeImport = async () => {
    if (!confirmModal || !confirmModal.file) return;
    const { type, file } = confirmModal;
    setConfirmModal(null);

    setIsImporting(type);
    showToast(
      lang === 'vi' ? `Đang tải lên và xử lý ${file.name}...` : `Uploading and processing ${file.name}...`,
      'info'
    );

    const formData = new FormData();
    formData.append('file', file);

    let endpoint = '/api/backup/db';
    if (type === 'profile') endpoint = '/api/backup/profile';
    if (type === 'full') endpoint = '/api/backup/full';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          data.message || (lang === 'vi' ? 'Khôi phục thành công!' : 'Restored successfully!'),
          'success'
        );
        await fetchStats();
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        showToast(
          lang === 'vi' ? `Lỗi khôi phục: ${data.error}` : `Restore error: ${data.error}`,
          'error'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(lang === 'vi' ? `Lỗi kết nối: ${msg}` : `Connection error: ${msg}`, 'error');
    } finally {
      setIsImporting(null);
    }
  };

  return (
    <div className="app-card p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-app-border">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shadow-sm shrink-0">
            <HardDrive className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{lang === 'vi' ? 'Sao lưu & Khôi phục' : 'Backup & Restore'}</span>
              <span className="app-tag text-[10px] font-bold px-2 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shrink-0 whitespace-nowrap">
                Backup
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              {lang === 'vi'
                ? 'Xuất nhập SQLite, Facebook Profile và sao lưu hệ thống.'
                : 'Export/import SQLite database, Facebook Profile and full backups.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={isLoadingStats}
          className="btn btn-sm btn-secondary self-start sm:self-auto shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin text-indigo-500' : ''}`} />
          <span>{lang === 'vi' ? 'Làm mới' : 'Refresh'}</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : toast.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={dbInputRef}
        onChange={handleDbFileSelected}
        accept=".db,.sqlite,.json"
        className="hidden"
      />
      <input
        type="file"
        ref={profileInputRef}
        onChange={handleProfileFileSelected}
        accept=".json,.zip"
        className="hidden"
      />
      <input
        type="file"
        ref={fullInputRef}
        onChange={handleFullFileSelected}
        accept=".zip"
        className="hidden"
      />

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1: Database (SQLite & JSON) */}
        <div className="app-subcard p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-app-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {lang === 'vi' ? 'Cơ sở dữ liệu (Database)' : 'Database (SQLite & JSON)'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {lang === 'vi' ? 'SQLite app.db • Bài viết, xu hướng & nhật ký' : 'SQLite app.db • Posts, trends & logs'}
                  </p>
                </div>
              </div>
              <span className="app-tag text-[11px] font-mono font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap">
                {stats?.db.sizeFormatted || '...'}
              </span>
            </div>

            {/* DB Metrics Pills */}
            <div className="grid grid-cols-3 gap-2 my-3.5 text-center">
              <div className="app-card p-2.5 rounded-xl shadow-xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {lang === 'vi' ? 'Bài viết' : 'Posts'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats?.db.postsCount ?? 0}
                </div>
              </div>
              <div className="app-card p-2.5 rounded-xl shadow-xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {lang === 'vi' ? 'Xu hướng' : 'Trends'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats?.db.trendsCount ?? 0}
                </div>
              </div>
              <div className="app-card p-2.5 rounded-xl shadow-xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {lang === 'vi' ? 'Nhật ký' : 'Logs'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats?.db.logsCount ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 border-t border-app-border">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleExportDb('sqlite')}
                disabled={isExporting !== null}
                className="btn btn-sm btn-secondary w-full"
              >
                {isExporting === 'db-sqlite' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-indigo-500" />
                )}
                <span>{lang === 'vi' ? 'Xuất .DB' : 'Export .DB'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportDb('json')}
                disabled={isExporting !== null}
                className="btn btn-sm btn-secondary w-full"
              >
                {isExporting === 'db-json' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                ) : (
                  <FileJson className="w-3.5 h-3.5 text-amber-500" />
                )}
                <span>{lang === 'vi' ? 'Xuất JSON' : 'Export JSON'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => dbInputRef.current?.click()}
              disabled={isImporting !== null}
              className="btn btn-md btn-primary w-full"
            >
              {isImporting === 'db' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{lang === 'vi' ? 'Nhập Database (.db, .sqlite, .json)' : 'Import Database (.db, .sqlite, .json)'}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Facebook Profile & Session */}
        <div className="app-subcard p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-app-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-600/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                  <FacebookIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {lang === 'vi' ? 'Facebook Profile & Phiên (Session)' : 'Facebook Profile & Session'}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {lang === 'vi' ? 'Cookie đăng nhập & Browser Profile' : 'Login Cookies & Browser Profile'}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap shadow-sm ${
                  stats?.profile.fbStatus.loggedIn
                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                    : 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stats?.profile.fbStatus.loggedIn ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-amber-500 dark:bg-amber-400'}`} />
                {stats?.profile.fbStatus.loggedIn
                  ? (lang === 'vi' ? 'Đã kết nối' : 'Connected')
                  : (lang === 'vi' ? 'Chưa kết nối' : 'Disconnected')}
              </span>
            </div>

            {/* Profile Metrics Pills */}
            <div className="grid grid-cols-2 gap-2 my-3.5 text-center">
              <div className="app-card p-2.5 rounded-xl shadow-xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {lang === 'vi' ? 'ID Tài khoản (c_user)' : 'Account ID (c_user)'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5 truncate px-1">
                  {stats?.profile.cUser ? `User ${stats.profile.cUser}` : (lang === 'vi' ? 'Chưa có' : 'None')}
                </div>
              </div>
              <div className="app-card p-2.5 rounded-xl shadow-xs">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  {lang === 'vi' ? 'File fb-session.json' : 'fb-session.json File'}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white font-mono mt-0.5">
                  {stats?.profile.sessionExists
                    ? stats.profile.sessionSizeFormatted
                    : (lang === 'vi' ? 'Chưa tạo' : 'Not created')}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 border-t border-app-border">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleExportProfile('session')}
                disabled={isExporting !== null || !stats?.profile.sessionExists}
                className="btn btn-sm btn-secondary w-full"
                title={
                  lang === 'vi'
                    ? 'Tải file fb-session.json gọn nhẹ ~5KB, dùng để chuyển sang máy khác'
                    : 'Download lightweight fb-session.json ~5KB to transfer to another machine'
                }
              >
                {isExporting === 'profile-session' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                )}
                <span>{lang === 'vi' ? 'Xuất Session' : 'Export Session'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportProfile('zip')}
                disabled={isExporting !== null || (!stats?.profile.sessionExists && !stats?.profile.profileDirExists)}
                className="btn btn-sm btn-secondary w-full"
                title={
                  lang === 'vi'
                    ? 'Tải toàn bộ profile trình duyệt nén (.zip) đã lược bỏ cache rác'
                    : 'Download compressed browser profile (.zip) excluding temporary cache'
                }
              >
                {isExporting === 'profile-zip' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                ) : (
                  <FolderArchive className="w-3.5 h-3.5 text-purple-500" />
                )}
                <span>{lang === 'vi' ? 'Xuất ZIP' : 'Export ZIP'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => profileInputRef.current?.click()}
              disabled={isImporting !== null}
              className="btn btn-md btn-primary w-full"
            >
              {isImporting === 'profile' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{lang === 'vi' ? 'Nhập Profile / Session (.json hoặc .zip)' : 'Import Profile / Session (.json or .zip)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: All-in-One Full System Backup */}
      <div className="app-subcard p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>{lang === 'vi' ? 'Gói sao lưu toàn bộ hệ thống (Full Backup ZIP)' : 'Full System Backup (All-in-One ZIP)'}</span>
              <span className="app-tag text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                {lang === 'vi' ? 'Khuyên dùng' : 'Recommended'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'vi'
                ? 'Tích hợp cơ sở dữ liệu SQLite và phiên Facebook vào 1 file ZIP duy nhất để lưu trữ hoặc di chuyển tool.'
                : 'Combines SQLite database and Facebook session into a single ZIP for safe storage or migration.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={handleExportFull}
            disabled={isExporting !== null}
            className="btn btn-md btn-emerald shrink-0"
          >
            {isExporting === 'full' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{lang === 'vi' ? 'Tải Toàn Bộ (.zip)' : 'Download Full (.zip)'}</span>
          </button>

          <button
            type="button"
            onClick={() => fullInputRef.current?.click()}
            disabled={isImporting !== null}
            className="btn btn-md btn-secondary shrink-0"
          >
            {isImporting === 'full' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{lang === 'vi' ? 'Khôi Phục (.zip)' : 'Restore (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{confirmModal.message}</p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
              >
                {lang === 'vi' ? 'Hủy bỏ' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all active:scale-95"
              >
                {lang === 'vi' ? 'Xác nhận nạp dữ liệu' : 'Confirm Import Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
