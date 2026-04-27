"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/NotifyProvider";
import { getLeadSourceLabel } from "@/lib/lead-sources";

interface ContactRequest {
  id: string;
  name: string;
  phone: string;
  service: string;
  message: string | null;
  status: string;
  notes: string | null;
  source: string | null;
  sourcePath: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  createdAt: string;
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin",
  DEN_NLMT: "☀️ Đèn NLMT",
  PIN_LUU_TRU: "⚡ Pin Lưu Trữ",
  CAMERA: "📹 Camera",
  CUSTOM: "🔧 Custom",
  KHAC: "📞 Khác",
  battery: "🔋 Đóng Pin",
  camera: "📹 Camera",
  contact: "📞 Liên hệ",
};

const serviceOrderDefaults: Record<string, { productName: string; service: string }> = {
  DONG_PIN: { productName: "Đóng pin", service: "DONG_PIN" },
  DEN_NLMT: { productName: "Đèn năng lượng mặt trời", service: "DEN_NLMT" },
  PIN_LUU_TRU: { productName: "Pin lưu trữ", service: "PIN_LUU_TRU" },
  CAMERA: { productName: "Camera an ninh", service: "CAMERA" },
  CUSTOM: { productName: "Dịch vụ theo yêu cầu", service: "CUSTOM" },
  KHAC: { productName: "Yêu cầu tư vấn", service: "KHAC" },
  battery: { productName: "Đóng pin", service: "DONG_PIN" },
  camera: { productName: "Camera an ninh", service: "CAMERA" },
  contact: { productName: "Yêu cầu tư vấn", service: "KHAC" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-800 border-blue-200" },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-800 border-green-200" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-800 border-red-200" },
};

const PAGE_SIZE = 8;
const HOUR_IN_MS = 60 * 60 * 1000;
const OPEN_STATUSES = new Set(["PENDING", "CONTACTED", "IN_PROGRESS"]);
const STATUS_PRIORITY = ["PENDING", "CONTACTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const sortOptions = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "name", label: "Tên A-Z" },
  { value: "priority", label: "Ưu tiên cần xử lý" },
] as const;

type SortMode = (typeof sortOptions)[number]["value"];

function getStatusRank(status: string) {
  const rank = STATUS_PRIORITY.indexOf(status);
  return rank === -1 ? STATUS_PRIORITY.length : rank;
}

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized.endsWith(".local")
  );
}

function isInternalTrackingValue(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return (
    !normalized ||
    normalized.includes("e2e") ||
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.startsWith("/e2e")
  );
}

