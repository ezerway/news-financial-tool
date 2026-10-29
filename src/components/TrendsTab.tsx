'use client';

import React, { useState } from 'react';
import { TrendItem } from '@/types';
import { TrendingUp, Sparkles, ExternalLink, RefreshCw, Search, Newspaper, DollarSign, Globe, FileSpreadsheet, Bot, Zap, Link2, AlertCircle, AlertTriangle } from 'lucide-react';

interface TrendsTabProps {
  trends: TrendItem[];
  onCrawl: (geo: string) => Promise<void>;
  onGenerate: (trendId: string) => Promise<void>;
  onFindSources?: (trendId: string) => Promise<void>;
  isCrawling: boolean;
  generatingId: string | null;
}

const GEO_NAMES: Record<string, { label: string; flag: string }> = {
  VN: { label: 'Việt Nam (VN)', flag: '🇻🇳' },
  US: { label: 'Hoa Kỳ (US)', flag: '🇺🇸' },
  SG: { label: 'Singapore (SG)', flag: '🇸🇬' },
  GB: { label: 'Vương quốc Anh (GB)', flag: '🇬🇧' },
  JP: { label: 'Nhật Bản (JP)', flag: '🇯🇵' },
  all: { label: 'Tất cả quốc gia', flag: '🌐' },
};

export default function TrendsTab({
  trends,
  onCrawl,
  onGenerate,
  onFindSources,
  isCrawling,
  generatingId,
}: TrendsTabProps) {
  const [search, setSearch] = useState('');
  const [selectedGeo, setSelectedGeo] = useState('VN');
  const [searchingSourceId, setSearchingSourceId] = useState<string | null>(null);

  // Filter trends by selected country
  const geoTrends = selectedGeo === 'all' ? trends : trends.filter((t) => t.geo === selectedGeo);

  // Filter trends by search keyword
  const filteredTrends = geoTrends.filter((t) => {
    return (
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.articles.some((a) => a.title.toLowerCase().includes(search.toLowerCase()))
    );
  });

  // Handle switching country: filter immediately, and auto-crawl if country has no data yet
  const handleGeoChange = async (newGeo: string) => {
    setSelectedGeo(newGeo);
    if (newGeo !== 'all') {
      const exists = trends.some((t) => t.geo === newGeo);
      if (!exists) {
        await onCrawl(newGeo);
      }
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Crawl Action Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm xu hướng..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Region Select */}
          <select
            value={selectedGeo}
            onChange={(e) => handleGeoChange(e.target.value)}
            className="flex-1 sm:flex-initial bg-slate-950/80 border border-slate-800 text-xs font-semibold text-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
          >
            <option value="VN">🇻🇳 Việt Nam</option>
            <option value="US">🇺🇸 Hoa Kỳ</option>
            <option value="SG">🇸🇬 Singapore</option>
            <option value="GB">🇬🇧 Anh</option>
            <option value="JP">🇯🇵 Nhật Bản</option>
            <option value="all">🌐 Tất cả</option>
          </select>

          {/* Crawl CTA right next to Search */}
          <button
            onClick={() => onCrawl(selectedGeo === 'all' ? 'VN' : selectedGeo)}
            disabled={isCrawling}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
            <span>{isCrawling ? 'Đang cào...' : 'Cào Trends'}</span>
          </button>
        </div>
      </div>

      {/* Grid of Trends */}
      {filteredTrends.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-slate-900/50 border border-slate-800/80">
          <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">
            Chưa có dữ liệu xu hướng cho {GEO_NAMES[selectedGeo]?.label || selectedGeo}
          </h3>
          <p className="text-xs text-slate-400 mt-1.5 max-w-sm mx-auto mb-4">
            Bấm nút &quot;Cào Trends&quot; để lấy xu hướng Kinh doanh & Tài chính mới nhất.
          </p>
          <button
            onClick={() => onCrawl(selectedGeo === 'all' ? 'VN' : selectedGeo)}
            disabled={isCrawling}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
            <span>{isCrawling ? 'Đang cào...' : 'Cào ngay'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrends.map((trend) => {
            const isGenerating = generatingId === trend.id;
            const isSearchingSource = searchingSourceId === trend.id;
            const validArticles = (trend.articles || []).filter((a) => a.url && !a.url.includes('google.com'));
            const hasSourceLinks = validArticles.length > 0;

            return (
              <div
                key={trend.id}
                className="group p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 backdrop-blur-md shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between"
              >
                <div>
                  {/* Traffic & Sources count */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      🔥 {trend.approx_traffic || 'Nhiều tìm kiếm'}
                    </span>

                    {hasSourceLinks ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> {validArticles.length} nguồn
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/25 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-400" /> Chưa có nguồn
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-white capitalize group-hover:text-indigo-300 transition-colors line-clamp-2 leading-snug">
                    {trend.title}
                  </h3>

                  {/* Related Articles or Missing Notice */}
                  {hasSourceLinks ? (
                    <div className="mt-3.5 space-y-1.5 border-t border-slate-800/80 pt-3">
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {validArticles.map((art, idx) => (
                          <a
                            key={idx}
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/60 text-left transition group/link"
                          >
                            <div className="flex items-center justify-between gap-1 text-slate-200 group-hover/link:text-indigo-300 font-medium text-xs line-clamp-1">
                              <span>{art.title}</span>
                              <ExternalLink className="w-3 h-3 text-slate-500 group-hover/link:text-indigo-400 shrink-0" />
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {art.source}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3.5 p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Chưa có link nguồn báo chí.</span>
                    </div>
                  )}
                </div>

                {/* Footer Action */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-slate-500">
                    {trend.status === 'drafted' ? 'Đã tạo bài' : ''}
                  </span>

                  {hasSourceLinks ? (
                    <button
                      onClick={() => onGenerate(trend.id)}
                      disabled={isGenerating}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                      <span>{isGenerating ? 'Đang viết...' : 'Tạo bài'}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {onFindSources && (
                        <button
                          onClick={async () => {
                            setSearchingSourceId(trend.id);
                            try {
                              await onFindSources(trend.id);
                            } finally {
                              setSearchingSourceId(null);
                            }
                          }}
                          disabled={isSearchingSource}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
                          title="Tìm kiếm liên kết báo chí cho xu hướng này"
                        >
                          <Search className={`w-3.5 h-3.5 text-indigo-400 ${isSearchingSource ? 'animate-spin' : ''}`} />
                          <span>{isSearchingSource ? 'Đang tìm...' : 'Tìm link nguồn'}</span>
                        </button>
                      )}
                      <button
                        disabled
                        className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 border border-slate-800 text-slate-500 text-xs font-medium cursor-not-allowed"
                        title="Chỉ cho phép tạo bài nếu có source link"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-slate-600" />
                        <span>Cần có source link</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
