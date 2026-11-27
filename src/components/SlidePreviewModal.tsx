'use client';

import React, { useState, useEffect } from 'react';
import { TrendItem } from '@/types';
import { VideoSlideScript } from '@/services/video-script-generator';
import {
  X,
  Film,
  Sparkles,
  RotateCcw,
  Play,
  Layers,
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  Loader2,
  Clock,
  Tag,
  MessageCircle,
} from 'lucide-react';
import { useI18n } from '@/context/I18nThemeContext';

export interface SlidePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  trend: TrendItem | null;
  onRenderVideo: (
    trendId: string,
    force: boolean,
    templateId?: string,
    customScript?: VideoSlideScript
  ) => Promise<void>;
  isRendering?: boolean;
}

const TEMPLATE_OPTIONS = [
  { id: 'random', name: '🎲 Ngẫu nhiên thông minh', desc: 'Tự động chọn mẫu tối ưu' },
  { id: 'modern_dark', name: '🌌 Hiện đại & Tối giản', desc: 'Navy Blue & Kính mờ sang trọng' },
  { id: 'bloomberg_terminal', name: '📈 Wall Street Terminal', desc: 'Tone đen sâu & Vàng tài chính' },
  { id: 'editorial_magazine', name: '💎 Tạp chí Sang trọng', desc: 'Obsidian & Vàng Champagne' },
  { id: 'neon_cyber', name: '⚡ Cyberpunk Neon', desc: 'Cyan & Magenta FinTech tương lai' },
];

