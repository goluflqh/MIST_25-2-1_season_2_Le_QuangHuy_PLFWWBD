"use client";

import { useState } from "react";

const pageSize = 6;

const serviceLabels: Record<string, string> = {
  DONG_PIN: "Đóng Pin",
  DEN_NLMT: "Đèn NLMT",
  PIN_LUU_TRU: "Pin Lưu Trữ",
  CAMERA: "Camera",
  CUSTOM: "Theo yêu cầu",
  KHAC: "Dịch vụ",
};

const avatarColors = [
  "from-red-500 to-red-700",
  "from-orange-400 to-amber-500",
  "from-slate-700 to-slate-900",
  "from-red-400 to-orange-500",
  "from-amber-500 to-red-600",
];

export interface PublicReviewSummary {
  id: string;
  comment: string;
  name: string;
  rating: number;
  service: string;
}

function ReviewCard({
  index,
  review,
}: {
  index: number;
  review: PublicReviewSummary;
}) {
  return (
    <div className="relative mt-8 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-[0_20px_80px_-52px_rgba(15,23,42,0.45)] transition-transform duration-300 hover:-translate-y-1">
      <div className="absolute -top-8 left-8">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br ${avatarColors[index % avatarColors.length]} font-heading text-2xl font-black text-white shadow-md`}
        >
          {review.name.charAt(0)}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {serviceLabels[review.service] || review.service}
        </span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg
              key={star}
              className={`h-4 w-4 ${star <= review.rating ? "text-amber-400" : "text-slate-200"}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.922-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.068-3.292z" />
            </svg>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/75 p-5">
        <p className="font-body text-sm italic leading-7 text-slate-700">
          &ldquo;{review.comment}&rdquo;
        </p>
      </div>

      <div className="mt-5">
        <span className="font-heading text-lg font-bold text-textMain">{review.name}</span>
        <p className="font-body text-sm text-slate-400">Khách đã trải nghiệm dịch vụ thực tế</p>
      </div>
    </div>
  );
}

export default function TestimonialsReviewPager({ reviews }: { reviews: PublicReviewSummary[] }) {
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const pageCount = Math.max(1, Math.ceil(reviews.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleReviews = reviews.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (reviews.length === 0) return null;

  return (
    <div className="mt-12">
      <button
        type="button"
        onClick={() => {
          setIsOpen((value) => !value);
          setPage(1);
        }}
        className="mx-auto flex w-fit items-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-body font-bold text-white shadow-lg transition-colors hover:bg-slate-800"
        aria-expanded={isOpen}
      >
        {isOpen ? "Ẩn đánh giá khách hàng" : `Xem thêm ${reviews.length} đánh giá từ khách hàng`}
      </button>

      {isOpen ? (
        <div className="mt-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {visibleReviews.map((review, index) => (
              <ReviewCard
                key={review.id}
                review={review}
                index={(currentPage - 1) * pageSize + index + 3}
              />
            ))}
          </div>

          {pageCount > 1 ? (
            <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:flex-row">
              <p className="font-body text-sm font-semibold text-slate-500">
                Trang {currentPage}/{pageCount}
              </p>
              <div className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={currentPage === 1}
                  className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-body font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-300 sm:flex-none"
                >
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                  disabled={currentPage === pageCount}
                  className="min-h-11 flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-200 disabled:text-slate-400 sm:flex-none"
                >
                  Tiếp
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
