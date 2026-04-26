"use client";

import { useMemo, useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  service: string;
  approved: boolean;
  createdAt: string;
  user: { name: string; phone: string };
}

type ReviewStatusFilter = "all" | "pending" | "approved";
type ReviewSortMode = "newest" | "ratingHigh" | "ratingLow";

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ NLMT",
  PIN_LUU_TRU: "⚡ Lưu Trữ",
  CAMERA: "📹 Camera",
  CUSTOM: "🔧 Custom",
  KHAC: "📞 Khác",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

export default function AdminReviewsClient({ initialReviews }: { initialReviews: ReviewData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [reviews, setReviews] = useState<ReviewData[]>(initialReviews);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>("pending");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sortMode, setSortMode] = useState<ReviewSortMode>("newest");

  const metrics = useMemo(() => {
    const pending = reviews.filter((review) => !review.approved).length;
    const approved = reviews.length - pending;
    const averageRating = reviews.length > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
      : 0;
    const lowRating = reviews.filter((review) => review.rating <= 3).length;

    return { pending, approved, averageRating, lowRating };
  }, [reviews]);

  const serviceOptions = useMemo(() => {
    return Array.from(new Set(reviews.map((review) => review.service))).sort((first, second) => (
      (serviceLabels[first] || first).localeCompare(serviceLabels[second] || second, "vi")
    ));
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return reviews
      .filter((review) => {
        const matchesStatus = statusFilter === "all"
          || (statusFilter === "pending" && !review.approved)
          || (statusFilter === "approved" && review.approved);
        const matchesService = serviceFilter === "all" || review.service === serviceFilter;
        const matchesRating = ratingFilter === "all" || review.rating === Number(ratingFilter);
        const matchesSearch = query.length === 0
          || review.user.name.toLowerCase().includes(query)
          || review.user.phone.toLowerCase().includes(query)
          || review.comment.toLowerCase().includes(query)
          || (serviceLabels[review.service] || review.service).toLowerCase().includes(query);

        return matchesStatus && matchesService && matchesRating && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "ratingHigh") return second.rating - first.rating;
        if (sortMode === "ratingLow") return first.rating - second.rating;
        return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      });
  }, [ratingFilter, reviews, searchQuery, serviceFilter, sortMode, statusFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("pending");
    setServiceFilter("all");
    setRatingFilter("all");
    setSortMode("newest");
  };

  const toggleApproval = async (id: string, approved: boolean) => {
    setPendingReviewId(id);
    setReviews((prev) => prev.map((review) => (
      review.id === id ? { ...review, approved } : review
    )));

    try {
      const response = await fetch("/api/admin/reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, approved }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setReviews((prev) => prev.map((review) => (
          review.id === id ? { ...review, approved: !approved } : review
        )));
        showToast(data.message || "Chưa cập nhật được trạng thái duyệt.", "error");
        return;
      }

      showToast(approved ? "Đã duyệt đánh giá." : "Đã ẩn đánh giá.", "success");
    } catch {
      setReviews((prev) => prev.map((review) => (
        review.id === id ? { ...review, approved: !approved } : review
      )));
      showToast("Không thể cập nhật đánh giá lúc này.", "error");
    } finally {
      setPendingReviewId(null);
    }
  };

  const deleteReview = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá đánh giá này không?", async () => {
      setDeletingReviewId(id);

      try {
        const response = await fetch("/api/admin/reviews", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi khi xoá.", "error");
          return;
        }

        setReviews((prev) => prev.filter((review) => review.id !== id));
        showToast("Đã xoá đánh giá.", "success");
      } catch {
        showToast("Không thể xoá đánh giá lúc này.", "error");
      } finally {
        setDeletingReviewId(null);
      }
    });
  };

  return (
    <div data-testid="dashboard-reviews-moderation" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Duyệt đánh giá</p>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Đánh Giá</h2>
          <p className="font-body text-sm text-slate-500">
            {metrics.pending} chờ duyệt · {metrics.approved} đã duyệt · {reviews.length} tổng
          </p>
        </div>
        <button
          onClick={resetFilters}
          className="self-start rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-600 transition-colors hover:bg-slate-200 lg:self-auto"
        >
          Xoá bộ lọc
        </button>
      </div>

      <div data-testid="dashboard-reviews-metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-amber-700">Chờ duyệt</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-amber-700">{metrics.pending}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Đã duyệt</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-green-700">{metrics.approved}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Điểm trung bình</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">
            {metrics.averageRating.toFixed(1)}
          </p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Cần theo dõi</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-red-700">{metrics.lowRating}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <input
            data-testid="dashboard-reviews-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm khách, SĐT, nội dung"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          />
          <select
            data-testid="dashboard-reviews-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)}
            title="Lọc trạng thái duyệt"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="all">Tất cả</option>
          </select>
          <select
            data-testid="dashboard-reviews-service-filter"
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
            title="Lọc dịch vụ đánh giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả dịch vụ</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>{serviceLabels[service] || service}</option>
            ))}
          </select>
          <select
            data-testid="dashboard-reviews-rating-filter"
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value)}
            title="Lọc số sao"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả sao</option>
            <option value="5">5 sao</option>
            <option value="4">4 sao</option>
            <option value="3">3 sao</option>
            <option value="2">2 sao</option>
            <option value="1">1 sao</option>
          </select>
          <select
            data-testid="dashboard-reviews-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as ReviewSortMode)}
            title="Sắp xếp đánh giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="newest">Mới nhất</option>
            <option value="ratingHigh">Sao cao nhất</option>
            <option value="ratingLow">Sao thấp nhất</option>
          </select>
        </div>
        <p data-testid="dashboard-reviews-result-count" className="mt-3 font-body text-xs text-slate-400">
          Hiển thị {filteredReviews.length} / {reviews.length} đánh giá
        </p>
      </div>

      <div className="space-y-3">
        {reviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p className="font-body text-sm text-slate-400">Chưa có đánh giá nào.</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
            <p className="font-body text-sm text-slate-400">Không có đánh giá nào khớp bộ lọc.</p>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isPending={pendingReviewId === review.id}
              isDeleting={deletingReviewId === review.id}
              onToggle={toggleApproval}
              onDelete={deleteReview}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  isPending,
  isDeleting,
  onToggle,
  onDelete,
}: {
  review: ReviewData;
  isPending: boolean;
  isDeleting: boolean;
  onToggle: (id: string, approved: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      data-testid="dashboard-review-card"
      className={`rounded-xl border bg-white p-5 shadow-sm transition-opacity ${review.approved ? "border-green-100" : "border-yellow-200 bg-yellow-50/30"} ${isDeleting ? "opacity-60" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-body font-bold text-sm text-slate-800">{review.user.name}</span>
            <span className="font-body text-xs text-slate-400">{review.user.phone}</span>
            <span className="font-body text-xs text-slate-400">{serviceLabels[review.service] || review.service}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${review.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {review.approved ? "Đã duyệt" : "Chờ duyệt"}
            </span>
          </div>
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-sm ${star <= review.rating ? "text-yellow-400" : "text-slate-200"}`}>★</span>
            ))}
          </div>
          <p className="font-body text-sm text-slate-600">&ldquo;{review.comment}&rdquo;</p>
          <p className="font-body text-[10px] text-slate-300 mt-1">{formatDateTime(review.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(review.id, !review.approved)}
            disabled={isPending}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:bg-slate-100 disabled:text-slate-400 ${review.approved ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
          >
            {isPending ? "..." : review.approved ? "Ẩn" : "Duyệt ✓"}
          </button>
          <button
            onClick={() => onDelete(review.id)}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300 transition-colors"
          >
            {isDeleting ? "..." : "Xoá"}
          </button>
        </div>
      </div>
    </div>
  );
}
