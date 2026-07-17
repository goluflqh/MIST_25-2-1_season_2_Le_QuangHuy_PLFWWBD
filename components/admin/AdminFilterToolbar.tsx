"use client";

import { useId, useState, type ReactNode } from "react";

export default function AdminFilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  searchLabel = "Tìm kiếm",
  searchDataTestId,
  children,
  activeFilterCount = 0,
  resultSummary,
  onReset,
  desktopGridClassName = "md:grid-cols-2 xl:grid-cols-3",
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  searchLabel?: string;
  searchDataTestId?: string;
  children?: ReactNode;
  activeFilterCount?: number;
  resultSummary?: ReactNode;
  onReset?: () => void;
  desktopGridClassName?: string;
}) {
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const filterPanelId = useId();
  const hasFilters = Boolean(children);
  const hasActiveState = activeFilterCount > 0 || searchValue.trim().length > 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1 space-y-1.5">
          <span className="sr-only">{searchLabel}</span>
          <span className="relative block">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              data-testid={searchDataTestId}
              type="search"
              name="adminSearch"
              autoComplete="off"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder.endsWith("…") ? searchPlaceholder : `${searchPlaceholder}…`}
              className="min-h-12 w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 font-body text-base text-slate-800 outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus-visible:border-red-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
            />
          </span>
        </label>
        {hasFilters ? (
          <button
            type="button"
            aria-expanded={showMobileFilters}
            aria-controls={filterPanelId}
            onClick={() => setShowMobileFilters((current) => !current)}
            className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 font-body text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 md:hidden"
          >
            <svg className="h-4 w-4" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
            Bộ lọc
            {activeFilterCount > 0 ? (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>
        ) : null}
      </div>

      {hasFilters ? (
        <div
          id={filterPanelId}
          className={`${showMobileFilters ? "grid" : "hidden"} mt-3 gap-3 border-t border-slate-100 pt-3 md:grid md:border-t-0 md:pt-0 ${desktopGridClassName}`}
        >
          {children}
        </div>
      ) : null}

      {resultSummary || (hasActiveState && onReset) ? (
        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="font-body text-sm leading-5 text-slate-600">{resultSummary}</div>
          {hasActiveState && onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="min-h-10 rounded-lg bg-slate-100 px-3 py-1.5 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              Xóa bộ lọc
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
