"use client";

import { useState } from "react";
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

const emptyItem = {
  category: "PIN",
  name: "",
  price: "",
  unit: "VNĐ",
  description: "",
  note: "",
  sortOrder: 0,
};

function sortItems(items: PricingItem[]) {
  return [...items].sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category);
    if (categoryCompare !== 0) return categoryCompare;

    const orderCompare = left.sortOrder - right.sortOrder;
    if (orderCompare !== 0) return orderCompare;

    return left.name.localeCompare(right.name);
  });
}

export default function AdminPricingClient({ initialItems }: { initialItems: PricingItem[] }) {
  const { showToast, showConfirm } = useNotify();
  const [items, setItems] = useState<PricingItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { id: editingId, ...formData } : formData;

    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/pricing", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Lỗi khi lưu mục giá.";
        setFormError(message);
        showToast(message, "error");
        return;
      }

      setItems((prev) => sortItems(
        editingId
          ? prev.map((item) => (item.id === editingId ? data.item : item))
          : [...prev, data.item]
      ));
      setShowForm(false);
      setFormData(emptyItem);
      setEditingId(null);
      showToast(editingId ? "Đã cập nhật mục giá." : "Đã thêm mục giá mới.", "success");
    } catch {
      const message = "Không thể lưu mục giá lúc này.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: PricingItem) => {
    setFormData({
      category: item.category,
      name: item.name,
      price: item.price,
      unit: item.unit,
      description: item.description || "",
      note: item.note || "",
      sortOrder: item.sortOrder,
    });
    setEditingId(item.id);
    setFormError(null);
    setShowForm(true);
  };

  const deleteItem = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá mục giá này không?", async () => {
      setDeletingId(id);

      try {
        const response = await fetch("/api/admin/pricing", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi khi xoá.", "error");
          return;
        }

        setItems((prev) => prev.filter((item) => item.id !== id));
        showToast("Đã xoá mục giá.", "success");
      } catch {
        showToast("Không thể xoá mục giá lúc này.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Bảng Giá</h2>
          <p className="font-body text-sm text-slate-500">{items.length} mục · sửa ở đây → tự cập nhật trang /bao-gia</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData(emptyItem);
            setFormError(null);
          }}
          className="px-4 py-2 bg-red-600 text-white rounded-xl font-body font-bold text-sm hover:bg-red-700 transition-colors"
        >
          + Thêm Mới
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <h3 className="font-heading font-bold text-slate-900">{editingId ? "Sửa" : "Thêm"} Mục Giá</h3>
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-body text-red-600">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })} title="Danh mục" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm">
              {categories.map((category) => <option key={category.key} value={category.key}>{category.label}</option>)}
            </select>
            <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Tên sản phẩm / dịch vụ" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.price} onChange={(event) => setFormData({ ...formData, price: event.target.value })} placeholder="Giá (VD: 350.000 - 500.000)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" required />
            <input value={formData.description || ""} onChange={(event) => setFormData({ ...formData, description: event.target.value })} placeholder="Mô tả (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
            <input value={formData.note || ""} onChange={(event) => setFormData({ ...formData, note: event.target.value })} placeholder="Ghi chú (tuỳ chọn)" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
            <input type="number" value={formData.sortOrder} onChange={(event) => setFormData({ ...formData, sortOrder: parseInt(event.target.value, 10) || 0 })} placeholder="Thứ tự" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang lưu..." : editingId ? "Cập Nhật" : "Thêm"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormError(null); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category.key);
        if (categoryItems.length === 0) return null;

        return (
          <div key={category.key}>
            <h3 className="font-body font-bold text-sm text-slate-600 mb-2 flex items-center gap-2">{category.label} ({categoryItems.length})</h3>
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
              {categoryItems.map((item) => (
                <div key={item.id} className={`px-5 py-3.5 flex items-center gap-4 border-b border-slate-50 last:border-0 ${deletingId === item.id ? "opacity-60" : "hover:bg-slate-50/50"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm text-slate-800">{item.name}</p>
                    {item.description && <p className="font-body text-xs text-slate-400">{item.description}</p>}
                  </div>
                  <span className="font-heading font-bold text-red-600 text-sm shrink-0">{item.price} {item.unit}</span>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(item)} className="px-2 py-1 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-lg">Sửa</button>
                    <button
                      onClick={() => deleteItem(item.id)}
                      disabled={deletingId === item.id}
                      className="px-2 py-1 text-[10px] font-bold bg-red-50 text-red-500 rounded-lg disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {deletingId === item.id ? "..." : "Xoá"}
                    </button>
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
