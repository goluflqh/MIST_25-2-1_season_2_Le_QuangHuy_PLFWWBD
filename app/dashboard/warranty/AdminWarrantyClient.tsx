"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminFilterToolbar from "@/components/admin/AdminFilterToolbar";
import AdminMetricStrip from "@/components/admin/AdminMetricStrip";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminServiceIcon from "@/components/admin/AdminServiceIcon";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import PaginationControls from "@/components/PaginationControls";
import { addMonthsInVietnam, formatVietnamDate } from "@/lib/vietnam-time";

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
  serviceOrderId?: string | null;
}

type WarrantyStatusFilter = "all" | "valid" | "expiring" | "expired" | "unknown";
type WarrantySortMode = "newest" | "endingSoon" | "customer";

const serviceLabels: Record<string, string> = {
  DONG_PIN: "Đóng pin",
  DEN_NLMT: "Đèn năng lượng mặt trời",
  PIN_LUU_TRU: "Pin lưu trữ",
  CAMERA: "Camera",
  KHAC: "Khác",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 12;

function getDaysRemaining(endDate: string) {
  return Math.ceil((new Date(endDate).getTime() - Date.now()) / DAY_MS);
}

function isUnknownWarrantyDate(value: string) {
  const parsedDate = new Date(value);
  return !Number.isFinite(parsedDate.getTime()) || parsedDate.getUTCFullYear() <= 1900;
}

function getWarrantyStatus(endDate: string) {
  if (isUnknownWarrantyDate(endDate)) {
    return {
      key: "unknown" as const,
      label: "Thiếu ngày",
      color: "bg-orange-100 text-orange-800",
      border: "border-orange-200 bg-orange-50/30",
      accent: "bg-orange-400",
    };
  }

  const daysRemaining = getDaysRemaining(endDate);
  if (daysRemaining < 0) {
    return {
      key: "expired" as const,
      label: "Hết bảo hành",
      color: "bg-red-100 text-red-700",
      border: "border-red-200 bg-red-50/30",
      accent: "bg-red-500",
    };
  }

  if (daysRemaining <= 30) {
    return {
      key: "expiring" as const,
      label: "Sắp hết hạn",
      color: "bg-amber-100 text-amber-700",
      border: "border-amber-200 bg-amber-50/30",
      accent: "bg-amber-500",
    };
  }

  return {
    key: "valid" as const,
    label: "Còn bảo hành",
    color: "bg-green-100 text-green-700",
    border: "border-green-100",
    accent: "bg-emerald-500",
  };
}

function formatDate(value: string) {
  return formatVietnamDate(value);
}

function isVietnameseDateText(value: string) {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value.trim());
}

function addMonths(date: Date, months: number) {
  return addMonthsInVietnam(date, months);
}

function formatDateInput(value: Date) {
  return formatVietnamDate(value);
}

function defaultWarrantyEndDateText() {
  return formatDateInput(addMonths(new Date(), 6));
}

