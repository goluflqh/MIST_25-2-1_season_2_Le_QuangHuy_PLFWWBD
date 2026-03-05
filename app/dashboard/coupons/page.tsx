"use client";

import { useState, useEffect } from "react";

interface CouponData { id: string; code: string; description: string; discount: string; pointsCost: number; usageLimit: number; usedCount: number; active: boolean; expiresAt: string | null; user: { name: string } | null; }

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ code: "", description: "", discount: "", pointsCost: 50, usageLimit: 1 });

  const fetchCoupons = async () => { const res = await fetch("/api/admin/coupons").then((r) => r.json()); if (res.success) setCoupons(res.coupons); setIsLoading(false); };
  useEffect(() => { fetchCoupons(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/coupons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    if (res.ok) { fetchCoupons(); setShowForm(false); setFormData({ code: "", description: "", discount: "", pointsCost: 50, usageLimit: 1 }); }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Xoá mã này?")) return;
    const res = await fetch("/api/admin/coupons", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) fetchCoupons();
  };

  if (isLoading) return <div className="py-12 text-center"><div className="animate-pulse h-6 bg-slate-200 rounded-xl w-40 mx-auto"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Mã Giảm Giá</h2>
          <p className="font-body text-sm text-slate-500">{coupons.length} mã</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors">+ Tạo Mã</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">Tạo Mã Giảm Giá</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="Mã coupon (VD: MINHHONG50)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.discount} onChange={(e) => setFormData({ ...formData, discount: e.target.value })} placeholder="Giảm giá (VD: 10% hoặc 50000)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Mô tả (VD: Giảm 10% dịch vụ pin)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input type="number" value={formData.pointsCost} onChange={(e) => setFormData({ ...formData, pointsCost: parseInt(e.target.value) || 0 })} placeholder="Điểm cần đổi" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm">Tạo</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {coupons.map((c) => (
          <div key={c.id} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="px-2 py-1 bg-slate-100 rounded-lg text-sm font-bold text-slate-800">{c.code}</code>
                <span className="font-heading font-bold text-red-600 text-sm">-{c.discount}</span>
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{c.pointsCost} điểm</span>
              </div>
              <p className="font-body text-xs text-slate-400 mt-1">{c.description} · Dùng: {c.usedCount}/{c.usageLimit}</p>
              {c.user && <p className="font-body text-[10px] text-slate-300">Đã đổi bởi: {c.user.name}</p>}
            </div>
            <button onClick={() => deleteCoupon(c.id)} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-500 rounded-lg hover:bg-red-100 shrink-0">Xoá</button>
          </div>
        ))}
      </div>
    </div>
  );
}
