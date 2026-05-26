"use client";

import { useMemo, useState } from "react";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import { formatVietnamDate, todayVietnamText } from "@/lib/vietnam-time";

interface PartnerEntryData {
  id: string;
  partnerId: string;
  entryType: string;
  entryDate: string;
  amount: number;
  signedAmount: number;
  description: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PartnerData {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  type: string;
  notes: string | null;
  active: boolean;
  balance: number;
  totals: {
    decrease: number;
    increase: number;
  };
  ledgerEntries: PartnerEntryData[];
  createdAt: string;
  updatedAt: string;
}

type EntryFilter = "ALL" | "OPENING_BALANCE" | "PURCHASE" | "PAYMENT" | "RETURN" | "ADJUSTMENT";

const entryTypeLabels: Record<string, { label: string; color: string; sign: string }> = {
  ADJUSTMENT: { label: "Điều chỉnh", color: "bg-slate-50 text-slate-700 border-slate-200", sign: "+/-" },
  OPENING_BALANCE: { label: "Đầu kỳ", color: "bg-blue-50 text-blue-700 border-blue-200", sign: "+" },
  PAYMENT: { label: "Thanh toán", color: "bg-green-50 text-green-700 border-green-200", sign: "-" },
  PURCHASE: { label: "Mua hàng", color: "bg-red-50 text-red-700 border-red-200", sign: "+" },
  RETURN: { label: "Trả hàng", color: "bg-amber-50 text-amber-700 border-amber-200", sign: "-" },
};

const partnerTypeLabels: Record<string, string> = {
  OTHER: "Khác",
  SERVICE_PARTNER: "Đối tác dịch vụ",
  SUPPLIER: "Nhà cung cấp",
};

function formatMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}${Math.abs(amount).toLocaleString("vi-VN")}đ`;
}

function parseMoneyText(value: string) {
  const parsed = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string | null) {
  return formatVietnamDate(value) || "Chưa có";
}

function upsertPartner(partners: PartnerData[], nextPartner: PartnerData) {
  const exists = partners.some((partner) => partner.id === nextPartner.id);
  if (!exists) return [nextPartner, ...partners].sort((first, second) => first.name.localeCompare(second.name, "vi"));
  return partners.map((partner) => (partner.id === nextPartner.id ? nextPartner : partner));
}

export default function AdminPartnerLedgerClient({ initialPartners }: { initialPartners: PartnerData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [partners, setPartners] = useState(initialPartners);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartners[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("ALL");
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(true);
  const [isSavingPartner, setIsSavingPartner] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [partnerForm, setPartnerForm] = useState({
    code: "",
    name: "",
    notes: "",
    phone: "",
    type: "SUPPLIER",
  });
  const [entryForm, setEntryForm] = useState({
    amount: "",
    description: "",
    entryDate: todayVietnamText(),
    entryType: "PURCHASE",
    notes: "",
    reference: "",
  });

  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) || partners[0] || null;
  const longPartner = partners.find((partner) => partner.code === "LONG");
  const allEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return partners
      .flatMap((partner) =>
        partner.ledgerEntries.map((entry) => ({
          ...entry,
          partnerCode: partner.code,
          partnerName: partner.name,
        }))
      )
      .filter((entry) => {
        const matchesType = entryFilter === "ALL" || entry.entryType === entryFilter;
        const matchesSearch = !query
          || entry.partnerName.toLowerCase().includes(query)
          || entry.partnerCode.toLowerCase().includes(query)
          || entry.description.toLowerCase().includes(query)
          || (entry.reference || "").toLowerCase().includes(query)
          || (entry.notes || "").toLowerCase().includes(query);
        return matchesType && matchesSearch;
      })
      .sort((first, second) => new Date(second.entryDate).getTime() - new Date(first.entryDate).getTime());
  }, [entryFilter, partners, searchQuery]);

  const metrics = useMemo(() => {
    return partners.reduce(
      (summary, partner) => {
        summary.balance += partner.balance;
        summary.entries += partner.ledgerEntries.length;
        if (partner.balance > 0) summary.payablePartners += 1;
        return summary;
      },
      { balance: 0, entries: 0, payablePartners: 0 }
    );
  }, [partners]);

  const savePartner = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!partnerForm.name.trim()) {
      showToast("Vui lòng nhập tên đối tác.", "error");
      return;
    }

    setIsSavingPartner(true);
    try {
      const response = await fetch("/api/admin/partner-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "partner", ...partnerForm }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa tạo được đối tác.", "error");
        return;
      }

      setPartners((current) => upsertPartner(current, data.partner));
      setSelectedPartnerId(data.partner.id);
      setPartnerForm({ code: "", name: "", notes: "", phone: "", type: "SUPPLIER" });
      setShowPartnerForm(false);
      showToast("Đã thêm đối tác.", "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi tạo đối tác.", "error");
    } finally {
      setIsSavingPartner(false);
    }
  };

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedPartner) {
      showToast("Chưa chọn đối tác.", "error");
      return;
    }

    if (parseMoneyText(entryForm.amount) <= 0) {
      showToast("Vui lòng nhập số tiền giao dịch.", "error");
      return;
    }

    setIsSavingEntry(true);
    try {
      const response = await fetch("/api/admin/partner-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...entryForm, partnerId: selectedPartner.id }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa ghi được giao dịch.", "error");
        return;
      }

      setPartners((current) => upsertPartner(current, data.partner));
      setEntryForm({
        amount: "",
        description: "",
        entryDate: todayVietnamText(),
        entryType: entryForm.entryType,
        notes: "",
        reference: "",
      });
      showToast("Đã ghi giao dịch đối tác.", "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi ghi giao dịch.", "error");
    } finally {
      setIsSavingEntry(false);
    }
  };

  const deleteEntry = (entry: PartnerEntryData) => {
    showConfirm("Xoá giao dịch đối tác này khỏi sổ?", async () => {
      setDeletingEntryId(entry.id);
      try {
        const response = await fetch("/api/admin/partner-ledger", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa xoá được giao dịch.", "error");
          return;
        }

        setPartners((current) => upsertPartner(current, data.partner));
        showToast("Đã xoá giao dịch.", "success");
      } catch {
        showToast("Kết nối bị gián đoạn khi xoá giao dịch.", "error");
      } finally {
        setDeletingEntryId(null);
      }
    });
  };

  const syncGoogleSheet = async () => {
    setSyncingSheet(true);
    try {
      const response = await fetch("/api/admin/sheets-sync", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa sync được Google Sheet.", "error");
        return;
      }

      showToast(`Đã sync ${data.tabs?.length || 0} tab sang Google Sheet.`, "success");
    } catch {
      showToast("Kết nối bị gián đoạn khi sync Google Sheet.", "error");
    } finally {
      setSyncingSheet(false);
    }
  };

  return (
    <div data-testid="dashboard-partner-ledger" className="space-y-5 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Sổ đối tác</p>
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Công Nợ Đối Tác</h2>
          <p className="font-body text-sm text-slate-500">
            Theo dõi Long và các đối tác khác bằng giao dịch riêng, không trộn vào đơn dịch vụ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncGoogleSheet}
            disabled={syncingSheet}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-300"
          >
            {syncingSheet ? "Đang sync..." : "Sync Google Sheet"}
          </button>
          <button
            type="button"
            onClick={() => setShowPartnerForm((current) => !current)}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
          >
            + Đối tác
          </button>
          <button
            type="button"
            onClick={() => setShowEntryForm((current) => !current)}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white hover:bg-red-700"
          >
            + Giao dịch
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Tổng đối tác</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{partners.length}</p>
          <p className="mt-1 font-body text-xs text-slate-500">{metrics.payablePartners} đối tác còn phải trả</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Tổng phải trả đối tác</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{formatMoney(metrics.balance)}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
          <p className="font-body text-xs uppercase tracking-wider text-amber-700">Minh Hồng phải trả Long</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-amber-700">{formatMoney(longPartner?.balance || 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="font-body text-xs uppercase tracking-wider text-slate-400">Giao dịch</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{metrics.entries}</p>
          <p className="mt-1 font-body text-xs text-slate-500">Đầu kỳ, mua, trả, hoàn, điều chỉnh</p>
        </div>
      </div>

      {showPartnerForm ? (
        <form onSubmit={savePartner} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="font-body text-xs font-bold text-slate-600">Tên đối tác</span>
              <input
                value={partnerForm.name}
                onChange={(event) => setPartnerForm({ ...partnerForm, name: event.target.value })}
                placeholder="Ví dụ: Long"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Mã</span>
              <input
                value={partnerForm.code}
                onChange={(event) => setPartnerForm({ ...partnerForm, code: event.target.value })}
                placeholder="LONG"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">SĐT</span>
              <input
                value={partnerForm.phone}
                onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })}
                placeholder="Tuỳ chọn"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Loại</span>
              <select
                value={partnerForm.type}
                onChange={(event) => setPartnerForm({ ...partnerForm, type: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              >
                {Object.entries(partnerTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-5">
              <span className="font-body text-xs font-bold text-slate-600">Ghi chú</span>
              <input
                value={partnerForm.notes}
                onChange={(event) => setPartnerForm({ ...partnerForm, notes: event.target.value })}
                placeholder="Thông tin nội bộ về đối tác"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={isSavingPartner} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
              {isSavingPartner ? "Đang lưu..." : "Lưu đối tác"}
            </button>
            <button type="button" onClick={() => setShowPartnerForm(false)} className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-600">
              Huỷ
            </button>
          </div>
        </form>
      ) : null}

      {showEntryForm ? (
        <form onSubmit={saveEntry} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Đối tác</span>
              <select
                value={selectedPartner?.id || ""}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              >
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>{partner.name}</option>
                ))}
              </select>
            </label>
            <VietnameseDateInput
              label="Ngày"
              name="partnerEntryDate"
              value={entryForm.entryDate}
              onChange={(value) => setEntryForm({ ...entryForm, entryDate: value })}
            />
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Loại giao dịch</span>
              <select
                value={entryForm.entryType}
                onChange={(event) => setEntryForm({ ...entryForm, entryType: event.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              >
                {Object.entries(entryTypeLabels).map(([key, config]) => (
                  <option key={key} value={key}>{config.label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Số tiền</span>
              <input
                inputMode="numeric"
                value={entryForm.amount}
                onChange={(event) => setEntryForm({ ...entryForm, amount: event.target.value })}
                placeholder="Ví dụ: 7490000"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="font-body text-xs font-bold text-slate-600">Nội dung</span>
              <input
                value={entryForm.description}
                onChange={(event) => setEntryForm({ ...entryForm, description: event.target.value })}
                placeholder="Ví dụ: Mua thêm 300cell eve 25p"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-600">Mã chứng từ</span>
              <input
                value={entryForm.reference}
                onChange={(event) => setEntryForm({ ...entryForm, reference: event.target.value })}
                placeholder="Tuỳ chọn"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-5">
              <span className="font-body text-xs font-bold text-slate-600">Ghi chú</span>
              <input
                value={entryForm.notes}
                onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })}
                placeholder="Ghi chú nội bộ"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={isSavingEntry || !selectedPartner} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
              {isSavingEntry ? "Đang ghi..." : "Ghi giao dịch"}
            </button>
            {selectedPartner ? (
              <p className="font-body text-sm font-semibold text-slate-500">
                Số dư sau ghi sẽ cập nhật cho {selectedPartner.name}.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="sticky top-0 z-20 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_180px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm đối tác, nội dung, chứng từ, ghi chú"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none focus:border-red-400"
          />
          <select
            value={selectedPartner?.id || ""}
            onChange={(event) => setSelectedPartnerId(event.target.value)}
            title="Chọn đối tác"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            {partners.map((partner) => (
              <option key={partner.id} value={partner.id}>
                {partner.name} · phải trả {formatMoney(partner.balance)}
              </option>
            ))}
          </select>
          <select
            value={entryFilter}
            onChange={(event) => setEntryFilter(event.target.value as EntryFilter)}
            title="Lọc loại giao dịch"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="ALL">Tất cả giao dịch</option>
            {Object.entries(entryTypeLabels).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body text-xs text-slate-500">
            Đang xem {allEntries.length} giao dịch · Minh Hồng phải trả {formatMoney(metrics.balance)}
          </p>
          {selectedPartner ? (
            <p className="font-body text-xs font-bold text-red-700">
              Minh Hồng phải trả {selectedPartner.name}: {formatMoney(selectedPartner.balance)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          {partners.map((partner) => (
            <button
              key={partner.id}
              type="button"
              onClick={() => setSelectedPartnerId(partner.id)}
              className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                selectedPartner?.id === partner.id ? "border-red-200 ring-2 ring-red-100" : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-base font-extrabold text-slate-900">{partner.name}</p>
                  <p className="font-body text-xs font-semibold text-slate-400">{partner.code} · {partnerTypeLabels[partner.type] || partner.type}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-body font-bold ${partner.balance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {formatMoney(partner.balance)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 font-body text-xs text-slate-500">
                <span>Tăng phải trả: <strong>{formatMoney(partner.totals.increase)}</strong></span>
                <span>Giảm phải trả: <strong>{formatMoney(partner.totals.decrease)}</strong></span>
              </div>
              {partner.notes ? <p className="mt-2 font-body text-xs text-slate-400">{partner.notes}</p> : null}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-collapse text-left font-body text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Đối tác</th>
                  <th className="px-4 py-3">Loại</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Chứng từ</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {allEntries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">
                      Chưa có giao dịch nào khớp bộ lọc.
                    </td>
                  </tr>
                ) : (
                  allEntries.map((entry) => {
                    const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
                    return (
                      <tr key={entry.id} className={deletingEntryId === entry.id ? "opacity-60" : ""}>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(entry.entryDate)}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{entry.partnerName}</p>
                          <p className="text-xs text-slate-400">{entry.partnerCode}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>
                            {type.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700">{entry.description}</p>
                          {entry.notes ? <p className="mt-1 text-xs text-slate-400">{entry.notes}</p> : null}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${entry.signedAmount > 0 ? "text-red-700" : "text-green-700"}`}>
                          {formatMoney(entry.signedAmount)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{entry.reference || "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteEntry(entry)}
                            disabled={deletingEntryId === entry.id}
                            className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
                          >
                            Xoá
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
