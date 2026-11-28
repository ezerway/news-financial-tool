'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Eye,
  CheckCircle,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Check,
  ChevronRight,
  ExternalLink,
  Layers,
  Wand2,
  X,
  Sliders,
  Maximize2
} from 'lucide-react';
import { useI18n } from '@/context/I18nThemeContext';

export interface TemplateItem {
  id: string;
  name: string;
  nameEn: string;
  tagline: string;
  badge: string;
  category: string;
  previewColor: string;
  accentColor: string;
  fontFamily: string;
  features: string[];
}

interface TemplatesTabProps {
  onNotify?: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
}

export default function TemplatesTab({ onNotify }: TemplatesTabProps) {
  const { lang } = useI18n();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [defaultTemplate, setDefaultTemplate] = useState<string>('random');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Preview Modal State
  const [previewTemplate, setPreviewTemplate] = useState<TemplateItem | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const [previewDuration, setPreviewDuration] = useState<number>(20);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [iframeScale, setIframeScale] = useState(0.44);

  // Tự động tính toán tỉ lệ scale phù hợp với kích thước container
  useEffect(() => {
    if (!containerRef.current) return;
    const updateScale = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          // Luôn co giãn vừa vặn toàn bộ khung hình 720x1280 theo cả 2 chiều, không bị cắt
          const scale = Math.min(w / 720, h / 1280);
          setIframeScale(scale);
        } else if (w > 0) {
          setIframeScale(w / 720);
        }
      }
    };
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [previewTemplate]);

  // Điều khiển phát tự động timeline theo thời gian thực
  useEffect(() => {
    if (!isPlayingPreview) return;
    const interval = setInterval(() => {
      setPreviewCurrentTime((prev) => {
        const next = Math.round((prev + 0.1) * 10) / 10;
        if (next >= previewDuration) {
          setIsPlayingPreview(false);
          return previewDuration;
        }
        const iframe = document.getElementById('previewIframe') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow && (iframe.contentWindow as any).seekTo) {
          (iframe.contentWindow as any).seekTo(next);
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isPlayingPreview, previewDuration]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/video-templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
        setDefaultTemplate(data.defaultTemplate || 'random');
      }
    } catch {
      onNotify?.(lang === 'vi' ? 'Không thể tải danh sách mẫu video' : 'Failed to load video templates', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSetDefault = async (templateId: string) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            video_default_template: templateId,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDefaultTemplate(templateId);
        onNotify?.(
          lang === 'vi'
            ? `Đã đặt "${templateId === 'random' ? 'Ngẫu nhiên' : templateId}" làm mẫu mặc định!`
            : `Set "${templateId}" as default template!`,
          'success'
        );
      } else {
        onNotify?.(data.error || (lang === 'vi' ? 'Lỗi khi lưu cài đặt' : 'Error saving settings'), 'error');
      }
    } catch {
      onNotify?.(lang === 'vi' ? 'Lỗi kết nối khi lưu cài đặt' : 'Connection error saving settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenPreview = async (tmpl: TemplateItem) => {
    setPreviewTemplate(tmpl);
    setIsLoadingPreview(true);
    setPreviewHtml('');
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);

    try {
      const res = await fetch('/api/video-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: tmpl.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewHtml(data.html);
        if (data.duration) {
          setPreviewDuration(data.duration);
        }
      } else {
        onNotify?.(data.error || (lang === 'vi' ? 'Không thể tạo bản xem trước' : 'Could not generate preview'), 'error');
      }
    } catch {
      onNotify?.(lang === 'vi' ? 'Lỗi khi tải bản xem trước' : 'Error loading preview', 'error');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="app-card p-5 sm:p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>HyperFrames Engine 9:16</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {lang === 'vi' ? 'Quản lý Mẫu Giao diện Video' : 'Video Templates Management'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
              {lang === 'vi'
                ? 'Bộ sưu tập các phong cách hiển thị video bản tin ngắn 9:16 chuyên nghiệp cho Reels, TikTok, Shorts và Zalo Video. Tự động tương thích với kích thước di động.'
                : 'Collection of 9:16 vertical short video templates for Facebook Reels, TikTok, YouTube Shorts, and Zalo Video.'}
            </p>
          </div>

          {/* Quick Global Setting Card */}
          <div className="shrink-0 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                {lang === 'vi' ? 'Chế độ khi tạo tự động' : 'Default Creation Mode'}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {defaultTemplate === 'random'
                    ? (lang === 'vi' ? '🎲 Ngẫu nhiên (Đổi mới liên tục)' : '🎲 Random (Dynamic)')
                    : templates.find((t) => t.id === defaultTemplate)?.name || defaultTemplate}
                </span>
                {defaultTemplate !== 'random' && (
                  <button
                    onClick={() => handleSetDefault('random')}
                    disabled={isSaving}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                  >
                    ({lang === 'vi' ? 'Đổi sang ngẫu nhiên' : 'Set to random'})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Danh sách Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card Đặc Biệt: Random Mode */}
        <div
          className={`app-card p-5 rounded-2xl flex flex-col justify-between transition-all duration-200 border-2 relative ${
            defaultTemplate === 'random'
              ? 'border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
              : 'border-dashed border-slate-300 dark:border-slate-800 hover:border-slate-400'
          }`}
        >
          {defaultTemplate === 'random' && (
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
              <Check className="w-3 h-3" />
              <span>{lang === 'vi' ? 'Đang dùng' : 'Active Default'}</span>
            </div>
          )}

          <div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md mb-4">
              <Wand2 className="w-6 h-6" />
            </div>

            <div className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-2">
              AUTO ROTATION
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">
              {lang === 'vi' ? 'Ngẫu nhiên thông minh' : 'Smart Randomizer'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
              {lang === 'vi'
                ? 'Hệ thống tự động hoán đổi luân phiên các mẫu khác nhau khi tạo video giúp kênh phong phú, hấp dẫn và không gây nhàm chán cho người xem.'
                : 'Automatically rotates through all available templates for each generated video to keep your channels fresh.'}
            </p>

            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{lang === 'vi' ? 'Tránh sự lặp lại đơn điệu' : 'Avoid repetitive styling'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{lang === 'vi' ? 'Phù hợp với thuật toán Reels & Shorts' : 'Optimized for Reels & Shorts algorithms'}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>{lang === 'vi' ? 'Tự động cân đối tất cả các mẫu' : 'Automatically balances all templates'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleSetDefault('random')}
            disabled={defaultTemplate === 'random' || isSaving}
            className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
              defaultTemplate === 'random'
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default'
                : 'btn-primary'
            }`}
          >
            {defaultTemplate === 'random' ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" />
                <span>{lang === 'vi' ? 'Đang là mặc định' : 'Current Default'}</span>
              </>
            ) : (
              <span>{lang === 'vi' ? 'Chọn làm mặc định' : 'Set as Default'}</span>
            )}
          </button>
        </div>

        {/* 4 Templates Cụ Thể */}
        {templates.map((tmpl) => {
          const isDefault = defaultTemplate === tmpl.id;

          return (
            <div
              key={tmpl.id}
              className={`app-card rounded-2xl flex flex-col justify-between overflow-hidden transition-all duration-200 border-2 ${
                isDefault
                  ? 'border-indigo-600 dark:border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              {/* Visual Preview Header Bar */}
              <div
                className="h-28 relative p-4 flex flex-col justify-between"
                style={{ background: tmpl.previewColor }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider text-slate-900 shadow-xs"
                    style={{ backgroundColor: tmpl.accentColor }}
                  >
                    {tmpl.badge}
                  </span>

                  {isDefault && (
                    <div className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-900 flex items-center gap-1 shadow-sm backdrop-blur-sm">
                      <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                      <span>{lang === 'vi' ? 'Mặc định' : 'Default'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-mono font-medium text-slate-300 tracking-wider">
                    {tmpl.category}
                  </div>
                  <div className="text-base font-extrabold text-white tracking-tight drop-shadow-md">
                    {tmpl.name}
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] text-slate-400 font-medium mb-1">
                    {tmpl.nameEn} • {tmpl.fontFamily.split('/')[0].trim()}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
                    {tmpl.tagline}
                  </p>

                  <div className="space-y-1.5 mb-5">
                    {tmpl.features.map((feat, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                        <span className="line-clamp-2">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => handleOpenPreview(tmpl)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{lang === 'vi' ? 'Xem trước Live 9:16' : 'Live Preview'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetDefault(tmpl.id)}
                    disabled={isDefault || isSaving}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                      isDefault
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 cursor-default'
                        : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer'
                    }`}
                  >
                    {isDefault ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{lang === 'vi' ? 'Đang là mặc định' : 'Current Default'}</span>
                      </>
                    ) : (
                      <span>{lang === 'vi' ? 'Đặt làm mặc định' : 'Set as Default'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Preview Modal */}
      {previewTemplate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewTemplate(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-5 flex flex-col md:flex-row gap-6 max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: 9:16 Frame Preview Container with Exact Viewport Scaling */}
            <div className="w-full md:w-[320px] shrink-0 flex flex-col items-center">
              <div
                ref={containerRef}
                className="w-full aspect-[9/16] max-h-[66vh] bg-black rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl relative flex items-center justify-center"
              >
                {isLoadingPreview ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                    <RotateCcw className="w-6 h-6 animate-spin text-indigo-400" />
                    <span>{lang === 'vi' ? 'Đang render mẫu HTML...' : 'Rendering HTML template...'}</span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '720px',
                      height: '1280px',
                      transform: `scale(${iframeScale})`,
                      transformOrigin: 'center center',
                      position: 'absolute',
                      pointerEvents: 'none',
                    }}
                  >
                    <iframe
                      id="previewIframe"
                      srcDoc={previewHtml}
                      className="border-0 select-none"
                      title="Live Preview"
                      style={{ width: '720px', height: '1280px' }}
                    />
                  </div>
                )}
              </div>

              {/* Timeline Slider & Playback for Preview */}
              <div className="w-full mt-3 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span className="font-bold text-slate-300">{previewCurrentTime.toFixed(1)}s / {previewDuration.toFixed(1)}s</span>
                  <span className="text-indigo-400 font-bold">
                    {previewCurrentTime < 3.0
                      ? 'Scene 1: Intro'
                      : previewCurrentTime < 7.0
                      ? 'Scene 2: Headline'
                      : previewCurrentTime < previewDuration - 4.5
                      ? 'Scene 3: Content'
                      : 'Scene 4: Outro'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (previewCurrentTime >= previewDuration) {
                        setPreviewCurrentTime(0);
                        const iframe = document.getElementById('previewIframe') as HTMLIFrameElement;
                        if (iframe && iframe.contentWindow && (iframe.contentWindow as any).seekTo) {
                          (iframe.contentWindow as any).seekTo(0);
                        }
                      }
                      setIsPlayingPreview(!isPlayingPreview);
                    }}
                    className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shrink-0 transition cursor-pointer shadow-xs"
                    title={isPlayingPreview ? (lang === 'vi' ? 'Tạm dừng' : 'Pause') : (lang === 'vi' ? 'Phát tự động' : 'Auto play')}
                  >
                    {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPreviewCurrentTime(0);
                      const iframe = document.getElementById('previewIframe') as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow && (iframe.contentWindow as any).seekTo) {
                        (iframe.contentWindow as any).seekTo(0);
                      }
                    }}
                    className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 flex items-center justify-center shrink-0 transition cursor-pointer"
                    title={lang === 'vi' ? 'Xem lại từ đầu' : 'Replay from start'}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="range"
                    min="0"
                    max={previewDuration}
                    step="0.1"
                    value={previewCurrentTime}
                    onChange={(e) => {
                      const time = parseFloat(e.target.value);
                      setPreviewCurrentTime(time);
                      const iframe = document.getElementById('previewIframe') as HTMLIFrameElement;
                      if (iframe && iframe.contentWindow && (iframe.contentWindow as any).seekTo) {
                        (iframe.contentWindow as any).seekTo(time);
                      }
                    }}
                    className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Right: Template Details & Quick Controls */}
            <div className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <div className="text-xs text-indigo-400 font-mono font-bold tracking-wider uppercase">
                      {previewTemplate.category}
                    </div>
                    <h3 className="text-xl font-black text-white">{previewTemplate.name}</h3>
                  </div>
                  <button
                    onClick={() => setPreviewTemplate(null)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    {lang === 'vi' ? 'Mô tả phong cách' : 'Style Description'}
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {previewTemplate.tagline}
                  </p>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    {lang === 'vi' ? 'Điểm nổi bật & Thiết kế' : 'Highlights & Design'}
                  </div>
                  <div className="space-y-2">
                    {previewTemplate.features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700/60 space-y-2">
                  <div className="text-xs font-bold text-slate-200">
                    {lang === 'vi' ? 'Chuẩn xuất bản hỗ trợ' : 'Supported Platforms'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700 font-semibold">
                      Facebook Reels
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white border border-slate-700 font-semibold">
                      TikTok
                    </span>
                    <span className="px-2 py-0.5 rounded bg-red-900/60 text-red-300 border border-red-700 font-semibold">
                      YouTube Shorts
                    </span>
                    <span className="px-2 py-0.5 rounded bg-sky-900/60 text-sky-300 border border-sky-700 font-semibold">
                      Zalo Video
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons in Modal */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setPreviewTemplate(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
                >
                  {lang === 'vi' ? 'Đóng' : 'Close'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSetDefault(previewTemplate.id);
                    setPreviewTemplate(null);
                  }}
                  disabled={defaultTemplate === previewTemplate.id}
                  className="btn-primary py-2 px-5 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {defaultTemplate === previewTemplate.id
                      ? (lang === 'vi' ? 'Đang là mẫu mặc định' : 'Current default template')
                      : (lang === 'vi' ? 'Đặt mẫu này làm mặc định' : 'Set as default template')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
