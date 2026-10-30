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
  LogOut,
} from 'lucide-react';
import { useI18n } from '@/context/I18nThemeContext';

export default function AdminSecuritySection() {
  const { t, lang } = useI18n();
  const [currentUsername, setCurrentUsername] = useState('admin');
  const [newUsername, setNewUsername] = useState('admin');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/login?logout=1';
  };

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
      setFeedback({
        type: 'error',
        message: lang === 'vi' ? 'Vui lòng nhập mật khẩu hiện tại để xác thực thay đổi.' : 'Please enter current password to verify changes.',
      });
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setFeedback({
        type: 'error',
        message: lang === 'vi' ? 'Mật khẩu mới phải có tối thiểu 6 ký tự.' : 'New password must be at least 6 characters.',
      });
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setFeedback({
        type: 'error',
        message: lang === 'vi' ? 'Mật khẩu mới và mật khẩu nhập lại không trùng khớp.' : 'New password and confirmation do not match.',
      });
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
        setFeedback({
          type: 'success',
          message: data.message || (lang === 'vi' ? 'Cập nhật tài khoản quản trị thành công!' : 'Admin account updated successfully!'),
        });
        setCurrentUsername(data.username || newUsername.trim());
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setFeedback({
          type: 'error',
          message: data.error || (lang === 'vi' ? 'Cập nhật thất bại. Vui lòng kiểm tra lại mật khẩu hiện tại.' : 'Update failed. Please check your current password.'),
        });
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: `${lang === 'vi' ? 'Lỗi kết nối máy chủ' : 'Server error'}: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-card p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 sm:pb-4 border-b border-app-border">
        <div className="flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center shadow-sm shrink-0">
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              {lang === 'vi' ? 'Bảo mật & Đổi Mật khẩu' : 'Security & Change Password'}
              <span className="app-tag text-[10px] font-bold px-2 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border-indigo-500/20 shrink-0 whitespace-nowrap">
                VPS
              </span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
              {lang === 'vi' ? 'Đổi tên đăng nhập hoặc mật khẩu quản trị bảo vệ Dashboard.' : 'Change admin username or password to protect VPS Dashboard.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <div className="app-tag flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>User: <strong className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{currentUsername}</strong></span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="app-tag px-2.5 py-1 rounded-full text-xs font-semibold hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-900 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            title={lang === 'vi' ? 'Đăng xuất khỏi phiên hiện tại' : 'Log out from current session'}
          >
            {isLoggingOut ? (
              <Loader2 className="w-3 h-3 animate-spin text-rose-500" />
            ) : (
              <LogOut className="w-3 h-3 text-rose-500" />
            )}
            <span>{t('logout')}</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2.5 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* New Username */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{lang === 'vi' ? 'Tên đăng nhập (Username)' : 'Username'}</span>
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="admin"
              required
              className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Current Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>{lang === 'vi' ? 'Mật khẩu hiện tại (Xác thực)' : 'Current Password (Verify)'}</span>
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                {lang === 'vi' ? '*Bắt buộc' : '*Required'}
              </span>
            </label>
            <div className="relative">
              <input
                type={showCurrentPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={lang === 'vi' ? 'Nhập mật khẩu hiện tại...' : 'Enter current password...'}
                required
                className="w-full h-9 pl-3 pr-10 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPw(!showCurrentPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{lang === 'vi' ? 'Mật khẩu mới (Tùy chọn)' : 'New Password (Optional)'}</span>
            </label>
            <div className="relative">
              <input
                type={showNewPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={lang === 'vi' ? 'Để trống nếu chỉ muốn đổi tên đăng nhập' : 'Leave blank if only changing username'}
                minLength={6}
                className="w-full h-9 pl-3 pr-10 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowNewPw(!showNewPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{lang === 'vi' ? 'Nhập lại mật khẩu mới' : 'Confirm New Password'}</span>
            </label>
            <input
              type={showNewPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={lang === 'vi' ? 'Nhập lại mật khẩu mới...' : 'Re-enter new password...'}
              className="w-full h-9 px-3 app-input rounded-lg text-xs font-mono placeholder-slate-400 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-slate-500">
            {lang === 'vi'
              ? 'Mật khẩu được mã hóa an toàn bằng PBKDF2 (SHA-512, 100.000 vòng) theo tiêu chuẩn bảo mật OWASP.'
              : 'Passwords are encrypted and securely hashed using PBKDF2 (SHA-512, 100,000 rounds) per OWASP standards.'}
          </p>
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-md btn-primary shrink-0 self-end sm:self-auto"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>
              {isLoading
                ? (lang === 'vi' ? 'Đang cập nhật...' : 'Updating...')
                : (lang === 'vi' ? 'Cập nhật tài khoản' : 'Update Account')}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
