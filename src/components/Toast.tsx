'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  text: string;
  title?: string;
  type: ToastType;
  duration?: number;
}

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const ToastCard: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const duration = toast.duration || 4500;
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 220);
  };

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      remainingTimeRef.current -= Date.now() - startTimeRef.current;
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, Math.max(remainingTimeRef.current, 500));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused]);

  // Color schemes based on toast type
  const themeStyles = {
    success: {
      border: 'border-emerald-500/35 hover:border-emerald-500/50',
      badgeBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_14px_rgba(16,185,129,0.25)]',
      gradient: 'from-emerald-500/[0.12] via-emerald-500/[0.03] to-transparent',
      bar: 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
      titleColor: 'text-emerald-400 dark:text-emerald-300',
      defaultTitle: 'Thành công',
      icon: <CheckCircle2 className="w-4 h-4 shrink-0 animate-in zoom-in-75 duration-200" />,
    },
    error: {
      border: 'border-rose-500/35 hover:border-rose-500/50',
      badgeBg: 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-[0_0_14px_rgba(244,63,94,0.25)]',
      gradient: 'from-rose-500/[0.12] via-rose-500/[0.03] to-transparent',
      bar: 'bg-gradient-to-r from-rose-500 to-red-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]',
      titleColor: 'text-rose-400 dark:text-rose-300',
      defaultTitle: 'Lỗi phát sinh',
      icon: <AlertCircle className="w-4 h-4 shrink-0 animate-in zoom-in-75 duration-200" />,
    },
    warning: {
      border: 'border-amber-500/35 hover:border-amber-500/50',
      badgeBg: 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_14px_rgba(245,158,11,0.25)]',
      gradient: 'from-amber-500/[0.12] via-amber-500/[0.03] to-transparent',
      bar: 'bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
      titleColor: 'text-amber-400 dark:text-amber-300',
      defaultTitle: 'Cảnh báo',
      icon: <AlertTriangle className="w-4 h-4 shrink-0 animate-in zoom-in-75 duration-200" />,
    },
    info: {
      border: 'border-indigo-500/35 hover:border-indigo-500/50',
      badgeBg: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-[0_0_14px_rgba(99,102,241,0.25)]',
      gradient: 'from-indigo-500/[0.12] via-indigo-500/[0.03] to-transparent',
      bar: 'bg-gradient-to-r from-indigo-500 via-sky-400 to-cyan-400 shadow-[0_0_8px_rgba(99,102,241,0.5)]',
      titleColor: 'text-indigo-400 dark:text-indigo-300',
      defaultTitle: 'Thông báo',
      icon: <Info className="w-4 h-4 shrink-0 animate-in zoom-in-75 duration-200" />,
    },
  }[toast.type];

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`
        pointer-events-auto group relative w-full sm:w-[380px] overflow-hidden rounded-2xl
        border ${themeStyles.border}
        bg-[#0f172a]/92 dark:bg-[#0c1222]/95
        backdrop-blur-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.65)]
        transition-all duration-200 ease-out
        ${isExiting
          ? 'opacity-0 scale-95 translate-y-2 sm:-translate-y-2'
          : 'opacity-100 scale-100 translate-y-0 animate-in fade-in zoom-in-95 slide-in-from-top-4 sm:slide-in-from-top-3 duration-250'
        }
      `}
      style={{
        boxShadow:
          toast.type === 'success'
            ? '0 16px 36px -8px rgba(16, 185, 129, 0.22), 0 0 1px 1px rgba(16, 185, 129, 0.15)'
            : toast.type === 'error'
            ? '0 16px 36px -8px rgba(244, 63, 94, 0.22), 0 0 1px 1px rgba(244, 63, 94, 0.15)'
            : '0 16px 36px -8px rgba(99, 102, 241, 0.22), 0 0 1px 1px rgba(99, 102, 241, 0.15)',
      }}
    >
      {/* Subtle Top-to-Bottom Ambient Glow Overlay */}
      <div className={`absolute inset-0 bg-gradient-to-br ${themeStyles.gradient} pointer-events-none`} />

      {/* Content Body */}
      <div className="relative p-3.5 sm:p-4 flex items-start gap-3">
        {/* Illuminated Status Badge */}
        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${themeStyles.badgeBg} transition-transform duration-200 group-hover:scale-105`}>
          {themeStyles.icon}
        </div>

        {/* Message Details */}
        <div className="flex-1 min-w-0 pr-1 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`text-[11px] font-bold tracking-wider uppercase ${themeStyles.titleColor}`}>
              {toast.title || themeStyles.defaultTitle}
            </span>
            {toast.type === 'info' && (
              <Sparkles className="w-3 h-3 text-indigo-400 opacity-70 animate-pulse" />
            )}
          </div>
          <p className="text-xs font-medium text-slate-100 dark:text-slate-200 leading-relaxed break-words line-clamp-3 select-text">
            {toast.text}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 dark:hover:bg-slate-700/50 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
          aria-label="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Animated Shrinking Countdown Progress Bar */}
      <div className="relative h-[2px] w-full bg-slate-800/40 overflow-hidden">
        <div
          className={`h-full ${themeStyles.bar} transition-all origin-left`}
          style={{
            animation: `toast-progress ${duration}ms linear forwards`,
            animationPlayState: isPaused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
};

export interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-none flex flex-col gap-2.5 items-end
        top-4 right-4 sm:top-5 sm:right-6
        max-w-[calc(100vw-2rem)] sm:max-w-md w-full"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
