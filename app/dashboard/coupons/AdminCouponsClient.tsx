"use client";

import { useMemo, useState } from "react";
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

type CouponStatusFilter = "all" | "active" | "inactive" | "expired" | "depleted" | "assigned";
type CouponSortMode = "recommended" | "code" | "points" | "usage";

function isExpired(coupon: CouponData) {
  return Boolean(coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now());
}

function isDepleted(coupon: CouponData) {
  return coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit;
}

function getCouponStatus(coupon: CouponData) {
  if (isExpired(coupon)) return { key: "expired" as const, label: "Hết hạn", color: "bg-red-100 text-red-700" };
  if (isDepleted(coupon)) return { key: "depleted" as const, label: "Hết lượt", color: "bg-slate-200 text-slate-700" };
  if (!coupon.active) return { key: "inactive" as const, label: "Tạm tắt", color: "bg-slate-100 text-slate-500" };
  return { key: "active" as const, label: "Đang bật", color: "bg-green-100 text-green-700" };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

export default function AdminCouponsClient({ initialCoupons }: { initialCoupons: CouponData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [coupons, setCoupons] = useState<CouponData[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    discount: "",
    pointsCost: 50,
    usageLimit: 1,
    expiresAt: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>("all");
  const [sortMode, setSortMode] = useState<CouponSortMode>("recommended");

  const metrics = useMemo(() => {
    return coupons.reduce(
      (summary, coupon) => {
        const status = getCouponStatus(coupon);
        summary.total += 1;
        summary.used += coupon.usedCount;
        if (status.key === "active") summary.active += 1;
        if (status.key === "expired") summary.expired += 1;
        if (coupon.user) summary.assigned += 1;
        return summary;
      },
      { total: 0, active: 0, expired: 0, assigned: 0, used: 0 }
    );
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return coupons
      .filter((coupon) => {
        const status = getCouponStatus(coupon);
        const matchesStatus = statusFilter === "all"
          || status.key === statusFilter
          || (statusFilter === "assigned" && Boolean(coupon.user));
        const matchesSearch = query.length === 0
          || coupon.code.toLowerCase().includes(query)
          || coupon.description.toLowerCase().includes(query)
          || coupon.discount.toLowerCase().includes(query)
          || (coupon.user?.name || "").toLowerCase().includes(query);

        return matchesStatus && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "code") return first.code.localeCompare(second.code, "vi");
        if (sortMode === "points") return second.pointsCost - first.pointsCost;
        if (sortMode === "usage") return second.usedCount - first.usedCount;
        return Number(getCouponStatus(second).key === "active") - Number(getCouponStatus(first).key === "active");
      });
  }, [coupons, searchQuery, sortMode, statusFilter]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortMode("recommended");
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          expiresAt: formData.expiresAt || null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        const message = data.message || "Chưa tạo được mã giảm giá.";
        setFormError(message);
        showToast(message, "error");
        return;
      }

      setCoupons((prev) => [
        {
          ...data.coupon,
          expiresAt: data.coupon.expiresAt ? new Date(data.coupon.expiresAt).toISOString() : null,
          user: null,
        },
        ...prev,
      ]);
      setShowForm(false);
      setFormData({ code: "", description: "", discount: "", pointsCost: 50, usageLimit: 1, expiresAt: "" });
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
    <div data-testid="dashboard-coupons-crm" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Rewards CRM</p>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Mã Giảm Giá</h2>
          <p className="font-body text-sm text-slate-500">
            {metrics.total} mã · {metrics.active} đang bật · {metrics.used} lượt đã dùng
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={resetFilters}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-600 transition-colors hover:bg-slate-200"
          >
            Reset bộ lọc
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setFormError(null);
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-red-700"
          >
            + Tạo Mã
          </button>
        </div>
      </div>

      <div data-testid="dashboard-coupons-metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Đang bật</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-green-700">{metrics.active}</p>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-blue-700">Đã gán khách</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-blue-700">{metrics.assigned}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Lượt đã dùng</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.used}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Hết hạn</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-red-700">{metrics.expired}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]">
          <input
            data-testid="dashboard-coupons-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm mã, mô tả, mức giảm, khách đã đổi"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          />
          <select
            data-testid="dashboard-coupons-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as CouponStatusFilter)}
            title="Lọc trạng thái mã giảm giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang bật</option>
            <option value="inactive">Tạm tắt</option>
            <option value="expired">Hết hạn</option>
            <option value="depleted">Hết lượt</option>
            <option value="assigned">Đã gán khách</option>
          </select>
          <select
            data-testid="dashboard-coupons-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as CouponSortMode)}
            title="Sắp xếp mã giảm giá"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="recommended">Ưu tiên đang bật</option>
            <option value="code">Mã A-Z</option>
            <option value="points">Điểm cao nhất</option>
            <option value="usage">Dùng nhiều nhất</option>
          </select>
        </div>
        <p data-testid="dashboard-coupons-result-count" className="mt-3 font-body text-xs text-slate-400">
          Hiển thị {filteredCoupons.length} / {coupons.length} mã
        </p>
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
            <input type="number" value={formData.usageLimit} onChange={(event) => setFormData({ ...formData, usageLimit: parseInt(event.target.value, 10) || 1 })} placeholder="Số lượt dùng" min={1} className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
            <input type="date" value={formData.expiresAt} onChange={(event) => setFormData({ ...formData, expiresAt: event.target.value })} title="Ngày hết hạn mã" className="px-4 py-3 rounded-xl border border-slate-200 font-body text-sm" />
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
          {filteredCoupons.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <p className="font-body text-sm text-slate-400">Không có mã nào khớp bộ lọc.</p>
            </div>
          ) : (
            filteredCoupons.map((coupon) => {
              const status = getCouponStatus(coupon);

              return (
                <div
                  key={coupon.id}
                  data-testid="dashboard-coupon-card"
                  className={`flex flex-col gap-3 rounded-xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center ${deletingId === coupon.id ? "opacity-60" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold text-slate-800">{coupon.code}</code>
                      <span className="font-heading text-sm font-bold text-red-600">-{coupon.discount}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.color}`}>{status.label}</span>
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                        {coupon.pointsCost} điểm
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-slate-500">{coupon.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 font-body text-[10px] text-slate-400">
                      <span>Dùng: {coupon.usedCount}/{coupon.usageLimit}</span>
                      {coupon.expiresAt && <span>Hết hạn: {formatDate(coupon.expiresAt)}</span>}
                      {coupon.user && <span>Đã đổi bởi: {coupon.user.name}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCoupon(coupon.id)}
                    disabled={deletingId === coupon.id}
                    className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    {deletingId === coupon.id ? "..." : "Xoá"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
