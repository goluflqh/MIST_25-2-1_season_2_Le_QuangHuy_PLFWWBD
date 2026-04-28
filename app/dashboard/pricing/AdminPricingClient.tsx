"use client";

import { useMemo, useRef, useState } from "react";
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

type PricingSeedItem = Omit<PricingItem, "id">;

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

function getPricingSignature(item: Pick<PricingItem, "category" | "name">) {
  return `${item.category}:${item.name.trim().replace(/\s+/g, " ").toLowerCase()}`;
}

function sanitizeIntegerText(value: string) {
  return value.replace(/\D/g, "");
}

function parseIntegerField(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function AdminPricingClient({
  defaultItems = [],
  initialItems,
}: {
  defaultItems?: readonly PricingSeedItem[];
  initialItems: PricingItem[];
}) {
  const { showToast, showConfirm } = useNotify();
  const bootstrapInFlightRef = useRef(false);
  const [items, setItems] = useState<PricingItem[]>(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyItem);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState(emptyItem);
  const [isSaving, setIsSaving] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
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

  const missingDefaultItems = useMemo(() => {
    return defaultItems.filter((defaultItem) => (
      !items.some((item) => (
        getPricingSignature(item) === getPricingSignature(defaultItem)
      ))
    ));
  }, [defaultItems, items]);
  const canImportDefaultPricing = items.length === 0 && missingDefaultItems.length > 0;

  const resetFilters = () => {
    setSearchQuery("");
    setCategoryFilter("all");
    setSortMode("category");
  };

  const bootstrapDefaultPricing = async () => {
    if (bootstrapInFlightRef.current || missingDefaultItems.length === 0) return;

    bootstrapInFlightRef.current = true;
    setIsBootstrapping(true);
    setFormError(null);

    try {
      const created: PricingItem[] = [];
      const itemsToCreate = missingDefaultItems;

      for (const item of itemsToCreate) {
        const response = await fetch("/api/admin/pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || `Chưa nhập được mục giá "${item.name}".`);
        }

        created.push(data.item);
      }

      setItems((prev) => {
        const seen = new Set(prev.map(getPricingSignature));
        const merged = [...prev];

        for (const item of created) {
          const signature = getPricingSignature(item);
          if (!seen.has(signature)) {
            seen.add(signature);
            merged.push(item);
          }
        }

        return sortItems(merged);
      });
      showToast(`Đã bổ sung ${created.length} mục giá mẫu còn thiếu vào dashboard.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chưa nhập được bảng giá mẫu.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      bootstrapInFlightRef.current = false;
      setIsBootstrapping(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      ...formData,
      sortOrder: parseIntegerField(formData.sortOrder, 0),
    };

    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Lỗi khi lưu mục giá.";
        setFormError(message);
        showToast(message, "error");
        return;
      }

      setItems((prev) => sortItems([...prev, data.item]));
      setShowForm(false);
      setFormData(emptyItem);
      showToast("Đã thêm mục giá mới.", "success");
    } catch {
      const message = "Không thể lưu mục giá lúc này.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (item: PricingItem) => {
    setEditFormData({
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
    setShowForm(false);
  };

  const saveInlineEdit = async (id: string) => {
    const payload = {
      ...editFormData,
      sortOrder: parseIntegerField(editFormData.sortOrder, 0),
    };

    setSavingEditId(id);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Lỗi khi lưu mục giá.";
        setFormError(message);
        showToast(message, "error");
        return;
      }

      setItems((prev) => sortItems(prev.map((item) => (item.id === id ? data.item : item))));
      setEditingId(null);
      setEditFormData(emptyItem);
      showToast("Đã cập nhật mục giá.", "success");
    } catch {
      const message = "Không thể lưu mục giá lúc này.";
      setFormError(message);
      showToast(message, "error");
    } finally {
      setSavingEditId(null);
    }
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
          {canImportDefaultPricing ? (
            <button
              onClick={bootstrapDefaultPricing}
              disabled={isBootstrapping}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-300"
            >
              {isBootstrapping ? "Đang nhập..." : "Nhập bảng giá mẫu"}
            </button>
          ) : null}
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
          <h3 className="font-heading font-bold text-slate-900">Thêm Mục Giá</h3>
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
              {isSaving ? "Đang lưu..." : "Thêm"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setFormError(null); }} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="font-body text-sm text-slate-400">
            {items.length === 0
              ? "Chưa có mục giá nào trong DB. Bấm Nhập bảng giá mẫu để đưa dữ liệu đang hiển thị public vào dashboard."
              : "Không có mục giá nào khớp bộ lọc."}
          </p>
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
                {categoryItems.map((item) => {
                  const isEditing = editingId === item.id;

                  if (isEditing) {
                    return (
                      <form
                        key={item.id}
                        data-testid="dashboard-pricing-item"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveInlineEdit(item.id);
                        }}
                        className="border-b border-slate-50 bg-slate-50/70 px-5 py-4 last:border-0"
                      >
                        <div className="grid gap-3 lg:grid-cols-[150px_1.2fr_1fr_90px_90px]">
                          <select
                            value={editFormData.category}
                            onChange={(event) => setEditFormData({ ...editFormData, category: event.target.value })}
                            title="Danh mục"
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                          >
                            {categories.map((categoryOption) => (
                              <option key={categoryOption.key} value={categoryOption.key}>{categoryOption.label}</option>
                            ))}
                          </select>
                          <input
                            value={editFormData.name}
                            onChange={(event) => setEditFormData({ ...editFormData, name: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Tên mục giá"
                            required
                          />
                          <input
                            value={editFormData.price}
                            onChange={(event) => setEditFormData({ ...editFormData, price: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Giá"
                            required
                          />
                          <input
                            value={editFormData.unit}
                            onChange={(event) => setEditFormData({ ...editFormData, unit: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Đơn vị"
                          />
                          <input
                            type="text"
                            inputMode="numeric"
                            value={editFormData.sortOrder}
                            onChange={(event) => setEditFormData({ ...editFormData, sortOrder: sanitizeIntegerText(event.target.value) })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Thứ tự"
                          />
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <input
                            value={editFormData.description || ""}
                            onChange={(event) => setEditFormData({ ...editFormData, description: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Mô tả"
                          />
                          <input
                            value={editFormData.note || ""}
                            onChange={(event) => setEditFormData({ ...editFormData, note: event.target.value })}
                            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-body"
                            placeholder="Ghi chú"
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={savingEditId === item.id}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            {savingEditId === item.id ? "Đang lưu..." : "Lưu dòng này"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(null);
                              setEditFormData(emptyItem);
                              setFormError(null);
                            }}
                            disabled={savingEditId === item.id}
                            className="rounded-xl bg-white px-4 py-2 text-sm font-body font-bold text-slate-600 ring-1 ring-slate-200 disabled:text-slate-300"
                          >
                            Huỷ
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div
                      key={item.id}
                      data-testid="dashboard-pricing-item"
                      className={`flex flex-col gap-3 border-b border-slate-50 px-5 py-4 last:border-0 sm:flex-row sm:items-center ${deletingId === item.id ? "opacity-60" : "hover:bg-slate-50/50"}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-body text-sm font-semibold text-slate-800">{item.name}</p>
                        {item.description && <p className="font-body text-xs text-slate-400">{item.description}</p>}
                        {item.note && <p className="font-body text-[10px] text-slate-300">{item.note}</p>}
                      </div>
                      <span className="shrink-0 font-heading text-sm font-bold text-red-600">{item.price} {item.unit}</span>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => startEdit(item)} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">Sửa</button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          disabled={deletingId === item.id}
                          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-500 disabled:bg-slate-100 disabled:text-slate-300"
                        >
                          {deletingId === item.id ? "..." : "Xoá"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
