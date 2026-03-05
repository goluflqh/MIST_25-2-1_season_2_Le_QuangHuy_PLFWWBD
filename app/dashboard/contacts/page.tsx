"use client";

import { useState, useEffect } from "react";
import { useNotify } from "@/components/NotifyProvider";

interface ContactRequest {
  id: string;
  name: string;
  phone: string;
  service: string;
  message: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

const serviceLabels: Record<string, string> = {
  DONG_PIN: "🔋 Đóng Pin", DEN_NLMT: "☀️ Đèn NLMT", PIN_LUU_TRU: "⚡ Pin Lưu Trữ",
  CAMERA: "📹 Camera", CUSTOM: "🔧 Custom", KHAC: "📞 Khác",
  battery: "🔋 Đóng Pin", camera: "📹 Camera", contact: "📞 Liên hệ",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  CONTACTED: { label: "Đã liên hệ", color: "bg-blue-100 text-blue-800 border-blue-200" },
  IN_PROGRESS: { label: "Đang xử lý", color: "bg-orange-100 text-orange-800 border-orange-200" },
  COMPLETED: { label: "Hoàn thành", color: "bg-green-100 text-green-800 border-green-200" },
  CANCELLED: { label: "Đã huỷ", color: "bg-red-100 text-red-800 border-red-200" },
};

export default function ContactsManagementPage() {
  const { showToast, showConfirm } = useNotify();
  const [contacts, setContacts] = useState<ContactRequest[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contact");
      const data = await res.json();
      if (data.success) setContacts(data.contacts);
    } catch { /* */ }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchContacts(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c)); showToast("Đã cập nhật trạng thái.", "success"); }
  };

  const saveNotes = async (id: string) => {
    const res = await fetch(`/api/contact/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notesValue }),
    });
    if (res.ok) {
      setContacts((prev) => prev.map((c) => c.id === id ? { ...c, notes: notesValue } : c));
      setEditingNotes(null);
      showToast("Đã lưu ghi chú.", "success");
    }
  };

  const deleteContact = (id: string) => {
    showConfirm("Bạn có chắc chắn muốn xoá yêu cầu này không?", async () => {
      const res = await fetch(`/api/contact/${id}`, { method: "DELETE" });
      if (res.ok) { setContacts((prev) => prev.filter((c) => c.id !== id)); showToast("Đã xoá yêu cầu.", "success"); }
      else showToast("Lỗi khi xoá.", "error");
    });
  };

  const filtered = filter === "ALL" ? contacts : contacts.filter((c) => c.status === filter);

  if (isLoading) {
    return (
      <div className="text-center py-20">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-slate-200 rounded-xl w-48 mx-auto"></div>
          <div className="h-4 bg-slate-200 rounded-xl w-32 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading font-extrabold text-xl text-slate-900">Quản Lý Yêu Cầu Tư Vấn</h2>
          <p className="font-body text-sm text-slate-500">{contacts.length} yêu cầu tổng cộng</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {[{ key: "ALL", label: "Tất cả" }, ...Object.entries(statusConfig).map(([k, v]) => ({ key: k, label: v.label }))].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-body font-bold transition-colors ${filter === f.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {f.label} {f.key === "ALL" ? `(${contacts.length})` : `(${contacts.filter((c) => c.status === f.key).length})`}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <p className="text-3xl mb-2">📭</p>
          <p className="font-body text-slate-400">Không có yêu cầu nào {filter !== "ALL" && `ở trạng thái "${statusConfig[filter]?.label}"`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-body font-bold text-slate-900 text-sm">{c.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig[c.status]?.color}`}>
                      {statusConfig[c.status]?.label}
                    </span>
                  </div>
                  <p className="font-body text-sm text-slate-500">📱 {c.phone} · {serviceLabels[c.service] || c.service}</p>
                  {c.message && <p className="font-body text-xs text-slate-400 mt-1">💬 {c.message}</p>}
                  <p className="font-body text-[10px] text-slate-300 mt-1">{new Date(c.createdAt).toLocaleString("vi-VN")}</p>

                  {/* Notes / Address */}
                  <div className="mt-2">
                    {editingNotes === c.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={notesValue}
                          onChange={(e) => setNotesValue(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs font-body border border-slate-200 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
                          placeholder="Địa chỉ, ghi chú admin..."
                          autoFocus
                        />
                        <button onClick={() => saveNotes(c.id)} className="px-3 py-1.5 text-xs font-bold bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors">Lưu</button>
                        <button onClick={() => setEditingNotes(null)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors">Huỷ</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingNotes(c.id); setNotesValue(c.notes || ""); }}
                        className="flex items-center gap-1.5 text-xs font-body text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        📍 {c.notes || "Thêm địa chỉ / ghi chú..."}
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <select
                    value={c.status}
                    onChange={(e) => updateStatus(c.id, e.target.value)}
                    title="Cập nhật trạng thái"
                    className="text-xs font-body font-bold px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:ring-1 focus:ring-red-500 outline-none"
                  >
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <a href={`tel:${c.phone}`} className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="Gọi">📞</a>
                  <button onClick={() => deleteContact(c.id)} className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Xoá">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
