'use client';

import React, { useState } from 'react';
import {
  X,
  Key,
  Globe,
  Upload,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileCode,
  Loader2,
  SlidersHorizontal,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';

interface FacebookConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  fbStatus: { loggedIn: boolean; username?: string; message: string };
  initialTargetUrl?: string;
}

export default function FacebookConnectModal({
  isOpen,
  onClose,
  onSuccess,
  fbStatus,
  initialTargetUrl,
}: FacebookConnectModalProps) {
  const [activeTab, setActiveTab] = useState<'cookies' | 'file' | 'browser'>('cookies');
  const [cookieInputMode, setCookieInputMode] = useState<'json' | 'fields'>('json');
  const [cUser, setCUser] = useState('');
  const [xs, setXs] = useState('');
  const [rawCookies, setRawCookies] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  // Handle Cookie Submit (c_user & xs)
  const handleSaveFieldsCookies = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCUser = cUser.trim();
    const trimmedXs = xs.trim();

    // If user pasted full JSON or raw string into c_user field by mistake
    if (trimmedCUser.startsWith('[') || trimmedCUser.startsWith('{') || trimmedCUser.includes('c_user=')) {
      return handleSaveRawJsonSubmit(trimmedCUser);
    }

    if (!trimmedCUser || !trimmedXs) {
      setErrorMessage('Vui lòng nhập cả 2 giá trị c_user và xs.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/fb-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cUser: trimmedCUser,
          xs: trimmedXs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || 'Đã lưu và kích hoạt phiên Facebook thành công!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Không thể lưu cookie Facebook.');
      }
    } catch (err: unknown) {
      setErrorMessage(`Lỗi kết nối: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Raw JSON / Full Cookie string submit
  const handleSaveRawJsonSubmit = async (rawInput?: string) => {
    const inputToUse = (typeof rawInput === 'string' ? rawInput : rawCookies).trim();
    if (!inputToUse) {
      setErrorMessage('Vui lòng dán nội dung cookie (JSON hoặc chuỗi cookie).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/fb-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawCookies: inputToUse,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || 'Đã lưu và nạp đầy đủ cookies Facebook thành công!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Không thể đọc hoặc lưu cookies.');
      }
    } catch (err: unknown) {
      setErrorMessage(`Lỗi kết nối: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Launch Browser
  const handleLaunchBrowser = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/fb-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: initialTargetUrl }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message);
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setErrorMessage(data.error || 'Không thể mở trình duyệt trên máy chủ.');
      }
    } catch (err: unknown) {
      setErrorMessage(`Lỗi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle File Upload
  const handleUploadFile = async () => {
    if (!selectedFile) {
      setErrorMessage('Vui lòng chọn file fb-session.json hoặc ZIP profile.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/backup/profile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || 'Đã nạp file session thành công!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } else {
        setErrorMessage(data.error || 'Nạp file thất bại.');
      }
    } catch (err: unknown) {
      setErrorMessage(`Lỗi tải file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-xl bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl shadow-indigo-950/50 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10 shrink-0">
              <FacebookIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">
                Kết nối Tài khoản Facebook
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Lưu phiên đăng nhập để bot tự động đăng bài &amp; bình luận Fanpage
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/70 border-b border-slate-800/60 flex items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium shrink-0 whitespace-nowrap">
            Trạng thái hiện tại:
          </span>
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border truncate ${
              fbStatus.loggedIn
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
            title={fbStatus.message}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                fbStatus.loggedIn ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="truncate">{fbStatus.message}</span>
          </div>
        </div>

        {/* Clean Segmented Tab Navigation */}
        <div className="p-2 sm:p-3 bg-slate-950/40 border-b border-slate-800/80">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            {/* Tab 1: Cookies */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('cookies');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                activeTab === 'cookies'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Key className="w-3.5 h-3.5 shrink-0" />
              <span>Dán Cookie</span>
              <span className={`hidden sm:inline text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === 'cookies' ? 'bg-white/20 text-white' : 'bg-blue-500/20 text-blue-300'
              }`}>
                VPS
              </span>
            </button>

            {/* Tab 2: File Upload */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('file');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                activeTab === 'file'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">File Session</span>
            </button>

            {/* Tab 3: Browser */}
            <button
              type="button"
              onClick={() => {
                setActiveTab('browser');
                setErrorMessage(null);
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition-all ${
                activeTab === 'browser'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Trình duyệt</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: COOKIES (Support JSON export & individual fields) */}
          {activeTab === 'cookies' && (
            <div className="space-y-4">
              {/* Sub-mode switcher */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Chọn cách nhập:</span>
                </span>
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setCookieInputMode('json');
                      setErrorMessage(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-center transition-all ${
                      cookieInputMode === 'json'
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    JSON (Khuyên dùng) ★
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCookieInputMode('fields');
                      setErrorMessage(null);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-center transition-all ${
                      cookieInputMode === 'fields'
                        ? 'bg-blue-600 text-white shadow-sm font-bold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Nhập c_user &amp; xs
                  </button>
                </div>
              </div>

              {/* Mode A: Cookie-Editor JSON / Raw string (Recommended) */}
              {cookieInputMode === 'json' ? (
                <div className="space-y-3.5 animate-in fade-in duration-200">
                  <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 leading-relaxed">
                    💡 <strong>Cách tiện nhất:</strong> Mở facebook.com trên trình duyệt máy tính $\rightarrow$ Mở tiện ích <strong>Cookie-Editor</strong> $\rightarrow$ Bấm nút <strong>Export</strong> $\rightarrow$ Dán vào ô bên dưới. Cách này mang theo đầy đủ <code>datr</code>, <code>sb</code>, <code>c_user</code>, <code>xs</code> giúp phiên Facebook hoạt động ổn định nhất!
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Dán nội dung JSON Cookie hoặc chuỗi cookie:
                    </label>
                    <textarea
                      rows={6}
                      value={rawCookies}
                      onChange={(e) => setRawCookies(e.target.value)}
                      placeholder={`Ví dụ định dạng Cookie-Editor:\n[\n  { "name": "c_user", "value": "..." },\n  { "name": "xs", "value": "..." }\n]\n\nHoặc chuỗi: c_user=...; xs=...; datr=...`}
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner transition"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSaveRawJsonSubmit()}
                    disabled={isSubmitting || !rawCookies.trim()}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xl shadow-blue-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu và nạp cookie...</span>
                      </>
                    ) : (
                      <>
                        <FileCode className="w-4 h-4" />
                        <span>Lưu &amp; Kích hoạt Phiên Facebook</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* Mode B: Separate c_user and xs fields */
                <form onSubmit={handleSaveFieldsCookies} className="space-y-3.5 animate-in fade-in duration-200">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Cookie <code>c_user</code> (ID tài khoản Facebook) *
                    </label>
                    <input
                      type="text"
                      value={cUser}
                      onChange={(e) => setCUser(e.target.value)}
                      placeholder="Ví dụ: 100089234567890"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      Cookie <code>xs</code> (Mã token phiên) *
                    </label>
                    <input
                      type="text"
                      value={xs}
                      onChange={(e) => setXs(e.target.value)}
                      placeholder="Ví dụ: 24%3Al6J...%3A2%3A17..."
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono shadow-inner transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-xl shadow-blue-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang lưu và nạp cookie...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-4 h-4" />
                        <span>Lưu &amp; Kích hoạt Phiên Facebook</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Guide accordion */}
              <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/40 text-xs mt-3">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-slate-300 hover:text-white font-medium"
                >
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Cách lấy cookie Facebook từ máy bạn trong 10 giây</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">{showGuide ? 'Ẩn hướng dẫn' : 'Xem chi tiết'}</span>
                </button>
                {showGuide && (
                  <div className="p-4 pt-1 border-t border-slate-800/60 text-slate-400 space-y-2 leading-relaxed">
                    <p>
                      <strong>Cách 1 (Khuyên dùng - Tiện ích Cookie-Editor):</strong> Cài extension <em>Cookie-Editor</em> trên Chrome/Edge. Mở <code>facebook.com</code>, bấm vào icon extension $\rightarrow$ chọn nút <strong>Export</strong> $\rightarrow$ Dán vào tab <strong>&quot;Dán Cookie-Editor (JSON)&quot;</strong> ở trên.
                    </p>
                    <p>
                      <strong>Cách 2 (F12 DevTools):</strong> Vào <code>facebook.com</code>, nhấn <strong>F12</strong> $\rightarrow$ chọn tab <strong>Application</strong> $\rightarrow$ <strong>Cookies</strong> $\rightarrow$ <code>https://www.facebook.com</code> $\rightarrow$ Copy giá trị của <code>c_user</code> và <code>xs</code>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Tải lên file <code>fb-session.json</code> hoặc file Profile ZIP đã xuất từ máy tính cá nhân của bạn. Hệ thống sẽ tự động cập nhật session cho Playwright.
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300">
                  Chọn file phiên (.json hoặc .zip)
                </label>
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-2xl p-2.5 shadow-inner"
                />
              </div>

              <button
                type="button"
                onClick={handleUploadFile}
                disabled={isUploading || !selectedFile}
                className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xl shadow-blue-600/25 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang nạp file session...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Nạp file session lên hệ thống</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: BROWSER GUI */}
          {activeTab === 'browser' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 leading-relaxed">
                ⚠️ <strong>Lưu ý:</strong> Chế độ này chỉ hoạt động khi ứng dụng chạy trên máy tính có màn hình (macOS, Windows, hoặc Linux có Desktop). Nếu ứng dụng chạy trên <strong>Linux VPS không có giao diện (Headless)</strong>, lệnh này sẽ không thể mở cửa sổ! Hãy sử dụng tab <strong>&quot;Dán Cookie&quot;</strong>.
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 space-y-1.5">
                <p>Khi bấm nút, máy chủ sẽ mở Chromium:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  <li>Đăng nhập tài khoản Facebook bình thường &amp; 2FA nếu có.</li>
                  <li>Chuyển đổi sang tư cách Fanpage nếu bạn cấu hình đăng lên Page.</li>
                  <li>Đóng cửa sổ khi xong, hệ thống sẽ tự động lưu phiên.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleLaunchBrowser}
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang khởi chạy Chromium...</span>
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 text-blue-400" />
                    <span>Khởi chạy cửa sổ trình duyệt Chromium</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
