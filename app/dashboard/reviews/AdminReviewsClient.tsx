"use client";

import { useMemo, useState } from "react";
import AdminFilterToolbar from "@/components/admin/AdminFilterToolbar";
import AdminMetricStrip from "@/components/admin/AdminMetricStrip";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminServiceIcon from "@/components/admin/AdminServiceIcon";
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
  DONG_PIN: "Đóng pin",
  DEN_NLMT: "Năng lượng mặt trời",
  PIN_LUU_TRU: "Pin lưu trữ",
  CAMERA: "Camera",
  CUSTOM: "Theo yêu cầu",
  KHAC: "Khác",
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
      <AdminPageHeader
        eyebrow="Duyệt đánh giá"
        title="Quản Lý Đánh Giá"
        summary={`${metrics.pending} chờ duyệt · ${metrics.approved} đã duyệt · ${reviews.length} tổng`}
      />

      <AdminMetricStrip
        dataTestId="dashboard-reviews-metrics"
        items={[
          { key: "pending", label: "Chờ duyệt", value: metrics.pending, tone: "amber", active: statusFilter === "pending", onSelect: () => setStatusFilter("pending") },
          { key: "approved", label: "Đã duyệt", value: metrics.approved, tone: "green", active: statusFilter === "approved", onSelect: () => setStatusFilter("approved") },
          { key: "average", label: "Điểm trung bình", value: metrics.averageRating.toFixed(1) },
          { key: "low", label: "Cần theo dõi", value: metrics.lowRating, tone: "red" },
        ]}
      />

      <AdminFilterToolbar
        searchDataTestId="dashboard-reviews-search"
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Khách hàng, SĐT, nội dung"
        activeFilterCount={Number(statusFilter !== "pending") + Number(serviceFilter !== "all") + Number(ratingFilter !== "all") + Number(sortMode !== "newest")}
        onReset={resetFilters}
        desktopGridClassName="md:grid-cols-2 xl:grid-cols-4"
        resultSummary={<p data-testid="dashboard-reviews-result-count">Hiển thị {filteredReviews.length} / {reviews.length} đánh giá</p>}
      >
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái</span>
          <select
            data-testid="dashboard-reviews-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReviewStatusFilter)}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="pending">Chờ duyệt</option>
            <option value="approved">Đã duyệt</option>
            <option value="all">Tất cả</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Dịch vụ</span>
          <select
            data-testid="dashboard-reviews-service-filter"
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="all">Tất cả dịch vụ</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>{serviceLabels[service] || service}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Số sao</span>
          <select
            data-testid="dashboard-reviews-rating-filter"
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="all">Tất cả sao</option>
            <option value="5">5 sao</option>
            <option value="4">4 sao</option>
            <option value="3">3 sao</option>
            <option value="2">2 sao</option>
            <option value="1">1 sao</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Sắp xếp</span>
          <select
            data-testid="dashboard-reviews-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as ReviewSortMode)}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="newest">Mới nhất</option>
            <option value="ratingHigh">Sao cao nhất</option>
            <option value="ratingLow">Sao thấp nhất</option>
          </select>
        </label>
      </AdminFilterToolbar>

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
            <span className="flex items-center gap-1.5 font-body text-sm text-slate-500">
              <AdminServiceIcon service={review.service} className="h-4 w-4 shrink-0" />
              {serviceLabels[review.service] || review.service}
            </span>
            <span className={`rounded-full px-2 py-1 text-xs font-bold ${review.approved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {review.approved ? "Đã duyệt" : "Chờ duyệt"}
            </span>
          </div>
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-sm ${star <= review.rating ? "text-yellow-400" : "text-slate-200"}`}>★</span>
            ))}
          </div>
          <p className="font-body text-sm text-slate-600">&ldquo;{review.comment}&rdquo;</p>
          <p className="mt-1 font-body text-xs text-slate-500">{formatDateTime(review.createdAt)}</p>
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
