'use client';

import React from 'react';
import { TrendingUp, FileText, CheckCircle2, Activity } from 'lucide-react';
import { TrendItem, PostItem, ActivityLog } from '@/types';
import { useI18n } from '@/context/I18nThemeContext';

interface StatsCardsProps {
  trends: TrendItem[];
  posts: PostItem[];
  logs: ActivityLog[];
}

export default function StatsCards({ trends, posts, logs }: StatsCardsProps) {
  const { t, lang } = useI18n();
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const draftCount = posts.filter((p) => p.status === 'draft').length;

  const cards = [
    {
      title: t('stat_trends'),
      value: trends.length.toString(),
      icon: TrendingUp,
      subtitle: lang === 'vi' ? 'Google Trends Kinh doanh' : 'Business Trends',
      accentColor: 'text-indigo-600 dark:text-indigo-400',
      iconBg: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    },
    {
      title: t('stat_drafts'),
      value: draftCount.toString(),
      icon: FileText,
      subtitle: lang === 'vi' ? 'Bản thảo AI sẵn sàng' : 'AI Drafts Ready',
      accentColor: 'text-amber-600 dark:text-amber-400',
      iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    },
    {
      title: t('stat_published'),
      value: publishedCount.toString(),
      icon: CheckCircle2,
      subtitle: lang === 'vi' ? 'Đã xuất bản Fanpage' : 'Published on Page',
      accentColor: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: t('stat_logs'),
      value: logs.length.toString(),
      icon: Activity,
      subtitle: lang === 'vi' ? 'Nhật ký thời gian thực' : 'Real-time Events',
      accentColor: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="p-4 sm:p-5 rounded-xl app-card shadow-xs transition duration-150 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium opacity-75">
                {c.title}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.iconBg}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="my-1">
              <div className="text-2xl sm:text-3xl font-bold tracking-tight font-mono text-inherit">
                {c.value}
              </div>
            </div>


            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {c.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
}