export default function SlidePreviewModal({
  isOpen,
  onClose,
  trend,
  onRenderVideo,
  isRendering = false,
}: SlidePreviewModalProps) {
  const { lang } = useI18n();

  const [script, setScript] = useState<VideoSlideScript | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('random');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit'>('preview');

  // Fetch script khi mở modal (Ưu tiên lấy kịch bản đã sinh trước đó)
  useEffect(() => {
    if (isOpen && trend?.id) {
      setErrorMsg(null);
      setIsLoading(true);
      setIsFromCache(false);
      fetch(`/api/trends/${trend.id}/slide-preview`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.script) {
            setScript(data.script);
            setIsFromCache(!!data.fromCache);
          } else {
            setErrorMsg(data.error || 'Không thể tải kịch bản slide');
          }
        })
        .catch((err) => {
          setErrorMsg(err.message || 'Lỗi kết nối khi tải slide');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, trend?.id]);

  // Sinh lại script bằng AI khi người dùng chủ động yêu cầu
  const handleRegenerateScript = async () => {
    if (!trend?.id) return;
    setIsRegenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/trends/${trend.id}/slide-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setScript(data.script);
        setIsFromCache(false);
      } else {
        setErrorMsg(data.error || 'Lỗi sinh lại kịch bản slide');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối');
    } finally {
      setIsRegenerating(false);
    }
  };

  // Lưu chỉnh sửa kịch bản vào CSDL
  const handleSaveEdits = async () => {
    if (!trend?.id || !script) return;
    setIsSavingEdits(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/trends/${trend.id}/slide-preview`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg(true);
        setTimeout(() => setSaveSuccessMsg(false), 2500);
      } else {
        setErrorMsg(data.error || 'Lỗi khi lưu kịch bản');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối');
    } finally {
      setIsSavingEdits(false);
    }
  };

  // Kích hoạt render video
  const handleStartRender = async () => {
    if (!trend?.id || !script) return;
    await onRenderVideo(trend.id, true, selectedTemplate, script);
    onClose();
  };

  if (!isOpen || !trend) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs pt-safe pb-safe animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/50 shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <Film className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                <span>{lang === 'vi' ? 'Xem trước kịch bản Video 9:16' : 'Video 9:16 Slide Preview'}</span>
              </span>
              {trend.video_generated === 1 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                  {lang === 'vi' ? 'Đã có video cũ' : 'Has existing video'}
                </span>
              )}
              {isFromCache && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-medium">
                  {lang === 'vi' ? '✓ Đã lưu kịch bản' : '✓ Saved script'}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
              {trend.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Template select + Regenerate + Mode switch */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 shrink-0">
              {lang === 'vi' ? 'Mẫu video:' : 'Template:'}
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="h-8 px-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-inherit focus:outline-hidden focus:border-purple-500"
            >
              {TEMPLATE_OPTIONS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Chuyển tab xem trước / chỉnh sửa */}
            <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 inline mr-1" />
                {lang === 'vi' ? 'Xem trước' : 'Preview'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  activeTab === 'edit'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 inline mr-1" />
                {lang === 'vi' ? 'Sửa chữ' : 'Edit'}
              </button>
            </div>

            {/* Nút sinh lại kịch bản với AI */}
            <button
              type="button"
              onClick={handleRegenerateScript}
              disabled={isLoading || isRegenerating || isRendering}
              className="btn btn-sm btn-secondary text-xs gap-1.5 font-semibold text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              title={lang === 'vi' ? 'Yêu cầu AI viết lại kịch bản slide khác' : 'Regenerate slide script with AI'}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin text-purple-500' : ''}`} />
              <span>{isRegenerating ? (lang === 'vi' ? 'Đang viết lại...' : 'Regenerating...') : (lang === 'vi' ? 'Viết lại slide' : 'Regenerate')}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {lang === 'vi' ? 'Đang đọc báo và xây dựng kịch bản slide 9:16...' : 'Generating 9:16 slide script...'}
              </p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {errorMsg}
            </div>
          ) : script ? (
            activeTab === 'preview' ? (
              /* TAB 1: VISUAL PREVIEW OF ALL SLIDES */
              <div className="space-y-4">
                {/* 1. SLIDE MỞ ĐẦU (INTRO) */}
                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800/80 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      SLIDE 1: MỞ ĐẦU (INTRO - 3 GIÂY)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-200/60 dark:bg-purple-900/60 font-mono">
                      {script.intro?.categoryLabel || 'BẢN TIN'}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    {script.intro?.mainTitle || trend.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 italic">
                    "{script.intro?.tagline || 'Cập nhật tin tức thị trường nhanh nhất'}"
                  </p>
                </div>

                {/* 2. SLIDE TIÊU ĐỀ (HEADLINE) */}
                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/80 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5" />
                      SLIDE 2: TIÊU ĐỀ CHÍNH (HEADLINE)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-200/60 dark:bg-blue-900/60 font-mono">
                      {script.slide1?.timestamp || 'Hôm nay'}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    {script.slide1?.headline || trend.title}
                  </h3>
                </div>

                {/* 3. CÁC SLIDE NỘI DUNG (CONTENT SLIDES) */}
                <div className="space-y-3">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-500" />
                    <span>NỘI DUNG CHI TIẾT & SỐ LIỆU ({script.contentSlides?.length || 0} NHÓM SLIDE)</span>
                  </div>

                  {(script.contentSlides || []).map((cs, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        <span>NHÓM {idx + 1}: {cs.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {cs.fragments?.length || 0} ý chính
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-2 border-l-2 border-indigo-500/40">
                        {(cs.fragments || []).map((frag, fIdx) => (
                          <div
                            key={fIdx}
                            className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: frag }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4. SLIDE KẾT THÚC (OUTRO) */}
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>SLIDE KẾT THÚC (OUTRO & KÊU GỌI TƯƠNG TÁC)</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {script.outro?.ctaText || 'Theo dõi kênh để đón xem bản tin tiếp theo!'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {script.outro?.subText || 'Bình luận ý kiến của bạn bên dưới.'}
                  </p>
                </div>
              </div>
            ) : (
              /* TAB 2: INLINE TEXT EDITING */
              <div className="space-y-4">
                {/* Edit Intro */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    Slide Mở đầu (Intro)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Nhãn chuyên mục:</label>
                      <input
                        type="text"
                        value={script.intro?.categoryLabel || ''}
                        onChange={(e) =>
                          setScript({
                            ...script,
                            intro: { ...script.intro, categoryLabel: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 app-input rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Tagline:</label>
                      <input
                        type="text"
                        value={script.intro?.tagline || ''}
                        onChange={(e) =>
                          setScript({
                            ...script,
                            intro: { ...script.intro, tagline: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 app-input rounded text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Tiêu đề lớn:</label>
                    <input
                      type="text"
                      value={script.intro?.mainTitle || ''}
                      onChange={(e) =>
                        setScript({
                          ...script,
                          intro: { ...script.intro, mainTitle: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 app-input rounded text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Edit Headline */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400">
                    Slide Tiêu đề (Headline)
                  </h4>
                  <div>
                    <label className="text-[11px] text-slate-500 block mb-0.5">Tiêu đề tin tức:</label>
                    <input
                      type="text"
                      value={script.slide1?.headline || ''}
                      onChange={(e) =>
                        setScript({
                          ...script,
                          slide1: { ...script.slide1, headline: e.target.value },
                        })
                      }
                      className="w-full h-8 px-2.5 app-input rounded text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Edit Content Slides */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    Nội dung chi tiết & Đoạn dẫn
                  </h4>
                  {(script.contentSlides || []).map((cs, cIdx) => (
                    <div key={cIdx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <label className="text-[11px] font-bold text-slate-500 block">
                        Nhóm {cIdx + 1} - Tiêu đề nhóm:
                      </label>
                      <input
                        type="text"
                        value={cs.title}
                        onChange={(e) => {
                          const newCS = [...script.contentSlides];
                          newCS[cIdx].title = e.target.value;
                          setScript({ ...script, contentSlides: newCS });
                        }}
                        className="w-full h-8 px-2.5 app-input rounded text-xs font-bold"
                      />

                      <div className="space-y-1.5 pt-1">
                        <label className="text-[10px] text-slate-400 block">Các đoạn dẫn dữ kiện:</label>
                        {(cs.fragments || []).map((frag, fIdx) => (
                          <textarea
                            key={fIdx}
                            rows={2}
                            value={frag.replace(/<[^>]*>/g, '')}
                            onChange={(e) => {
                              const newCS = [...script.contentSlides];
                              newCS[cIdx].fragments[fIdx] = e.target.value;
                              setScript({ ...script, contentSlides: newCS });
                            }}
                            className="w-full p-2 app-input rounded text-xs font-mono resize-y"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Edit Outro */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Slide Kết (Outro)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Lời kêu gọi (CTA):</label>
                      <input
                        type="text"
                        value={script.outro?.ctaText || ''}
                        onChange={(e) =>
                          setScript({
                            ...script,
                            outro: { ...script.outro, ctaText: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 app-input rounded text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Câu kết phụ:</label>
                      <input
                        type="text"
                        value={script.outro?.subText || ''}
                        onChange={(e) =>
                          setScript({
                            ...script,
                            outro: { ...script.outro, subText: e.target.value },
                          })
                        }
                        className="w-full h-8 px-2.5 app-input rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-ghost text-xs"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'edit' && (
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={isSavingEdits || !script}
                className="btn btn-sm btn-secondary text-xs gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {isSavingEdits
                    ? (lang === 'vi' ? 'Đang lưu...' : 'Saving...')
                    : saveSuccessMsg
                    ? (lang === 'vi' ? '✓ Đã lưu!' : '✓ Saved!')
                    : (lang === 'vi' ? 'Lưu kịch bản' : 'Save script')}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={handleStartRender}
              disabled={isLoading || isRendering || !script}
              className="btn btn-sm bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
            >
              {isRendering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === 'vi' ? 'Đang tạo video...' : 'Rendering...'}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>{lang === 'vi' ? 'Tạo Video với kịch bản này' : 'Render Video with this script'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
