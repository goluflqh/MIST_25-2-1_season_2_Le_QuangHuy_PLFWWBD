"use client";

import { useMemo, useState } from "react";
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

type WarrantyStatusFilter = "all" | "valid" | "expiring" | "expired";
type WarrantySortMode = "newest" | "endingSoon" | "customer";

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ NLMT",
  PIN_LUU_TRU: "⚡ Lưu Trữ",
  CAMERA: "📹 Camera",
  KHAC: "📞 Khác",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function getDaysRemaining(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / DAY_MS);
}

function getWarrantyStatus(endDate: string) {
  const daysRemaining = getDaysRemaining(endDate);
  if (daysRemaining < 0) {
    return {
      key: "expired" as const,
      label: "❌ Hết BH",
      color: "bg-red-100 text-red-700",
      border: "border-red-200 bg-red-50/30",
    };
  }

  if (daysRemaining <= 30) {
    return {
      key: "expiring" as const,
      label: "⚠️ Sắp hết",
      color: "bg-amber-100 text-amber-700",
      border: "border-amber-200 bg-amber-50/30",
    };
  }

  return {
    key: "valid" as const,
    label: "✅ Còn BH",
    color: "bg-green-100 text-green-700",
    border: "border-green-100",
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN");
}

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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarrantyStatusFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortMode, setSortMode] = useState<WarrantySortMode>("endingSoon");

  const metrics = useMemo(() => {
    return warranties.reduce(
      (summary, warranty) => {
        const status = getWarrantyStatus(warranty.endDate);
        summary.total += 1;
        summary[status.key] += 1;
        return summary;
      },
      { total: 0, valid: 0, expiring: 0, expired: 0 }
    );
  }, [warranties]);

  const serviceOptions = useMemo(() => {
    return Array.from(new Set(warranties.map((warranty) => warranty.service))).sort((first, second) => (
      (serviceLabels[first] || first).localeCompare(serviceLabels[second] || second, "vi")
    ));
  }, [warranties]);

  const filteredWarranties = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return warranties
      .filter((warranty) => {
        const status = getWarrantyStatus(warranty.endDate);
        const matchesStatus = statusFilter === "all" || status.key === statusFilter;
        const matchesService = serviceFilter === "all" || warranty.service === serviceFilter;
        const matchesSearch = query.length === 0
          || warranty.serialNo.toLowerCase().includes(query)
          || warranty.productName.toLowerCase().includes(query)
          || warranty.customerName.toLowerCase().includes(query)
          || warranty.customerPhone.toLowerCase().includes(query)
          || (warranty.notes || "").toLowerCase().includes(query);

        return matchesStatus && matchesService && matchesSearch;
      })
      .sort((first, second) => {
        if (sortMode === "endingSoon") {
          return new Date(first.endDate).getTime() - new Date(second.endDate).getTime();
        }
        if (sortMode === "customer") {
          return first.customerName.localeCompare(second.customerName, "vi");
        }
        return new Date(second.startDate).getTime() - new Date(first.startDate).getTime();
      });
  }, [searchQuery, serviceFilter, sortMode, statusFilter, warranties]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setServiceFilter("all");
    setSortMode("endingSoon");
  };

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
    <div data-testid="dashboard-warranty-crm" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Warranty CRM</p>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Bảo Hành Số</h2>
          <p className="font-body text-sm text-slate-500">
            {metrics.total} phiếu · {metrics.expiring} sắp hết hạn · {metrics.expired} đã hết hạn
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
              setError("");
            }}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-red-700"
          >
            + Tạo Phiếu BH
          </button>
        </div>
      </div>

      <div data-testid="dashboard-warranty-metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Tổng phiếu</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.total}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Còn hiệu lực</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-green-700">{metrics.valid}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-amber-700">Sắp hết hạn</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-amber-700">{metrics.expiring}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Đã hết hạn</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-red-700">{metrics.expired}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
          <input
            data-testid="dashboard-warranty-search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm serial, SĐT, khách hàng, sản phẩm"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          />
          <select
            data-testid="dashboard-warranty-status-filter"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as WarrantyStatusFilter)}
            title="Lọc trạng thái bảo hành"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="valid">Còn hiệu lực</option>
            <option value="expiring">Sắp hết hạn</option>
            <option value="expired">Đã hết hạn</option>
          </select>
          <select
            data-testid="dashboard-warranty-service-filter"
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value)}
            title="Lọc dịch vụ bảo hành"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="all">Tất cả dịch vụ</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>{serviceLabels[service] || service}</option>
            ))}
          </select>
          <select
            data-testid="dashboard-warranty-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as WarrantySortMode)}
            title="Sắp xếp phiếu bảo hành"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none transition-colors focus:border-red-400"
          >
            <option value="endingSoon">Hạn gần nhất</option>
            <option value="newest">Mới tạo</option>
            <option value="customer">Tên khách A-Z</option>
          </select>
        </div>
        <p data-testid="dashboard-warranty-result-count" className="mt-3 font-body text-xs text-slate-400">
          Hiển thị {filteredWarranties.length} / {warranties.length} phiếu
        </p>
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
          {filteredWarranties.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <p className="font-body text-sm text-slate-400">Không có phiếu bảo hành nào khớp bộ lọc.</p>
            </div>
          ) : (
            filteredWarranties.map((warranty) => {
              const status = getWarrantyStatus(warranty.endDate);
              const daysRemaining = getDaysRemaining(warranty.endDate);
              const timelineCopy = daysRemaining < 0
                ? `Quá hạn ${Math.abs(daysRemaining)} ngày`
                : `Còn ${daysRemaining} ngày`;

              return (
                <div
                  key={warranty.id}
                  data-testid="dashboard-warranty-card"
                  className={`rounded-xl border bg-white p-5 shadow-sm ${status.border} ${deletingId === warranty.id ? "opacity-60" : ""}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold">{warranty.serialNo}</code>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.color}`}>
                          {status.label}
                        </span>
                        <span className="font-body text-xs text-slate-400">
                          {serviceLabels[warranty.service] || warranty.service}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-sm font-semibold text-slate-800">{warranty.productName}</p>
                      <p className="font-body text-xs text-slate-500">{warranty.customerName} · {warranty.customerPhone}</p>
                      <div className="mt-2 flex flex-wrap gap-2 font-body text-[10px] text-slate-400">
                        <span>Tạo: {formatDate(warranty.startDate)}</span>
                        <span>BH đến: {formatDate(warranty.endDate)}</span>
                        <span>{timelineCopy}</span>
                      </div>
                      {warranty.notes && (
                        <p className="mt-2 line-clamp-2 font-body text-xs text-slate-500">{warranty.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteWarranty(warranty.id)}
                      disabled={deletingId === warranty.id}
                      className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-500 disabled:bg-slate-100 disabled:text-slate-300"
                    >
                      {deletingId === warranty.id ? "..." : "Xoá"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
