'use client';

import React, { useState, useRef } from 'react';
import { ReelItem } from '@/types';
import {
  Film,
  Plus,
  Clock,
  Send,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Play,
  UploadCloud,
  FileVideo,
  X,
  Calendar,
  Sparkles,
  Loader2,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Video,
  Image as ImageIcon,
  Download,
} from 'lucide-react';
import { formatDateTime, formatDateDDMMYYYY, replaceDateWildcards } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';

interface ReelsTabProps {
  reels: ReelItem[];
  onRefresh: () => Promise<void>;
  onPublishReel: (reelId: string) => Promise<void>;
  onDeleteReel: (reelId: string) => Promise<void>;
  onUpdateReel: (
    reelId: string,
    data: { caption?: string; scheduled_at?: string | null; status?: string }
  ) => Promise<void>;
  onCreateReel: (data: {
    video_path: string;
    video_filename?: string;
    caption: string;
    scheduled_at?: string | null;
    status?: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  }) => Promise<void>;
  publishingReelId: string | null;
}

export default function ReelsTab({
  reels,
  onRefresh,
  onPublishReel,
  onDeleteReel,
  onUpdateReel,
  onCreateReel,
  publishingReelId,
}: ReelsTabProps) {
  const { t, lang, theme } = useI18n();

  // Filter state
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [previewVideoTitle, setPreviewVideoTitle] = useState<string>('');
  const [previewDebugVideo, setPreviewDebugVideo] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  // Edit modal
  const [editingReel, setEditingReel] = useState<ReelItem | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editIsScheduled, setEditIsScheduled] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Checking scheduled status
  const [isCheckingScheduled, setIsCheckingScheduled] = useState(false);

  // Create Reel form state
  const [inputMode, setInputMode] = useState<'upload' | 'local'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFilePath, setUploadedFilePath] = useState<string>('');
  const [uploadedFilename, setUploadedFilename] = useState<string>('');
  const [localFilePath, setLocalFilePath] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpandCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredReels = reels.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const getMinDateTimeLocal = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  const handleOpenCreateModal = () => {
    setSelectedFile(null);
    setUploadedFilePath('');
    setUploadedFilename('');
    setLocalFilePath('');
    setCaption('');
    setIsScheduled(false);
    // Default scheduled time to 1 hour from now
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);
    nextHour.setMinutes(nextHour.getMinutes() - nextHour.getTimezoneOffset());
    setScheduledAt(nextHour.toISOString().slice(0, 16));
    setInputMode('upload');
    setIsCreateModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/reels/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setUploadedFilePath(data.filePath);
        setUploadedFilename(data.filename);
      } else {
        alert(data.error || t('alert_upload_failed'));
        setSelectedFile(null);
      }
    } catch (err: any) {
      alert(`${t('alert_upload_failed')}: ${err.message}`);
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateSubmit = async (publishImmediate = false) => {
    let finalPath = '';
    let finalFilename = '';

    if (inputMode === 'upload') {
      if (!uploadedFilePath) {
        alert(t('alert_upload_select_first'));
        return;
      }
      finalPath = uploadedFilePath;
      finalFilename = uploadedFilename || selectedFile?.name || 'reel.mp4';
    } else {
      let clean = localFilePath.trim();
      if (
        (clean.startsWith('"') && clean.endsWith('"')) ||
        (clean.startsWith("'") && clean.endsWith("'"))
      ) {
        clean = clean.slice(1, -1).trim();
      }
      if (!clean) {
        alert(t('alert_local_path_required'));
        return;
      }
      finalPath = clean;
      finalFilename = clean.split(/[/\\]/).pop() || 'reel.mp4';
    }

    setIsSubmitting(true);
    try {
      let scheduleIso: string | null = null;
      let status: 'draft' | 'scheduled' = 'draft';

      if (!publishImmediate && isScheduled && scheduledAt) {
        scheduleIso = new Date(scheduledAt).toISOString();
        status = 'scheduled';
      }

      await onCreateReel({
        video_path: finalPath,
        video_filename: finalFilename,
        caption: caption.trim(),
        scheduled_at: scheduleIso,
        status,
      });

      setIsCreateModalOpen(false);

      if (publishImmediate) {
        // Find the newly created reel from fresh fetch and publish
        await onRefresh();
      }
    } catch (err: any) {
      alert(`${t('alert_create_failed')}: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (reel: ReelItem) => {
    setEditingReel(reel);
    setEditCaption(reel.caption || '');
    if (reel.scheduled_at) {
      setEditIsScheduled(true);
      const d = new Date(reel.scheduled_at);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setEditScheduledAt(d.toISOString().slice(0, 16));
    } else {
      setEditIsScheduled(false);
      const nextHour = new Date(Date.now() + 60 * 60 * 1000);
      nextHour.setMinutes(nextHour.getMinutes() - nextHour.getTimezoneOffset());
      setEditScheduledAt(nextHour.toISOString().slice(0, 16));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingReel) return;
    setIsSavingEdit(true);

    try {
      let scheduledIso: string | null = null;
      let newStatus = editingReel.status;

      if (editIsScheduled && editScheduledAt) {
        scheduledIso = new Date(editScheduledAt).toISOString();
        if (newStatus === 'draft' || newStatus === 'failed') {
          newStatus = 'scheduled';
        }
      } else {
        scheduledIso = null;
        if (newStatus === 'scheduled') {
          newStatus = 'draft';
        }
      }

      await onUpdateReel(editingReel.id, {
        caption: editCaption.trim(),
        scheduled_at: scheduledIso,
        status: newStatus,
      });

      setEditingReel(null);
    } catch (err: any) {
      alert(`${t('alert_update_failed')}: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCheckScheduled = async () => {
    setIsCheckingScheduled(true);
    try {
      const res = await fetch('/api/reels/check-scheduled', { method: 'POST' });
      const data = await res.json();
      await onRefresh();
      if (data.result?.processed > 0) {
        alert(
          t('alert_scheduled_processed')
            .replace('{count}', String(data.result.processed))
            .replace('{success}', String(data.result.successful))
            .replace('{failed}', String(data.result.failed))
        );
      } else {
        alert(t('alert_all_scheduled_pending'));
      }
    } catch (err: any) {
      alert(`${t('alert_check_scheduled_failed')}: ${err.message}`);
    } finally {
      setIsCheckingScheduled(false);
    }
  };

  const appendHashtag = (tag: string) => {
    setCaption((prev) => (prev.trim() ? `${prev.trim()} ${tag}` : tag));
  };

  const appendWildcard = (wc: string) => {
    setCaption((prev) => (prev.trim() ? `${prev.trim()} ${wc}` : wc));
  };

  const appendEditWildcard = (wc: string) => {
    setEditCaption((prev) => (prev.trim() ? `${prev.trim()} ${wc}` : wc));
  };

  const filterLabels: Record<string, string> = {
    all: t('filter_all'),
    draft: t('filter_draft'),
    scheduled: t('filter_scheduled'),
    publishing: t('filter_publishing_reel'),
    published: t('filter_published'),
    failed: t('filter_failed'),
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl app-card text-xs">
          {(['all', 'draft', 'scheduled', 'publishing', 'published', 'failed'] as const).map((st) => {
            const count = st === 'all' ? reels.length : reels.filter((r) => r.status === st).length;
            const isActive = filter === st;

            return (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost text-slate-500'
                  }`}
              >
                <span>{filterLabels[st]}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${isActive ? 'bg-black/20 text-white' : 'app-tag'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Check Scheduled Button */}
          <button
            onClick={handleCheckScheduled}
            disabled={isCheckingScheduled}
            className="btn btn-sm btn-secondary text-xs"
            title={t('check_schedule_tooltip')}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isCheckingScheduled ? 'animate-spin text-indigo-500' : ''}`} />
            <span className="hidden sm:inline">
              {isCheckingScheduled ? t('checking_schedule') : t('check_scheduled_btn')}
            </span>
          </button>

          {/* Add New Reel Button */}
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-sm btn-primary text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('add_reel_btn')}</span>
          </button>
        </div>
      </div>

      {/* Reel List */}
      {filteredReels.length === 0 ? (
        <div className="rounded-xl app-card p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">
              {filter === 'all'
                ? t('no_reels_title')
                : `${t('no_reels_status_prefix')} "${filterLabels[filter] || filter}"`}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t('no_reels_desc')}
            </p>
          </div>
          <div>
            <button
              onClick={handleOpenCreateModal}
              className="btn btn-sm btn-primary text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('add_reel_btn')}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReels.map((reel) => {
            const isPublishingThis = publishingReelId === reel.id || reel.status === 'publishing';
            const isDeletingThis = isDeletingId === reel.id;
            const isExpanded = !!expandedCaptions[reel.id];
            const videoApiUrl = reel.video_filename
              ? `/api/videos/${encodeURIComponent(reel.video_filename)}`
              : null;

            return (
              <div
                key={reel.id}
                className="rounded-xl app-card shadow-xs p-4 flex flex-col justify-between space-y-3 border border-[var(--app-border)] hover:border-indigo-400/50 transition-colors"
              >
                {/* Header: Status and Time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    {reel.status === 'published' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {t('reel_status_published')}
                      </span>
                    )}

                    {reel.status === 'scheduled' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {t('reel_status_scheduled')}
                      </span>
                    )}

                    {reel.status === 'draft' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        <FileVideo className="w-3 h-3 text-slate-500" />
                        {t('reel_status_draft')}
                      </span>
                    )}

                    {reel.status === 'publishing' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-amber-500" />
                        {t('reel_status_publishing')}
                      </span>
                    )}

                    {reel.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        {t('reel_status_failed')}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-mono" suppressHydrationWarning>
                    {formatDateTime(reel.created_at)}
                  </span>
                </div>

                {/* Scheduled Info Banner if Scheduled */}
                {reel.status === 'scheduled' && reel.scheduled_at && (
                  <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
                      <span className="font-semibold truncate">
                        {t('schedule_run_at')} {formatDateTime(reel.scheduled_at)}
                      </span>
                    </div>
                    {new Date(reel.scheduled_at).getTime() <= Date.now() && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 rounded">
                        {t('reel_due_now')}
                      </span>
                    )}
                  </div>
                )}

                {/* Error Banner if Failed */}
                {reel.status === 'failed' && (reel.error_message || reel.debug_video_path || reel.screenshot_path) && (
                  <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-[11px] text-rose-800 dark:text-rose-300 space-y-1.5">
                    {reel.error_message && (
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                        <span className="line-clamp-2">{reel.error_message}</span>
                      </div>
                    )}
                    {(reel.debug_video_path || reel.screenshot_path) && (
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-rose-200/50 dark:border-rose-800/40">
                        {reel.debug_video_path && (
                          <button
                            type="button"
                            onClick={() => setPreviewDebugVideo(reel.debug_video_path || null)}
                            className="inline-flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 hover:underline cursor-pointer"
                            title={t('debug_video_title')}
                          >
                            <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{t('debug_video')}</span>
                          </button>
                        )}
                        {reel.screenshot_path && (
                          <button
                            type="button"
                            onClick={() => setPreviewScreenshot(reel.screenshot_path || null)}
                            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:underline cursor-pointer"
                            title={t('debug_screenshot_title')}
                          >
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{t('screenshot')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Video Info & Player / Preview */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--app-border)]">
                  <div
                    onClick={() => {
                      if (videoApiUrl) {
                        setPreviewVideoUrl(videoApiUrl);
                        setPreviewVideoTitle(reel.video_filename || 'Video Reel');
                      }
                    }}
                    className="relative w-16 h-20 rounded-md bg-black shrink-0 overflow-hidden cursor-pointer group flex items-center justify-center shadow-xs"
                    title={t('click_to_preview_video')}
                  >
                    {videoApiUrl ? (
                      <video
                        src={videoApiUrl}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                        preload="metadata"
                      />
                    ) : (
                      <Film className="w-6 h-6 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                      <Play className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={reel.video_filename || reel.video_path}>
                      {reel.video_filename || reel.video_path.split(/[/\\]/).pop()}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate" title={reel.video_path}>
                      {reel.video_path}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      {videoApiUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewVideoUrl(videoApiUrl);
                            setPreviewVideoTitle(reel.video_filename || 'Video Reel');
                          }}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold hover:underline inline-flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          {t('preview_video')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Reel Caption */}
                <div className="space-y-1">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {t('reel_caption_label')}
                  </span>
                  {reel.caption ? (
                    <div>
                      <p
                        className={`text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed ${!isExpanded ? 'line-clamp-3' : ''
                          }`}
                      >
                        {reel.caption}
                      </p>
                      {reel.status !== 'published' && /%%DATE%%/i.test(reel.caption) && (
                        <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono mt-1">
                          ⚡ %%DATE%% → {formatDateDDMMYYYY()}
                        </p>
                      )}
                      {reel.caption.length > 140 && (
                        <button
                          onClick={() => toggleExpandCaption(reel.id)}
                          className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold mt-0.5 inline-flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <>
                              {t('collapse_caption')} <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              {t('read_more_caption')} <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">{t('no_caption_content')}</p>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-[var(--app-border)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* Publish Now Button (enabled for draft, scheduled, failed) */}
                    <button
                      onClick={() => onPublishReel(reel.id)}
                      disabled={isPublishingThis}
                      className="btn btn-sm btn-primary text-xs"
                      title={t('publish_reel_tooltip')}
                    >
                      {isPublishingThis ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{t('reel_status_publishing')}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{reel.status === 'published' ? t('btn_republish') : t('btn_publish_immediate')}</span>
                        </>
                      )}
                    </button>

                    {/* Edit / Reschedule Button */}
                    <button
                      onClick={() => handleStartEdit(reel)}
                      disabled={isPublishingThis}
                      className="btn btn-sm btn-secondary text-xs"
                      title={t('edit_reel_tooltip')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{reel.status === 'scheduled' ? t('btn_reschedule') : t('btn_edit')}</span>
                    </button>

                    {/* View on Facebook Link if available */}
                    {reel.fb_post_url && (
                      <a
                        href={reel.fb_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-ghost text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                        title={lang === 'vi' ? 'Mở xem Reel trên Facebook' : 'Open Reel on Facebook'}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{t('view_reel_button')}</span>
                      </a>
                    )}
                  </div>

                  {/* Delete Button with Confirmation */}
                  <div>
                    {confirmDeleteId === reel.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          disabled={isDeletingThis}
                          onClick={async () => {
                            setIsDeletingId(reel.id);
                            try {
                              await onDeleteReel(reel.id);
                            } finally {
                              setIsDeletingId(null);
                              setConfirmDeleteId(null);
                            }
                          }}
                          className="btn btn-sm text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                        >
                          {isDeletingThis ? t('deleting') : t('confirm_delete')}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="btn btn-sm btn-ghost text-xs"
                        >
                          {t('btn_cancel')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(reel.id)}
                        disabled={isPublishingThis}
                        className="btn btn-sm btn-ghost text-xs text-slate-400 hover:text-rose-600"
                        title={t('delete_reel_tooltip')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE REEL MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="app-card border border-[var(--app-border)] rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-[var(--app-text)]">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Film className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm sm:text-base text-[var(--app-text)]">
                  {t('add_reel_btn')}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Input Mode Switcher */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--app-text)]">
                {t('reel_video_source')} <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl app-subcard text-xs">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${inputMode === 'upload'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                    }`}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{t('upload_from_device')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('local')}
                  className={`py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${inputMode === 'local'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-[var(--app-text-secondary)] hover:text-[var(--app-text)] hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                    }`}
                >
                  <FileVideo className="w-3.5 h-3.5" />
                  <span>{t('local_file_path')}</span>
                </button>
              </div>

              {/* Mode: Upload */}
              {inputMode === 'upload' && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${uploadedFilePath
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-[var(--app-border)] bg-[var(--app-input-bg)] hover:border-indigo-500/80 hover:bg-indigo-500/5'
                      }`}
                  >
                    {isUploading ? (
                      <div className="py-3 flex flex-col items-center gap-2 text-indigo-400">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-semibold">{t('uploading_video_to_server')}</span>
                      </div>
                    ) : uploadedFilePath ? (
                      <div className="space-y-1">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                          <Check className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-semibold text-emerald-400">
                          {uploadedFilename || selectedFile?.name}
                        </p>
                        <p className="text-[11px] text-[var(--app-text-secondary)]">
                          {(selectedFile?.size ? (selectedFile.size / (1024 * 1024)).toFixed(2) : '0')} MB • {t('click_to_change_file')}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1 py-2">
                        <UploadCloud className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-semibold text-[var(--app-text)]">
                          {t('click_or_drag_video')}
                        </p>
                        <p className="text-[11px] text-[var(--app-text-secondary)]">
                          {t('supported_video_formats')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mode: Local Path */}
              {inputMode === 'local' && (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={localFilePath}
                    onChange={(e) => setLocalFilePath(e.target.value)}
                    placeholder={t('local_file_placeholder')}
                    className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] font-mono"
                  />
                  <p className="text-[11px] text-[var(--app-text-secondary)]">
                    {t('local_file_tip')}
                  </p>
                </div>
              )}
            </div>

            {/* Caption Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--app-text)]">
                  {t('reel_caption_label')}
                </label>
                <span className="text-[11px] text-[var(--app-text-muted)] font-mono">
                  {caption.length} {t('char_count')}
                </span>
              </div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                placeholder={t('reel_caption_placeholder')}
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] resize-none leading-relaxed"
              />

              {/* Quick Wildcards & Hashtags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => appendWildcard('%%DATE%%')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors"
                  title={lang === 'vi' ? 'Chèn wildcard %%DATE%% (tự động thay bằng ngày hiện tại DD/MM/YYYY)' : 'Insert %%DATE%% wildcard (auto replaced with DD/MM/YYYY)'}
                >
                  ✨ %%DATE%% ({formatDateDDMMYYYY()})
                </button>
                <span className="text-[11px] text-[var(--app-text-secondary)] font-semibold">{t('suggested_hashtags')}</span>
                {['#taichinh', '#chungkhoan', '#kinhte', '#tintuc', '#xuhuong', '#reelsfb'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => appendHashtag(tag)}
                    className="px-2 py-0.5 rounded text-[10px] font-mono app-tag hover:border-indigo-400 hover:text-indigo-400 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/%%DATE%%/i.test(caption) && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="font-semibold">{lang === 'vi' ? 'Xem trước khi xuất bản:' : 'Preview when published:'}</span>{' '}
                  {replaceDateWildcards(caption)}
                </p>
              )}
            </div>

            {/* Scheduling Section */}
            <div className="p-4 rounded-xl app-subcard space-y-3.5 border border-[var(--app-border)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--app-text)]">
                      {t('schedule_reel_toggle')}
                    </p>
                    <p className="text-[11px] text-[var(--app-text-secondary)] truncate">
                      {t('schedule_reel_desc')}
                    </p>
                  </div>
                </div>

                {/* Clean button toggle without native checkbox */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isScheduled}
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${isScheduled ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {isScheduled && (
                <div className="pt-3 border-t border-[var(--app-border)] space-y-2">
                  <label className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('schedule_time_label')}:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    min={getMinDateTimeLocal()}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    style={{ colorScheme: theme }}
                    className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)]"
                  />
                  {scheduledAt && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('will_publish_at')} {formatDateTime(scheduledAt)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-[var(--app-border)] flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting || isUploading}
                className="btn btn-sm btn-ghost text-xs"
              >
                {t('btn_cancel')}
              </button>

              {isScheduled ? (
                <button
                  type="button"
                  onClick={() => handleCreateSubmit(false)}
                  disabled={isSubmitting || isUploading}
                  className="btn btn-sm btn-primary text-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t('saving')}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>{t('schedule_submit')}</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleCreateSubmit(false)}
                    disabled={isSubmitting || isUploading}
                    className="btn btn-sm btn-secondary text-xs"
                  >
                    {isSubmitting ? t('saving') : t('save_as_draft')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCreateSubmit(true)}
                    disabled={isSubmitting || isUploading}
                    className="btn btn-sm btn-primary text-xs"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('publishing_progress')}</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{t('publish_reel_now')}</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT / RESCHEDULE MODAL */}
      {editingReel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="app-card border border-[var(--app-border)] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 text-[var(--app-text)]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--app-text)]">
                  {t('edit_reel_title')}
                </h3>
              </div>
              <button
                onClick={() => setEditingReel(null)}
                className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] p-1 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video filename display */}
            <div className="p-2.5 rounded-lg app-subcard border border-[var(--app-border)] flex items-center gap-2 text-xs">
              <Film className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold truncate text-[var(--app-text)]">
                {editingReel.video_filename || editingReel.video_path}
              </span>
            </div>

            {/* Caption */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)]">
                {t('reel_caption_label')}
              </label>
              <textarea
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                rows={4}
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] resize-none leading-relaxed"
              />

              {/* Quick Wildcards */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => appendEditWildcard('%%DATE%%')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors"
                  title={lang === 'vi' ? 'Chèn wildcard %%DATE%% (tự động thay bằng ngày hiện tại DD/MM/YYYY)' : 'Insert %%DATE%% wildcard (auto replaced with DD/MM/YYYY)'}
                >
                  ✨ %%DATE%% ({formatDateDDMMYYYY()})
                </button>
              </div>

              {/%%DATE%%/i.test(editCaption) && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="font-semibold">{lang === 'vi' ? 'Xem trước khi xuất bản:' : 'Preview when published:'}</span>{' '}
                  {replaceDateWildcards(editCaption)}
                </p>
              )}
            </div>

            {/* Schedule Toggle & Picker */}
            <div className="p-4 rounded-xl app-subcard space-y-3.5 border border-[var(--app-border)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--app-text)]">
                      {t('schedule_reel_toggle')}
                    </p>
                    <p className="text-[11px] text-[var(--app-text-secondary)] truncate">
                      {t('schedule_reel_desc')}
                    </p>
                  </div>
                </div>

                {/* Clean button toggle without native checkbox */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={editIsScheduled}
                  onClick={() => setEditIsScheduled(!editIsScheduled)}
                  className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 shrink-0 ${editIsScheduled ? 'bg-indigo-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
                    }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md"></div>
                </button>
              </div>

              {editIsScheduled && (
                <div className="pt-3 border-t border-[var(--app-border)] space-y-2">
                  <label className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('schedule_time_label')}:</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={editScheduledAt}
                    min={getMinDateTimeLocal()}
                    onChange={(e) => setEditScheduledAt(e.target.value)}
                    style={{ colorScheme: theme }}
                    className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)]"
                  />
                  {editScheduledAt && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 rounded-lg">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('will_publish_at')} {formatDateTime(editScheduledAt)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-2 border-t border-[var(--app-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingReel(null)}
                disabled={isSavingEdit}
                className="btn btn-sm btn-ghost text-xs"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="btn btn-sm btn-primary text-xs"
              >
                {isSavingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('saving')}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('btn_save_changes')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIDEO PREVIEW MODAL */}
      {previewVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="bg-slate-900 text-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold truncate text-slate-200 max-w-[320px]">
                {previewVideoTitle}
              </span>
              <button
                onClick={() => setPreviewVideoUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative aspect-[9/16] max-h-[65vh] mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video
                src={previewVideoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* DEBUG VIDEO MODAL (Playwright full screen recording) */}
      {previewDebugVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pt-safe pb-safe">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" /> {t('debug_video_title')}
              </h3>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/videos/${encodeURIComponent(previewDebugVideo)}`}
                  download={previewDebugVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('download_video')}</span>
                </a>
                <button
                  onClick={() => setPreviewDebugVideo(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-[75vh] overflow-hidden rounded-xl bg-slate-950 p-2 flex items-center justify-center">
              <video
                controls
                autoPlay
                src={`/api/videos/${encodeURIComponent(previewDebugVideo)}`}
                className="max-w-full max-h-[70vh] rounded-lg border border-slate-800 shadow-md"
              >
                Trình duyệt không hỗ trợ phát trực tiếp video định dạng webm. Vui lòng bấm &quot;Tải video&quot; để xem trên máy.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* SCREENSHOT PREVIEW MODAL */}
      {previewScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs pt-safe pb-safe">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> {t('debug_screenshot_title')}
              </h3>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 max-h-[75vh] overflow-y-auto rounded-xl bg-slate-950 p-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshots/${encodeURIComponent(previewScreenshot)}`}
                alt="Audit Screenshot"
                className="max-w-full h-auto rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

