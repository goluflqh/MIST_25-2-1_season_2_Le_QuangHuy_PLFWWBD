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
type EntryMode = "PURCHASE" | "PAYMENT";
type EntryScope = "SELECTED" | "ALL";

interface EntryFormState {
  entryDate: string;
  entryMode: EntryMode;
  notes: string;
  paymentAmount: string;
  paymentDescription: string;
  productName: string;
  quantity: string;
  reference: string;
  unitPrice: string;
}

const entryTypeLabels: Record<string, { label: string; color: string }> = {
  ADJUSTMENT: { label: "Điều chỉnh", color: "bg-slate-50 text-slate-700 border-slate-200" },
  OPENING_BALANCE: { label: "Đầu kỳ", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PAYMENT: { label: "Thanh toán", color: "bg-green-50 text-green-700 border-green-200" },
  PURCHASE: { label: "Mua hàng", color: "bg-red-50 text-red-700 border-red-200" },
  RETURN: { label: "Trả hàng", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const partnerTypeLabels: Record<string, string> = {
  OTHER: "Khác",
  SERVICE_PARTNER: "Đối tác dịch vụ",
  SUPPLIER: "Nhà cung cấp",
};

function createEmptyEntryForm(mode: EntryMode = "PURCHASE"): EntryFormState {
  return {
    entryDate: todayVietnamText(),
    entryMode: mode,
    notes: "",
    paymentAmount: "",
    paymentDescription: "",
    productName: "",
    quantity: "1",
    reference: "",
    unitPrice: "",
  };
}

function formatMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}${Math.abs(amount).toLocaleString("vi-VN")}đ`;
}

function parseMoneyText(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "");
  const multiplier = normalized.endsWith("k") ? 1000 : 1;
  const rawNumber = multiplier === 1000 ? normalized.slice(0, -1) : normalized;
  const parsed = Number.parseInt(rawNumber.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function formatMoneyInputValue(value: string) {
  if (!value.trim()) return "";
  const parsed = parseMoneyText(value);
  return parsed > 0 ? parsed.toLocaleString("vi-VN") : "";
}

function parseQuantityText(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function formatDate(value: string | null) {
  return formatVietnamDate(value) || "Chưa có";
}

function upsertPartner(partners: PartnerData[], nextPartner: PartnerData) {
  const exists = partners.some((partner) => partner.id === nextPartner.id);
  if (!exists) return [nextPartner, ...partners].sort((first, second) => first.name.localeCompare(second.name, "vi"));
  return partners.map((partner) => (partner.id === nextPartner.id ? nextPartner : partner));
}

function getPartnerStats(partner: PartnerData) {
  return partner.ledgerEntries.reduce(
    (summary, entry, index) => {
      if (entry.entryType === "PURCHASE") summary.purchased += entry.amount;
      if (entry.entryType === "PAYMENT") summary.paid += entry.amount;
      if (index === 0) summary.latest = entry;
      return summary;
    },
    { latest: null as PartnerEntryData | null, paid: 0, purchased: 0 }
  );
}

export default function AdminPartnerLedgerClient({ initialPartners }: { initialPartners: PartnerData[] }) {
  const { showToast, showConfirm } = useNotify();
  const [partners, setPartners] = useState(initialPartners);
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartners[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("ALL");
  const [entryScope, setEntryScope] = useState<EntryScope>("SELECTED");
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
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
  const [entryForm, setEntryForm] = useState<EntryFormState>(() => createEmptyEntryForm());

  const selectedPartner = partners.find((partner) => partner.id === selectedPartnerId) || partners[0] || null;
  const selectedStats = selectedPartner ? getPartnerStats(selectedPartner) : null;
  const purchaseQuantity = parseQuantityText(entryForm.quantity);
  const purchaseUnitPrice = parseMoneyText(entryForm.unitPrice);
  const purchaseTotal = Math.round(purchaseQuantity * purchaseUnitPrice);

  const metrics = useMemo(() => {
    return partners.reduce(
      (summary, partner) => {
        const stats = getPartnerStats(partner);
        summary.balance += partner.balance;
        summary.entries += partner.ledgerEntries.length;
        summary.paid += stats.paid;
        summary.purchased += stats.purchased;
        if (partner.balance > 0) summary.payablePartners += 1;
        return summary;
      },
      { balance: 0, entries: 0, paid: 0, payablePartners: 0, purchased: 0 }
    );
  }, [partners]);

  const filteredPartners = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return partners;

    return partners.filter((partner) =>
      partner.name.toLowerCase().includes(query)
      || partner.code.toLowerCase().includes(query)
      || (partner.phone || "").toLowerCase().includes(query)
      || (partner.notes || "").toLowerCase().includes(query)
    );
  }, [partners, searchQuery]);

  const visibleEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sourcePartners = entryScope === "SELECTED" && selectedPartner ? [selectedPartner] : partners;

    return sourcePartners
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
  }, [entryFilter, entryScope, partners, searchQuery, selectedPartner]);

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

    const isPurchase = entryForm.entryMode === "PURCHASE";
    const amount = isPurchase ? purchaseTotal : parseMoneyText(entryForm.paymentAmount);
    const productName = entryForm.productName.trim();
    const paymentDescription = entryForm.paymentDescription.trim();

    if (isPurchase && !productName) {
      showToast("Vui lòng nhập sản phẩm hoặc nội dung mua hàng.", "error");
      return;
    }

    if (amount <= 0) {
      showToast(isPurchase ? "Vui lòng nhập số lượng và đơn giá hợp lệ." : "Vui lòng nhập số tiền thanh toán.", "error");
      return;
    }

    const quantityNote = isPurchase ? `SL ${formatQuantity(purchaseQuantity)} x ${formatMoney(purchaseUnitPrice)}` : "";
    const notes = [entryForm.notes.trim(), quantityNote].filter(Boolean).join(" · ");

    setIsSavingEntry(true);
    try {
      const response = await fetch("/api/admin/partner-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          description: isPurchase ? productName : paymentDescription || `Thanh toán cho ${selectedPartner.name}`,
          entryDate: entryForm.entryDate,
          entryType: entryForm.entryMode,
          notes,
          partnerId: selectedPartner.id,
          reference: entryForm.reference.trim(),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa ghi được giao dịch.", "error");
        return;
      }

      setPartners((current) => upsertPartner(current, data.partner));
      setSelectedPartnerId(data.partner.id);
      setEntryScope("SELECTED");
      setEntryForm(createEmptyEntryForm(entryForm.entryMode));
      showToast(isPurchase ? "Đã ghi mua hàng." : "Đã ghi thanh toán.", "success");
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
    }, "Xoá");
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
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Sổ phải trả đối tác</p>
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Đối Tác & Mua Hàng</h2>
          <p className="font-body text-sm text-slate-600">
            Minh Hồng ghi mua hàng là tăng số phải trả, ghi thanh toán là giảm số phải trả.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncGoogleSheet}
            disabled={syncingSheet}
            className="min-h-11 rounded-xl bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-300"
          >
            {syncingSheet ? "Đang sync..." : "Sync Google Sheet"}
          </button>
          <button
            type="button"
            onClick={() => setShowPartnerForm((current) => !current)}
            className="min-h-11 rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
          >
            + Đối tác
          </button>
          <button
            type="button"
            onClick={() => setShowEntryForm(true)}
            className="min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white hover:bg-red-700"
          >
            Ghi giao dịch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-slate-500">Đối tác</p>
          <p className="mt-1 font-heading text-3xl font-extrabold text-slate-900">{partners.length}</p>
          <p className="mt-1 font-body text-xs text-slate-500">{metrics.payablePartners} đối tác còn phải trả</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Minh Hồng đang phải trả</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{formatMoney(metrics.balance)}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-slate-500">Đã mua</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{formatMoney(metrics.purchased)}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4 sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Đã thanh toán</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-green-700">{formatMoney(metrics.paid)}</p>
        </div>
      </div>

      {showPartnerForm ? (
        <form onSubmit={savePartner} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="font-body text-xs font-bold text-slate-700">Tên đối tác</span>
              <input
                value={partnerForm.name}
                onChange={(event) => setPartnerForm({ ...partnerForm, name: event.target.value })}
                placeholder="Ví dụ: Long"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">Mã</span>
              <input
                value={partnerForm.code}
                onChange={(event) => setPartnerForm({ ...partnerForm, code: event.target.value })}
                placeholder="LONG"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">SĐT</span>
              <input
                value={partnerForm.phone}
                onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })}
                placeholder="Tuỳ chọn"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">Nhóm</span>
              <select
                value={partnerForm.type}
                onChange={(event) => setPartnerForm({ ...partnerForm, type: event.target.value })}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              >
                {Object.entries(partnerTypeLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 md:col-span-2 xl:col-span-5">
              <span className="font-body text-xs font-bold text-slate-700">Ghi chú</span>
              <input
                value={partnerForm.notes}
                onChange={(event) => setPartnerForm({ ...partnerForm, notes: event.target.value })}
                placeholder="Thông tin nội bộ về đối tác"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={isSavingPartner} className="min-h-11 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
              {isSavingPartner ? "Đang lưu..." : "Lưu đối tác"}
            </button>
            <button type="button" onClick={() => setShowPartnerForm(false)} className="min-h-11 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-700">
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      {showEntryForm ? (
        <form onSubmit={saveEntry} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-heading text-lg font-extrabold text-slate-900">Ghi giao dịch</h3>
              <p className="font-body text-sm text-slate-600">
                {selectedPartner ? `Đang ghi cho ${selectedPartner.name}` : "Chọn đối tác trước khi ghi."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowEntryForm(false)}
              className="min-h-11 rounded-xl bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
            >
              Đóng
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <label className="space-y-1.5 lg:col-span-2">
              <span className="font-body text-xs font-bold text-slate-700">Đối tác</span>
              <select
                value={selectedPartner?.id || ""}
                onChange={(event) => setSelectedPartnerId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
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
            <div className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">Loại</span>
              <div className="grid grid-cols-2 gap-2">
                {(["PURCHASE", "PAYMENT"] as EntryMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEntryForm((current) => ({ ...createEmptyEntryForm(mode), entryDate: current.entryDate, reference: current.reference }))}
                    className={`min-h-11 rounded-xl px-3 py-2 text-sm font-body font-bold ${entryForm.entryMode === mode ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {mode === "PURCHASE" ? "Mua hàng" : "Thanh toán"}
                  </button>
                ))}
              </div>
            </div>

            {entryForm.entryMode === "PURCHASE" ? (
              <>
                <label className="space-y-1.5 lg:col-span-2">
                  <span className="font-body text-xs font-bold text-slate-700">Sản phẩm / nội dung</span>
                  <input
                    value={entryForm.productName}
                    onChange={(event) => setEntryForm({ ...entryForm, productName: event.target.value })}
                    placeholder="Ví dụ: 300 cell EVE 25P"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="font-body text-xs font-bold text-slate-700">Số lượng</span>
                  <input
                    inputMode="decimal"
                    value={entryForm.quantity}
                    onChange={(event) => setEntryForm({ ...entryForm, quantity: event.target.value })}
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="font-body text-xs font-bold text-slate-700">Đơn giá</span>
                  <input
                    inputMode="numeric"
                    value={entryForm.unitPrice}
                    onChange={(event) => setEntryForm({ ...entryForm, unitPrice: event.target.value })}
                    onBlur={() => setEntryForm((current) => ({ ...current, unitPrice: formatMoneyInputValue(current.unitPrice) }))}
                    placeholder="Ví dụ: 25k"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                  />
                </label>
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 lg:col-span-4">
                  <p className="font-body text-xs font-bold uppercase tracking-wider text-red-700">Tổng tiền mua</p>
                  <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{formatMoney(purchaseTotal)}</p>
                </div>
              </>
            ) : (
              <>
                <label className="space-y-1.5">
                  <span className="font-body text-xs font-bold text-slate-700">Số tiền thanh toán</span>
                  <input
                    inputMode="numeric"
                    value={entryForm.paymentAmount}
                    onChange={(event) => setEntryForm({ ...entryForm, paymentAmount: event.target.value })}
                    onBlur={() => setEntryForm((current) => ({ ...current, paymentAmount: formatMoneyInputValue(current.paymentAmount) }))}
                    placeholder="Ví dụ: 1000k"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                  />
                </label>
                <label className="space-y-1.5 lg:col-span-3">
                  <span className="font-body text-xs font-bold text-slate-700">Nội dung</span>
                  <input
                    value={entryForm.paymentDescription}
                    onChange={(event) => setEntryForm({ ...entryForm, paymentDescription: event.target.value })}
                    placeholder="Ví dụ: chuyển khoản trả Long"
                    className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                  />
                </label>
              </>
            )}

            <label className="space-y-1.5 lg:col-span-2">
              <span className="font-body text-xs font-bold text-slate-700">Chứng từ</span>
              <input
                value={entryForm.reference}
                onChange={(event) => setEntryForm({ ...entryForm, reference: event.target.value })}
                placeholder="Mã chuyển khoản, số phiếu hoặc link ảnh"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5 lg:col-span-2">
              <span className="font-body text-xs font-bold text-slate-700">Ghi chú</span>
              <input
                value={entryForm.notes}
                onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })}
                placeholder="Ghi chú nội bộ"
                className="min-h-11 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="submit" disabled={isSavingEntry || !selectedPartner} className="min-h-11 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
              {isSavingEntry ? "Đang ghi..." : entryForm.entryMode === "PURCHASE" ? "Ghi mua hàng" : "Ghi thanh toán"}
            </button>
            <button type="button" onClick={() => setShowEntryForm(false)} className="min-h-11 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-700">
              Hủy
            </button>
            {selectedPartner ? (
              <p className="font-body text-sm font-semibold text-slate-600">
                Hiện Minh Hồng đang phải trả {selectedPartner.name}: {formatMoney(selectedPartner.balance)}.
              </p>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px]">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm đối tác, giao dịch, chứng từ, ghi chú"
            className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-body outline-none focus:border-red-400"
          />
          <select
            value={entryScope}
            onChange={(event) => setEntryScope(event.target.value as EntryScope)}
            title="Phạm vi giao dịch"
            className="min-h-11 rounded-xl border border-slate-200 px-3 py-2 text-sm font-body outline-none focus:border-red-400"
          >
            <option value="SELECTED">Đối tác đang chọn</option>
            <option value="ALL">Tất cả đối tác</option>
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
          <p className="font-body text-sm text-slate-600">
            Đang xem {visibleEntries.length} giao dịch · tổng phải trả {formatMoney(metrics.balance)}
          </p>
          {selectedPartner ? (
            <p className="font-body text-sm font-bold text-red-700">
              {selectedPartner.name}: {formatMoney(selectedPartner.balance)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-3">
          {filteredPartners.length === 0 ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-5 text-sm font-body text-slate-500 shadow-sm">
              Không có đối tác khớp tìm kiếm.
            </div>
          ) : filteredPartners.map((partner) => {
            const stats = getPartnerStats(partner);
            return (
              <button
                key={partner.id}
                type="button"
                onClick={() => {
                  setSelectedPartnerId(partner.id);
                  setEntryScope("SELECTED");
                }}
                className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition-colors ${
                  selectedPartner?.id === partner.id ? "border-red-200 ring-2 ring-red-100" : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-heading text-base font-extrabold text-slate-900">{partner.name}</p>
                    <p className="font-body text-xs font-semibold text-slate-500">{partner.code} · {partnerTypeLabels[partner.type] || partner.type}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-body font-bold ${partner.balance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {formatMoney(partner.balance)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 font-body text-xs text-slate-600">
                  <span>Đã mua: <strong>{formatMoney(stats.purchased)}</strong></span>
                  <span>Đã thanh toán: <strong>{formatMoney(stats.paid)}</strong></span>
                </div>
                <p className="mt-2 font-body text-xs text-slate-500">
                  Giao dịch gần nhất: {stats.latest ? formatDate(stats.latest.entryDate) : "Chưa có"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {selectedPartner ? (
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Đối tác đang xem</p>
                  <h3 className="mt-1 font-heading text-xl font-extrabold text-slate-900">{selectedPartner.name}</h3>
                  <p className="font-body text-sm text-slate-600">{selectedPartner.phone || "Chưa có SĐT"} · {partnerTypeLabels[selectedPartner.type] || selectedPartner.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEntryForm(true)}
                  className="min-h-11 rounded-xl bg-red-600 px-4 py-2 text-sm font-body font-bold text-white hover:bg-red-700"
                >
                  Ghi giao dịch
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="font-body text-xs font-bold text-red-700">Minh Hồng đang phải trả</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-red-700">{formatMoney(selectedPartner.balance)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-body text-xs font-bold text-slate-600">Đã mua</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{formatMoney(selectedStats?.purchased || 0)}</p>
                </div>
                <div className="rounded-xl bg-green-50 p-3">
                  <p className="font-body text-xs font-bold text-green-700">Đã thanh toán</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-green-700">{formatMoney(selectedStats?.paid || 0)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-body text-xs font-bold text-slate-600">Giao dịch gần nhất</p>
                  <p className="mt-1 font-heading text-base font-extrabold text-slate-900">{selectedStats?.latest ? formatDate(selectedStats.latest.entryDate) : "Chưa có"}</p>
                </div>
              </div>
              {selectedPartner.notes ? <p className="mt-3 font-body text-sm text-slate-500">{selectedPartner.notes}</p> : null}
            </div>
          ) : null}

          <div className="space-y-3 lg:hidden">
            {visibleEntries.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-body text-slate-500 shadow-sm">
                Chưa có giao dịch nào khớp bộ lọc.
              </div>
            ) : visibleEntries.map((entry) => {
              const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
              return (
                <div key={entry.id} className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${deletingEntryId === entry.id ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-base font-extrabold text-slate-900">{entry.description}</p>
                      <p className="font-body text-sm text-slate-600">{entry.partnerName} · {formatDate(entry.entryDate)}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>{type.label}</span>
                  </div>
                  <p className={`mt-3 font-heading text-xl font-extrabold ${entry.signedAmount > 0 ? "text-red-700" : "text-green-700"}`}>
                    {formatMoney(entry.signedAmount)}
                  </p>
                  {entry.reference ? <p className="mt-2 font-body text-sm text-slate-600">Chứng từ: {entry.reference}</p> : null}
                  {entry.notes ? <p className="mt-1 font-body text-sm text-slate-500">{entry.notes}</p> : null}
                  <button
                    type="button"
                    onClick={() => deleteEntry(entry)}
                    disabled={deletingEntryId === entry.id}
                    className="mt-3 min-h-11 rounded-xl bg-red-50 px-4 py-2 text-sm font-body font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    Xoá
                  </button>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full border-collapse text-left font-body text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Ngày</th>
                    <th className="px-4 py-3">Đối tác</th>
                    <th className="px-4 py-3">Loại</th>
                    <th className="px-4 py-3">Nội dung</th>
                    <th className="px-4 py-3 text-right">Tác động</th>
                    <th className="px-4 py-3">Chứng từ</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                        Chưa có giao dịch nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    visibleEntries.map((entry) => {
                      const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
                      return (
                        <tr key={entry.id} className={deletingEntryId === entry.id ? "opacity-60" : ""}>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(entry.entryDate)}</td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{entry.partnerName}</p>
                            <p className="text-xs text-slate-500">{entry.partnerCode}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>
                              {type.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800">{entry.description}</p>
                            {entry.notes ? <p className="mt-1 text-xs text-slate-500">{entry.notes}</p> : null}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${entry.signedAmount > 0 ? "text-red-700" : "text-green-700"}`}>
                            {formatMoney(entry.signedAmount)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{entry.reference || "-"}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => deleteEntry(entry)}
                              disabled={deletingEntryId === entry.id}
                              className="min-h-10 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
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
    </div>
  );
}
