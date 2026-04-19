"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AccountError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Account route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
        <p className="font-heading text-xl font-extrabold text-slate-900">Trang tài khoản đang gặp trục trặc</p>
        <p className="mt-2 font-body text-sm text-slate-500">
          Mình chưa tải được dữ liệu tài khoản của bạn. Bạn có thể thử lại ngay hoặc quay về trang chủ.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            Tải lại
          </button>
          <Link
            href="/"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  );
}
