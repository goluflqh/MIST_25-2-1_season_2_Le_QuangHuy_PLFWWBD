"use client";

import { useState, useEffect } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface PricingItem {
  id: string;
  category: string;
  name: string;
  price: string;
  unit: string;
  description: string | null;
  note: string | null;
  sortOrder: number;
  active: boolean;
}

const categories = [
  { key: "PIN", label: "🔋 Pin", color: "bg-red-50 text-red-700" },
  { key: "NLMT", label: "☀️ NLMT", color: "bg-yellow-50 text-yellow-700" },
  { key: "LUU_TRU", label: "⚡ Lưu Trữ", color: "bg-blue-50 text-blue-700" },
  { key: "CAMERA", label: "📹 Camera", color: "bg-green-50 text-green-700" },
];

const emptyItem = { category: "PIN", name: "", price: "", unit: "VNĐ", description: "", note: "", sortOrder: 0 };

export default function AdminPricingPage() {
  const { showToast, showConfirm } = useNotify();
  const [items, setItems] = useState<PricingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchItems = async () => {
    const res = await fetch("/api/admin/pricing").then((r) => r.json());
    if (res.success) setItems(res.items);
    setIsLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...formData } : formData;
    const res = await fetch("/api/admin/pricing", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      fetchItems();
      setShowForm(false);
      setFormData(emptyItem);
      setEditingId(null);
      showToast(editingId ? "Đã cập nhật mục giá." : "Đã thêm mục giá mới.", "success");
    } else {
      showToast("Lỗi khi lưu mục giá.", "error");
    }
  };

  const startEdit = (item: PricingItem) => {
    setFormData({ category: item.category, name: item.name, price: item.price, unit: item.unit, description: item.description || "", note: item.note || "", sortOrder: item.sortOrder });
    setEditingId(item.id);
    setShowForm(true);
  };

  const deleteItem = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá mục giá này không?", async () => {
      const res = await fetch("/api/admin/pricing", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (res.ok) { fetchItems(); showToast("Đã xoá mục giá.", "success"); }
      else showToast("Lỗi khi xoá.", "error");
    });
  };

  if (isLoading) return <div className="py-12 text-center"><div className="animate-pulse h-6 bg-slate-200 rounded-xl w-40 mx-auto"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Bảng Giá</h2>
          <p className="font-body text-sm text-slate-500">{items.length} mục · Sửa ở đây → tự cập nhật trang /bao-gia</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyItem); }} className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors">
          + Thêm Mới
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">{editingId ? "Sửa" : "Thêm"} Mục Giá</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} title="Danh mục" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm">
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Tên sản phẩm / dịch vụ" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} placeholder="Giá (VD: 350.000 - 500.000)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.description || ""} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Mô tả (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
            <input value={formData.note || ""} onChange={(e) => setFormData({ ...formData, note: e.target.value })} placeholder="Ghi chú (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
            <input type="number" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })} placeholder="Thứ tự" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm">{editingId ? "Cập Nhật" : "Thêm"}</button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {categories.map((cat) => {
        const catItems = items.filter((i) => i.category === cat.key);
        if (catItems.length === 0) return null;
        return (
          <div key={cat.key}>
            <h3 className="font-body font-bold text-sm text-slate-600 mb-2 flex items-center gap-2">{cat.label} ({catItems.length})</h3>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              {catItems.map((item) => (
                <div key={item.id} className="px-5 py-3.5 flex items-center gap-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm text-slate-800">{item.name}</p>
                    {item.description && <p className="font-body text-xs text-slate-400">{item.description}</p>}
                  </div>
                  <span className="font-heading font-bold text-red-600 text-sm shrink-0">{item.price} {item.unit}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(item)} className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-lg">Sửa</button>
                    <button onClick={() => deleteItem(item.id)} className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg">Xoá</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
