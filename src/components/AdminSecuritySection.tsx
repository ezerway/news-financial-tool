'use client';

import React, { useState, useEffect } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  KeyRound,
} from 'lucide-react';

export default function AdminSecuritySection() {
  const [currentUsername, setCurrentUsername] = useState('admin');
  const [newUsername, setNewUsername] = useState('admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch current logged in username
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.username) {
          setCurrentUsername(d.username);
          setNewUsername(d.username);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!currentPassword) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại để xác thực thay đổi.' });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setFeedback({ type: 'error', message: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Mật khẩu mới và mật khẩu nhập lại không trùng khớp.' });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newUsername: newUsername.trim(),
          newPassword: newPassword ? newPassword.trim() : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setFeedback({ type: 'success', message: data.message || 'Cập nhật tài khoản quản trị thành công!' });
        setCurrentUsername(data.username || newUsername.trim());
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({ type: 'error', message: data.error || 'Cập nhật thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Lỗi kết nối máy chủ: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Lock className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              Bảo mật &amp; Đổi Mật khẩu Web (VPS Gateway)
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 shrink-0 whitespace-nowrap">
                Bảo vệ VPS
              </span>
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Đổi tên đăng nhập hoặc mật khẩu quản trị để bảo vệ Dashboard an toàn trên Internet.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 shrink-0 whitespace-nowrap">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Tài khoản hiện tại: <strong className="text-white font-mono">{currentUsername}</strong></span>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/40 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* New Username */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Tên đăng nhập (Username)</span>
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="admin"
              required
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
            />
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Mật khẩu hiện tại (Xác thực)</span>
              </span>
              <span className="text-[10px] text-amber-400 font-normal">*Bắt buộc</span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu hiện tại..."
                required
                className="w-full px-4 py-2.5 pr-10 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Mật khẩu mới (Tùy chọn)</span>
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Để trống nếu chỉ muốn đổi tên đăng nhập"
                minLength={6}
                className="w-full px-4 py-2.5 pr-10 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Nhập lại mật khẩu mới</span>
            </label>
            <input
              type={showNewPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới..."
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono shadow-inner"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500">
            Mật khẩu được mã hóa an toàn bằng PBKDF2 (SHA-512, 100.000 vòng) theo tiêu chuẩn bảo mật OWASP.
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition-all active:scale-95 disabled:opacity-50 shrink-0 self-end sm:self-auto"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            )}
            <span>Cập nhật tài khoản</span>
          </button>
        </div>
      </form>
    </div>
  );
}
