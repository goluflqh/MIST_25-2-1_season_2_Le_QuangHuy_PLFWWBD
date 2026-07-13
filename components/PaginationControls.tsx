"use client";

interface PaginationControlsProps {
  className?: string;
  dataTestId?: string;
  itemLabel?: string;
  labelTestId?: string;
  nextTestId?: string;
  onPageChange: (page: number) => void;
  page: number;
  pageCount: number;
  pageSize?: number;
  previousTestId?: string;
  totalItems?: number;
}

function getPageNumbers(page: number, pageCount: number, windowSize: number) {
  const offset = Math.floor(windowSize / 2);
  const start = Math.max(1, Math.min(page - offset, pageCount - windowSize + 1));
  const end = Math.min(pageCount, start + windowSize - 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function PaginationControls({
  className = "",
  dataTestId,
  itemLabel = "bản ghi",
  labelTestId,
  nextTestId,
  onPageChange,
  page,
  pageCount,
  pageSize,
  previousTestId,
  totalItems,
}: PaginationControlsProps) {
  if (pageCount <= 1) return null;

  const activePage = Math.min(Math.max(page, 1), pageCount);
  const mobilePageNumbers = getPageNumbers(activePage, pageCount, 3);
  const desktopPageNumbers = getPageNumbers(activePage, pageCount, 5);
  const firstVisible = totalItems && pageSize ? (activePage - 1) * pageSize + 1 : null;
  const lastVisible = totalItems && pageSize ? Math.min(activePage * pageSize, totalItems) : null;
  const resultLabel = totalItems && firstVisible && lastVisible
    ? ` · ${firstVisible}-${lastVisible} trong ${totalItems} ${itemLabel}`
    : "";

  return (
    <div
      data-testid={dataTestId}
      className={`flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm sm:px-4 sm:py-3 ${className}`}
    >
      <p className="hidden shrink-0 font-body text-xs text-slate-500 min-[360px]:block" data-testid={labelTestId}>
        Trang {activePage}/{pageCount}
        {resultLabel ? <span className="hidden md:inline">{resultLabel}</span> : null}
      </p>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button
          data-testid={previousTestId}
          type="button"
          onClick={() => onPageChange(Math.max(1, activePage - 1))}
          disabled={activePage === 1}
          className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:text-slate-300 sm:px-3"
        >
          Trước
        </button>
        {mobilePageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === activePage ? "page" : undefined}
            aria-label={`Trang ${pageNumber}`}
            className={`min-h-11 min-w-11 rounded-lg px-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:hidden ${
              pageNumber === activePage
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        {desktopPageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === activePage ? "page" : undefined}
            aria-label={`Trang ${pageNumber}`}
            className={`hidden min-h-11 min-w-11 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 sm:inline-flex sm:items-center sm:justify-center ${
              pageNumber === activePage
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        <button
          data-testid={nextTestId}
          type="button"
          onClick={() => onPageChange(Math.min(pageCount, activePage + 1))}
          disabled={activePage === pageCount}
          className="min-h-11 rounded-lg border border-slate-200 px-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:text-slate-300 sm:px-3"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
