"use client";

import { useMemo, useRef, useState } from "react";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import { formatVietnamDate } from "@/lib/vietnam-time";

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
  _count: { redemptions: number };
  redemptions: {
    id: string;
    createdAt: string;
    user: { name: string; phone: string };
  }[];
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
  return formatVietnamDate(value);
}

function normalizeCouponCodeInput(value: string) {
  return value
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
}

function sanitizeUnsignedIntegerText(value: string) {
  return value.replace(/\D/g, "");
}

function parseIntegerField(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRedemptionCount(coupon: CouponData) {
  return coupon._count?.redemptions ?? 0;
}

function isVietnameseDateText(value: string) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim());
}

const couponFormDefaults = {
  code: "",
  description: "",
  discount: "",
  pointsCost: "50",
  usageLimit: "1",
  expiresAt: "",
};

export default function AdminCouponsClient({ initialCoupons }: { initialCoupons: CouponData[] }) {
  const { showToast, showConfirm } = useNotify();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [coupons, setCoupons] = useState<CouponData[]>(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(couponFormDefaults);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponStatusFilter>("all");
  const [sortMode, setSortMode] = useState<CouponSortMode>("recommended");
  const [expandedCouponId, setExpandedCouponId] = useState<string | null>(null);

  const metrics = useMemo(() => {
    return coupons.reduce(
      (summary, coupon) => {
        const status = getCouponStatus(coupon);
        const redemptionCount = getRedemptionCount(coupon);
        summary.total += 1;
        summary.used += coupon.usedCount;
        if (status.key === "active") summary.active += 1;
        if (status.key === "expired") summary.expired += 1;
        summary.assigned += redemptionCount;
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
        const redemptionCount = getRedemptionCount(coupon);
        const matchesStatus = statusFilter === "all"
          || status.key === statusFilter
          || (statusFilter === "assigned" && redemptionCount > 0);
        const matchesSearch = query.length === 0
          || coupon.code.toLowerCase().includes(query)
          || coupon.description.toLowerCase().includes(query)
          || coupon.discount.toLowerCase().includes(query)
          || coupon.redemptions.some((redemption) => (
            redemption.user.name.toLowerCase().includes(query)
            || redemption.user.phone.toLowerCase().includes(query)
          ));

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

  const toggleCreateForm = () => {
    const shouldOpen = !showForm;
    setShowForm(shouldOpen);
    setFormError(null);

    if (shouldOpen) {
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        firstFieldRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const payload = {
      code: formData.code.trim(),
      description: formData.description.trim(),
      discount: formData.discount.trim(),
      pointsCost: parseIntegerField(formData.pointsCost, 0),
      usageLimit: parseIntegerField(formData.usageLimit, 1),
      expiresAt: formData.expiresAt.trim() || null,
    };

    if (!payload.code || !payload.description || !payload.discount) {
      const message = "Vui lòng nhập đủ mã, giá trị giảm và mô tả ưu đãi.";
      setFormError(message);
      showToast(message, "error");
      return;
    }

    if (payload.expiresAt && !isVietnameseDateText(payload.expiresAt)) {
      const message = "Ngày hết hạn nhập theo dạng ngày/tháng/năm, ví dụ 30/04/2026.";
      setFormError(message);
      showToast(message, "error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
          _count: { redemptions: 0 },
          redemptions: [],
        },
        ...prev,
      ]);
      setShowForm(false);
      setFormData(couponFormDefaults);
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
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Ưu đãi đổi điểm</p>
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
            Xoá bộ lọc
          </button>
          <button
            aria-expanded={showForm}
            onClick={toggleCreateForm}
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
          <p className="font-body text-xs uppercase tracking-wider text-blue-700">Lượt khách nhận</p>
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
            placeholder="Tìm mã, mô tả, mức giảm, khách đã nhận"
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
            <option value="assigned">Đã có khách nhận</option>
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
        <form ref={formRef} onSubmit={handleCreate} className="scroll-mt-28 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="font-heading font-bold text-slate-900">Tạo Mã Giảm Giá</h3>
            <p className="mt-1 font-body text-sm text-slate-500">
              Số 50 là điểm khách cần đổi để lấy mã. Số 1 là tổng số lượt mã được dùng.
            </p>
          </div>
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-body text-red-600">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Mã khách nhập</span>
              <input
                ref={firstFieldRef}
                data-testid="dashboard-coupon-code-input"
                name="couponCode"
                value={formData.code}
                onChange={(event) => setFormData({ ...formData, code: normalizeCouponCodeInput(event.target.value) })}
                placeholder="Ví dụ: MINHHONG50"
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
              <span className="block font-body text-xs text-slate-400">Không dấu, không khoảng trắng. Khoảng trắng sẽ đổi thành dấu gạch ngang.</span>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Giá trị giảm</span>
              <input
                data-testid="dashboard-coupon-discount-input"
                name="couponDiscount"
                value={formData.discount}
                onChange={(event) => setFormData({ ...formData, discount: event.target.value })}
                placeholder="Ví dụ: 10% hoặc 50000"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
              <span className="block font-body text-xs text-slate-400">Nhập phần trăm hoặc số tiền giảm theo đồng.</span>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Mô tả ưu đãi</span>
              <input
                data-testid="dashboard-coupon-description-input"
                name="couponDescription"
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                placeholder="Ví dụ: Giảm 10% dịch vụ đóng pin"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
              <span className="block font-body text-xs text-slate-400">Dòng này giúp admin nhớ mã dùng cho ưu đãi nào.</span>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Điểm khách cần đổi</span>
              <input
                data-testid="dashboard-coupon-points-input"
                name="couponPointsCost"
                type="text"
                inputMode="numeric"
                min={0}
                value={formData.pointsCost}
                onChange={(event) => setFormData({ ...formData, pointsCost: sanitizeUnsignedIntegerText(event.target.value) })}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
              />
              <span className="block font-body text-xs text-slate-400">Mặc định 50 điểm. Nhập 0 nếu muốn tặng miễn phí.</span>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Số lượt dùng tối đa</span>
              <input
                data-testid="dashboard-coupon-usage-input"
                name="couponUsageLimit"
                type="text"
                inputMode="numeric"
                value={formData.usageLimit}
                onChange={(event) => setFormData({ ...formData, usageLimit: sanitizeUnsignedIntegerText(event.target.value) })}
                min={1}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
              />
              <span className="block font-body text-xs text-slate-400">Mặc định 1 lượt để tránh khách dùng trùng ngoài ý muốn.</span>
            </label>
            <VietnameseDateInput
              dataTestId="dashboard-coupon-expiry-input"
              helper="Có thể gõ tay hoặc bấm Chọn ngày. Để trống nếu mã chưa cần ngày hết hạn."
              label="Ngày hết hạn"
              name="couponExpiresAt"
              value={formData.expiresAt}
              onChange={(value) => setFormData({ ...formData, expiresAt: value })}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang tạo…" : "Tạo"}
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
              const redemptionCount = getRedemptionCount(coupon);
              const hasRedemptionPreview = coupon.redemptions.length > 0;
              const isExpanded = expandedCouponId === coupon.id;

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
                      {redemptionCount > 0 ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {redemptionCount} khách đã nhận
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-body text-xs text-slate-500">{coupon.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 font-body text-[10px] text-slate-400">
                      <span>Dùng: {coupon.usedCount}/{coupon.usageLimit}</span>
                      <span>Khách nhận: {redemptionCount}</span>
                      {coupon.expiresAt && <span>Hết hạn: {formatDate(coupon.expiresAt)}</span>}
                    </div>
                    {redemptionCount > 0 ? (
                      <button
                        type="button"
                        onClick={() => setExpandedCouponId(isExpanded ? null : coupon.id)}
                        className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        {isExpanded ? "Ẩn khách đã nhận" : `Xem ${redemptionCount} khách đã nhận`}
                      </button>
                    ) : null}
                    {isExpanded ? (
                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        {hasRedemptionPreview ? (
                          <div className="space-y-2">
                            {coupon.redemptions.map((redemption) => (
                              <div key={redemption.id} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate font-body text-xs font-bold text-slate-700">
                                    {redemption.user.name}
                                  </p>
                                  <p className="font-body text-[10px] text-slate-400">{redemption.user.phone}</p>
                                </div>
                                <span className="shrink-0 font-body text-[10px] text-slate-400">
                                  {formatDate(redemption.createdAt)}
                                </span>
                              </div>
                            ))}
                            {redemptionCount > coupon.redemptions.length ? (
                              <p className="font-body text-[10px] font-semibold text-slate-400">
                                Và {redemptionCount - coupon.redemptions.length} khách khác.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <p className="font-body text-xs text-slate-400">
                            Có {redemptionCount} lượt nhận cũ nhưng chưa có đủ thông tin khách để hiển thị.
                          </p>
                        )}
                      </div>
                    ) : null}
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
