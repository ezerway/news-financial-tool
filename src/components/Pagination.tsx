'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useI18n } from '@/context/I18nThemeContext';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = '',
}: PaginationProps) {
  const { lang } = useI18n();

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  if (totalItems === 0) {
    return null;
  }

  // Generate page numbers with smart ellipsis
  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      const leftBound = Math.max(2, safeCurrentPage - 1);
      const rightBound = Math.min(totalPages - 1, safeCurrentPage + 1);

      if (leftBound > 2) {
        pages.push('ellipsis-left');
      }

      for (let i = leftBound; i <= rightBound; i++) {
        pages.push(i);
      }

      if (rightBound < totalPages - 1) {
        pages.push('ellipsis-right');
      }

      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className={`p-3 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 shadow-xs backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${className}`}
    >
      {/* Left: Item range and Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-slate-500 dark:text-slate-400">
        <span>
          {lang === 'vi' ? (
            <>
              Hiển thị <span className="font-semibold text-slate-900 dark:text-white">{startItem}</span> -{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{endItem}</span> trên{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> mục
            </>
          ) : (
            <>
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startItem}</span> -{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{endItem}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span>
            </>
          )}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2.5 border-l border-slate-200 dark:border-slate-800">
            <span className="text-[11px] whitespace-nowrap text-slate-400">
              {lang === 'vi' ? 'Mỗi trang:' : 'Per page:'}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                const newSize = parseInt(e.target.value, 10);
                onPageSizeChange(newSize);
                onPageChange(1);
              }}
              className="app-input h-7 px-2 text-xs font-semibold rounded-lg focus:outline-hidden focus:border-indigo-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Navigation Controls */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={lang === 'vi' ? 'Trang đầu' : 'First page'}
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Prev Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={lang === 'vi' ? 'Trang trước' : 'Previous page'}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page Numbers */}
        <div className="flex items-center gap-1 px-1">
          {pages.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span key={`${p}-${idx}`} className="px-1 text-slate-400 font-mono select-none">
                  …
                </span>
              );
            }
            const isActive = p === safeCurrentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-7 h-7 px-2 rounded-lg font-semibold text-xs transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page */}
        <button
          type="button"
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={lang === 'vi' ? 'Trang sau' : 'Next page'}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last Page */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={lang === 'vi' ? 'Trang cuối' : 'Last page'}
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

