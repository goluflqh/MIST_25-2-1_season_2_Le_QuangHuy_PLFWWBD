"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface CouponData {
  id: string;
  code: string;
  description: string;
  discount: string;
  pointsCost: number;
  usageLimit: number;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
  user: { name: string } | null;
}

export default function AdminCouponsClient({ initialCoupons }: { initialCoupons: CouponData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [coupons, setCoupons] = useState<CouponData[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ code: "", description: "", discount: "", pointsCost: 50, usageLimit: 1 });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Chưa tạo được mã giảm giá.";
        setFormError(message);
        showToast(message, "error");
        return;
      }

      setCoupons((prev) => [data.coupon, ...prev]);
      setShowForm(false);
      setFormData({ code: "", description: "", discount: "", pointsCost: 50, usageLimit: 1 });
      showToast("Đã tạo mã giảm giá mới.", "success");
    } catch {
      const message = "Không thể tạo mã giảm giá lúc này.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteCoupon = (id: string) => {
    showConfirm("Xoá mã này?", async () => {
      setDeletingId(id);

      try {
        const response = await fetch("/api/admin/coupons", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Không xoá được mã này.", "error");
          return;
        }

        setCoupons((prev) => prev.filter((coupon) => coupon.id !== id));
        showToast("Đã xoá mã giảm giá.", "success");
      } catch {
        showToast("Không thể xoá mã lúc này.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Mã Giảm Giá</h2>
          <p className="font-body text-sm text-slate-500">{coupons.length} mã</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setFormError(null);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors"
        >
          + Tạo Mã
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">Tạo Mã Giảm Giá</h3>
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-body text-red-600">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={formData.code} onChange={(event) => setFormData({ ...formData, code: event.target.value.toUpperCase() })} placeholder="Mã coupon (VD: MINHHONG50)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.discount} onChange={(event) => setFormData({ ...formData, discount: event.target.value })} placeholder="Giảm giá (VD: 10% hoặc 50000)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.description} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Mô tả (VD: Giảm 10% dịch vụ pin)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input type="number" value={formData.pointsCost} onChange={(event) => setFormData({ ...formData, pointsCost: parseInt(event.target.value, 10) || 0 })} placeholder="Điểm cần đổi" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang tạo..." : "Tạo"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {coupons.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="font-body text-slate-500">Chưa có mã giảm giá nào được tạo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div key={coupon.id} className={`bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center ${deletingId === coupon.id ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="px-2 py-1 bg-slate-100 rounded-lg text-sm font-bold text-slate-800">{coupon.code}</code>
                  <span className="font-heading font-bold text-red-600 text-sm">-{coupon.discount}</span>
                  <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{coupon.pointsCost} điểm</span>
                </div>
                <p className="font-body text-xs text-slate-400 mt-1">{coupon.description} · Dùng: {coupon.usedCount}/{coupon.usageLimit}</p>
                {coupon.user && <p className="font-body text-[10px] text-slate-300">Đã đổi bởi: {coupon.user.name}</p>}
              </div>
              <button
                onClick={() => deleteCoupon(coupon.id)}
                disabled={deletingId === coupon.id}
                className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 shrink-0 disabled:bg-slate-100 disabled:text-slate-300"
              >
                {deletingId === coupon.id ? "..." : "Xoá"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
