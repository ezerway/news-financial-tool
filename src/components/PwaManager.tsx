'use client';

import React, { useEffect, useState } from 'react';
import { Download, X, Smartphone, Check, Sparkles, Monitor } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [showGeneralGuide, setShowGeneralGuide] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if user previously dismissed banner
    if (typeof window !== 'undefined') {
      const isDismissed = localStorage.getItem('trendpulse_pwa_dismissed') === 'true';
      setDismissed(isDismissed);
    }
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
          console.log('[PWA] Service Worker registered with scope:', reg.scope);
        } catch (err) {
          console.warn('[PWA] Service Worker registration failed:', err);
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
      }
    }

    // 2. Check standalone mode (already installed as PWA or launched from homescreen)
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIos(isIosDevice);

    // 4. Capture BeforeInstallPromptEvent
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Handle app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
      console.log('[PWA] App successfully installed!');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Listen for custom trigger from Settings or Header
    const handleCustomInstallTrigger = () => {
      handleInstallClick();
    };

    window.addEventListener('trendpulse:install-pwa', handleCustomInstallTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trendpulse:install-pwa', handleCustomInstallTrigger);
    };
  }, [deferredPrompt, isIos]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setInstalled(true);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        if (isIos) setShowIosPrompt(true);
        else setShowGeneralGuide(true);
      }
    } else if (isIos) {
      setShowIosPrompt(true);
    } else {
      setShowGeneralGuide(true);
    }
  };

  if (isStandalone || installed || dismissed) {
    return (
      <>
        {/* Modals still visible if triggered manually from Settings */}
        {renderModals()}
      </>
    );
  }

  function renderModals() {
    return (
      <>
        {/* iOS Safari Instruction Modal */}
        {showIosPrompt && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center mx-auto">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cài đặt trên iPhone/iPad (Safari)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Để dùng TrendPulse như ứng dụng độc lập trên màn hình chính:
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-left text-xs text-slate-700 dark:text-slate-300 space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Bấm vào nút <strong>Chia sẻ (Share icon 📤)</strong> ở thanh dưới trình duyệt Safari.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Cuộn xuống và chọn <strong>Thêm vào MH chính (Add to Home Screen)</strong>.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowIosPrompt(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}

        {/* Android / Desktop Chrome Instruction Modal */}
        {showGeneralGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center mx-auto">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Cài đặt ứng dụng TrendPulse</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Cách cài đặt trực tiếp từ trình duyệt của bạn:
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-left text-xs text-slate-700 dark:text-slate-300 space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Bấm vào <strong>menu 3 chấm (⋮)</strong> ở góc trên bên phải trình duyệt (hoặc icon cài đặt trên thanh địa chỉ URL).
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    Chọn <strong>&quot;Cài đặt ứng dụng&quot;</strong> hoặc <strong>&quot;Thêm vào màn hình chính&quot;</strong> (Install app).
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowGeneralGuide(false)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {/* Floating Bottom / Mobile Install Banner (Mobile only, hidden on desktop) */}
      <div className="md:hidden fixed bottom-20 right-3 left-3 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-indigo-500/30 backdrop-blur-xl shadow-xl dark:shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 flex items-center justify-center shrink-0 shadow-md">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div className="text-left min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="truncate">Cài đặt TrendPulse</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 shrink-0">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Mượt mà như App trên điện thoại
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white !text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition active:scale-95 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-white" />
              <span className="text-white">Cài đặt</span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('trendpulse_pwa_dismissed', 'true');
                }
                setDismissed(true);
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {renderModals()}
    </>
  );
}
