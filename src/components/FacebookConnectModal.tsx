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
  ExternalLink,
  Loader2,
  Terminal,
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
  const [activeTab, setActiveTab] = useState<'cookies' | 'browser' | 'file'>('cookies');
  const [cUser, setCUser] = useState('');
  const [xs, setXs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  // Handle Cookie Submit
  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cUser.trim() || !xs.trim()) {
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
          cUser: cUser.trim(),
          xs: xs.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Đã lưu và kích hoạt phiên Facebook thành công!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setErrorMessage(data.error || 'Không thể lưu cookie Facebook.');
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
        }, 1500);
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
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-lg">
              <FacebookIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Kết nối Tài khoản Facebook
              </h3>
              <p className="text-xs text-slate-400">
                Lưu phiên đăng nhập để bot tự động đăng bài &amp; bình luận
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Badge */}
        <div className="px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/60 flex items-center justify-between text-xs">
          <span className="text-slate-400">Trạng thái hiện tại:</span>
          <span
            className={`font-semibold flex items-center gap-1.5 ${
              fbStatus.loggedIn ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                fbStatus.loggedIn ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            {fbStatus.message}
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('cookies');
              setErrorMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'cookies'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Dán Cookie (Cho VPS)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300">
              Khuyên dùng
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('file');
              setErrorMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Tải file Session</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('browser');
              setErrorMessage(null);
            }}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-bold border-b-2 transition ${
              activeTab === 'browser'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Mở Chromium (GUI)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Alerts */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* TAB 1: COOKIES */}
          {activeTab === 'cookies' && (
            <form onSubmit={handleSaveCookies} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                💡 <strong>Dành cho máy chủ VPS:</strong> Bạn chỉ cần sao chép 2 giá trị cookie từ Facebook trên trình duyệt máy tính của bạn dán vào đây để bot đăng bài mà không cần cài giao diện đồ họa.
              </div>

              {/* c_user */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  Cookie <code>c_user</code> (User ID Facebook) *
                </label>
                <input
                  type="text"
                  value={cUser}
                  onChange={(e) => setCUser(e.target.value)}
                  placeholder="Ví dụ: 100089234567890"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* xs */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-200">
                  Cookie <code>xs</code> (Session Token) *
                </label>
                <input
                  type="text"
                  value={xs}
                  onChange={(e) => setXs(e.target.value)}
                  placeholder="Ví dụ: 24%3Al6J...%3A2%3A17..."
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Guide accordion */}
              <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-slate-950/40 text-xs">
                <button
                  type="button"
                  onClick={() => setShowGuide(!showGuide)}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-slate-300 hover:text-white font-medium"
                >
                  <span className="flex items-center gap-1.5 text-blue-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Cách lấy c_user và xs trong 10 giây</span>
                  </span>
                  <span className="text-[10px] text-slate-500">{showGuide ? 'Đóng' : 'Xem'}</span>
                </button>
                {showGuide && (
                  <div className="p-4 pt-1 border-t border-slate-800/60 text-slate-400 space-y-2 leading-relaxed">
                    <p>
                      <strong>Cách 1 (Tiện ích Cookie-Editor):</strong> Cài extension <em>Cookie-Editor</em> trên Chrome/Edge/Firefox, mở facebook.com, click vào extension và copy giá trị trường <code>c_user</code> và <code>xs</code>.
                    </p>
                    <p>
                      <strong>Cách 2 (F12 DevTools):</strong> Vào facebook.com, nhấn <strong>F12</strong> -&gt; chọn tab <strong>Application</strong> (hoặc <strong>Storage</strong>) -&gt; <strong>Cookies</strong> -&gt; <code>https://www.facebook.com</code> -&gt; Copy giá trị của <code>c_user</code> và <code>xs</code>.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang lưu và xác thực...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Lưu và Kích hoạt Phiên Facebook</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                Tải lên file <code>fb-session.json</code> hoặc file Profile ZIP đã xuất từ máy tính cá nhân của bạn.
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-200">
                  Chọn file phiên (.json hoặc .zip)
                </label>
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-500 w-full text-xs text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-2"
                />
              </div>

              <button
                type="button"
                onClick={handleUploadFile}
                disabled={isUploading || !selectedFile}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
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
                ⚠️ <strong>Lưu ý:</strong> Chế độ này chỉ hoạt động khi ứng dụng chạy trên máy tính có màn hình (macOS, Windows, hoặc Linux có Desktop). Nếu ứng dụng chạy trên <strong>Linux VPS không có giao diện (Headless)</strong>, lệnh này sẽ báo lỗi vì không có màn hình để mở cửa sổ! Hãy sử dụng tab <strong>&quot;Dán Cookie&quot;</strong>.
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
                className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
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
