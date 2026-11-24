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
  MessageSquare,
  Link2,
} from 'lucide-react';
import { formatDateTime, formatDateDDMMYYYY, replaceDateWildcards } from '@/lib/date';
import Pagination from './Pagination';
import TikTokIcon from './TikTokIcon';
import FacebookIcon from './FacebookIcon';
import YouTubeIcon from './YouTubeIcon';
import ZaloIcon from './ZaloIcon';
import { useI18n } from '@/context/I18nThemeContext';

interface ReelsTabProps {
  reels: ReelItem[];
  onRefresh: () => Promise<void>;
  onPublishReel: (reelId: string) => Promise<void>;
  onPublishTikTok?: (reelId: string) => Promise<void>;
  onPublishYouTube?: (reelId: string) => Promise<void>;
  onPublishZalo?: (reelId: string) => Promise<void>;
  onDeleteReel: (reelId: string) => Promise<void>;
  onUpdateReel: (
    reelId: string,
    data: {
      caption?: string;
      comment_content?: string | null;
      scheduled_at?: string | null;
      status?: string;
      fb_post_url?: string | null;
      tiktok_post_url?: string | null;
      tiktok_status?: string | null;
      tiktok_comment_status?: string | null;
      youtube_post_url?: string | null;
      youtube_status?: string | null;
      youtube_comment_status?: string | null;
      zalo_post_url?: string | null;
      zalo_status?: string | null;
      zalo_comment_status?: string | null;
    }
  ) => Promise<void>;
  onCreateReel: (data: {
    video_path: string;
    video_filename?: string;
    caption: string;
    comment_content?: string | null;
    scheduled_at?: string | null;
    status?: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  }) => Promise<void>;
  publishingReelId: string | null;
  publishingTikTokId?: string | null;
  publishingYouTubeId?: string | null;
  publishingZaloId?: string | null;
  onCommentReel?: (reelId: string) => Promise<void>;
  commentingReelId?: string | null;
  onCommentTikTokReel?: (reelId: string) => Promise<void>;
  commentingTikTokId?: string | null;
  onCommentYouTubeReel?: (reelId: string) => Promise<void>;
  commentingYouTubeId?: string | null;
  onCommentZaloReel?: (reelId: string) => Promise<void>;
  commentingZaloId?: string | null;
}

