"use client";

import { useMemo, useState } from "react";
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
  sortOrder: "0",
};

type PricingSortMode = "category" | "name" | "order";

function sortItems(items: PricingItem[]) {
  return [...items].sort((left, right) => {
    const categoryCompare = left.category.localeCompare(right.category);
    if (categoryCompare !== 0) return categoryCompare;

    const orderCompare = left.sortOrder - right.sortOrder;
    if (orderCompare !== 0) return orderCompare;

    return left.name.localeCompare(right.name);
  });
}

function sanitizeIntegerText(value: string) {
  return value.replace(/\D/g, "");
}

function parseIntegerField(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortMode, setSortMode] = useState<PricingSortMode>("category");

  const metrics = useMemo(() => {
    const activeItems = items.filter((item) => item.active).length;
    const categoriesInUse = new Set(items.map((item) => item.category)).size;
    const itemsWithNotes = items.filter((item) => item.note || item.description).length;

    return { activeItems, categoriesInUse, itemsWithNotes };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items
      .filter((item) => {
        const categoryLabel = categories.find((category) => category.key === item.category)?.label || item.category;
        const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
        const matchesSearch = query.length === 0
          || item.name.toLowerCase().includes(query)
          || item.price.toLowerCase().includes(query)
          || item.unit.toLowerCase().includes(query)
          || (item.description || "").toLowerCase().includes(query)
          || (item.note || "").toLowerCase().includes(query)
          || categoryLabel.toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "name") return first.name.localeCompare(second.name, "vi");
        if (sortMode === "order") return first.sortOrder - second.sortOrder;
        return sortItems([first, second])[0].id === first.id ? -1 : 1;
      });
  }, [categoryFilter, items, searchQuery, sortMode]);

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSortMode("category");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const method = editingId ? "PATCH" : "POST";
    const payload = {
      ...formData,
      sortOrder: parseIntegerField(formData.sortOrder, 0),
    };
    const body = editingId ? { id: editingId, ...payload } : payload;

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
      sortOrder: String(item.sortOrder),
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
    <div data-testid="dashboard-pricing-crm" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Bảng giá dịch vụ</p>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Bảng Giá</h2>
          <p className="font-body text-sm text-slate-500">
            {items.length} mục · sửa ở đây → tự cập nhật trang /bao-gia
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={resetFilters}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            Xoá bộ lọc
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData(emptyItem);
              setFormError(null);
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-red-700"
          >
            + Thêm Mới
          </button>
        </div>
      </div>

      <div data-testid="dashboard-pricing-metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Mục đang hiển thị</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.activeItems}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-blue-700">Nhóm dịch vụ</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-blue-700">{metrics.categoriesInUse}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Có mô tả/ghi chú</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-green-700">{metrics.itemsWithNotes}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Kết quả lọc</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{filteredItems.length}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
          <input
            data-testid="dashboard-pricing-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm tên, giá, mô tả, ghi chú"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          />
          <select
            data-testid="dashboard-pricing-category-filter"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            title="Lọc nhóm bảng giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả nhóm</option>
            {categories.map((category) => (
              <option key={category.key} value={category.key}>{category.label}</option>
            ))}
          </select>
          <select
            data-testid="dashboard-pricing-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as PricingSortMode)}
            title="Sắp xếp bảng giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="category">Nhóm + thứ tự</option>
            <option value="order">Thứ tự nhỏ nhất</option>
            <option value="name">Tên A-Z</option>
          </select>
        </div>
        <p data-testid="dashboard-pricing-result-count" className="mt-3 font-body text-xs text-slate-400">
          Hiển thị {filteredItems.length} / {items.length} mục
        </p>
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
            <input
              type="text"
              inputMode="numeric"
              value={formData.sortOrder}
              onChange={(event) => setFormData({ ...formData, sortOrder: sanitizeIntegerText(event.target.value) })}
              placeholder="Thứ tự"
              className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang lưu..." : editingId ? "Cập Nhật" : "Thêm"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setFormError(null); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="font-body text-sm text-slate-400">Không có mục giá nào khớp bộ lọc.</p>
        </div>
      ) : (
        categories.map((category) => {
          const categoryItems = filteredItems.filter((item) => item.category === category.key);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.key}>
              <h3 className="font-body font-bold text-sm text-slate-600 mb-2 flex items-center gap-2">
                {category.label} ({categoryItems.length})
              </h3>
              <div className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    data-testid="dashboard-pricing-item"
                    className={`flex items-center gap-4 border-b border-slate-50 px-5 py-3.5 last:border-0 ${deletingId === item.id ? "opacity-60" : "hover:bg-slate-50/50"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-semibold text-slate-800">{item.name}</p>
                      {item.description && <p className="font-body text-xs text-slate-400">{item.description}</p>}
                      {item.note && <p className="font-body text-[10px] text-slate-300">{item.note}</p>}
                    </div>
                    <span className="shrink-0 font-heading text-sm font-bold text-red-600">{item.price} {item.unit}</span>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => startEdit(item)} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Sửa</button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-500 disabled:bg-slate-100 disabled:text-slate-300"
                      >
                        {deletingId === item.id ? "..." : "Xoá"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