export default function AdminWarrantyClient({
  initialWarranties,
}: {
  initialWarranties: WarrantyData[];
}) {
  const { showToast, showConfirm } = useNotify();
  const formRef = useRef<HTMLFormElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const [warranties, setWarranties] = useState<WarrantyData[]>(initialWarranties);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    productName: "",
    customerPhone: "",
    service: "DONG_PIN",
    endDate: defaultWarrantyEndDateText(),
    notes: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    customerName: "",
    customerPhone: "",
    endDate: "",
    notes: "",
    productName: "",
    service: "DONG_PIN",
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<WarrantyStatusFilter>("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sortMode, setSortMode] = useState<WarrantySortMode>("endingSoon");
  const [currentPage, setCurrentPage] = useState(1);

  const metrics = useMemo(() => {
    return warranties.reduce(
      (summary, warranty) => {
        const status = getWarrantyStatus(warranty.endDate);
        summary.total += 1;
        summary[status.key] += 1;
        return summary;
      },
      { total: 0, valid: 0, expiring: 0, expired: 0, unknown: 0 }
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

  const totalPages = Math.max(1, Math.ceil(filteredWarranties.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const pageStartIndex = (activePage - 1) * PAGE_SIZE;
  const paginatedWarranties = useMemo(() => {
    return filteredWarranties.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  }, [filteredWarranties, pageStartIndex]);
  const firstVisibleResult = filteredWarranties.length === 0 ? 0 : pageStartIndex + 1;
  const lastVisibleResult = Math.min(pageStartIndex + paginatedWarranties.length, filteredWarranties.length);
  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const resetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setServiceFilter("all");
    setSortMode("endingSoon");
    setCurrentPage(1);
  };

  const toggleCreateForm = () => {
    const shouldOpen = !showForm;
    setShowForm(shouldOpen);
    setError("");

    if (shouldOpen) {
      setFormData((prev) => ({
        ...prev,
        endDate: prev.endDate || defaultWarrantyEndDateText(),
      }));
      window.setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        firstFieldRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const payload = {
      customerName: formData.customerName.trim(),
      productName: formData.productName.trim(),
      customerPhone: formData.customerPhone.trim(),
      service: formData.service,
      endDate: formData.endDate.trim(),
      notes: formData.notes.trim(),
    };

    if (!payload.customerName || !payload.productName || !payload.customerPhone || !payload.endDate) {
      const message = "Vui lòng nhập tên khách, sản phẩm, số điện thoại và ngày hết hạn.";
      setError(message);
      showToast(message, "error");
      return;
    }

    if (!isVietnameseDateText(payload.endDate)) {
      const message = "Ngày hết hạn nhập theo dạng ngày/tháng/năm, ví dụ 30/04/2026.";
      setError(message);
      showToast(message, "error");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/warranty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setFormData({
        customerName: "",
        productName: "",
        customerPhone: "",
        service: "DONG_PIN",
        endDate: defaultWarrantyEndDateText(),
        notes: "",
      });
      showToast("Tạo phiếu bảo hành thành công!", "success");
    } catch {
      const message = "Không thể tạo phiếu bảo hành lúc này.";
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (warranty: WarrantyData) => {
    setEditingId(warranty.id);
    setEditData({
      customerName: warranty.customerName,
      customerPhone: warranty.customerPhone,
      endDate: formatDateInput(new Date(warranty.endDate)),
      notes: warranty.notes || "",
      productName: warranty.productName,
      service: warranty.service,
    });
  };

  const saveEdit = async (id: string) => {
    setSavingEditId(id);
    try {
      const response = await fetch("/api/admin/warranty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editData }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa sửa được phiếu bảo hành.", "error");
        return;
      }

      setWarranties((prev) =>
        prev.map((warranty) =>
          warranty.id === id
            ? {
                ...warranty,
                ...data.warranty,
                endDate: new Date(data.warranty.endDate).toISOString(),
                startDate: new Date(data.warranty.startDate).toISOString(),
              }
            : warranty
        )
      );
      setEditingId(null);
      showToast("Đã sửa phiếu bảo hành.", "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi sửa bảo hành.", "error");
    } finally {
      setSavingEditId(null);
    }
  };

  const archiveWarranty = (id: string) => {
    showConfirm("Lưu trữ phiếu bảo hành này? Phiếu sẽ không còn xuất hiện trong danh sách đang dùng nhưng lịch sử vẫn được giữ lại.", async () => {
      setDeletingId(id);

      try {
        const response = await fetch("/api/admin/warranty", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa lưu trữ được phiếu bảo hành.", "error");
          return;
        }

        setWarranties((prev) => prev.filter((warranty) => warranty.id !== id));
        showToast("Đã lưu trữ phiếu bảo hành.", "success");
      } catch {
        showToast("Không thể lưu trữ phiếu bảo hành lúc này.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div data-testid="dashboard-warranty-crm" className="space-y-6 animate-fade-in-up">
      <AdminPageHeader
        eyebrow="Phiếu bảo hành"
        title="Quản Lý Phiếu Bảo Hành"
        summary={`${metrics.total} phiếu · ${metrics.expiring} sắp hết hạn · ${metrics.expired} đã hết hạn · ${metrics.unknown} thiếu ngày`}
        actions={
          <button
            aria-expanded={showForm}
            onClick={toggleCreateForm}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-body font-bold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
          >
            + Tạo Phiếu Bảo Hành
          </button>
        }
      />

      <AdminMetricStrip
        dataTestId="dashboard-warranty-metrics"
        items={[
          { key: "all", label: "Tổng phiếu", value: metrics.total, active: statusFilter === "all", onSelect: () => { setStatusFilter("all"); setCurrentPage(1); } },
          { key: "valid", label: "Còn hiệu lực", value: metrics.valid, tone: "green", active: statusFilter === "valid", onSelect: () => { setStatusFilter("valid"); setCurrentPage(1); } },
          { key: "expiring", label: "Sắp hết hạn", value: metrics.expiring, tone: "amber", active: statusFilter === "expiring", onSelect: () => { setStatusFilter("expiring"); setCurrentPage(1); } },
          { key: "expired", label: "Đã hết hạn", value: metrics.expired, tone: "red", active: statusFilter === "expired", onSelect: () => { setStatusFilter("expired"); setCurrentPage(1); } },
          { key: "unknown", label: "Thiếu ngày", value: metrics.unknown, tone: "orange", active: statusFilter === "unknown", onSelect: () => { setStatusFilter("unknown"); setCurrentPage(1); } },
        ]}
      />

      <AdminFilterToolbar
        searchDataTestId="dashboard-warranty-search"
        searchValue={searchQuery}
        onSearchChange={(value) => {
          setSearchQuery(value);
          setCurrentPage(1);
        }}
        searchPlaceholder="Mã bảo hành, SĐT, khách hàng, sản phẩm"
        activeFilterCount={Number(statusFilter !== "all") + Number(serviceFilter !== "all") + Number(sortMode !== "endingSoon")}
        onReset={resetFilters}
        desktopGridClassName="md:grid-cols-3"
        resultSummary={
          <p data-testid="dashboard-warranty-result-count">
            Hiển thị {filteredWarranties.length} / {warranties.length} phiếu · Trang {activePage}/{totalPages}
            {filteredWarranties.length > 0 ? ` · Dòng ${firstVisibleResult}-${lastVisibleResult}` : ""}
          </p>
        }
      >
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Trạng thái</span>
          <select
            data-testid="dashboard-warranty-status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as WarrantyStatusFilter);
              setCurrentPage(1);
            }}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="valid">Còn hiệu lực</option>
            <option value="expiring">Sắp hết hạn</option>
            <option value="expired">Đã hết hạn</option>
            <option value="unknown">Thiếu ngày</option>
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Dịch vụ</span>
          <select
            data-testid="dashboard-warranty-service-filter"
            value={serviceFilter}
            onChange={(event) => {
              setServiceFilter(event.target.value);
              setCurrentPage(1);
            }}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="all">Tất cả dịch vụ</option>
            {serviceOptions.map((service) => (
              <option key={service} value={service}>{serviceLabels[service] || service}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="font-body text-xs font-bold uppercase tracking-wider text-slate-600">Sắp xếp</span>
          <select
            data-testid="dashboard-warranty-sort"
            value={sortMode}
            onChange={(event) => {
              setSortMode(event.target.value as WarrantySortMode);
              setCurrentPage(1);
            }}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-body text-base outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:min-h-11 md:text-sm"
          >
            <option value="endingSoon">Hạn gần nhất</option>
            <option value="newest">Mới tạo</option>
            <option value="customer">Tên khách A-Z</option>
          </select>
        </label>
      </AdminFilterToolbar>

      {showForm && (
        <form ref={formRef} onSubmit={handleCreate} className="scroll-mt-28 bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div>
            <h3 className="font-heading font-bold text-slate-900">Tạo Phiếu Bảo Hành</h3>
            <p className="mt-1 font-body text-sm text-slate-500">
              Mã bảo hành sẽ tự tạo khi lưu. Ngày hết hạn mặc định là 6 tháng kể từ hôm nay và admin có thể sửa trước khi lưu.
            </p>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-body">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Tên khách</span>
              <input
                ref={firstFieldRef}
                name="warrantyCustomerName"
                value={formData.customerName}
                onChange={(event) => setFormData({ ...formData, customerName: event.target.value })}
                placeholder="Ví dụ: Nguyễn Văn A"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Tên sản phẩm</span>
              <input
                data-testid="dashboard-warranty-product-input"
                name="warrantyProductName"
                value={formData.productName}
                onChange={(event) => setFormData({ ...formData, productName: event.target.value })}
                placeholder="Ví dụ: Bộ pin xe điện 48V"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Số điện thoại khách</span>
              <input
                data-testid="dashboard-warranty-phone-input"
                name="warrantyCustomerPhone"
                type="tel"
                inputMode="tel"
                value={formData.customerPhone}
                onChange={(event) => setFormData({ ...formData, customerPhone: event.target.value })}
                placeholder="Ví dụ: 0912345678"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
                required
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Nhóm dịch vụ</span>
              <select
                data-testid="dashboard-warranty-service-input"
                name="warrantyService"
                value={formData.service}
                onChange={(event) => setFormData({ ...formData, service: event.target.value })}
                title="Loại dịch vụ"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
              >
                {Object.entries(serviceLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
              </select>
            </label>
            <VietnameseDateInput
              dataTestId="dashboard-warranty-end-date-input"
              helper="Có thể gõ tay hoặc bấm Chọn ngày."
              label="Ngày hết hạn bảo hành"
              name="warrantyEndDate"
              value={formData.endDate}
              onChange={(value) => setFormData({ ...formData, endDate: value })}
              required
            />
            <label className="space-y-1.5 sm:col-span-2">
              <span className="font-body text-xs font-bold text-slate-600">Ghi chú nội bộ</span>
              <input
                name="warrantyNotes"
                value={formData.notes || ""}
                onChange={(event) => setFormData({ ...formData, notes: event.target.value })}
                placeholder="Ví dụ: Khách nhận phiếu qua Zalo"
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-body font-bold text-sm disabled:bg-slate-300">
              {isSaving ? "Đang tạo…" : "Tạo Phiếu"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-body font-bold text-sm">Huỷ</button>
          </div>
        </form>
      )}

      {warranties.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
          <p className="font-body text-slate-500">Chưa có phiếu bảo hành nào trong hệ thống.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWarranties.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-10 text-center shadow-sm">
              <p className="font-body text-sm text-slate-400">Không có phiếu bảo hành nào khớp bộ lọc.</p>
            </div>
          ) : (
            <>
            <div className="hidden grid-cols-[minmax(0,1.65fr)_minmax(180px,1fr)_minmax(240px,1.15fr)_160px] gap-4 px-5 font-body text-xs font-bold uppercase tracking-wider text-slate-500 xl:grid">
              <span>Phiếu và sản phẩm</span>
              <span>Khách hàng</span>
              <span>Thời hạn bảo hành</span>
              <span className="text-center">Thao tác</span>
            </div>
            <div className="grid gap-3" data-testid="dashboard-warranty-card-grid">
            {paginatedWarranties.map((warranty) => {
              const status = getWarrantyStatus(warranty.endDate);
              const daysRemaining = getDaysRemaining(warranty.endDate);
              const startDateLabel = isUnknownWarrantyDate(warranty.startDate) ? "Chưa xác định" : formatDate(warranty.startDate);
              const endDateLabel = isUnknownWarrantyDate(warranty.endDate) ? "Chưa xác định" : formatDate(warranty.endDate);
              const timelineCopy = status.key === "unknown"
                ? "Cần bổ sung ngày bảo hành"
                : daysRemaining < 0
                  ? `Quá hạn ${Math.abs(daysRemaining)} ngày`
                  : `Còn ${daysRemaining} ngày`;

              return (
                <div
                  key={warranty.id}
                  data-testid="dashboard-warranty-card"
                  data-warranty-state={status.key}
                  className={`relative overflow-hidden rounded-2xl border bg-white p-4 pl-5 shadow-sm transition-shadow hover:shadow-md xl:rounded-xl xl:px-4 xl:py-3 xl:pl-5 ${status.border} ${deletingId === warranty.id ? "opacity-60" : ""}`}
                >
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${status.accent}`} />
                  {editingId === warranty.id ? (
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={editData.customerName}
                          onChange={(event) => setEditData({ ...editData, customerName: event.target.value })}
                          placeholder="Tên khách"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                        />
                        <input
                          value={editData.customerPhone}
                          onChange={(event) => setEditData({ ...editData, customerPhone: event.target.value })}
                          placeholder="Số điện thoại"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                        />
                        <input
                          value={editData.productName}
                          onChange={(event) => setEditData({ ...editData, productName: event.target.value })}
                          placeholder="Sản phẩm"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                        />
                        <select
                          value={editData.service}
                          onChange={(event) => setEditData({ ...editData, service: event.target.value })}
                          title="Dịch vụ"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                        >
                          {Object.entries(serviceLabels).map(([key, value]) => (
                            <option key={key} value={key}>{value}</option>
                          ))}
                        </select>
                        <VietnameseDateInput
                          dataTestId="dashboard-warranty-edit-end-date-input"
                          helper="Có thể gõ tay hoặc bấm Chọn ngày."
                          label="Ngày hết hạn"
                          name={"warrantyEditEndDate-" + warranty.id}
                          value={editData.endDate}
                          onChange={(value) => setEditData({ ...editData, endDate: value })}
                          required
                        />
                        <input
                          value={editData.notes}
                          onChange={(event) => setEditData({ ...editData, notes: event.target.value })}
                          placeholder="Ghi chú"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
                        />
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          disabled={savingEditId === warranty.id}
                          className="min-h-11 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 disabled:text-slate-300"
                        >
                          Huỷ
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(warranty.id)}
                          disabled={savingEditId === warranty.id}
                          className="min-h-11 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          {savingEditId === warranty.id ? "Đang lưu..." : "Lưu sửa"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1.65fr)_minmax(180px,1fr)_minmax(240px,1.15fr)_160px] xl:items-center xl:gap-4">
                      <div className="min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <code className="min-w-0 truncate rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-mono text-xs font-bold text-slate-700">{warranty.serialNo}</code>
                          <span data-testid="dashboard-warranty-card-status" className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-2 font-heading text-base font-extrabold leading-snug text-slate-900">{warranty.productName}</p>
                        <p className="mt-1 flex items-center gap-1.5 font-body text-sm font-semibold text-slate-600">
                          <AdminServiceIcon service={warranty.service} className="h-4 w-4 shrink-0" />
                          <span>{serviceLabels[warranty.service] || warranty.service}</span>
                          <span className="text-slate-300">·</span>
                          <span>{warranty.serviceOrderId ? "Đã liên kết đơn bán" : "Phiếu tạo riêng"}</span>
                        </p>
                        {warranty.notes && (
                          <p className="mt-2 line-clamp-1 font-body text-sm leading-5 text-slate-600" title={warranty.notes}>{warranty.notes}</p>
                        )}
                      </div>

                      <div data-testid="dashboard-warranty-card-customer" className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white/90 p-3 xl:border-0 xl:bg-transparent xl:p-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 font-heading text-sm font-extrabold text-white xl:h-9 xl:w-9 xl:rounded-lg">
                          {warranty.customerName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-body text-[15px] font-extrabold text-slate-900">{warranty.customerName}</p>
                          <a href={`tel:${warranty.customerPhone}`} className="font-body text-sm font-semibold tabular-nums text-slate-600 hover:text-slate-900 hover:underline">
                            {warranty.customerPhone}
                          </a>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                            <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Bắt đầu</p>
                            <p className="mt-0.5 font-body text-sm font-bold tabular-nums text-slate-800">{startDateLabel}</p>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
                            <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Hết hạn</p>
                            <p className="mt-0.5 font-body text-sm font-bold tabular-nums text-slate-800">{endDateLabel}</p>
                          </div>
                        </div>
                        <p className={`mt-2 rounded-lg px-3 py-1.5 font-body text-sm font-extrabold ${status.color}`}>{timelineCopy}</p>
                      </div>

                      <div data-testid="dashboard-warranty-card-actions" className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-100 pt-3 xl:grid-cols-1 xl:border-t-0 xl:pt-0">
                        <button
                          type="button"
                          onClick={() => startEdit(warranty)}
                          className="min-h-11 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 xl:min-h-9 xl:rounded-lg"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => archiveWarranty(warranty.id)}
                          disabled={deletingId === warranty.id}
                          className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-300 xl:min-h-9 xl:rounded-lg"
                        >
                          {deletingId === warranty.id ? "Đang lưu..." : "Lưu trữ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            </div>
            <PaginationControls
              dataTestId="dashboard-warranty-pagination"
              itemLabel="phiếu"
              onPageChange={setCurrentPage}
              page={activePage}
              pageCount={totalPages}
              pageSize={PAGE_SIZE}
              totalItems={filteredWarranties.length}
            />
            </>
          )}
        </div>
      )}
    </div>
  );
}
