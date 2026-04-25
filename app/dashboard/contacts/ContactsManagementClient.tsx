"use client";

import { useEffect, useMemo, useState } from "react";
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

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-800 border-blue-200" },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-800 border-green-200" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-800 border-red-200" },
};

const PAGE_SIZE = 8;
const OPEN_STATUSES = new Set(["PENDING", "CONTACTED", "IN_PROGRESS"]);
const STATUS_PRIORITY = ["PENDING", "CONTACTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const sortOptions = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "name", label: "Tên A-Z" },
  { value: "priority", label: "Ưu tiên pipeline" },
] as const;

type SortMode = (typeof sortOptions)[number]["value"];

function getStatusRank(status: string) {
  const rank = STATUS_PRIORITY.indexOf(status);
  return rank === -1 ? STATUS_PRIORITY.length : rank;
}

function formatReferrer(referrer: string | null) {
  if (!referrer) return null;

  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return referrer;
  }
}

export default function ContactsManagementClient({
  initialContacts,
}: {
  initialContacts: ContactRequest[];
}) {
  const { showToast, showConfirm } = useNotify();
  const [contacts, setContacts] = useState<ContactRequest[]>(initialContacts);
  const [filter, setFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [page, setPage] = useState(1);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
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

  const saveNotes = async (id: string) => {
    setSavingNotesId(id);

    try {
      const response = await fetch(`/api/contact/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notesValue }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa lưu được ghi chú.", "error");
        return;
      }

      setContacts((prev) =>
        prev.map((contact) => (contact.id === id ? { ...contact, notes: notesValue } : contact))
      );
      setEditingNotes(null);
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
        contact.sourcePath,
        referrer,
        contact.utmSource,
        contact.utmMedium,
        contact.utmCampaign,
        contact.utmTerm,
        contact.utmContent,
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
          <p className="font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">Lead đang mở</p>
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
              Tìm kiếm CRM
            </span>
            <input
              data-testid="dashboard-contacts-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-body text-slate-700 outline-none transition-colors focus:border-red-400 focus:bg-white focus:ring-2 focus:ring-red-100"
              placeholder="Tên, SĐT, ghi chú, UTM..."
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Nguồn lead
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
            Hiển thị {filtered.length} / {contacts.length} lead
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
                    {contact.utmSource ? (
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-body font-bold text-blue-700">
                        utm_source: {contact.utmSource}
                      </span>
                    ) : null}
                    {contact.utmCampaign ? (
                      <span className="rounded-full bg-purple-50 px-2 py-1 text-[10px] font-body font-bold text-purple-700">
                        campaign: {contact.utmCampaign}
                      </span>
                    ) : null}
                    {contact.utmMedium ? (
                      <span className="rounded-full bg-cyan-50 px-2 py-1 text-[10px] font-body font-bold text-cyan-700">
                        utm_medium: {contact.utmMedium}
                      </span>
                    ) : null}
                    {contact.utmTerm ? (
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-body font-bold text-amber-700">
                        utm_term: {contact.utmTerm}
                      </span>
                    ) : null}
                    {contact.utmContent ? (
                      <span className="rounded-full bg-pink-50 px-2 py-1 text-[10px] font-body font-bold text-pink-700">
                        utm_content: {contact.utmContent}
                      </span>
                    ) : null}
                    {formatReferrer(contact.referrer) ? (
                      <span className="rounded-full bg-green-50 px-2 py-1 text-[10px] font-body font-bold text-green-700">
                        Referrer: {formatReferrer(contact.referrer)}
                      </span>
                    ) : null}
                  </div>
                  {contact.sourcePath ? (
                    <p className="font-body text-[10px] text-slate-300 mt-1">Trang tạo lead: {contact.sourcePath}</p>
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
    </div>
  );
}