export default function ReelsTab({
  reels,
  onRefresh,
  onPublishReel,
  onPublishTikTok,
  onPublishYouTube,
  onPublishZalo,
  onDeleteReel,
  onUpdateReel,
  onCreateReel,
  publishingReelId,
  publishingTikTokId,
  publishingYouTubeId,
  publishingZaloId,
  onCommentReel,
  commentingReelId,
  onCommentTikTokReel,
  commentingTikTokId,
  onCommentYouTubeReel,
  commentingYouTubeId,
  onCommentZaloReel,
  commentingZaloId,
}: ReelsTabProps) {
  const { t, lang, theme } = useI18n();

  // Filter state
  const [filter, setFilter] = useState<'all' | 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [previewDebugVideo, setPreviewDebugVideo] = useState<string | null>(null);
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);

  // Edit modal
  const [editingReel, setEditingReel] = useState<ReelItem | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editCommentContent, setEditCommentContent] = useState('');
  const [editFbPostUrl, setEditFbPostUrl] = useState('');
  const [editTikTokPostUrl, setEditTikTokPostUrl] = useState('');
  const [editYouTubePostUrl, setEditYouTubePostUrl] = useState('');
  const [editZaloPostUrl, setEditZaloPostUrl] = useState('');
  const [editIsScheduled, setEditIsScheduled] = useState(false);
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Quick Correct Link modal
  const [correctingLinkReel, setCorrectingLinkReel] = useState<ReelItem | null>(null);
  const [correctFbUrl, setCorrectFbUrl] = useState('');
  const [correctTikTokUrl, setCorrectTikTokUrl] = useState('');
  const [correctYouTubeUrl, setCorrectYouTubeUrl] = useState('');
  const [correctZaloUrl, setCorrectZaloUrl] = useState('');
  const [correctMarkFbPublished, setCorrectMarkFbPublished] = useState(true);
  const [correctMarkTikTokPublished, setCorrectMarkTikTokPublished] = useState(true);
  const [correctMarkYouTubePublished, setCorrectMarkYouTubePublished] = useState(true);
  const [correctMarkZaloPublished, setCorrectMarkZaloPublished] = useState(true);
  const [isSavingCorrectLink, setIsSavingCorrectLink] = useState(false);

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
  const [commentContent, setCommentContent] = useState<string>('');
  const [isScheduled, setIsScheduled] = useState<boolean>(false);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [expandedCaptions, setExpandedCaptions] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpandCaption = (id: string) => {
    setExpandedCaptions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredReels = reels.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const totalItems = filteredReels.length;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedReels = filteredReels.slice(startIndex, startIndex + pageSize);

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
    setCommentContent('');
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
        comment_content: commentContent.trim() || null,
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
    setEditCommentContent(reel.comment_content || '');
    setEditFbPostUrl(reel.fb_post_url || '');
    setEditTikTokPostUrl(reel.tiktok_post_url || '');
    setEditYouTubePostUrl(reel.youtube_post_url || '');
    setEditZaloPostUrl(reel.zalo_post_url || '');
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
        comment_content: editCommentContent.trim() || null,
        scheduled_at: scheduledIso,
        status: newStatus,
        fb_post_url: editFbPostUrl.trim() || null,
        tiktok_post_url: editTikTokPostUrl.trim() || null,
        youtube_post_url: editYouTubePostUrl.trim() || null,
        zalo_post_url: editZaloPostUrl.trim() || null,
      });

      setEditingReel(null);
    } catch (err: any) {
      alert(`${t('alert_update_failed')}: ${err.message}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleStartCorrectLink = (reel: ReelItem) => {
    setCorrectingLinkReel(reel);
    setCorrectFbUrl(reel.fb_post_url || '');
    setCorrectTikTokUrl(reel.tiktok_post_url || '');
    setCorrectYouTubeUrl(reel.youtube_post_url || '');
    setCorrectZaloUrl(reel.zalo_post_url || '');
    setCorrectMarkFbPublished(reel.status !== 'published');
    setCorrectMarkTikTokPublished(reel.tiktok_status !== 'published');
    setCorrectMarkYouTubePublished(reel.youtube_status !== 'published');
    setCorrectMarkZaloPublished(reel.zalo_status !== 'published');
  };

  const handleSaveCorrectLink = async () => {
    if (!correctingLinkReel) return;
    setIsSavingCorrectLink(true);

    try {
      const trimmedFb = correctFbUrl.trim() || null;
      const trimmedTikTok = correctTikTokUrl.trim() || null;
      const trimmedYouTube = correctYouTubeUrl.trim() || null;
      const trimmedZalo = correctZaloUrl.trim() || null;

      const updateData: any = {
        fb_post_url: trimmedFb,
        tiktok_post_url: trimmedTikTok,
        youtube_post_url: trimmedYouTube,
        zalo_post_url: trimmedZalo,
      };

      if (trimmedFb && correctMarkFbPublished && correctingLinkReel.status !== 'published') {
        updateData.status = 'published';
      }

      if (trimmedTikTok && correctMarkTikTokPublished && correctingLinkReel.tiktok_status !== 'published') {
        updateData.tiktok_status = 'published';
      }

      if (trimmedYouTube && correctMarkYouTubePublished && correctingLinkReel.youtube_status !== 'published') {
        updateData.youtube_status = 'published';
      }

      if (trimmedZalo && correctMarkZaloPublished && correctingLinkReel.zalo_status !== 'published') {
        updateData.zalo_status = 'published';
      }

      await onUpdateReel(correctingLinkReel.id, updateData);
      setCorrectingLinkReel(null);
    } catch (err: any) {
      alert(`${lang === 'vi' ? 'Lỗi cập nhật liên kết' : 'Error updating links'}: ${err.message}`);
    } finally {
      setIsSavingCorrectLink(false);
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

  const appendCommentWildcard = (wc: string) => {
    setCommentContent((prev) => (prev.trim() ? `${prev.trim()} ${wc}` : wc));
  };

  const appendEditCommentWildcard = (wc: string) => {
    setEditCommentContent((prev) => (prev.trim() ? `${prev.trim()} ${wc}` : wc));
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
                onClick={() => {
                  setFilter(st);
                  setCurrentPage(1);
                }}
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
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedReels.map((reel) => {
              const isPublishingThis = publishingReelId === reel.id || reel.status === 'publishing';
              const isPublishingTikTokThis =
                (publishingTikTokId && publishingTikTokId === reel.id) || reel.tiktok_status === 'publishing';
              const isPublishingYouTubeThis =
                (publishingYouTubeId && publishingYouTubeId === reel.id) || reel.youtube_status === 'publishing';
              const isPublishingZaloThis =
                (publishingZaloId && publishingZaloId === reel.id) || reel.zalo_status === 'publishing';
              const isPublishingAny =
                isPublishingThis || isPublishingTikTokThis || isPublishingYouTubeThis || isPublishingZaloThis;
              const isDeletingThis = isDeletingId === reel.id;
              const isExpanded = !!expandedCaptions[reel.id];

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
                  {((reel.status === 'failed' && (reel.error_message || reel.debug_video_path || reel.screenshot_path)) ||
                    (reel.tiktok_status === 'failed' && (reel.tiktok_error_message || reel.tiktok_debug_video_path || reel.tiktok_screenshot_path)) ||
                    (reel.tiktok_comment_status === 'failed' && (reel.tiktok_error_message || reel.tiktok_debug_video_path || reel.tiktok_screenshot_path)) ||
                    (reel.youtube_status === 'failed' && (reel.youtube_error_message || reel.youtube_debug_video_path || reel.youtube_screenshot_path)) ||
                    (reel.zalo_status === 'failed' && (reel.zalo_error_message || reel.zalo_debug_video_path || reel.zalo_screenshot_path))) && (
                      <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-800/40 text-[11px] text-rose-800 dark:text-rose-300 space-y-1.5">
                        {reel.error_message && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                            <span className="line-clamp-2">[FB] {reel.error_message}</span>
                          </div>
                        )}
                        {reel.tiktok_error_message && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                            <span className="line-clamp-2">[TikTok] {reel.tiktok_error_message}</span>
                          </div>
                        )}
                        {reel.youtube_error_message && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500 mt-0.5" />
                            <span className="line-clamp-2">[YouTube] {reel.youtube_error_message}</span>
                          </div>
                        )}
                        {reel.zalo_error_message && (
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-blue-500 mt-0.5" />
                            <span className="line-clamp-2">[Zalo] {reel.zalo_error_message}</span>
                          </div>
                        )}
                        {(reel.debug_video_path || reel.tiktok_debug_video_path || reel.youtube_debug_video_path || reel.zalo_debug_video_path || reel.screenshot_path || reel.tiktok_screenshot_path || reel.youtube_screenshot_path || reel.zalo_screenshot_path) && (
                          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-rose-200/50 dark:border-rose-800/40">
                            {reel.debug_video_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewDebugVideo(reel.debug_video_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 hover:underline cursor-pointer"
                                title={t('debug_video_title')}
                              >
                                <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{t('fb_video_error')}</span>
                              </button>
                            )}
                            {reel.tiktok_debug_video_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewDebugVideo(reel.tiktok_debug_video_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 hover:underline cursor-pointer"
                                title={lang === 'vi' ? 'Xem video quá trình lỗi TikTok' : 'Watch TikTok error video'}
                              >
                                <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{t('tiktok_video_error')}</span>
                              </button>
                            )}
                            {reel.youtube_debug_video_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewDebugVideo(reel.youtube_debug_video_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-100 hover:underline cursor-pointer"
                                title={lang === 'vi' ? 'Xem video quá trình lỗi YouTube' : 'Watch YouTube error video'}
                              >
                                <Video className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{lang === 'vi' ? 'Video lỗi YouTube' : 'YouTube Error Video'}</span>
                              </button>
                            )}
                            {reel.zalo_debug_video_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewDebugVideo(reel.zalo_debug_video_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 hover:underline cursor-pointer"
                                title={lang === 'vi' ? 'Xem video quá trình lỗi Zalo' : 'Watch Zalo error video'}
                              >
                                <Video className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{lang === 'vi' ? 'Video lỗi Zalo' : 'Zalo Error Video'}</span>
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
                                <span>{lang === 'vi' ? 'Ảnh FB' : 'FB Screenshot'}</span>
                              </button>
                            )}
                            {reel.tiktok_screenshot_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshot(reel.tiktok_screenshot_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:underline cursor-pointer"
                                title={t('tiktok_screenshot_error')}
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>{lang === 'vi' ? 'Ảnh TikTok' : 'TikTok Screenshot'}</span>
                              </button>
                            )}
                            {reel.youtube_screenshot_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshot(reel.youtube_screenshot_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:underline cursor-pointer"
                                title={lang === 'vi' ? 'Xem ảnh chụp màn hình lỗi YouTube' : 'View YouTube error screenshot'}
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span>{lang === 'vi' ? 'Ảnh YouTube' : 'YouTube Screenshot'}</span>
                              </button>
                            )}
                            {reel.zalo_screenshot_path && (
                              <button
                                type="button"
                                onClick={() => setPreviewScreenshot(reel.zalo_screenshot_path || null)}
                                className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:underline cursor-pointer"
                                title={lang === 'vi' ? 'Xem ảnh chụp màn hình lỗi Zalo' : 'View Zalo error screenshot'}
                              >
                                <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span>{lang === 'vi' ? 'Ảnh Zalo' : 'Zalo Screenshot'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Video Info & Thumbnail */}
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--app-border)]">
                    <div
                      className="relative w-14 h-16 sm:w-16 sm:h-20 rounded-lg bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0 overflow-hidden flex flex-col items-center justify-center shadow-xs border border-slate-700/60"
                      title={reel.video_filename || 'Video Reel'}
                    >
                      <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20 shadow-xs">
                        <Play className="w-3.5 h-3.5 fill-white text-white ml-0.5" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate" title={reel.video_filename || reel.video_path}>
                        {reel.video_filename || reel.video_path.split(/[/\\]/).pop()}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono truncate" title={reel.video_path}>
                        {reel.video_path}
                      </p>
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

                  {/* Auto Comment Preview */}
                  {reel.comment_content && (() => {
                    const comments = reel.comment_content
                      .split(/\r?\n|\|/)
                      .map((c) => c.trim())
                      .filter(Boolean);

                    return (
                      <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-[var(--app-border)]">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            💬 {lang === 'vi' ? 'Bình luận tự động' : 'Auto Comment'}
                            {comments.length > 1 && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-normal">
                                {comments.length} {lang === 'vi' ? 'bình luận' : 'comments'}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {reel.comment_status && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${reel.comment_status === 'commented'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : reel.comment_status === 'failed'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}
                              >
                                {reel.comment_status === 'commented'
                                  ? (lang === 'vi' ? '✓ FB: Đã bình luận' : '✓ FB: Commented')
                                  : reel.comment_status === 'failed'
                                    ? (lang === 'vi' ? '✗ FB: Lỗi' : '✗ FB: Failed')
                                    : (lang === 'vi' ? '○ FB: Chờ' : '○ FB: Pending')}
                              </span>
                            )}
                            {reel.tiktok_status === 'published' && reel.tiktok_comment_status && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${reel.tiktok_comment_status === 'commented'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : reel.tiktok_comment_status === 'failed'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}
                              >
                                {reel.tiktok_comment_status === 'commented'
                                  ? (lang === 'vi' ? '✓ TT: Đã bình luận' : '✓ TT: Commented')
                                  : reel.tiktok_comment_status === 'failed'
                                    ? (lang === 'vi' ? '✗ TT: Lỗi' : '✗ TT: Failed')
                                    : (lang === 'vi' ? '○ TT: Chờ' : '○ TT: Pending')}
                              </span>
                            )}
                            {reel.youtube_status === 'published' && reel.youtube_comment_status && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${reel.youtube_comment_status === 'commented'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : reel.youtube_comment_status === 'failed'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}
                              >
                                {reel.youtube_comment_status === 'commented'
                                  ? (lang === 'vi' ? '✓ YT: Đã bình luận' : '✓ YT: Commented')
                                  : reel.youtube_comment_status === 'failed'
                                    ? (lang === 'vi' ? '✗ YT: Lỗi' : '✗ YT: Failed')
                                    : (lang === 'vi' ? '○ YT: Chờ' : '○ YT: Pending')}
                              </span>
                            )}
                            {reel.zalo_status === 'published' && reel.zalo_comment_status && (
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${reel.zalo_comment_status === 'commented'
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    : reel.zalo_comment_status === 'failed'
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                      : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}
                              >
                                {reel.zalo_comment_status === 'commented'
                                  ? (lang === 'vi' ? '✓ ZL: Đã bình luận' : '✓ ZL: Commented')
                                  : reel.zalo_comment_status === 'failed'
                                    ? (lang === 'vi' ? '✗ ZL: Lỗi' : '✗ ZL: Failed')
                                    : (lang === 'vi' ? '○ ZL: Chờ' : '○ ZL: Pending')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Comment Items */}
                        {comments.length > 1 ? (
                          <div className="space-y-1.5 mt-1">
                            {comments.map((cText, idx) => (
                              <div
                                key={idx}
                                className="p-2 rounded-md bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 text-xs text-slate-700 dark:text-slate-200 leading-relaxed break-all shadow-2xs"
                              >
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-0.5">
                                  <span className="w-3.5 h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center font-mono text-[9px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <span>{lang === 'vi' ? `Bình luận #${idx + 1}` : `Comment #${idx + 1}`}</span>
                                </div>
                                <div className="whitespace-pre-wrap">{cText}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-all">
                            {reel.comment_content}
                          </p>
                        )}

                        {reel.status !== 'published' && /%%DATE%%/i.test(reel.comment_content) && (
                          <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono mt-0.5">
                            ⚡ %%DATE%% → {formatDateDDMMYYYY()}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Bottom Actions - 2-tier Modern Responsive Layout */}
                  <div className="pt-2 border-t border-[var(--app-border)] space-y-2">
                    {/* Tier 1: Platform Channels (Facebook, TikTok, YouTube & Zalo in 2x2 grid) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
                      {/* Facebook Channel Box */}
                      <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 flex flex-col justify-between gap-2 h-full">
                        <div className="flex items-center justify-between gap-1 min-h-[20px]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 min-w-0">
                            <FacebookIcon className="w-3.5 h-3.5 fill-blue-600 dark:fill-blue-400 shrink-0" />
                            <span className="whitespace-nowrap font-semibold">Facebook Reel</span>
                            {reel.status === 'published' && reel.comment_status === 'commented' && (
                              <span className="text-[10px] text-emerald-500 font-medium shrink-0">✓ Đã cmt</span>
                            )}
                          </div>
                          {reel.fb_post_url ? (
                            <a
                              href={reel.fb_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                              title={lang === 'vi' ? 'Mở xem Reel trên Facebook' : 'Open Reel on Facebook'}
                            >
                              <span>{lang === 'vi' ? 'Xem Reel' : 'View Reel'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic shrink-0">
                              {lang === 'vi' ? 'Chưa có link' : 'No link'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onPublishReel(reel.id)}
                            disabled={isPublishingAny}
                            className="flex-1 min-w-0 btn btn-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg border border-blue-500 shadow-2xs active:scale-[0.98] transition-all"
                            title={t('publish_reel_tooltip')}
                          >
                            {isPublishingThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                <span className="truncate whitespace-nowrap">{t('reel_status_publishing')}</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3 shrink-0" />
                                <span className="truncate whitespace-nowrap">
                                  {reel.status === 'published'
                                    ? (lang === 'vi' ? 'Đăng lại' : 'Republish')
                                    : (lang === 'vi' ? 'Đăng FB' : 'Post FB')}
                                </span>
                              </>
                            )}
                          </button>

                          {reel.status === 'published' && onCommentReel && (
                            <button
                              onClick={() => onCommentReel(reel.id)}
                              disabled={isPublishingThis || isPublishingTikTokThis || commentingReelId === reel.id}
                              className="flex-1 min-w-0 btn btn-xs text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg font-semibold border border-blue-300 dark:border-blue-700/70 bg-white hover:bg-blue-50 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Gửi bình luận vào Reel Facebook' : 'Comment on Facebook Reel'}
                            >
                              {commentingReelId === reel.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" />
                                  <span className="truncate whitespace-nowrap">{lang === 'vi' ? 'Gửi...' : 'Commenting...'}</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.comment_status === 'commented'
                                      ? (lang === 'vi' ? 'Bình luận lại' : 'Re-comment')
                                      : (lang === 'vi' ? 'Bình luận' : 'Comment')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* TikTok Channel Box */}
                      <div className="p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 flex flex-col justify-between gap-2 h-full">
                        <div className="flex items-center justify-between gap-1 min-h-[20px]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 min-w-0">
                            <TikTokIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap font-semibold">TikTok</span>
                            {reel.tiktok_status === 'published' && reel.tiktok_comment_status === 'commented' && (
                              <span className="text-[10px] text-emerald-500 font-medium shrink-0">✓ Đã cmt</span>
                            )}
                            {reel.tiktok_status === 'publishing' && (
                              <span className="text-[10px] text-amber-500 inline-flex items-center gap-0.5 font-normal shrink-0">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                <span>{lang === 'vi' ? 'Đang đăng...' : 'Posting...'}</span>
                              </span>
                            )}
                            {reel.tiktok_status === 'failed' && (
                              <span
                                className="text-[10px] text-rose-500 inline-flex items-center gap-0.5 cursor-help font-normal shrink-0"
                                title={reel.tiktok_error_message || (lang === 'vi' ? 'Đăng TikTok lỗi' : 'TikTok post failed')}
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>{t('tiktok_status_failed')}</span>
                              </span>
                            )}
                          </div>

                          {reel.tiktok_post_url ? (
                            <a
                              href={reel.tiktok_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                              title={lang === 'vi' ? 'Mở xem video trên TikTok' : 'Open video on TikTok'}
                            >
                              <span>TikTok</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic shrink-0">
                              {lang === 'vi' ? 'Chưa có link' : 'No link'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onPublishTikTok && (
                            <button
                              onClick={() => onPublishTikTok(reel.id)}
                              disabled={isPublishingAny}
                              className="flex-1 min-w-0 btn btn-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg border border-rose-500 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Xuất bản video lên TikTok' : 'Publish video to TikTok'}
                            >
                              {isPublishingTikTokThis ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  <span className="truncate whitespace-nowrap">TikTok...</span>
                                </>
                              ) : (
                                <>
                                  <TikTokIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.tiktok_status === 'published'
                                      ? (lang === 'vi' ? 'Đăng lại' : 'Republish')
                                      : (lang === 'vi' ? 'Đăng TikTok' : 'Post TikTok')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}

                          {reel.tiktok_status === 'published' && onCommentTikTokReel && (
                            <button
                              onClick={() => onCommentTikTokReel(reel.id)}
                              disabled={isPublishingThis || isPublishingTikTokThis || commentingTikTokId === reel.id}
                              className="flex-1 min-w-0 btn btn-xs text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg font-semibold border border-rose-300 dark:border-rose-700/70 bg-white hover:bg-rose-50 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Gửi bình luận vào video TikTok' : 'Comment on TikTok video'}
                            >
                              {commentingTikTokId === reel.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-rose-500 shrink-0" />
                                  <span className="truncate whitespace-nowrap">{lang === 'vi' ? 'Gửi...' : 'Commenting...'}</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.tiktok_comment_status === 'commented'
                                      ? (lang === 'vi' ? 'Bình luận lại' : 'Re-comment')
                                      : (lang === 'vi' ? 'Bình luận' : 'Comment')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* YouTube Shorts Channel Box */}
                      <div className="p-2.5 rounded-lg bg-red-50/50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-900/40 flex flex-col justify-between gap-2 h-full">
                        <div className="flex items-center justify-between gap-1 min-h-[20px]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-300 min-w-0">
                            <YouTubeIcon className="w-3.5 h-3.5 text-red-600 shrink-0" />
                            <span className="whitespace-nowrap font-semibold">YouTube Shorts</span>
                            {reel.youtube_status === 'published' && reel.youtube_comment_status === 'commented' && (
                              <span className="text-[10px] text-emerald-500 font-medium shrink-0">✓ Đã cmt</span>
                            )}
                            {reel.youtube_status === 'publishing' && (
                              <span className="text-[10px] text-amber-500 inline-flex items-center gap-0.5 font-normal shrink-0">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                <span>{lang === 'vi' ? 'Đang đăng...' : 'Posting...'}</span>
                              </span>
                            )}
                            {reel.youtube_status === 'failed' && (
                              <span
                                className="text-[10px] text-red-500 inline-flex items-center gap-0.5 cursor-help font-normal shrink-0"
                                title={reel.youtube_error_message || (lang === 'vi' ? 'Đăng YouTube lỗi' : 'YouTube post failed')}
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>{lang === 'vi' ? 'Lỗi' : 'Failed'}</span>
                              </span>
                            )}
                          </div>

                          {reel.youtube_post_url ? (
                            <a
                              href={reel.youtube_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                              title={lang === 'vi' ? 'Mở xem video trên YouTube Shorts' : 'Open video on YouTube Shorts'}
                            >
                              <span>Shorts</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic shrink-0">
                              {lang === 'vi' ? 'Chưa có link' : 'No link'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onPublishYouTube && (
                            <button
                              onClick={() => onPublishYouTube(reel.id)}
                              disabled={isPublishingAny}
                              className="flex-1 min-w-0 btn btn-xs bg-red-600 hover:bg-red-700 text-white font-semibold text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg border border-red-500 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Xuất bản video lên YouTube Shorts' : 'Publish video to YouTube Shorts'}
                            >
                              {isPublishingYouTubeThis ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  <span className="truncate whitespace-nowrap">Shorts...</span>
                                </>
                              ) : (
                                <>
                                  <YouTubeIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.youtube_status === 'published'
                                      ? (lang === 'vi' ? 'Đăng lại' : 'Republish')
                                      : (lang === 'vi' ? 'Đăng Shorts' : 'Post Shorts')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}

                          {(reel.youtube_status === 'published' || reel.youtube_post_url) && onCommentYouTubeReel && (
                            <button
                              onClick={() => onCommentYouTubeReel(reel.id)}
                              disabled={isPublishingThis || isPublishingTikTokThis || isPublishingYouTubeThis || commentingYouTubeId === reel.id}
                              className="flex-1 min-w-0 btn btn-xs text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg font-semibold border border-red-300 dark:border-red-700/70 bg-white hover:bg-red-50 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Gửi bình luận vào video YouTube Shorts' : 'Comment on YouTube Shorts video'}
                            >
                              {commentingYouTubeId === reel.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-red-500 shrink-0" />
                                  <span className="truncate whitespace-nowrap">{lang === 'vi' ? 'Gửi...' : 'Commenting...'}</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.youtube_comment_status === 'commented'
                                      ? (lang === 'vi' ? 'Bình luận lại' : 'Re-comment')
                                      : (lang === 'vi' ? 'Bình luận' : 'Comment')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Zalo Video Channel Box */}
                      <div className="p-2.5 rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-200/60 dark:border-sky-900/40 flex flex-col justify-between gap-2 h-full">
                        <div className="flex items-center justify-between gap-1 min-h-[20px]">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300 min-w-0">
                            <ZaloIcon className="w-3.5 h-3.5 text-[#0068FF] shrink-0" />
                            <span className="whitespace-nowrap font-semibold">Zalo Video</span>
                            {reel.zalo_status === 'published' && reel.zalo_comment_status === 'commented' && (
                              <span className="text-[10px] text-emerald-500 font-medium shrink-0">✓ Đã cmt</span>
                            )}
                            {reel.zalo_status === 'publishing' && (
                              <span className="text-[10px] text-amber-500 inline-flex items-center gap-0.5 font-normal shrink-0">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                <span>{lang === 'vi' ? 'Đang đăng...' : 'Posting...'}</span>
                              </span>
                            )}
                            {reel.zalo_status === 'failed' && (
                              <span
                                className="text-[10px] text-sky-500 inline-flex items-center gap-0.5 cursor-help font-normal shrink-0"
                                title={reel.zalo_error_message || (lang === 'vi' ? 'Đăng Zalo lỗi' : 'Zalo post failed')}
                              >
                                <AlertCircle className="w-2.5 h-2.5" />
                                <span>{lang === 'vi' ? 'Lỗi' : 'Failed'}</span>
                              </span>
                            )}
                          </div>

                          {reel.zalo_post_url ? (
                            <a
                              href={reel.zalo_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-0.5 font-medium shrink-0"
                              title={lang === 'vi' ? 'Mở xem video trên Zalo Video' : 'Open video on Zalo Video'}
                            >
                              <span>Zalo</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic shrink-0">
                              {lang === 'vi' ? 'Chưa có link' : 'No link'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {onPublishZalo && (
                            <button
                              onClick={() => onPublishZalo(reel.id)}
                              disabled={isPublishingAny}
                              className="flex-1 min-w-0 btn btn-xs bg-[#0068FF] hover:bg-[#0054d1] text-white font-semibold text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg border border-[#0068FF] shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Xuất bản video lên Zalo Video' : 'Publish video to Zalo Video'}
                            >
                              {isPublishingZaloThis ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                  <span className="truncate whitespace-nowrap">Zalo...</span>
                                </>
                              ) : (
                                <>
                                  <ZaloIcon className="w-3 h-3 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.zalo_status === 'published'
                                      ? (lang === 'vi' ? 'Đăng lại' : 'Republish')
                                      : (lang === 'vi' ? 'Đăng Zalo' : 'Post Zalo')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}

                          {(reel.zalo_status === 'published' || reel.zalo_post_url) && onCommentZaloReel && (
                            <button
                              onClick={() => onCommentZaloReel(reel.id)}
                              disabled={isPublishingThis || isPublishingTikTokThis || isPublishingYouTubeThis || isPublishingZaloThis || commentingZaloId === reel.id}
                              className="flex-1 min-w-0 btn btn-xs text-xs py-1.5 inline-flex items-center justify-center gap-1 rounded-lg font-semibold border border-sky-300 dark:border-sky-700/70 bg-white hover:bg-sky-50 dark:bg-sky-950/40 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 shadow-2xs active:scale-[0.98] transition-all cursor-pointer"
                              title={lang === 'vi' ? 'Gửi bình luận vào video Zalo Video' : 'Comment on Zalo Video'}
                            >
                              {commentingZaloId === reel.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin text-sky-500 shrink-0" />
                                  <span className="truncate whitespace-nowrap">{lang === 'vi' ? 'Gửi...' : 'Commenting...'}</span>
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                  <span className="truncate whitespace-nowrap">
                                    {reel.zalo_comment_status === 'commented'
                                      ? (lang === 'vi' ? 'Bình luận lại' : 'Re-comment')
                                      : (lang === 'vi' ? 'Bình luận' : 'Comment')}
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tier 2: Management Toolbar (Edit, Correct Links, Debug Videos, Delete) */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 text-xs">
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Edit Caption / Schedule */}
                        <button
                          onClick={() => handleStartEdit(reel)}
                          disabled={isPublishingThis || isPublishingTikTokThis}
                          className="btn btn-xs btn-ghost text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
                          title={t('edit_reel_tooltip')}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{reel.status === 'scheduled' ? t('btn_reschedule') : t('btn_edit')}</span>
                        </button>

                        {/* Manual Link Correction */}
                        <button
                          onClick={() => handleStartCorrectLink(reel)}
                          disabled={isPublishingThis || isPublishingTikTokThis}
                          className="btn btn-xs btn-ghost text-cyan-700 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 inline-flex items-center gap-1 cursor-pointer"
                          title={lang === 'vi' ? 'Chỉnh sửa liên kết Facebook Reel / TikTok thủ công' : 'Correct Facebook Reel / TikTok links manually'}
                        >
                          <Link2 className="w-3 h-3 text-cyan-500" />
                          <span>{lang === 'vi' ? 'Sửa link' : 'Edit links'}</span>
                        </button>

                        {/* Debug Video Facebook */}
                        {reel.debug_video_path && reel.status !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => setPreviewDebugVideo(reel.debug_video_path || null)}
                            className="btn btn-xs btn-ghost text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 inline-flex items-center gap-1 cursor-pointer"
                            title={lang === 'vi' ? 'Xem video quay lại quá trình đăng Facebook' : 'View Facebook post process video'}
                          >
                            <Video className="w-3 h-3 text-indigo-500" />
                            <span>Video FB</span>
                          </button>
                        )}

                        {/* Debug Video TikTok */}
                        {reel.tiktok_debug_video_path && reel.tiktok_status !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => setPreviewDebugVideo(reel.tiktok_debug_video_path || null)}
                            className="btn btn-xs btn-ghost text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer"
                            title={lang === 'vi' ? 'Xem video quay lại quá trình đăng TikTok' : 'View TikTok post process video'}
                          >
                            <Video className="w-3 h-3 text-rose-500" />
                            <span>Video TT</span>
                          </button>
                        )}

                        {/* Debug Video YouTube */}
                        {reel.youtube_debug_video_path && reel.youtube_status !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => setPreviewDebugVideo(reel.youtube_debug_video_path || null)}
                            className="btn btn-xs btn-ghost text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1 cursor-pointer"
                            title={lang === 'vi' ? 'Xem video quay lại quá trình đăng YouTube' : 'View YouTube post process video'}
                          >
                            <Video className="w-3 h-3 text-red-500" />
                            <span>Video YT</span>
                          </button>
                        )}

                        {/* Debug Video Zalo */}
                        {reel.zalo_debug_video_path && reel.zalo_status !== 'failed' && (
                          <button
                            type="button"
                            onClick={() => setPreviewDebugVideo(reel.zalo_debug_video_path || null)}
                            className="btn btn-xs btn-ghost text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 inline-flex items-center gap-1 cursor-pointer"
                            title={lang === 'vi' ? 'Xem video quay lại quá trình đăng Zalo Video' : 'View Zalo Video post process video'}
                          >
                            <Video className="w-3 h-3 text-sky-500" />
                            <span>Video Zalo</span>
                          </button>
                        )}
                      </div>

                      {/* Delete Reel */}
                      <div className="shrink-0">
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
                              className="btn btn-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60"
                            >
                              {isDeletingThis ? t('deleting') : t('confirm_delete')}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="btn btn-xs btn-ghost text-slate-500"
                            >
                              {t('btn_cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(reel.id)}
                            disabled={isPublishingThis}
                            className="btn btn-xs btn-ghost text-slate-400 hover:text-rose-600 p-1"
                            title={t('delete_reel_tooltip')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[6, 10, 20, 50]}
          />
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

            {/* Auto Comment Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--app-text)] flex items-center gap-1">
                  💬 {lang === 'vi' ? 'Bình luận tự động (First Comment - Tùy chọn)' : 'Auto Comment (Optional)'}
                </label>
                <span className="text-[11px] text-[var(--app-text-muted)] font-mono">
                  {commentContent.length} {t('char_count')}
                </span>
              </div>
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                rows={3}
                placeholder={lang === 'vi' ? 'Nhập nội dung bình luận tự động ngay sau khi đăng Reel (hỗ trợ %%DATE%%, link nguồn, hashtag)...' : 'Auto comment content after Reel is published (supports %%DATE%%, links, hashtags)...'}
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] resize-none leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => appendCommentWildcard('%%DATE%%')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors"
                  title={lang === 'vi' ? 'Chèn wildcard %%DATE%% (tự động thay bằng ngày hiện tại DD/MM/YYYY)' : 'Insert %%DATE%% wildcard (auto replaced with DD/MM/YYYY)'}
                >
                  ✨ %%DATE%% ({formatDateDDMMYYYY()})
                </button>
              </div>

              {/%%DATE%%/i.test(commentContent) && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="font-semibold">{lang === 'vi' ? 'Xem trước bình luận:' : 'Preview comment:'}</span>{' '}
                  {replaceDateWildcards(commentContent)}
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

            {/* Auto Comment Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)] flex items-center gap-1">
                💬 {lang === 'vi' ? 'Bình luận tự động (First Comment - Tùy chọn)' : 'Auto Comment (Optional)'}
              </label>
              <textarea
                value={editCommentContent}
                onChange={(e) => setEditCommentContent(e.target.value)}
                rows={3}
                placeholder={lang === 'vi' ? 'Nhập nội dung bình luận tự động ngay sau khi đăng Reel (hỗ trợ %%DATE%%, link nguồn, hashtag)...' : 'Auto comment content after Reel is published (supports %%DATE%%, links, hashtags)...'}
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] resize-none leading-relaxed"
              />

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => appendEditCommentWildcard('%%DATE%%')}
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors"
                  title={lang === 'vi' ? 'Chèn wildcard %%DATE%% (tự động thay bằng ngày hiện tại DD/MM/YYYY)' : 'Insert %%DATE%% wildcard (auto replaced with DD/MM/YYYY)'}
                >
                  ✨ %%DATE%% ({formatDateDDMMYYYY()})
                </button>
              </div>

              {/%%DATE%%/i.test(editCommentContent) && (
                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded-lg border border-indigo-200/50 dark:border-indigo-800/50">
                  <span className="font-semibold">{lang === 'vi' ? 'Xem trước bình luận:' : 'Preview comment:'}</span>{' '}
                  {replaceDateWildcards(editCommentContent)}
                </p>
              )}
            </div>

            {/* Social Media Links (Facebook & TikTok) */}
            <div className="p-3.5 rounded-xl app-subcard space-y-3 border border-[var(--app-border)]">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-[var(--app-text)]">
                  {lang === 'vi' ? 'Liên kết bài đăng mạng xã hội (Tùy chọn)' : 'Social Media Links (Optional)'}
                </span>
              </div>

              {/* FB Reel Link */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--app-text)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                    <span>{lang === 'vi' ? 'Link Facebook Reel:' : 'Facebook Reel Link:'}</span>
                  </span>
                  {editFbPostUrl && (
                    <a
                      href={editFbPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-1"
                      title={lang === 'vi' ? 'Mở thử liên kết' : 'Test link in new tab'}
                    >
                      <span>Mở thử</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  value={editFbPostUrl}
                  onChange={(e) => setEditFbPostUrl(e.target.value)}
                  placeholder="https://www.facebook.com/reel/123456789..."
                  className="app-input w-full text-xs p-2 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </div>

              {/* TikTok Link */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--app-text)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <TikTokIcon className="w-3.5 h-3.5 text-rose-500" />
                    <span>{lang === 'vi' ? 'Link TikTok Video:' : 'TikTok Video Link:'}</span>
                  </span>
                  {editTikTokPostUrl && (
                    <a
                      href={editTikTokPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-rose-500 hover:underline inline-flex items-center gap-1"
                      title={lang === 'vi' ? 'Mở thử liên kết' : 'Test link in new tab'}
                    >
                      <span>Mở thử</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  value={editTikTokPostUrl}
                  onChange={(e) => setEditTikTokPostUrl(e.target.value)}
                  placeholder="https://www.tiktok.com/@channel/video/7428123456789..."
                  className="app-input w-full text-xs p-2 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </div>

              {/* YouTube Shorts Link */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--app-text)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <YouTubeIcon className="w-3.5 h-3.5 text-red-500" />
                    <span>{lang === 'vi' ? 'Link YouTube Shorts:' : 'YouTube Shorts Link:'}</span>
                  </span>
                  {editYouTubePostUrl && (
                    <a
                      href={editYouTubePostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-red-500 hover:underline inline-flex items-center gap-1"
                      title={lang === 'vi' ? 'Mở thử liên kết' : 'Test link in new tab'}
                    >
                      <span>Mở thử</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  value={editYouTubePostUrl}
                  onChange={(e) => setEditYouTubePostUrl(e.target.value)}
                  placeholder="https://www.youtube.com/shorts/..."
                  className="app-input w-full text-xs p-2 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </div>

              {/* Zalo Video Link */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-[var(--app-text)] flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ZaloIcon className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Link Zalo Video:' : 'Zalo Video Link:'}</span>
                  </span>
                  {editZaloPostUrl && (
                    <a
                      href={editZaloPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline inline-flex items-center gap-1"
                      title={lang === 'vi' ? 'Mở thử liên kết' : 'Test link in new tab'}
                    >
                      <span>Mở thử</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </label>
                <input
                  type="url"
                  value={editZaloPostUrl}
                  onChange={(e) => setEditZaloPostUrl(e.target.value)}
                  placeholder="https://video.zalo.me/creator/phan-tich/noi-dung/video-..."
                  className="app-input w-full text-xs p-2 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
                />
              </div>
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

      {/* CORRECT LINK MODAL (Quick edit FB & TikTok links) */}
      {correctingLinkReel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs pt-safe pb-safe">
          <div className="relative max-w-lg w-full app-card rounded-2xl p-5 shadow-2xl border border-[var(--app-border)] space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm sm:text-base text-[var(--app-text)]">
                  {lang === 'vi' ? 'Chỉnh sửa liên kết mạng xã hội' : 'Correct Social Media Links'}
                </h3>
              </div>
              <button
                onClick={() => setCorrectingLinkReel(null)}
                className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video filename display */}
            <div className="p-2.5 rounded-lg app-subcard border border-[var(--app-border)] flex items-center gap-2 text-xs">
              <Film className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="font-semibold truncate text-[var(--app-text)]">
                {correctingLinkReel.video_filename || correctingLinkReel.video_path}
              </span>
            </div>

            {/* Facebook Reel Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
                  <span>{lang === 'vi' ? 'Link Facebook Reel:' : 'Facebook Reel Link:'}</span>
                </span>
                {correctFbUrl && (
                  <a
                    href={correctFbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{lang === 'vi' ? 'Mở thử' : 'Test open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={correctFbUrl}
                onChange={(e) => setCorrectFbUrl(e.target.value)}
                placeholder="https://www.facebook.com/reel/123456789..."
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
              <p className="text-[10px] text-[var(--app-text-secondary)]">
                {lang === 'vi'
                  ? 'Dán link Reel công khai trên Facebook để xem và thực hiện bình luận tự động.'
                  : 'Paste the public Facebook Reel link to view and comment.'}
              </p>
            </div>

            {/* TikTok Video Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <TikTokIcon className="w-3.5 h-3.5 text-rose-500" />
                  <span>{lang === 'vi' ? 'Link TikTok Video:' : 'TikTok Video Link:'}</span>
                </span>
                {correctTikTokUrl && (
                  <a
                    href={correctTikTokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-rose-500 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{lang === 'vi' ? 'Mở thử' : 'Test open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={correctTikTokUrl}
                onChange={(e) => setCorrectTikTokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@channel/video/7428123456789..."
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
              <p className="text-[10px] text-[var(--app-text-secondary)]">
                {lang === 'vi'
                  ? 'Dán link video TikTok để xem và thực hiện bình luận tự động qua TikTok Studio.'
                  : 'Paste the TikTok video link to view and comment via TikTok Studio.'}
              </p>
            </div>

            {/* YouTube Shorts Video Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <YouTubeIcon className="w-3.5 h-3.5 text-red-500" />
                  <span>{lang === 'vi' ? 'Link YouTube Shorts:' : 'YouTube Shorts Link:'}</span>
                </span>
                {correctYouTubeUrl && (
                  <a
                    href={correctYouTubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-red-500 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{lang === 'vi' ? 'Mở thử' : 'Test open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={correctYouTubeUrl}
                onChange={(e) => setCorrectYouTubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/shorts/..."
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
              <p className="text-[10px] text-[var(--app-text-secondary)]">
                {lang === 'vi'
                  ? 'Dán link video YouTube Shorts để xem và thực hiện bình luận tự động.'
                  : 'Paste the YouTube Shorts video link to view and comment.'}
              </p>
            </div>

            {/* Zalo Video Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--app-text)] flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ZaloIcon className="w-3.5 h-3.5" />
                  <span>{lang === 'vi' ? 'Link Zalo Video:' : 'Zalo Video Link:'}</span>
                </span>
                {correctZaloUrl && (
                  <a
                    href={correctZaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-blue-500 hover:underline inline-flex items-center gap-1"
                  >
                    <span>{lang === 'vi' ? 'Mở thử' : 'Test open'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={correctZaloUrl}
                onChange={(e) => setCorrectZaloUrl(e.target.value)}
                placeholder="https://video.zalo.me/creator/phan-tich/noi-dung/video-..."
                className="app-input w-full text-xs p-2.5 rounded-lg border border-[var(--app-border)] font-mono text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]"
              />
              <p className="text-[10px] text-[var(--app-text-secondary)]">
                {lang === 'vi'
                  ? 'Dán link video Zalo Video để xem và thực hiện bình luận tự động.'
                  : 'Paste the Zalo Video link to view and comment.'}
              </p>
            </div>

            {/* Status updates options */}
            <div className="p-3 rounded-lg app-subcard border border-[var(--app-border)] space-y-2">
              <div className="text-[11px] font-semibold text-[var(--app-text)]">
                {lang === 'vi' ? 'Tùy chọn trạng thái:' : 'Status options:'}
              </div>
              {correctingLinkReel.status !== 'published' && (
                <label className="flex items-center gap-2 text-xs text-[var(--app-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={correctMarkFbPublished}
                    onChange={(e) => setCorrectMarkFbPublished(e.target.checked)}
                    className="rounded border-[var(--app-border)] text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    {lang === 'vi'
                      ? 'Đánh dấu Reel Facebook là "Đã xuất bản" (Published) nếu có link'
                      : 'Mark Facebook Reel as "Published" if link is provided'}
                  </span>
                </label>
              )}
              {correctingLinkReel.tiktok_status !== 'published' && (
                <label className="flex items-center gap-2 text-xs text-[var(--app-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={correctMarkTikTokPublished}
                    onChange={(e) => setCorrectMarkTikTokPublished(e.target.checked)}
                    className="rounded border-[var(--app-border)] text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    {lang === 'vi'
                      ? 'Đánh dấu video TikTok là "Đã xuất bản" (Published) nếu có link'
                      : 'Mark TikTok video as "Published" if link is provided'}
                  </span>
                </label>
              )}
              {correctingLinkReel.youtube_status !== 'published' && (
                <label className="flex items-center gap-2 text-xs text-[var(--app-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={correctMarkYouTubePublished}
                    onChange={(e) => setCorrectMarkYouTubePublished(e.target.checked)}
                    className="rounded border-[var(--app-border)] text-red-600 focus:ring-red-500"
                  />
                  <span>
                    {lang === 'vi'
                      ? 'Đánh dấu YouTube Shorts là "Đã xuất bản" (Published) nếu có link'
                      : 'Mark YouTube Shorts as "Published" if link is provided'}
                  </span>
                </label>
              )}
              {correctingLinkReel.zalo_status !== 'published' && (
                <label className="flex items-center gap-2 text-xs text-[var(--app-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={correctMarkZaloPublished}
                    onChange={(e) => setCorrectMarkZaloPublished(e.target.checked)}
                    className="rounded border-[var(--app-border)] text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    {lang === 'vi'
                      ? 'Đánh dấu Zalo Video là "Đã xuất bản" (Published) nếu có link'
                      : 'Mark Zalo Video as "Published" if link is provided'}
                  </span>
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-[var(--app-border)] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCorrectingLinkReel(null)}
                disabled={isSavingCorrectLink}
                className="btn btn-sm btn-ghost text-xs cursor-pointer"
              >
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={handleSaveCorrectLink}
                disabled={isSavingCorrectLink}
                className="btn btn-sm btn-primary text-xs cursor-pointer"
              >
                {isSavingCorrectLink ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('saving')}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Lưu liên kết' : 'Save Links'}</span>
                  </>
                )}
              </button>
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
                {t('video_play_unsupported')}
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

