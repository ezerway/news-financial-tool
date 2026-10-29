'use client';

import React from 'react';
import { TrendingUp, FileText, CheckCircle, Activity } from 'lucide-react';
import { TrendItem, PostItem, ActivityLog } from '@/types';

interface StatsCardsProps {
  trends: TrendItem[];
  posts: PostItem[];
  logs: ActivityLog[];
}

export default function StatsCards({ trends, posts, logs }: StatsCardsProps) {
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;

  const cards = [
    {
      title: 'Xu hướng',
      value: trends.length.toString(),
      icon: TrendingUp,
      gradient: 'from-blue-500/10 to-indigo-500/5',
      borderColor: 'border-blue-500/25 hover:border-blue-500/50',
      iconBg: 'bg-blue-500/15 text-blue-400',
    },
    {
      title: 'Bản thảo',
      value: draftCount.toString(),
      icon: FileText,
      gradient: 'from-amber-500/10 to-orange-500/5',
      borderColor: 'border-amber-500/25 hover:border-amber-500/50',
      iconBg: 'bg-amber-500/15 text-amber-400',
    },
    {
      title: 'Đã xuất bản',
      value: publishedCount.toString(),
      icon: CheckCircle,
      gradient: 'from-emerald-500/10 to-teal-500/5',
      borderColor: 'border-emerald-500/25 hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      title: 'Nhật ký',
      value: logs.length.toString(),
      icon: Activity,
      gradient: 'from-purple-500/10 to-pink-500/5',
      borderColor: 'border-purple-500/25 hover:border-purple-500/50',
      iconBg: 'bg-purple-500/15 text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${c.gradient} bg-slate-900/60 border ${c.borderColor} backdrop-blur-md shadow-md transition-all duration-200 hover:-translate-y-0.5`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-400">{c.title}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.iconBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-white">{c.value}</div>
          </div>
        );
      })}
    </div>
  );
}
