"use client";

import { useMemo, useRef, useState } from "react";

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
  const [isOpen, setIsOpen] = useState(false);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(reviews.length > 1);
  const carouselRef = useRef<HTMLDivElement>(null);
  const services = useMemo(
    () => [...new Set(reviews.map((review) => review.service))],
    [reviews]
  );
  const filteredReviews = useMemo(
    () => reviews.filter((review) => (
      (ratingFilter === "all" || review.rating === Number(ratingFilter))
      && (serviceFilter === "all" || review.service === serviceFilter)
    )),
    [ratingFilter, reviews, serviceFilter]
  );

  const updateScrollState = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    setCanScrollBack(carousel.scrollLeft > 8);
    setCanScrollForward(carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 8);
  };

  const resetCarousel = (nextReviewCount: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const carousel = carouselRef.current;
        carousel?.scrollTo({ left: 0 });
        setCanScrollBack(false);
        setCanScrollForward(Boolean(carousel && nextReviewCount > 1 && carousel.clientWidth < carousel.scrollWidth - 8));
      });
    });
  };

  const scrollCarousel = (direction: -1 | 1) => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    carousel.scrollBy({ left: direction * Math.max(carousel.clientWidth * 0.85, 280), behavior: "smooth" });
  };

  if (reviews.length === 0) return null;

  return (
    <div className="mt-12">
      <button
        data-testid="public-reviews-toggle"
        type="button"
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) resetCarousel(filteredReviews.length);
        }}
        className="mx-auto flex w-fit items-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-body font-bold text-white shadow-lg transition-colors hover:bg-slate-800"
        aria-expanded={isOpen}
      >
        {isOpen ? "Ẩn đánh giá khách hàng" : `Xem thêm ${reviews.length} đánh giá từ khách hàng`}
      </button>

      {isOpen ? (
        <div className="mt-8" data-testid="public-reviews-list">
          <div className="mx-auto mb-2 flex max-w-3xl flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 font-body text-xs font-bold text-slate-600">
              Số sao
              <select
                data-testid="public-reviews-rating-filter"
                value={ratingFilter}
                onChange={(event) => {
                  const nextRating = event.target.value;
                  setRatingFilter(nextRating);
                  resetCarousel(reviews.filter((review) => (
                    (nextRating === "all" || review.rating === Number(nextRating))
                    && (serviceFilter === "all" || review.service === serviceFilter)
                  )).length);
                }}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              >
                <option value="all">Tất cả</option>
                {[5, 4, 3, 2, 1].map((rating) => (
                  <option key={rating} value={rating}>{rating} sao</option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2 font-body text-xs font-bold text-slate-600">
              Dịch vụ
              <select
                data-testid="public-reviews-service-filter"
                value={serviceFilter}
                onChange={(event) => {
                  const nextService = event.target.value;
                  setServiceFilter(nextService);
                  resetCarousel(reviews.filter((review) => (
                    (ratingFilter === "all" || review.rating === Number(ratingFilter))
                    && (nextService === "all" || review.service === nextService)
                  )).length);
                }}
                className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
              >
                <option value="all">Tất cả</option>
                {services.map((service) => (
                  <option key={service} value={service}>{serviceLabels[service] || service}</option>
                ))}
              </select>
            </label>
          </div>

          {filteredReviews.length > 0 ? (
            <div className="relative px-12 sm:px-14">
              <button
                type="button"
                data-testid="public-reviews-previous"
                aria-label="Xem đánh giá trước"
                onClick={() => scrollCarousel(-1)}
                disabled={!canScrollBack}
                className="absolute left-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div
                ref={carouselRef}
                data-testid="public-reviews-carousel"
                onScroll={updateScrollState}
                className={`flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${filteredReviews.length === 1 ? "justify-center" : ""}`}
              >
                {filteredReviews.map((review, index) => (
                  <div key={review.id} className="min-w-0 shrink-0 basis-[88%] snap-start sm:basis-[calc(50%-0.75rem)] lg:basis-[calc(33.333%-1rem)]">
                    <ReviewCard review={review} index={index + 3} />
                  </div>
                ))}
              </div>
              <button
                type="button"
                data-testid="public-reviews-next"
                aria-label="Xem đánh giá tiếp theo"
                onClick={() => scrollCarousel(1)}
                disabled={!canScrollForward}
                className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:border-red-200 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center font-body text-sm text-slate-500">
              Chưa có đánh giá phù hợp bộ lọc này.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
