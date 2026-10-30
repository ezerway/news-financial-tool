'use client';

import React, { useState } from 'react';
import { PostItem } from '@/types';
import {
  Send,
  Sparkles,
  ExternalLink,
  Trash2,
  Save,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import { formatDateTime } from '@/lib/date';
import { useI18n } from '@/context/I18nThemeContext';

interface PostsTabProps {
  posts: PostItem[];
  onPublish: (postId: string, dryRun: boolean) => Promise<void>;
  onComment?: (postId: string, postUrl?: string) => Promise<void>;
  onUpdate: (postId: string, postContent: string, commentContent: string) => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  publishingId: string | null;
  commentingId?: string | null;
}

export default function PostsTab({
  posts,
  onPublish,
  onComment,
  onUpdate,
  onDelete,
  publishingId,
  commentingId,
}: PostsTabProps) {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'failed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editCommentContent, setEditCommentContent] = useState('');
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [commentModalPost, setCommentModalPost] = useState<PostItem | null>(null);
  const [customPostUrl, setCustomPostUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedPosts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredPosts = posts.filter((p) => {
    if (filter === 'all') return true;
    return p.status === filter;
  });

  const handleStartEdit = (post: PostItem) => {
    setEditingId(post.id);
    setEditPostContent(post.post_content);
    setEditCommentContent(post.comment_content);
  };

  const handleSaveEdit = async (postId: string) => {
    await onUpdate(postId, editPostContent, editCommentContent);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 rounded-xl app-card text-xs">
        {(['all', 'draft', 'published', 'failed'] as const).map((st) => {
          const count = st === 'all' ? posts.length : posts.filter((p) => p.status === st).length;
          const labels = {
            all: t('filter_all'),
            draft: t('filter_draft'),
            published: t('filter_published'),
            failed: t('filter_failed'),
          };
          const isActive = filter === st;
          return (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`btn btn-sm ${
                isActive
                  ? 'btn-primary'
                  : 'btn-ghost text-slate-500'
              }`}
            >
              <span>{labels[st]}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-black/20 text-white' : 'app-tag'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Posts List */}
      {filteredPosts.length === 0 ? (
        <div className="p-10 text-center rounded-xl app-card">
          <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-inherit">{t('no_posts_title')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{t('no_posts_desc')}</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {filteredPosts.map((post) => {
            const isEditing = editingId === post.id;
            const isPublishing = publishingId === post.id;
            const isCommenting = commentingId === post.id;
            const isExpanded = !!expandedPosts[post.id];

            return (
              <div
                key={post.id}
                className="p-4 sm:p-5 rounded-xl app-card shadow-xs space-y-3.5"
              >
                {/* Header Row: Title, Created Date, Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-inherit capitalize">
                      {post.trend_title}
                    </span>
                    <span className="text-xs text-slate-400" suppressHydrationWarning>
                      • {formatDateTime(post.created_at)}
                    </span>
                  </div>


                  <div className="flex items-center gap-2">
                    {post.status === 'published' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle className="w-3 h-3 text-emerald-500" /> {t('filter_published')}
                      </span>
                    )}
                    {post.status === 'draft' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                        <Clock className="w-3 h-3 text-amber-500" /> {t('filter_draft')}
                      </span>
                    )}
                    {post.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">
                        <AlertCircle className="w-3 h-3 text-rose-500" /> {t('filter_failed')}
                      </span>
                    )}
                    {post.status === 'publishing' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 animate-pulse">
                        {t('filter_publishing')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {post.status === 'failed' && post.error_message && (
                  <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                    <span>{t('error_prefix')} {post.error_message}</span>
                  </div>
                )}

                {/* Content Section */}
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        <span>{t('fb_post_title')}</span>
                        <span className="text-[10px] font-mono text-slate-400">{editPostContent.length} {t('char_count')}</span>
                      </div>
                      <textarea
                        rows={7}
                        value={editPostContent}
                        onChange={(e) => setEditPostContent(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono leading-relaxed resize-y"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        <span>{t('comment_source_title')}</span>
                        <span className="text-[10px] font-mono text-slate-400">{editCommentContent.length} {t('char_count')}</span>
                      </div>
                      <textarea
                        rows={4}
                        value={editCommentContent}
                        onChange={(e) => setEditCommentContent(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:border-indigo-500 font-mono leading-relaxed resize-y"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Post Copy */}
                    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950/70 border border-slate-100 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                      <div className={!isExpanded ? 'line-clamp-4' : ''}>
                        {post.post_content}
                      </div>

                      {post.post_content.length > 200 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(post.id)}
                          className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" />
                              <span>{t('collapse')}</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" />
                              <span>{t('read_more')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Auto-comment preview */}
                    <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{t('comment_source_title')}</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{post.comment_content.length} ký tự</span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all line-clamp-2">
                        {post.comment_content}
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {/* Left: Meta links */}
                  <div className="flex items-center gap-3">
                    {post.fb_post_url && (
                      <a
                        href={post.fb_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        <FacebookIcon className="w-3.5 h-3.5" />
                        <span>{t('open_fb')} ↗</span>
                      </a>
                    )}

                    {post.screenshot_path && (
                      <button
                        type="button"
                        onClick={() => setPreviewScreenshot(post.screenshot_path || null)}
                        className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                        <span>{t('screenshot')}</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 ml-auto">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="btn btn-sm btn-ghost"
                        >
                          {t('btn_cancel')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(post.id)}
                          className="btn btn-sm btn-emerald"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{t('btn_save')}</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(post)}
                          className="btn btn-sm btn-secondary"
                        >
                          {t('btn_edit')}
                        </button>

                        {onComment && (
                          <button
                            type="button"
                            onClick={() => {
                              setCommentModalPost(post);
                              setCustomPostUrl(post.fb_post_url || '');
                            }}
                            disabled={isPublishing || isCommenting}
                            className="btn btn-sm btn-secondary"
                            title={t('btn_comment')}
                          >
                            <MessageSquare className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${isCommenting ? 'animate-spin' : ''}`} />
                            <span>{t('btn_comment')}</span>
                          </button>
                        )}

                        {post.status !== 'published' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onPublish(post.id, true)}
                              disabled={isPublishing || isCommenting}
                              className="btn btn-sm btn-secondary"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                              <span>{t('test_run')}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onPublish(post.id, false)}
                              disabled={isPublishing || isCommenting}
                              className="btn btn-sm btn-primary"
                            >
                              <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                              <span>{isPublishing ? t('filter_publishing') : t('publish_now')}</span>
                            </button>
                          </>
                        )}

                        {/* Delete confirmation */}
                        {confirmDeleteId === post.id ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                setIsDeletingId(post.id);
                                try {
                                  await onDelete(post.id);
                                } finally {
                                  setIsDeletingId(null);
                                  setConfirmDeleteId(null);
                                }
                              }}
                              disabled={isDeletingId === post.id}
                              className="btn btn-sm btn-danger"
                            >
                              {isDeletingId === post.id ? '...' : t('btn_delete')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="btn btn-sm btn-secondary"
                            >
                              {t('btn_cancel')}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(post.id)}
                            className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title={t('btn_delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Preview Modal */}
      {previewScreenshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> Ảnh chụp màn hình đối soát Playwright
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
                src={`/api/screenshots/${previewScreenshot}`}
                alt="Audit Screenshot"
                className="max-w-full h-auto rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {commentModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" /> Tự động gửi bình luận vào bài đã đăng
              </h3>
              <button
                onClick={() => setCommentModalPost(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <span className="text-slate-400 font-medium">Chủ đề bài viết:</span>
                <p className="font-bold text-white mt-0.5">{commentModalPost.trend_title}</p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Đường dẫn bài viết Facebook (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="https://www.facebook.com/... (để trống nếu muốn gửi vào bài mới nhất Fanpage)"
                  value={customPostUrl}
                  onChange={(e) => setCustomPostUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <span className="text-slate-400 font-medium">Bình luận nguồn sẽ gửi:</span>
                <div className="mt-1 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed">
                  {commentModalPost.comment_content}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setCommentModalPost(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Hủy
                </button>
                <button
                  onClick={async () => {
                    const postId = commentModalPost.id;
                    const url = customPostUrl.trim() || undefined;
                    setCommentModalPost(null);
                    if (onComment) {
                      await onComment(postId, url);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Bắt đầu gửi bình luận</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
