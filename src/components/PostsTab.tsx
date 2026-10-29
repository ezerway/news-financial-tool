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
} from 'lucide-react';
import FacebookIcon from './FacebookIcon';
import { formatDateTime } from '@/lib/date';

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
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'failed'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPostContent, setEditPostContent] = useState('');
  const [editCommentContent, setEditCommentContent] = useState('');
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(null);
  const [commentModalPost, setCommentModalPost] = useState<PostItem | null>(null);
  const [customPostUrl, setCustomPostUrl] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

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
    <div className="space-y-5">
      {/* Status Segmented Filter Bar */}
      <div className="p-2 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-lg flex items-center justify-between overflow-x-auto">
        <div className="inline-flex items-center gap-1.5">
          {(['all', 'draft', 'published', 'failed'] as const).map((st) => {
            const count = st === 'all' ? posts.length : posts.filter((p) => p.status === st).length;
            const labels = {
              all: 'Tất cả',
              draft: 'Bản thảo',
              published: 'Đã đăng',
              failed: 'Lỗi',
            };
            const isActive = filter === st;
            return (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{labels[st]}</span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Posts Cards */}
      {filteredPosts.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800/80">
          <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">Không có bài viết nào</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Hãy sang tab &quot;Xu hướng&quot; và bấm &quot;Tạo bài&quot; để sinh nội dung tự động.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const isEditing = editingId === post.id;
            const isPublishing = publishingId === post.id;
            const isCommenting = commentingId === post.id;

            return (
              <div
                key={post.id}
                className="p-5 sm:p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 backdrop-blur-md shadow-xl transition-all"
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base font-extrabold text-white capitalize tracking-tight">{post.trend_title}</span>
                    <span className="text-xs text-slate-500 font-medium" suppressHydrationWarning>
                      • {formatDateTime(post.created_at)}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {post.status === 'published' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Đã đăng
                      </span>
                    )}
                    {post.status === 'draft' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> Bản thảo
                      </span>
                    )}
                    {post.status === 'failed' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 shadow-sm">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Lỗi
                      </span>
                    )}
                    {post.status === 'publishing' && (
                      <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 animate-pulse">
                        Đang đăng...
                      </span>
                    )}
                  </div>
                </div>

                {/* Error Banner */}
                {post.status === 'failed' && post.error_message && (
                  <div className="mt-3 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>Lỗi: {post.error_message}</span>
                  </div>
                )}

                {/* Content Side-by-Side Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Left: Main Facebook Post */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between shadow-inner">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2.5 pb-2 border-b border-slate-800/60">
                        <span className="flex items-center gap-1.5 text-indigo-400">
                          <FacebookIcon className="w-4 h-4" /> Bài viết Facebook
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {isEditing ? editPostContent.length : post.post_content.length} ký tự
                        </span>
                      </div>
                      {isEditing ? (
                        <textarea
                          rows={11}
                          value={editPostContent}
                          onChange={(e) => setEditPostContent(e.target.value)}
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y"
                        />
                      ) : (
                        <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1">
                          {post.post_content}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: First Comment with Source Links */}
                  <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between shadow-inner">
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2.5 pb-2 border-b border-slate-800/60">
                        <span className="flex items-center gap-1.5 text-emerald-400">
                          <MessageSquare className="w-4 h-4" /> Bình luận nguồn
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          {isEditing ? editCommentContent.length : post.comment_content.length} ký tự
                        </span>
                      </div>
                      {isEditing ? (
                        <textarea
                          rows={11}
                          value={editCommentContent}
                          onChange={(e) => setEditCommentContent(e.target.value)}
                          className="w-full p-3 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono leading-relaxed resize-y"
                        />
                      ) : (
                        <div className="text-xs text-emerald-300/90 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto pr-1 font-mono">
                          {post.comment_content}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {post.fb_post_url && (
                      <a
                        href={post.fb_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Mở Facebook</span>
                      </a>
                    )}

                    {post.screenshot_path && (
                      <button
                        onClick={() => setPreviewScreenshot(post.screenshot_path || null)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ảnh chụp</span>
                      </button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition"
                        >
                          Hủy
                        </button>
                        <button
                          onClick={() => handleSaveEdit(post.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Lưu thay đổi</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(post)}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
                        >
                          Chỉnh sửa
                        </button>

                        {confirmDeleteId === post.id ? (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                            <button
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
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{isDeletingId === post.id ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-medium border border-slate-700 transition"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(post.id)}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 transition"
                            title="Xóa bài viết"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {onComment && (
                          <button
                            onClick={() => {
                              setCommentModalPost(post);
                              setCustomPostUrl(post.fb_post_url || '');
                            }}
                            disabled={isPublishing || isCommenting}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-emerald-950/60 text-emerald-300 text-xs font-semibold border border-emerald-500/30 transition disabled:opacity-50"
                            title="Bình luận link nguồn vào bài viết Facebook"
                          >
                            <MessageSquare className={`w-3.5 h-3.5 text-emerald-400 ${isCommenting ? 'animate-spin' : ''}`} />
                            <span>{isCommenting ? 'Đang gửi...' : 'Bình luận'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => onPublish(post.id, true)}
                          disabled={isPublishing || isCommenting}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-amber-500/30 transition disabled:opacity-50"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Chạy thử</span>
                        </button>

                        <button
                          onClick={() => onPublish(post.id, false)}
                          disabled={isPublishing || isCommenting}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-spin' : ''}`} />
                          <span>{isPublishing ? 'Đang đăng...' : 'Đăng bài'}</span>
                        </button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative max-w-4xl w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-indigo-400" /> Ảnh chụp màn hình đối soát Playwright
              </h3>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 max-h-[75vh] overflow-y-auto rounded-2xl bg-slate-950 p-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/screenshots/${previewScreenshot}`}
                alt="Audit Screenshot"
                className="max-w-full h-auto rounded-xl border border-slate-800 shadow-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Comment On Existing Post Modal */}
      {commentModalPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-lg w-full bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" /> Tự động gửi bình luận vào bài đã đăng
              </h3>
              <button
                onClick={() => setCommentModalPost(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-xs text-slate-400 font-medium">Chủ đề bài viết:</span>
                <p className="text-xs font-bold text-white mt-0.5">{commentModalPost.trend_title}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Đường dẫn bài viết trên Facebook (Tùy chọn):
                </label>
                <input
                  type="text"
                  placeholder="https://www.facebook.com/... (để trống nếu muốn bình luận vào bài mới nhất trên Fanpage)"
                  value={customPostUrl}
                  onChange={(e) => setCustomPostUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Nếu bạn đã đăng bài thủ công lên Facebook, hãy dán link bài viết đó vào đây. Nếu để trống, bot sẽ mở trang chủ Fanpage và bình luận vào bài viết mới nhất.
                </p>
              </div>

              <div>
                <span className="text-xs text-slate-400 font-medium">Nội dung bình luận nguồn sẽ gửi:</span>
                <div className="mt-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-emerald-300/90 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                  {commentModalPost.comment_content}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  onClick={() => setCommentModalPost(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
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
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Bắt đầu gửi bình luận ngay</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