function formatTrackingLabel(value: string | null | undefined) {
  if (isInternalTrackingValue(value)) return null;

  return String(value)
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReferrer(referrer: string | null) {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    if (isLocalHostname(url.hostname)) return null;
    return url.hostname;
  } catch {
    return isInternalTrackingValue(referrer) ? null : referrer;
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function formatSourcePath(sourcePath: string | null) {
  if (!sourcePath) return null;

  try {
    const rawSourcePath = sourcePath.trim();
    const url = new URL(sourcePath, "https://minhhong.local");
    if (url.pathname.startsWith("/e2e")) return null;

    const source = url.searchParams.get("source");
    if (source) {
      const sourceLabel = getLeadSourceLabel(source);
      return url.hash === "#quote" ? `${sourceLabel} - biểu mẫu tư vấn` : sourceLabel;
    }

    const isAbsoluteUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawSourcePath);
    if (isAbsoluteUrl && isLocalHostname(url.hostname)) return null;

    const pathLabels: Record<string, string> = {
      "/": "Trang chủ",
      "/bao-gia": "Trang báo giá",
      "/dang-ky": "Trang đăng ký",
      "/dang-nhap": "Trang đăng nhập",
      "/tai-khoan": "Trang tài khoản khách",
    };

    return pathLabels[url.pathname] || `Đường dẫn ${url.pathname}`;
  } catch {
    return isInternalTrackingValue(sourcePath) ? null : sourcePath;
  }
}

function getLeadAgeLabel(createdAt: string) {
  const ageMs = Math.max(Date.now() - new Date(createdAt).getTime(), 0);
  const hours = Math.floor(ageMs / HOUR_IN_MS);

  if (hours < 1) return "Mới tạo";
  if (hours < 24) return `${hours} giờ`;

  const days = Math.floor(hours / 24);
  return `${days} ngày`;
}

function getRecommendedAction(contact: ContactRequest) {
  if (contact.status === "PENDING") return "Gọi xác nhận nhu cầu trong hôm nay.";
  if (contact.status === "CONTACTED") return "Chốt cấu hình, ngân sách và lịch kiểm tra.";
  if (contact.status === "IN_PROGRESS") return "Cập nhật tiến độ và hẹn mốc bàn giao.";
  if (contact.status === "COMPLETED") return "Mời khách đánh giá hoặc giới thiệu thêm.";
  if (contact.status === "CANCELLED") return "Giữ lịch sử để tránh chăm sóc trùng.";

  return "Kiểm tra lại trạng thái và ghi chú chăm sóc.";
}

function getLeadHeat(contact: ContactRequest) {
  const ageMs = Date.now() - new Date(contact.createdAt).getTime();

  if (contact.status === "COMPLETED") {
    return {
      label: "Đã chốt",
      color: "border-green-200 bg-green-50 text-green-700",
    };
  }

  if (contact.status === "CANCELLED") {
    return {
      label: "Đã huỷ",
      color: "border-slate-200 bg-slate-50 text-slate-500",
    };
  }

  if (ageMs > 48 * HOUR_IN_MS) {
    return {
      label: "Cần xử lý",
      color: "border-red-200 bg-red-50 text-red-700",
    };
  }

  return {
    label: "Đang chăm sóc",
    color: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function buildServiceOrderHref(contact: ContactRequest) {
  const orderDefault = serviceOrderDefaults[contact.service] || serviceOrderDefaults.KHAC;
  const params = new URLSearchParams({
    customerName: contact.name,
    customerPhone: contact.phone,
    issueDescription: contact.message || "",
    notes: contact.notes || `Tạo từ yêu cầu tư vấn ${formatDateTime(contact.createdAt)}`,
    productName: orderDefault.productName,
    service: orderDefault.service,
    source: "CONTACT",
  });

  return `/dashboard/orders?${params.toString()}`;
}

export default function ContactsManagementClient({
  initialContacts,
}: {
  initialContacts: ContactRequest[];
}) {
  const router = useRouter();
  const { showToast, showConfirm } = useNotify();
  const [contacts, setContacts] = useState<ContactRequest[]>(initialContacts);
  const [filter, setFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [drawerNotesValue, setDrawerNotesValue] = useState("");
  const [isDrawerNotesEditing, setIsDrawerNotesEditing] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filter, sourceFilter, searchQuery, sortMode]);

  const sourceOptions = useMemo(() => {
    return Array.from(new Set(contacts.map((contact) => contact.source).filter(Boolean) as string[]))
      .sort((a, b) => getLeadSourceLabel(a).localeCompare(getLeadSourceLabel(b), "vi"));
  }, [contacts]);

  const crmStats = useMemo(() => {
    const openCount = contacts.filter((contact) => OPEN_STATUSES.has(contact.status)).length;
    const completedCount = contacts.filter((contact) => contact.status === "COMPLETED").length;
    const staleCount = contacts.filter((contact) => {
      if (!OPEN_STATUSES.has(contact.status)) return false;
      const ageMs = Date.now() - new Date(contact.createdAt).getTime();
      return ageMs > 48 * 60 * 60 * 1000;
    }).length;
    const conversionRate = contacts.length > 0 ? Math.round((completedCount / contacts.length) * 100) : 0;

    return { openCount, completedCount, staleCount, conversionRate };
  }, [contacts]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) return null;
    return contacts.find((contact) => contact.id === selectedContactId) || null;
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (!selectedContactId) return;
    if (!contacts.some((contact) => contact.id === selectedContactId)) {
      setSelectedContactId(null);
    }
  }, [contacts, selectedContactId]);

  useEffect(() => {
    if (!selectedContact) {
      setDrawerNotesValue("");
      setIsDrawerNotesEditing(false);
      return;
    }

    setDrawerNotesValue(selectedContact.notes || "");
    setIsDrawerNotesEditing(false);
  }, [selectedContact]);

  const updateStatus = async (id: string, status: string) => {
    const currentContact = contacts.find((contact) => contact.id === id);
    if (!currentContact || currentContact.status === status) return;

    const previousStatus = currentContact.status;
    setPendingStatusId(id);
    setContacts((prev) =>
      prev.map((contact) => (contact.id === id ? { ...contact, status } : contact))
    );

    try {
      const response = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setContacts((prev) =>
          prev.map((contact) => (contact.id === id ? { ...contact, status: previousStatus } : contact))
        );
        showToast(data.message || "Chưa cập nhật được trạng thái.", "error");
        return;
      }

      showToast("Đã cập nhật trạng thái.", "success");
    } catch {
      setContacts((prev) =>
        prev.map((contact) => (contact.id === id ? { ...contact, status: previousStatus } : contact))
      );
      showToast("Kết nối bị gián đoạn khi cập nhật trạng thái.", "error");
    } finally {
      setPendingStatusId(null);
    }
  };

  const saveNotes = async (id: string, nextNotes = notesValue, onSuccess?: () => void) => {
    setSavingNotesId(id);

    try {
      const response = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: nextNotes }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa lưu được ghi chú.", "error");
        return;
      }

      setContacts((prev) =>
        prev.map((contact) => (contact.id === id ? { ...contact, notes: nextNotes } : contact))
      );
      setEditingNotes(null);
      onSuccess?.();
      showToast("Đã lưu ghi chú.", "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi lưu ghi chú.", "error");
    } finally {
      setSavingNotesId(null);
    }
  };

  const deleteContact = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá yêu cầu này không?", async () => {
      setDeletingId(id);

      try {
        const response = await fetch(`/api/contact/${id}`, { method: "DELETE" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Lỗi khi xoá.", "error");
          return;
        }

        setContacts((prev) => prev.filter((contact) => contact.id !== id));
        if (selectedContactId === id) {
          setSelectedContactId(null);
        }
        showToast("Đã xoá yêu cầu.", "success");
      } catch {
        showToast("Không thể xoá yêu cầu lúc này.", "error");
      } finally {
        setDeletingId(null);
      }
    });
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const matchedContacts = contacts.filter((contact) => {
      const matchesStatus = filter === "ALL" || contact.status === filter;
      const matchesSource = sourceFilter === "ALL" || contact.source === sourceFilter;
      const referrer = formatReferrer(contact.referrer);
      const searchFields = [
        contact.name,
        contact.phone,
        serviceLabels[contact.service],
        contact.service,
        contact.message,
        contact.notes,
        contact.source,
        contact.source ? getLeadSourceLabel(contact.source) : null,
        formatSourcePath(contact.sourcePath),
        referrer,
        formatTrackingLabel(contact.utmSource),
        formatTrackingLabel(contact.utmMedium),
        formatTrackingLabel(contact.utmCampaign),
        formatTrackingLabel(contact.utmTerm),
        formatTrackingLabel(contact.utmContent),
      ];
      const matchesSearch =
        query.length === 0 ||
        searchFields.some((field) => field?.toLowerCase().includes(query));

      return matchesStatus && matchesSource && matchesSearch;
    });

    return [...matchedContacts].sort((a, b) => {
      if (sortMode === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortMode === "name") {
        return a.name.localeCompare(b.name, "vi");
      }

      if (sortMode === "priority") {
        const statusDelta = getStatusRank(a.status) - getStatusRank(b.status);
        if (statusDelta !== 0) return statusDelta;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [contacts, filter, searchQuery, sourceFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleContacts = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedHeat = selectedContact ? getLeadHeat(selectedContact) : null;
  const selectedReferrer = selectedContact ? formatReferrer(selectedContact.referrer) : null;

  return (
    <div data-testid="dashboard-contacts-crm" className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Yêu Cầu Tư Vấn</h2>
          <p className="font-body text-sm text-slate-500">{contacts.length} yêu cầu tổng cộng</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ key: "ALL", label: "Tất cả" }, ...Object.entries(statusConfig).map(([key, value]) => ({ key, label: value.label }))].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body font-bold transition-colors ${filter === item.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {item.label}{" "}
              {item.key === "ALL"
                ? `(${contacts.length})`
                : `(${contacts.filter((contact) => contact.status === item.key).length})`}
            </button>
          ))}
        </div>
      </div>

      <div data-testid="dashboard-contacts-metrics" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">Khách đang chờ</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{crmStats.openCount}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 p-4">
          <p className="font-body text-[11px] font-bold uppercase tracking-wider text-green-700">Đã hoàn thành</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-green-700">{crmStats.completedCount}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <p className="font-body text-[11px] font-bold uppercase tracking-wider text-amber-700">Trễ trên 48h</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-amber-700">{crmStats.staleCount}</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <p className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">Tỉ lệ chốt</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{crmStats.conversionRate}%</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="block">
            <span className="mb-1 block font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Tìm khách liên hệ
            </span>
            <input
              data-testid="dashboard-contacts-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-body text-slate-700 outline-none transition-colors focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
              placeholder="Tên, SĐT, ghi chú, nguồn quảng cáo…"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nguồn khách
            </span>
            <select
              data-testid="dashboard-contacts-source-filter"
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-body font-semibold text-slate-700 outline-none transition-colors focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              <option value="ALL">Tất cả nguồn</option>
              {sourceOptions.map((source) => (
                <option key={source} value={source}>
                  {getLeadSourceLabel(source)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sắp xếp
            </span>
            <select
              data-testid="dashboard-contacts-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-body font-semibold text-slate-700 outline-none transition-colors focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p data-testid="dashboard-contacts-result-count" className="font-body text-xs text-slate-500">
            Hiển thị {filtered.length} / {contacts.length} khách liên hệ
          </p>
          {(filter !== "ALL" || sourceFilter !== "ALL" || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setFilter("ALL");
                setSourceFilter("ALL");
                setSearchQuery("");
              }}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-body font-bold text-slate-600 transition-colors hover:bg-slate-200"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div data-testid="dashboard-contacts-empty" className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-body text-slate-400">
            Không có yêu cầu nào {filter !== "ALL" && `ở trạng thái "${statusConfig[filter]?.label}"`}
          </p>
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {visibleContacts.map((contact) => (
            <div
              data-testid="dashboard-contact-card"
              key={contact.id}
              className={`bg-white rounded-xl p-5 border border-slate-100 shadow-sm transition-all ${deletingId === contact.id ? "opacity-60" : "hover:shadow-md"}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-body font-bold text-slate-900 text-sm">{contact.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig[contact.status]?.color}`}>
                      {statusConfig[contact.status]?.label}
                    </span>
                  </div>
                  <p className="font-body text-sm text-slate-500">
                    📱 {contact.phone} · {serviceLabels[contact.service] || contact.service}
                  </p>
                  {contact.message ? (
                    <p className="font-body text-xs text-slate-400 mt-1">💬 {contact.message}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {contact.source ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-body font-bold text-slate-600">
                        Nguồn: {getLeadSourceLabel(contact.source)}
                      </span>
                    ) : null}
                    {formatTrackingLabel(contact.utmSource) ? (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-body font-bold text-blue-700">
                        Kênh quảng cáo: {formatTrackingLabel(contact.utmSource)}
                      </span>
                    ) : null}
                    {formatTrackingLabel(contact.utmCampaign) ? (
                      <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-body font-bold text-purple-700">
                        Chiến dịch: {formatTrackingLabel(contact.utmCampaign)}
                      </span>
                    ) : null}
                    {formatTrackingLabel(contact.utmMedium) ? (
                      <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-body font-bold text-cyan-700">
                        Cách chạy: {formatTrackingLabel(contact.utmMedium)}
                      </span>
                    ) : null}
                    {formatTrackingLabel(contact.utmTerm) ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-body font-bold text-amber-700">
                        Từ khoá: {formatTrackingLabel(contact.utmTerm)}
                      </span>
                    ) : null}
                    {formatTrackingLabel(contact.utmContent) ? (
                      <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-body font-bold text-pink-700">
                        Nội dung quảng cáo: {formatTrackingLabel(contact.utmContent)}
                      </span>
                    ) : null}
                    {formatReferrer(contact.referrer) ? (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-body font-bold text-green-700">
                        Trang giới thiệu: {formatReferrer(contact.referrer)}
                      </span>
                    ) : null}
                  </div>
                  {formatSourcePath(contact.sourcePath) ? (
                    <p className="font-body text-[10px] text-slate-300 mt-1">
                      Trang khách mở: {formatSourcePath(contact.sourcePath)}
                    </p>
                  ) : null}
                  <p className="font-body text-[10px] text-slate-300 mt-1">
                    {new Date(contact.createdAt).toLocaleString("vi-VN")}
                  </p>

                  <div className="mt-2">
                    {editingNotes === contact.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notesValue}
                          onChange={(event) => setNotesValue(event.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-body border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
                          placeholder="Địa chỉ, ghi chú admin..."
                          autoFocus
                        />
                        <button
                          onClick={() => saveNotes(contact.id)}
                          disabled={savingNotesId === contact.id}
                          className="px-3 py-1.5 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
                        >
                          {savingNotesId === contact.id ? "..." : "Lưu"}
                        </button>
                        <button
                          onClick={() => setEditingNotes(null)}
                          disabled={savingNotesId === contact.id}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 disabled:text-slate-300 transition-colors"
                        >
                          Huỷ
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingNotes(contact.id);
                          setNotesValue(contact.notes || "");
                        }}
                        className="flex items-center gap-1.5 text-xs font-body text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        📍 {contact.notes || "Thêm địa chỉ / ghi chú..."}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    data-testid="dashboard-contact-detail-open"
                    type="button"
                    onClick={() => setSelectedContactId(contact.id)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-body font-bold text-white transition-colors hover:bg-slate-800"
                  >
                    Chi tiết
                  </button>
                  <select
                    value={contact.status}
                    onChange={(event) => updateStatus(contact.id, event.target.value)}
                    title="Cập nhật trạng thái"
                    disabled={pendingStatusId === contact.id}
                    className="text-xs font-body font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-red-500 outline-none disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {Object.entries(statusConfig).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.label}
                      </option>
                    ))}
                  </select>
                  <a href={`tel:${contact.phone}`} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Gọi">
                    📞
                  </a>
                  <button
                    onClick={() => deleteContact(contact.id)}
                    disabled={deletingId === contact.id}
                    className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-300 transition-colors"
                    title="Xoá"
                  >
                    {deletingId === contact.id ? "..." : "🗑️"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
            <p className="font-body text-xs text-slate-500">
              Trang {currentPage} / {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                data-testid="dashboard-contacts-prev"
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={currentPage === 1}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-body font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:text-slate-300"
              >
                Trước
              </button>
              <button
                data-testid="dashboard-contacts-next"
                type="button"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-body font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                Sau
              </button>
            </div>
          </div>
        )}
        </>
      )}
      {selectedContact && selectedHeat ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 p-3 sm:p-6">
          <button
            type="button"
            aria-label="Đóng chi tiết khách"
            className="absolute inset-0"
            onClick={() => setSelectedContactId(null)}
          />
          <aside
            data-testid="dashboard-contact-detail-drawer"
            className="relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-body font-bold ${selectedHeat.color}`}>
                      {selectedHeat.label}
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-body font-bold ${statusConfig[selectedContact.status]?.color}`}>
                      {statusConfig[selectedContact.status]?.label}
                    </span>
                  </div>
                  <h3 className="truncate font-heading text-2xl font-extrabold text-slate-900">
                    {selectedContact.name}
                  </h3>
                  <p className="font-body text-sm text-slate-500">
                    {serviceLabels[selectedContact.service] || selectedContact.service} · tạo {getLeadAgeLabel(selectedContact.createdAt)} trước
                  </p>
                </div>
                <button
                  data-testid="dashboard-contact-detail-close"
                  type="button"
                  onClick={() => setSelectedContactId(null)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-body font-bold text-slate-600 transition-colors hover:bg-slate-200"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={`tel:${selectedContact.phone}`}
                  className="rounded-xl border border-green-100 bg-green-50 p-4 font-body text-sm font-bold text-green-700 transition-colors hover:bg-green-100"
                >
                  Gọi {selectedContact.phone}
                </a>
                <button
                  data-testid="dashboard-contact-create-order"
                  type="button"
                  onClick={() => router.push(buildServiceOrderHref(selectedContact))}
                  className="rounded-xl border border-red-100 bg-red-50 p-4 font-body text-sm font-bold text-red-700 transition-colors hover:bg-red-100"
                >
                  Tạo đơn dịch vụ
                </button>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">Thời điểm tạo</p>
                  <p className="mt-1 font-body text-sm font-semibold text-slate-700">
                    {formatDateTime(selectedContact.createdAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="font-body text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Hành động đề xuất
                </p>
                <p className="mt-1 font-body text-sm font-semibold text-slate-800">
                  {getRecommendedAction(selectedContact)}
                </p>
              </div>

              <div>
                <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Tiến độ nhanh
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(statusConfig).map(([key, value]) => (
                    <button
                      key={key}
                      data-testid={`dashboard-contact-detail-status-${key}`}
                      type="button"
                      onClick={() => updateStatus(selectedContact.id, key)}
                      disabled={selectedContact.status === key || pendingStatusId === selectedContact.id}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-body font-bold transition-colors ${
                        selectedContact.status === key
                          ? "border-slate-900 bg-slate-900 text-white"
                          : `${value.color} hover:opacity-80`
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Ghi chú chăm sóc
                  </p>
                  {!isDrawerNotesEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsDrawerNotesEditing(true)}
                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-body font-bold text-slate-600 transition-colors hover:bg-slate-200"
                    >
                      Sửa
                    </button>
                  ) : null}
                </div>
                {isDrawerNotesEditing ? (
                  <div className="space-y-3">
                    <textarea
                      data-testid="dashboard-contact-detail-notes"
                      value={drawerNotesValue}
                      onChange={(event) => setDrawerNotesValue(event.target.value)}
                      className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-body text-slate-700 outline-none focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
                      placeholder="Địa chỉ, nhu cầu, mốc gọi lại..."
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerNotesValue(selectedContact.notes || "");
                          setIsDrawerNotesEditing(false);
                        }}
                        disabled={savingNotesId === selectedContact.id}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-body font-bold text-slate-600 transition-colors hover:bg-slate-200 disabled:text-slate-300"
                      >
                        Huỷ
                      </button>
                      <button
                        data-testid="dashboard-contact-detail-save-notes"
                        type="button"
                        onClick={() => saveNotes(selectedContact.id, drawerNotesValue, () => setIsDrawerNotesEditing(false))}
                        disabled={savingNotesId === selectedContact.id}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-body font-bold text-white transition-colors hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        {savingNotesId === selectedContact.id ? "Đang lưu..." : "Lưu ghi chú"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-body text-sm text-slate-700">
                    {selectedContact.notes || "Chưa có ghi chú chăm sóc."}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <p className="mb-3 font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nội dung khách gửi
                </p>
                <p className="font-body text-sm text-slate-700">
                  {selectedContact.message || "Khách chưa để lại nội dung chi tiết."}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 p-4">
                <p className="mb-3 font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Nguồn khách biết đến
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedContact.source ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-body font-bold text-slate-600">
                      {getLeadSourceLabel(selectedContact.source)}
                    </span>
                  ) : null}
                  {formatSourcePath(selectedContact.sourcePath) ? (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-body font-bold text-slate-600">
                      Trang khách mở: {formatSourcePath(selectedContact.sourcePath)}
                    </span>
                  ) : null}
                  {selectedReferrer ? (
                    <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-body font-bold text-green-700">
                      Trang giới thiệu: {selectedReferrer}
                    </span>
                  ) : null}
                  {formatTrackingLabel(selectedContact.utmSource) ? (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-body font-bold text-blue-700">
                      Kênh quảng cáo: {formatTrackingLabel(selectedContact.utmSource)}
                    </span>
                  ) : null}
                  {formatTrackingLabel(selectedContact.utmCampaign) ? (
                    <span className="rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-body font-bold text-purple-700">
                      Chiến dịch: {formatTrackingLabel(selectedContact.utmCampaign)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
