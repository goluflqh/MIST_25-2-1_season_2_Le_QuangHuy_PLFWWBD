"use client";

import { useState, useEffect } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface WarrantyData { id: string; serialNo: string; productName: string; customerName: string; customerPhone: string; service: string; startDate: string; endDate: string; notes: string | null; }

const serviceLabels: Record<string, string> = { DONG_PIN: "🔋 Đóng Pin", DEN_NLMT: "☀️ NLMT", PIN_LUU_TRU: "⚡ Lưu Trữ", CAMERA: "📹 Camera", KHAC: "📞 Khác" };

export default function AdminWarrantyPage() {
  const { showToast, showConfirm } = useNotify();
  const [warranties, setWarranties] = useState<WarrantyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ serialNo: "", productName: "", customerPhone: "", service: "DONG_PIN", endDate: "", notes: "" });
  const [error, setError] = useState("");

  const fetchWarranties = async () => {
    const res = await fetch("/api/admin/warranty").then((r) => r.json());
    if (res.success) setWarranties(res.warranties);
    setIsLoading(false);
  };

  useEffect(() => {
    let isActive = true;

    const loadInitialWarranties = async () => {
      try {
        const res = await fetch("/api/admin/warranty").then((r) => r.json());
        if (isActive && res.success) setWarranties(res.warranties);
      } finally {
        if (isActive) setIsLoading(false);
      }
    };

    void loadInitialWarranties();

    return () => {
      isActive = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/warranty", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
    const data = await res.json();
    if (res.ok && data.success) {
      fetchWarranties();
      setShowForm(false);
      setFormData({ serialNo: "", productName: "", customerPhone: "", service: "DONG_PIN", endDate: "", notes: "" });
      showToast("Tạo phiếu bảo hành thành công!", "success");
    } else {
      setError(data.message || "Lỗi tạo phiếu BH.");
      showToast(data.message || "Lỗi tạo phiếu BH.", "error");
    }
  };

  const deleteWarranty = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá phiếu bảo hành này không?", async () => {
      const res = await fetch("/api/admin/warranty", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) { fetchWarranties(); showToast("Đã xoá phiếu bảo hành.", "success"); }
      else showToast("Lỗi khi xoá.", "error");
    });
  };

  if (isLoading) return <div className="py-12 text-center"><div className="animate-pulse h-6 bg-slate-200 rounded-xl w-40 mx-auto"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div><h2 className="font-heading font-extrabold text-xl text-slate-900">Bảo Hành Số</h2><p className="font-body text-sm text-slate-500">{warranties.length} phiếu</p></div>
        <button onClick={() => { setShowForm(!showForm); setError(""); }} className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors">+ Tạo Phiếu BH</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">Tạo Phiếu Bảo Hành</h3>
          <p className="font-body text-xs text-slate-400">⚠️ SĐT khách phải trùng với tài khoản đã đăng ký trên hệ thống.</p>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-body">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={formData.serialNo} onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })} placeholder="Số Serial" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.productName} onChange={(e) => setFormData({ ...formData, productName: e.target.value })} placeholder="Tên sản phẩm" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.customerPhone} onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })} placeholder="SĐT khách (đã đăng ký)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <select value={formData.service} onChange={(e) => setFormData({ ...formData, service: e.target.value })} title="Loại dịch vụ" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm">
              {Object.entries(serviceLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} title="Ngày hết hạn BH" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.notes || ""} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Ghi chú (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm">Tạo Phiếu</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {warranties.map((w) => {
          const isValid = new Date() < new Date(w.endDate);
          return (
            <div key={w.id} className={`bg-white rounded-xl p-5 border shadow-sm ${isValid ? "border-green-100" : "border-red-200 bg-red-50/30"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold">{w.serialNo}</code>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {isValid ? "✅ Còn BH" : "❌ Hết BH"}
                    </span>
                    <span className="text-xs text-slate-400">{serviceLabels[w.service]}</span>
                  </div>
                  <p className="font-body font-semibold text-sm text-slate-800 mt-1">{w.productName}</p>
                  <p className="font-body text-xs text-slate-400">{w.customerName} · {w.customerPhone}</p>
                  <p className="font-body text-[10px] text-slate-300">BH đến: {new Date(w.endDate).toLocaleDateString("vi-VN")}</p>
                </div>
                <button onClick={() => deleteWarranty(w.id)} className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-500 rounded-lg shrink-0">Xoá</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
