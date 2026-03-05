"use client";

import { useState, useEffect } from "react";
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
  DONG_PIN: "🔋 Đóng Pin", DEN_NLMT: "☀️ NLMT", PIN_LUU_TRU: "⚡ Lưu Trữ",
  CAMERA: "📹 Camera", CUSTOM: "🔧 Custom", KHAC: "📞 Khác",
};

export default function AdminReviewsPage() {
  const { showToast, showConfirm } = useNotify();
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reviews")
      .then((r) => r.json())
      .then((data) => { if (data.success) setReviews(data.reviews); })
      .finally(() => setIsLoading(false));
  }, []);

  const toggleApproval = async (id: string, approved: boolean) => {
    const res = await fetch("/api/admin/reviews", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
    if (res.ok) { setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved } : r)); showToast(approved ? "Đã duyệt đánh giá." : "Đã ẩn đánh giá.", "success"); }
  };

  const deleteReview = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá đánh giá này không?", async () => {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) { setReviews((prev) => prev.filter((r) => r.id !== id)); showToast("Đã xoá đánh giá.", "success"); }
      else showToast("Lỗi khi xoá.", "error");
    });
  };

  if (isLoading) return <div className="py-12 text-center"><div className="animate-pulse h-6 bg-slate-200 rounded-xl w-40 mx-auto"></div></div>;

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Đánh Giá</h2>
        <p className="font-body text-sm text-slate-500">{pending.length} chờ duyệt · {approved.length} đã duyệt</p>
      </div>

      {/* Pending Reviews */}
      {pending.length > 0 && (
        <div>
          <h3 className="font-body font-bold text-sm text-yellow-700 mb-3 flex items-center gap-2">⏳ Chờ Duyệt ({pending.length})</h3>
          <div className="space-y-3">
            {pending.map((r) => (
              <ReviewCard key={r.id} review={r} onToggle={toggleApproval} onDelete={deleteReview} />
            ))}
          </div>
        </div>
      )}

      {/* Approved Reviews */}
      <div>
        <h3 className="font-body font-bold text-sm text-green-700 mb-3 flex items-center gap-2">✅ Đã Duyệt ({approved.length})</h3>
        {approved.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center border border-slate-100">
            <p className="font-body text-slate-400">Chưa có đánh giá nào được duyệt</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approved.map((r) => (
              <ReviewCard key={r.id} review={r} onToggle={toggleApproval} onDelete={deleteReview} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewCard({ review, onToggle, onDelete }: { review: ReviewData; onToggle: (id: string, approved: boolean) => void; onDelete: (id: string) => void }) {
  return (
    <div className={`bg-white rounded-xl p-5 border shadow-sm ${review.approved ? "border-green-100" : "border-yellow-200 bg-yellow-50/30"}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-body font-bold text-sm text-slate-800">{review.user.name}</span>
            <span className="font-body text-xs text-slate-400">{review.user.phone}</span>
            <span className="font-body text-xs text-slate-400">{serviceLabels[review.service] || review.service}</span>
          </div>
          <div className="flex gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={`text-sm ${s <= review.rating ? "text-yellow-400" : "text-slate-200"}`}>★</span>
            ))}
          </div>
          <p className="font-body text-sm text-slate-600">&ldquo;{review.comment}&rdquo;</p>
          <p className="font-body text-[10px] text-slate-300 mt-1">{new Date(review.createdAt).toLocaleString("vi-VN")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggle(review.id, !review.approved)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${review.approved ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}
          >
            {review.approved ? "Ẩn" : "Duyệt ✓"}
          </button>
          <button onClick={() => onDelete(review.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}
