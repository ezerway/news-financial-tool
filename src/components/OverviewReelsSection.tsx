'use client';

import React, { useState } from 'react';
import {
  Film,
  Play,
  ArrowRight,
  TrendingUp,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { ReelItem } from '@/types';
import FacebookIcon from './FacebookIcon';
import TikTokIcon from './TikTokIcon';
import YouTubeIcon from './YouTubeIcon';
import ZaloIcon from './ZaloIcon';

interface OverviewReelsSectionProps {
  reels: ReelItem[];
  onNavigateToReels: () => void;
  onNavigateToTrends: () => void;
}

export default function OverviewReelsSection({
  reels,
  onNavigateToReels,
  onNavigateToTrends,
}: OverviewReelsSectionProps) {
  const [previewReel, setPreviewReel] = useState<ReelItem | null>(null);

  const draftCount = reels.filter((r) => r.status === 'draft').length;
  const publishedCount = reels.filter((r) => r.status === 'published').length;
  const scheduledCount = reels.filter((r) => r.status === 'scheduled').length;
  const recentReels = reels.slice(0, 4);

  const formatVideoSrc = (videoPath: string) => {
    const filename = videoPath.split('/').pop() || '';
    return `/api/videos/${encodeURIComponent(filename)}`;
  };

  return (
    <div className="rounded-xl app-card shadow-xs p-4 sm:p-5 space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-fuchsia-600 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                Video Reels 9:16 Mới Nhất
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-50 dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400 border border-fuchsia-200 dark:border-fuchsia-800">
                {reels.length} video
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Bản tin ngắn 9:16 tự động từ xu hướng, tối ưu phân phối đa nền tảng
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={onNavigateToTrends}
            className="btn btn-sm btn-secondary text-xs flex items-center gap-1.5"
            title="Đến trang Xu hướng để tạo thêm video"
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            <span>Tạo từ Trend</span>
          </button>
          <button
            onClick={onNavigateToReels}
            className="btn btn-sm btn-primary text-xs flex items-center gap-1"
          >
            <span>Quản lý Reels ({reels.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium text-[11px] border border-amber-200/50 dark:border-amber-800/40">
            Bản nháp: <b>{draftCount}</b>
          </span>
          <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-medium text-[11px] border border-emerald-200/50 dark:border-emerald-800/40">
            Đã đăng: <b>{publishedCount}</b>
          </span>
          {scheduledCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium text-[11px] border border-blue-200/50 dark:border-blue-800/40">
              Lên lịch: <b>{scheduledCount}</b>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
          <span>Hỗ trợ:</span>
          <div className="flex items-center gap-1">
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[#1877F2]" title="Facebook Reels">
              <FacebookIcon className="w-3 h-3" />
            </span>
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white" title="TikTok">
              <TikTokIcon className="w-3 h-3" />
            </span>
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[#FF0000]" title="YouTube Shorts">
              <YouTubeIcon className="w-3 h-3" />
            </span>
            <span className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-[#0068FF]" title="Zalo Video">
              <ZaloIcon className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Reels Grid or Empty State */}
      {reels.length === 0 ? (
        <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
            <Film className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Chưa có video Reel nào trong hệ thống
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Chuyển sang trang Xu hướng để tạo video dọc 9:16 hiện đại, chuyên nghiệp từ bất kỳ từ khóa hot nào chỉ với 1 click.
            </p>
          </div>
          <button
            onClick={onNavigateToTrends}
            className="btn btn-sm btn-primary flex items-center gap-1.5"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Đến trang Xu hướng để tạo Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {recentReels.map((reel) => {
            const hasPublishedFb = reel.status === 'published' || !!reel.fb_post_url;
            const hasPublishedTikTok = reel.tiktok_status === 'published' || !!reel.tiktok_post_url;
            const hasPublishedYouTube = reel.youtube_status === 'published' || !!reel.youtube_post_url;
            const hasPublishedZalo = reel.zalo_status === 'published' || !!reel.zalo_post_url;

            return (
              <div
                key={reel.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 overflow-hidden flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-150 shadow-2xs group"
              >
                {/* 9:16 Video Player Card */}
                <div className="relative aspect-[9/16] max-h-[300px] sm:max-h-[320px] bg-slate-950 overflow-hidden flex items-center justify-center">
                  <video
                    src={formatVideoSrc(reel.video_path)}
                    preload="metadata"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition duration-200"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/50 pointer-events-none" />

                  {/* Play Button Overlay */}
                  <button
                    onClick={() => setPreviewReel(reel)}
                    className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white shadow-lg transition-transform transform group-hover:scale-110"
                    title="Xem trước video"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>

                  {/* Top Status & Format Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/60 text-white backdrop-blur-xs">
                      9:16 HD
                    </span>

                    {reel.status === 'published' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3 h-3" /> Đã đăng
                      </span>
                    ) : reel.status === 'scheduled' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white flex items-center gap-1 shadow-xs">
                        <Clock className="w-3 h-3" /> Lên lịch
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white flex items-center gap-1 shadow-xs">
                        Bản nháp
                      </span>
                    )}
                  </div>

                  {/* Bottom Platform Pills on Video */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none text-[10px] text-white">
                    <div className="flex items-center gap-1 bg-black/60 backdrop-blur-xs px-2 py-1 rounded-md">
                      <span className={hasPublishedFb ? 'text-[#1877F2]' : 'opacity-40'} title="Facebook">
                        <FacebookIcon className="w-2.5 h-2.5" />
                      </span>
                      <span className={hasPublishedTikTok ? 'text-white' : 'opacity-40'} title="TikTok">
                        <TikTokIcon className="w-2.5 h-2.5" />
                      </span>
                      <span className={hasPublishedYouTube ? 'text-[#FF0000]' : 'opacity-40'} title="Shorts">
                        <YouTubeIcon className="w-2.5 h-2.5" />
                      </span>
                      <span className={hasPublishedZalo ? 'text-[#0068FF]' : 'opacity-40'} title="Zalo">
                        <ZaloIcon className="w-2.5 h-2.5" />
                      </span>
                    </div>

                    <span className="text-[10px] text-slate-300 font-mono bg-black/60 px-1.5 py-0.5 rounded">
                      20s
                    </span>
                  </div>
                </div>

                {/* Card Content & Action */}
                <div className="p-3 flex flex-col justify-between flex-1 gap-2.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2 leading-relaxed">
                    {reel.caption.split('\n')[0] || 'Bản tin tài chính ngắn'}
                  </p>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPreviewReel(reel)}
                      className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" /> Xem video
                    </button>

                    <button
                      onClick={onNavigateToReels}
                      className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-0.5"
                    >
                      Chi tiết <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 9:16 Video Preview Modal */}
      {previewReel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-bold text-xs text-white">Xem Trước Video Reel 9:16</span>
              </div>
              <button
                onClick={() => setPreviewReel(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <div className="w-full aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
              <video
                controls
                autoPlay
                src={formatVideoSrc(previewReel.video_path)}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {previewReel.caption}
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500 font-mono">
                  Định dạng: 720x1280 • H.264
                </span>
                <button
                  onClick={() => {
                    setPreviewReel(null);
                    onNavigateToReels();
                  }}
                  className="btn btn-xs btn-primary text-[11px] flex items-center gap-1"
                >
                  <span>Chuyển tới Reels Tab</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
