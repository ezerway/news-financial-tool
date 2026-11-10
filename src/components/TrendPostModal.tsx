'use client';

import React, { useState } from 'react';
import { TrendItem, PostItem } from '@/types';
import {
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Send,
  RotateCcw,
  ArrowRight,
  Zap,
  Clock,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import { formatDateTime } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';

export interface TrendPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  trend: TrendItem | null;
  post: PostItem | null;
  onGenerate?: (trendId: string) => Promise<void>;
  onRetryAndPublish?: (trendId: string) => Promise<void>;
  onPublishPost?: (postId: string, force?: boolean) => Promise<void>;
  onNavigateToPostsTab?: (postId?: string) => void;
  isGenerating?: boolean;
  isPublishing?: boolean;
}

export default function TrendPostModal({
  isOpen,
  onClose,
  trend,
  post,
  onGenerate,
  onRetryAndPublish,
  onPublishPost,
  onNavigateToPostsTab,
  isGenerating = false,
  isPublishing = false,
}: TrendPostModalProps) {
  const { lang } = useI18n();
  const [copiedType, setCopiedType] = useState<'post' | 'comment' | null>(null);

  if (!isOpen || !trend) return null;

  const handleCopy = async (text: string, type: 'post' | 'comment') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const hasSourceLinks =
    Array.isArray(trend.articles) &&
    trend.articles.some((a) => a.url && !a.url.includes('google.com'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs pt-safe pb-safe animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800/80 flex items-start justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                <FileText className="w-3 h-3" />
                <span>{lang === 'vi' ? 'Bài viết xu hướng' : 'Trend Post'}</span>
              </span>

              {post ? (
                post.status === 'published' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    <span>{lang === 'vi' ? 'Đã đăng Facebook' : 'Published'}</span>
                  </span>
                ) : post.status === 'failed' ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                    <AlertCircle className="w-2.5 h-2.5" />
                    <span>{lang === 'vi' ? 'Xuất bản thất bại' : 'Failed'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                    <FileEdit className="w-2.5 h-2.5" />
                    <span>{lang === 'vi' ? 'Bản thảo sẵn sàng' : 'Draft Ready'}</span>
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                  <span>{lang === 'vi' ? 'Chưa tạo bài' : 'Not generated'}</span>
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white capitalize leading-tight">
              {trend.title}
            </h3>

            {post?.published_at && (
              <p className="text-[11px] text-slate-400 flex items-center gap-1" suppressHydrationWarning>
                <Clock className="w-3 h-3" />
                <span>
                  {lang === 'vi' ? 'Đăng lúc:' : 'Published at:'} {formatDateTime(post.published_at)}
                </span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {post ? (
            <>
              {/* Direct Facebook Post Link if published */}
              {post.fb_post_url && (
                <div className="p-3 sm:p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FacebookIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-emerald-800 dark:text-emerald-300 text-xs truncate">
                        {lang === 'vi' ? 'Đã xuất bản thành công lên Facebook' : 'Published on Facebook'}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                        {post.fb_post_url}
                      </div>
                    </div>
                  </div>

                  <a
                    href={post.fb_post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-primary bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5"
                  >
                    <span>{lang === 'vi' ? 'Xem bài viết' : 'View post'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Error Message if failed */}
              {post.status === 'failed' && post.error_message && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-xs">{lang === 'vi' ? 'Lỗi xuất bản bài viết:' : 'Publish error:'}</div>
                    <div className="text-[11px] mt-0.5 leading-relaxed">{post.error_message}</div>
                  </div>
                </div>
              )}

              {/* Post Content */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{lang === 'vi' ? 'Nội dung bài viết Facebook:' : 'Facebook post caption:'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(post.post_content, 'post')}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    {copiedType === 'post' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{lang === 'vi' ? 'Sao chép' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed max-h-56 overflow-y-auto">
                  {post.post_content}
                </div>
              </div>

              {/* Comment Content (Source Links) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">#</span>
                    <span>{lang === 'vi' ? 'Bình luận nguồn bài viết (First Comment):' : 'First comment (sources):'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(post.comment_content, 'comment')}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    {copiedType === 'comment' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">{lang === 'vi' ? 'Đã sao chép' : 'Copied'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>{lang === 'vi' ? 'Sao chép' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans text-xs leading-relaxed max-h-36 overflow-y-auto">
                  {post.comment_content}
                </div>
              </div>

              {/* Attached Screenshot Preview if exists */}
              {post.screenshot_path && (
                <div className="space-y-1.5 pt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{lang === 'vi' ? 'Ảnh đối soát màn hình đăng bài:' : 'Audit screenshot:'}</span>
                  </span>
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 p-1 flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/screenshots/${post.screenshot_path}`}
                      alt="Publish Screenshot"
                      className="max-h-52 w-auto object-contain rounded-lg"
                    />
                  </div>
                </div>
              )}

              {/* Recorded Process Video if exists (Dev Mode or Error) */}
              {post.video_path && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      <span>{lang === 'vi' ? 'Video quay lại quá trình đăng:' : 'Posting process video:'}</span>
                    </span>
                    <a
                      href={`/api/videos/${encodeURIComponent(post.video_path)}`}
                      download={post.video_path}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {lang === 'vi' ? 'Tải video' : 'Download'}
                    </a>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black p-1 flex justify-center">
                    <video
                      controls
                      src={`/api/videos/${encodeURIComponent(post.video_path)}`}
                      className="max-h-60 w-full rounded-lg"
                      preload="metadata"
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* No Post Generated Yet */
            <div className="p-8 sm:p-10 text-center rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'vi' ? 'Chưa có bài viết cho xu hướng này' : 'No post generated yet'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                  {hasSourceLinks
                    ? lang === 'vi'
                      ? 'Xu hướng đã có nguồn báo chí sẵn sàng. Bạn có thể bấm "Tạo bài viết với AI" để hệ thống tự động soạn thảo ngay!'
                      : 'Trend has news sources ready. Click "Generate with AI" to create a post!'
                    : lang === 'vi'
                    ? 'Xu hướng này chưa có link nguồn báo chí. Bạn có thể bấm "Tìm nguồn & Đăng bài" để AI tự động tìm nguồn bài báo chính thống và tạo bài viết.'
                    : 'This trend is missing sources. Click "Find Sources & Publish" to discover articles and post.'}
                </p>
              </div>

              {/* Source Articles summary if available */}
              {Array.isArray(trend.articles) && trend.articles.length > 0 && (
                <div className="pt-2 text-left">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1.5">
                    {lang === 'vi' ? 'Các bài báo nguồn liên quan:' : 'Related news sources:'}
                  </span>
                  <div className="space-y-1.5">
                    {trend.articles.map((art, idx) => (
                      <a
                        key={idx}
                        href={art.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs hover:border-indigo-500 transition group"
                      >
                        <span className="truncate pr-2 font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">
                          {art.title}
                        </span>
                        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-secondary text-xs"
          >
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {post ? (
              <>
                {onNavigateToPostsTab && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToPostsTab(post.id);
                    }}
                    className="btn btn-sm btn-secondary text-xs inline-flex items-center gap-1.5"
                  >
                    <span>{lang === 'vi' ? 'Quản lý trong tab Bài viết' : 'Manage in Posts tab'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {onPublishPost && (
                  post.status === 'published' ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onPublishPost(post.id, true);
                      }}
                      disabled={isPublishing}
                      className="btn btn-sm btn-primary bg-indigo-600 hover:bg-indigo-700 text-white text-xs inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                      <span>{isPublishing ? (lang === 'vi' ? 'Đang đăng lại...' : 'Republishing...') : (lang === 'vi' ? 'Đăng lại lên Fanpage' : 'Republish')}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await onPublishPost(post.id);
                      }}
                      disabled={isPublishing}
                      className="btn btn-sm btn-primary text-xs inline-flex items-center gap-1.5"
                    >
                      <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                      <span>{isPublishing ? (lang === 'vi' ? 'Đang đăng...' : 'Publishing...') : (lang === 'vi' ? 'Đăng ngay lên Fanpage' : 'Publish now')}</span>
                    </button>
                  )
                )}
              </>
            ) : (
              <>
                {hasSourceLinks && onGenerate ? (
                  <button
                    type="button"
                    onClick={async () => {
                      onClose();
                      await onGenerate(trend.id);
                    }}
                    disabled={isGenerating}
                    className="btn btn-sm btn-primary text-xs inline-flex items-center gap-1.5"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? (lang === 'vi' ? 'Đang tạo bài...' : 'Generating...') : (lang === 'vi' ? 'Tạo bài viết với AI' : 'Generate with AI')}</span>
                  </button>
                ) : onRetryAndPublish ? (
                  <button
                    type="button"
                    onClick={async () => {
                      onClose();
                      await onRetryAndPublish(trend.id);
                    }}
                    className="btn btn-sm btn-primary bg-amber-600 hover:bg-amber-700 text-white text-xs inline-flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>{lang === 'vi' ? 'Tìm nguồn & Đăng bài ngay' : 'Find sources & publish'}</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

