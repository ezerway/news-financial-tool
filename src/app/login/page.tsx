import { Suspense } from 'react';
import type { Metadata } from 'next';
import LoginForm from '@/components/LoginForm';

export const metadata: Metadata = {
  title: 'Đăng nhập - TrendPulse AI',
  description: 'Đăng nhập vào hệ thống quản trị TrendPulse AI',
};

function LoginFormSkeleton() {
  return (
    <div className="w-full max-w-md p-8 sm:p-10 rounded-3xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center min-h-[460px] space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 animate-pulse" />
      <div className="h-6 w-40 bg-slate-800 rounded-lg animate-pulse" />
      <div className="h-4 w-60 bg-slate-800/60 rounded-lg animate-pulse" />
      <div className="w-full space-y-3 pt-4">
        <div className="h-10 w-full bg-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-10 w-full bg-slate-800/50 rounded-2xl animate-pulse" />
        <div className="h-11 w-full bg-indigo-600/30 rounded-2xl animate-pulse mt-4" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Background ambient decorative shapes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
