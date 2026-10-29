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
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';

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
    } catch (err: any) {
      console.error('Failed to load backup stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
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
      showToast(`Đang tải xuống bản sao lưu cơ sở dữ liệu (${format.toUpperCase()})...`, 'info');
    } catch (err: any) {
      showToast(`Lỗi xuất DB: ${err.message}`, 'error');
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
          ? 'Đang tải file fb-session.json...'
          : 'Đang tải gói sao lưu profile trình duyệt (.zip)...',
        'info'
      );
    } catch (err: any) {
      showToast(`Lỗi xuất profile: ${err.message}`, 'error');
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
      showToast('Đang tải gói sao lưu toàn bộ hệ thống (DB + Profile)...', 'info');
    } catch (err: any) {
      showToast(`Lỗi xuất sao lưu: ${err.message}`, 'error');
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
      title: 'Xác nhận nạp cơ sở dữ liệu mới',
      message: `Bạn đang chuẩn bị nạp tập tin "${file.name}" (${(file.size / 1024).toFixed(1)} KB). Cơ sở dữ liệu hiện tại sẽ được cập nhật. Hệ thống sẽ tự động sao lưu bản cũ vào app.db.bak trước khi thực hiện. Bạn có muốn tiếp tục?`,
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
      title: 'Xác nhận nạp Facebook Profile / Session',
      message: `Bạn đang chuẩn bị nạp tập tin "${file.name}". Phiên đăng nhập Facebook hiện tại sẽ được thay thế bằng dữ liệu trong tập tin này. Bạn có muốn tiếp tục?`,
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
      title: 'Xác nhận khôi phục toàn bộ hệ thống',
      message: `Bạn đang chuẩn bị khôi phục toàn bộ dữ liệu từ "${file.name}". Toàn bộ cơ sở dữ liệu và phiên Facebook sẽ được khôi phục. Bạn có chắc chắn muốn tiếp tục?`,
    });
    e.target.value = '';
  };

  // Perform upload after confirmation
  const executeImport = async () => {
    if (!confirmModal || !confirmModal.file) return;
    const { type, file } = confirmModal;
    setConfirmModal(null);

    setIsImporting(type);
    showToast(`Đang tải lên và xử lý ${file.name}...`, 'info');

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
        showToast(data.message || 'Khôi phục thành công!', 'success');
        await fetchStats();
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        showToast(`Lỗi khôi phục: ${data.error}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối: ${err.message}`, 'error');
    } finally {
      setIsImporting(null);
    }
  };

  return (
    <div className="p-4 sm:p-7 rounded-2xl sm:rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 sm:pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <HardDrive className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              Sao lưu &amp; Khôi phục (Backup / Restore)
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                Mới
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Xuất nhập cơ sở dữ liệu SQLite, phiên Facebook Profile và gói sao lưu toàn bộ hệ thống.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={isLoadingStats}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 text-xs font-semibold text-slate-300 transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Làm mới thông tin</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-2xl border text-xs font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/70 border-rose-500/40 text-rose-200'
              : 'bg-blue-950/70 border-blue-500/40 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Database (SQLite & JSON) */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">Cơ sở dữ liệu (Database)</h4>
                  <p className="text-[11px] text-slate-400 truncate">SQLite app.db • Bài viết, xu hướng &amp; nhật ký</p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0 whitespace-nowrap shadow-sm">
                {stats?.db.sizeFormatted || '...'}
              </span>
            </div>

            {/* DB Metrics Pills */}
            <div className="grid grid-cols-3 gap-2 my-3.5 text-center">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Bài viết</div>
                <div className="text-xs font-bold text-white font-mono mt-0.5">
                  {stats?.db.postsCount ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Xu hướng</div>
                <div className="text-xs font-bold text-white font-mono mt-0.5">
                  {stats?.db.trendsCount ?? 0}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">Nhật ký</div>
                <div className="text-xs font-bold text-white font-mono mt-0.5">
                  {stats?.db.logsCount ?? 0}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 border-t border-slate-800/60">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleExportDb('sqlite')}
                disabled={isExporting !== null}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting === 'db-sqlite' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-indigo-400" />
                )}
                <span>Xuất .DB (SQLite)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportDb('json')}
                disabled={isExporting !== null}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
              >
                {isExporting === 'db-json' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <FileJson className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Xuất JSON</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => dbInputRef.current?.click()}
              disabled={isImporting !== null}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-900/40 via-indigo-800/40 to-slate-800/40 hover:from-indigo-800/60 hover:to-slate-700/60 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {isImporting === 'db' ? (
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              ) : (
                <Upload className="w-4 h-4 text-indigo-400" />
              )}
              <span>Nhập Cơ sở dữ liệu (.db, .sqlite, .json)</span>
            </button>
          </div>
        </div>

        {/* Card 2: Facebook Profile & Session */}
        <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-800/60">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600/15 text-blue-400 flex items-center justify-center shrink-0">
                  <FacebookIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">Facebook Profile &amp; Phiên (Session)</h4>
                  <p className="text-[11px] text-slate-400 truncate">Cookie đăng nhập, StorageState &amp; Browser Profile</p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap shadow-sm ${
                  stats?.profile.fbStatus.loggedIn
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${stats?.profile.fbStatus.loggedIn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {stats?.profile.fbStatus.loggedIn ? 'Đã kết nối' : 'Chưa kết nối'}
              </span>
            </div>

            {/* Profile Metrics Pills */}
            <div className="grid grid-cols-2 gap-2 my-3.5 text-center">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">ID Tài khoản (c_user)</div>
                <div className="text-xs font-bold text-white font-mono mt-0.5 truncate px-1">
                  {stats?.profile.cUser ? `User ${stats.profile.cUser}` : 'Chưa có'}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                <div className="text-[10px] text-slate-400">File fb-session.json</div>
                <div className="text-xs font-bold text-white font-mono mt-0.5">
                  {stats?.profile.sessionExists ? stats.profile.sessionSizeFormatted : 'Chưa tạo'}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1 border-t border-slate-800/60">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleExportProfile('session')}
                disabled={isExporting !== null || !stats?.profile.sessionExists}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                title="Tải file fb-session.json gọn nhẹ ~5KB, dùng để chuyển sang máy khác"
              >
                {isExporting === 'profile-session' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                ) : (
                  <Download className="w-3.5 h-3.5 text-blue-400" />
                )}
                <span>Xuất Session (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExportProfile('zip')}
                disabled={isExporting !== null || (!stats?.profile.sessionExists && !stats?.profile.profileDirExists)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all active:scale-95 disabled:opacity-40"
                title="Tải toàn bộ profile trình duyệt nén (.zip) đã lược bỏ cache rác"
              >
                {isExporting === 'profile-zip' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <FolderArchive className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>Xuất Full Profile (.zip)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => profileInputRef.current?.click()}
              disabled={isImporting !== null}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-900/40 via-blue-800/40 to-slate-800/40 hover:from-blue-800/60 hover:to-slate-700/60 border border-blue-500/40 text-blue-300 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
            >
              {isImporting === 'profile' ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              ) : (
                <Upload className="w-4 h-4 text-blue-400" />
              )}
              <span>Nhập Profile / Session (.json hoặc .zip)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card 3: All-in-One Full System Backup */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900/90 to-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <FolderArchive className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              Gói sao lưu toàn bộ hệ thống (Full Backup ZIP)
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0 whitespace-nowrap">
                Khuyên dùng
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tích hợp cơ sở dữ liệu SQLite và phiên Facebook vào 1 file ZIP duy nhất để lưu trữ hoặc di chuyển tool.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={handleExportFull}
            disabled={isExporting !== null}
            className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all active:scale-95 disabled:opacity-50 shadow-sm"
          >
            {isExporting === 'full' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Tải Toàn Bộ (.zip)</span>
          </button>

          <button
            type="button"
            onClick={() => fullInputRef.current?.click()}
            disabled={isImporting !== null}
            className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
          >
            {isImporting === 'full' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
            ) : (
              <Upload className="w-3.5 h-3.5 text-slate-300" />
            )}
            <span>Khôi Phục (.zip)</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-white">{confirmModal.title}</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">{confirmModal.message}</p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={executeImport}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-all active:scale-95"
              >
                Xác nhận nạp dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
