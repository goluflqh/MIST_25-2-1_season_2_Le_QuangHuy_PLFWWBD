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

function getPageNumbers(page: number, pageCount: number) {
  const windowSize = 5;
  const start = Math.max(1, Math.min(page - 2, pageCount - windowSize + 1));
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
  const pageNumbers = getPageNumbers(activePage, pageCount);
  const firstVisible = totalItems && pageSize ? (activePage - 1) * pageSize + 1 : null;
  const lastVisible = totalItems && pageSize ? Math.min(activePage * pageSize, totalItems) : null;
  const resultLabel = totalItems && firstVisible && lastVisible
    ? ` · ${firstVisible}-${lastVisible} trong ${totalItems} ${itemLabel}`
    : "";

  return (
    <div
      data-testid={dataTestId}
      className={`flex flex-col gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="font-body text-xs text-slate-500" data-testid={labelTestId}>
        Trang {activePage}/{pageCount}{resultLabel}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5 sm:justify-end">
        <button
          data-testid={previousTestId}
          type="button"
          onClick={() => onPageChange(Math.max(1, activePage - 1))}
          disabled={activePage === 1}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:text-slate-300"
        >
          Trước
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === activePage ? "page" : undefined}
            className={`min-h-9 min-w-9 rounded-lg px-3 text-xs font-bold ${
              pageNumber === activePage
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600"
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
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 disabled:text-slate-300"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
