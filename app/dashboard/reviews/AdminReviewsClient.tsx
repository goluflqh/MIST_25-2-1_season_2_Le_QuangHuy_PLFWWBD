"use client";

import { useState } from "react";
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

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ NLMT",
  PIN_LUU_TRU: "⚡ Lưu Trữ",
  CAMERA: "📹 Camera",
  CUSTOM: "🔧 Custom",
  KHAC: "📞 Khác",
};

export default function AdminReviewsClient({ initialReviews }: { initialReviews: ReviewData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [reviews, setReviews] = useState<ReviewData[]>(initialReviews);
  const [pendingReviewId, setPendingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

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

  const pending = reviews.filter((review) => !review.approved);
  const approved = reviews.filter((review) => review.approved);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Đánh Giá</h2>
        <p className="font-body text-sm text-slate-500">{pending.length} chờ duyệt · {approved.length} đã duyệt</p>
      </div>

      {pending.length > 0 && (
        <div>
          <h3 className="font-body font-bold text-sm text-yellow-700 mb-3 flex items-center gap-2">⏳ Chờ Duyệt ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isPending={pendingReviewId === review.id}
                isDeleting={deletingReviewId === review.id}
                onToggle={toggleApproval}
                onDelete={deleteReview}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="font-body font-bold text-sm text-green-700 mb-3 flex items-center gap-2">✅ Đã Duyệt ({approved.length})</h3>
        {approved.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
            <p className="font-body text-slate-400">Chưa có đánh giá nào được duyệt</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approved.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                isPending={pendingReviewId === review.id}
                isDeleting={deletingReviewId === review.id}
                onToggle={toggleApproval}
                onDelete={deleteReview}
              />
            ))}
          </div>
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
    <div className={`bg-white rounded-xl p-5 border shadow-sm transition-opacity ${review.approved ? "border-green-100" : "border-yellow-200 bg-yellow-50/30"} ${isDeleting ? "opacity-60" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-body font-bold text-sm text-slate-800">{review.user.name}</span>
            <span className="font-body text-xs text-slate-400">{review.user.phone}</span>
            <span className="font-body text-xs text-slate-400">{serviceLabels[review.service] || review.service}</span>
          </div>
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star} className={`text-sm ${star <= review.rating ? "text-yellow-400" : "text-slate-200"}`}>★</span>
            ))}
          </div>
          <p className="font-body text-sm text-slate-600">&ldquo;{review.comment}&rdquo;</p>
          <p className="font-body text-[10px] text-slate-300 mt-1">{new Date(review.createdAt).toLocaleString("vi-VN")}</p>
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
