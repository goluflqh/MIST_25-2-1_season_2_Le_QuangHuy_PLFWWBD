"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
      <p className="font-heading text-xl font-extrabold text-slate-900">Dashboard đang tải chưa trọn vẹn</p>
      <p className="mt-2 font-body text-sm text-slate-500">
        Có lỗi xảy ra khi lấy dữ liệu quản trị. Bạn có thể thử tải lại phần này hoặc quay về trang tổng quan.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
        >
          Thử lại
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Về tổng quan
        </Link>
      </div>
    </div>
  );
}
