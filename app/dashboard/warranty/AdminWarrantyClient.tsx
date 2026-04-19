"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface WarrantyData {
  id: string;
  serialNo: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startDate: string;
  endDate: string;
  notes: string | null;
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ NLMT",
  PIN_LUU_TRU: "⚡ Lưu Trữ",
  CAMERA: "📹 Camera",
  KHAC: "📞 Khác",
};

export default function AdminWarrantyClient({
  initialWarranties,
}: {
  initialWarranties: WarrantyData[];
}) {
  const { showToast, showConfirm } = useNotify();
  const [warranties, setWarranties] = useState<WarrantyData[]>(initialWarranties);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    serialNo: "",
    productName: "",
    customerPhone: "",
    service: "DONG_PIN",
    endDate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Lỗi tạo phiếu BH.";
        setError(message);
        showToast(message, "error");
        return;
      }

      setWarranties((prev) => [
        {
          ...data.warranty,
          startDate: new Date(data.warranty.startDate).toISOString(),
          endDate: new Date(data.warranty.endDate).toISOString(),
        },
        ...prev,
      ]);
      setShowForm(false);
      setFormData({ serialNo: "", productName: "", customerPhone: "", service: "DONG_PIN", endDate: "", notes: "" });
      showToast("Tạo phiếu bảo hành thành công!", "success");
    } catch {
      const message = "Không thể tạo phiếu bảo hành lúc này.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWarranty = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá phiếu bảo hành này không?", async () => {
      setDeletingId(id);

      try {
        const response = await fetch("/api/admin/warranty", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi khi xoá.", "error");
          return;
        }

        setWarranties((prev) => prev.filter((warranty) => warranty.id !== id));
        showToast("Đã xoá phiếu bảo hành.", "success");
      } catch {
        showToast("Không thể xoá phiếu bảo hành lúc này.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Bảo Hành Số</h2>
          <p className="font-body text-sm text-slate-500">{warranties.length} phiếu</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setError("");
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors"
        >
          + Tạo Phiếu BH
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">Tạo Phiếu Bảo Hành</h3>
          <p className="font-body text-xs text-slate-400">⚠️ SĐT khách phải trùng với tài khoản đã đăng ký trên hệ thống.</p>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-body">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={formData.serialNo} onChange={(event) => setFormData({ ...formData, serialNo: event.target.value })} placeholder="Số Serial" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.productName} onChange={(event) => setFormData({ ...formData, productName: event.target.value })} placeholder="Tên sản phẩm" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.customerPhone} onChange={(event) => setFormData({ ...formData, customerPhone: event.target.value })} placeholder="SĐT khách (đã đăng ký)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <select value={formData.service} onChange={(event) => setFormData({ ...formData, service: event.target.value })} title="Loại dịch vụ" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm">
              {Object.entries(serviceLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
            </select>
            <input type="date" value={formData.endDate} onChange={(event) => setFormData({ ...formData, endDate: event.target.value })} title="Ngày hết hạn BH" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.notes || ""} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Ghi chú (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang tạo..." : "Tạo Phiếu"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {warranties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <p className="text-3xl mb-2">🛡️</p>
          <p className="font-body text-slate-500">Chưa có phiếu bảo hành nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warranties.map((warranty) => {
            const isValid = new Date() < new Date(warranty.endDate);

            return (
              <div key={warranty.id} className={`bg-white rounded-xl p-5 border shadow-sm ${isValid ? "border-green-100" : "border-red-200 bg-red-50/30"} ${deletingId === warranty.id ? "opacity-60" : ""}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold">{warranty.serialNo}</code>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isValid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {isValid ? "✅ Còn BH" : "❌ Hết BH"}
                      </span>
                      <span className="text-xs text-slate-400">{serviceLabels[warranty.service]}</span>
                    </div>
                    <p className="font-body font-semibold text-sm text-slate-800 mt-1">{warranty.productName}</p>
                    <p className="font-body text-xs text-slate-400">{warranty.customerName} · {warranty.customerPhone}</p>
                    <p className="font-body text-[10px] text-slate-300">BH đến: {new Date(warranty.endDate).toLocaleDateString("vi-VN")}</p>
                  </div>
                  <button
                    onClick={() => deleteWarranty(warranty.id)}
                    disabled={deletingId === warranty.id}
                    className="px-3 py-1.5 text-xs font-bold bg-red-50 text-red-500 rounded-lg shrink-0 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    {deletingId === warranty.id ? "..." : "Xoá"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
