"use client";

import { useState } from "react";
import { useNotify } from "@/components/NotifyProvider";

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

const sourceLabels: Record<string, string> = {
  homepage: "Trang chủ",
  "pricing-page": "Trang báo giá",
  "service-dong-pin": "Trang đóng pin",
  "service-den-nlmt": "Trang đèn NLMT",
  "service-pin-luu-tru": "Trang pin lưu trữ",
  "service-camera": "Trang camera",
};

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
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [savingNotesId, setSavingNotesId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filtered = filter === "ALL" ? contacts : contacts.filter((contact) => contact.status === filter);

  return (
    <div className="space-y-6 animate-fade-in-up">
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

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-body text-slate-400">
            Không có yêu cầu nào {filter !== "ALL" && `ở trạng thái "${statusConfig[filter]?.label}"`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((contact) => (
            <div
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
                        Nguồn: {sourceLabels[contact.source] || contact.source}
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
      )}
    </div>
  );
}
