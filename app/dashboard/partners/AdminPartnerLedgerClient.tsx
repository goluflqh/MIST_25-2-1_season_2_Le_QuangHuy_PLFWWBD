"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminVietnameseDateRangeFilter from "@/components/admin/AdminVietnameseDateRangeFilter";
import MinhHongWorkbookImportPanel from "@/components/admin/MinhHongWorkbookImportPanel";
import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { useNotify } from "@/components/NotifyProvider";
import PaginationControls from "@/components/PaginationControls";
import { adminTimePresetLabels, matchesAdminTimePreset, type AdminTimePreset } from "@/lib/admin-time-filter";
import { summarizePartnerLedgerEntries } from "@/lib/financial-calculations";
import { formatMoneyInputValue, parseMoneyText } from "@/lib/money";
import { calculatePartnerPurchaseAmounts, parsePartnerDiscountPercent } from "@/lib/partner-discounts";
import { getPartnerEntryAmountLabel, getPartnerEntryDisplayDetails, getPartnerEntryHistoryNote } from "@/lib/partner-entry-display";
import { getVisibleDebtPartners } from "@/lib/partner-legacy";
import { formatVietnamDate, getVietnamDateKey, todayVietnamText } from "@/lib/vietnam-time";

interface PartnerEntryData {
  id: string;
  partnerId: string;
  entryType: string;
  entryDate: string;
  amount: number;
  discountAmount: number;
  discountPercent: number | null;
  signedAmount: number;
  description: string;
  reference: string | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  sourceName: string | null;
  sourceCode: string | null;
  sourceRow: number | null;
  paymentMethod: string | null;
  category: string | null;
  receivedGoods: boolean | null;
  countsInDebt: boolean;
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
    adjusted?: number;
    decrease: number;
    increase: number;
    openingBalance?: number;
    paid?: number;
    purchased?: number;
    referenceOnly?: number;
    returned?: number;
  };
  ledgerEntries: PartnerEntryData[];
  createdAt: string;
  updatedAt: string;
}

type EntryFilter = "ALL" | "OPENING_BALANCE" | "PURCHASE" | "PAYMENT" | "RETURN" | "ADJUSTMENT";
type EntryMode = "PURCHASE" | "PAYMENT" | "RETURN";
type EntryScope = "SELECTED" | "ALL";

type VisibleEntry = PartnerEntryData & {
  partnerCode: string;
  partnerName: string;
};

interface EntryFormState {
  discountPercent: string;
  entryDate: string;
  entryMode: EntryMode;
  notes: string;
  paymentAmount: string;
  paymentDescription: string;
  paymentMethod: string;
  productName: string;
  quantity: string;
  reference: string;
  unit: string;
  unitPrice: string;
}

const HISTORY_PAGE_SIZE = 12;
const RECENT_ENTRY_LIMIT = 5;

const entryTypeLabels: Record<string, { label: string; color: string }> = {
  ADJUSTMENT: { label: "Điều chỉnh", color: "bg-slate-50 text-slate-700 border-slate-200" },
  OPENING_BALANCE: { label: "Số dư chốt", color: "bg-blue-50 text-blue-700 border-blue-200" },
  PAYMENT: { label: "Thanh toán", color: "bg-green-50 text-green-700 border-green-200" },
  PURCHASE: { label: "Mua hàng", color: "bg-red-50 text-red-700 border-red-200" },
  RETURN: { label: "Trả hàng", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

const entryModeLabels: Record<EntryMode, string> = {
  PAYMENT: "Thanh toán",
  PURCHASE: "Mua hàng",
  RETURN: "Trả hàng",
};

const partnerTypeLabels: Record<string, string> = {
  OTHER: "Khác",
  SERVICE_PARTNER: "Đối tác dịch vụ",
  SUPPLIER: "Nhà cung cấp",
};

function createEmptyEntryForm(mode: EntryMode = "PURCHASE"): EntryFormState {
  return {
    discountPercent: "",
    entryDate: todayVietnamText(),
    entryMode: mode,
    notes: "",
    paymentAmount: "",
    paymentDescription: "",
    paymentMethod: "",
    productName: "",
    quantity: "1",
    reference: "",
    unit: "",
    unitPrice: "",
  };
}

function formatMoney(value: number | null | undefined) {
  const amount = Number(value || 0);
  const prefix = amount < 0 ? "-" : "";
  return `${prefix}${Math.abs(amount).toLocaleString("vi-VN")}đ`;
}

function parseQuantityText(value: string) {
  const parsed = Number.parseFloat(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatDate(value: string | null) {
  if (!value) return "Chưa có ngày";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() <= 1900) return "Chưa có ngày";
  return formatVietnamDate(value) || "Chưa có ngày";
}

function formatEntryAmount(entry: Pick<PartnerEntryData, "amount" | "countsInDebt">) {
  return !entry.countsInDebt && entry.amount === 0 ? "—" : formatMoney(entry.amount);
}

function upsertPartner(partners: PartnerData[], nextPartner: PartnerData) {
  const exists = partners.some((partner) => partner.id === nextPartner.id);
  if (!exists) return [nextPartner, ...partners].sort((first, second) => first.name.localeCompare(second.name, "vi"));
  return partners.map((partner) => (partner.id === nextPartner.id ? nextPartner : partner));
}

function getPartnerStats(partner: PartnerData) {
  const fallbackTotals = summarizePartnerLedgerEntries(partner.ledgerEntries);

  return {
    countedPaid: fallbackTotals.countedPaid,
    countedPurchased: fallbackTotals.countedPurchased,
    countedReturned: fallbackTotals.countedReturned,
    latest: partner.ledgerEntries[0] || null,
    openingBalance: partner.totals.openingBalance ?? fallbackTotals.openingBalance,
    paid: partner.totals.paid ?? fallbackTotals.paid,
    purchased: partner.totals.purchased ?? fallbackTotals.purchased,
    referenceOnly: partner.totals.referenceOnly ?? fallbackTotals.referenceOnly,
    returned: partner.totals.returned ?? fallbackTotals.returned,
  };
}

export default function AdminPartnerLedgerClient({
  initialPartners,
  partnerImportEnabled = false,
}: {
  initialPartners: PartnerData[];
  partnerImportEnabled?: boolean;
}) {
  const { showToast, showConfirm } = useNotify();
  const partnerFormRef = useRef<HTMLFormElement | null>(null);
  const partnerFirstFieldRef = useRef<HTMLInputElement | null>(null);
  const entryDialogPanelRef = useRef<HTMLFormElement | null>(null);
  const entryProductRef = useRef<HTMLInputElement | null>(null);
  const entryPaymentAmountRef = useRef<HTMLInputElement | null>(null);
  const [partners, setPartners] = useState(initialPartners);
  const [selectedPartnerId, setSelectedPartnerId] = useState(
    () => getVisibleDebtPartners(initialPartners)[0]?.id || initialPartners[0]?.id || ""
  );
  const [partnerQuery, setPartnerQuery] = useState("");
  const [historyTimePreset, setHistoryTimePreset] = useState<AdminTimePreset>("ALL");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyCustomFromDate, setHistoryCustomFromDate] = useState("");
  const [historyCustomToDate, setHistoryCustomToDate] = useState("");
  const [historyType, setHistoryType] = useState<EntryFilter>("ALL");
  const [historyScope, setHistoryScope] = useState<EntryScope>("SELECTED");
  const [historyPage, setHistoryPage] = useState(1);
  const [showPartnerForm, setShowPartnerForm] = useState(false);
  const [entryDialogMode, setEntryDialogMode] = useState<EntryMode | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showHistoryFilters, setShowHistoryFilters] = useState(false);
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

  const visibleDebtPartners = useMemo(() => getVisibleDebtPartners(partners), [partners]);
  const selectedPartner = visibleDebtPartners.find((partner) => partner.id === selectedPartnerId) || visibleDebtPartners[0] || partners[0] || null;
  const selectedStats = selectedPartner ? getPartnerStats(selectedPartner) : null;
  const entryQuantity = parseQuantityText(entryForm.quantity);
  const entryUnitPrice = parseMoneyText(entryForm.unitPrice);
  const entryDiscountPercent = parsePartnerDiscountPercent(entryForm.discountPercent);
  const isEntryDiscountValid = entryDiscountPercent === null
    || (entryDiscountPercent >= 0 && entryDiscountPercent <= 100);
  const entryPurchaseAmounts = calculatePartnerPurchaseAmounts(
    entryQuantity,
    entryUnitPrice,
    isEntryDiscountValid ? entryDiscountPercent : null
  );
  const entryLineTotal = entryForm.entryMode === "PURCHASE"
    ? entryPurchaseAmounts.netAmount
    : entryPurchaseAmounts.grossAmount;
  const isPaymentMode = entryForm.entryMode === "PAYMENT";

  const focusPanel = useCallback((panel: HTMLElement | null, target: HTMLElement | null) => {
    window.setTimeout(() => {
      panel?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    }, 80);
  }, []);

  const metrics = useMemo(() => {
    return visibleDebtPartners.reduce(
      (summary, partner) => {
        const stats = getPartnerStats(partner);
        summary.balance += partner.balance;
        summary.entries += partner.ledgerEntries.length;
        summary.paid += stats.paid;
        summary.purchased += stats.purchased;
        summary.returned += stats.returned;
        if (partner.balance > 0) summary.payablePartners += 1;
        return summary;
      },
      { balance: 0, entries: 0, paid: 0, payablePartners: 0, purchased: 0, returned: 0 }
    );
  }, [visibleDebtPartners]);

  const getFilteredPartners = useCallback((value: string) => {
    const query = value.trim().toLowerCase();
    if (!query) return visibleDebtPartners;

    return visibleDebtPartners.filter((partner) =>
      partner.name.toLowerCase().includes(query)
      || partner.code.toLowerCase().includes(query)
      || (partner.phone || "").toLowerCase().includes(query)
      || (partner.notes || "").toLowerCase().includes(query)
    );
  }, [visibleDebtPartners]);

  const filteredPartners = useMemo(() => getFilteredPartners(partnerQuery), [getFilteredPartners, partnerQuery]);

  const updatePartnerQuery = useCallback((value: string) => {
    setPartnerQuery(value);

    const matches = getFilteredPartners(value);
    if (matches.length === 0) return;

    const selectedStillVisible = matches.some((partner) => partner.id === selectedPartnerId);
    if (!selectedStillVisible) {
      setSelectedPartnerId(matches[0].id);
    }
  }, [getFilteredPartners, selectedPartnerId]);

  useEffect(() => {
    if (filteredPartners.length === 0) return;
    const selectedStillVisible = filteredPartners.some((partner) => partner.id === selectedPartnerId);
    if (!selectedStillVisible) {
      setSelectedPartnerId(filteredPartners[0].id);
    }
  }, [filteredPartners, selectedPartnerId]);

  const allEntries = useMemo<VisibleEntry[]>(() => {
    return visibleDebtPartners
      .flatMap((partner) =>
        partner.ledgerEntries.map((entry) => ({
          ...entry,
          partnerCode: partner.code,
          partnerName: partner.name,
        }))
      )
      .sort((first, second) => new Date(second.entryDate).getTime() - new Date(first.entryDate).getTime());
  }, [visibleDebtPartners]);

  const recentEntries = useMemo<VisibleEntry[]>(() => {
    if (!selectedPartner) return [];
    return selectedPartner.ledgerEntries.slice(0, RECENT_ENTRY_LIMIT).map((entry) => ({
      ...entry,
      partnerCode: selectedPartner.code,
      partnerName: selectedPartner.name,
    }));
  }, [selectedPartner]);

  const historyEntries = useMemo(() => {
    const query = historyQuery.trim().toLowerCase();
    const baseEntries = historyScope === "SELECTED" && selectedPartner
      ? allEntries.filter((entry) => entry.partnerId === selectedPartner.id)
      : allEntries;

    return baseEntries.filter((entry) => {
      const dateKey = getVietnamDateKey(entry.entryDate);
      const todayKey = getVietnamDateKey(new Date());
      const matchesType = historyType === "ALL" || entry.entryType === historyType;
      const matchesTime = matchesAdminTimePreset(
        dateKey,
        historyTimePreset,
        todayKey,
        historyCustomFromDate,
        historyCustomToDate
      );
      const matchesSearch = !query
        || entry.partnerName.toLowerCase().includes(query)
        || entry.partnerCode.toLowerCase().includes(query)
        || entry.description.toLowerCase().includes(query)
        || (entry.reference || "").toLowerCase().includes(query)
        || (entry.notes || "").toLowerCase().includes(query)
        || (entry.sourceName || "").toLowerCase().includes(query)
        || (entry.sourceCode || "").toLowerCase().includes(query);
      return matchesType && matchesTime && matchesSearch;
    });
  }, [allEntries, historyCustomFromDate, historyCustomToDate, historyQuery, historyScope, historyTimePreset, historyType, selectedPartner]);

  const historyStats = useMemo(() => {
    return historyEntries.reduce(
      (summary, entry) => {
        if (entry.entryType === "PURCHASE") summary.purchased += entry.amount;
        if (entry.entryType === "PAYMENT") summary.paid += entry.amount;
        if (entry.entryType === "RETURN") summary.returned += entry.amount;
        return summary;
      },
      { paid: 0, purchased: 0, returned: 0 }
    );
  }, [historyEntries]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyCustomFromDate, historyCustomToDate, historyQuery, historyScope, historyTimePreset, historyType, selectedPartnerId]);

  useEffect(() => {
    if (!showPartnerForm) return;
    focusPanel(partnerFormRef.current, partnerFirstFieldRef.current);
  }, [focusPanel, showPartnerForm]);

  useEffect(() => {
    if (!entryDialogMode) return;
    const target = entryForm.entryMode === "PAYMENT" ? entryPaymentAmountRef.current : entryProductRef.current;
    focusPanel(entryDialogPanelRef.current, target);
  }, [entryDialogMode, entryForm.entryMode, focusPanel]);

  const historyPageCount = Math.max(1, Math.ceil(historyEntries.length / HISTORY_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyPageCount);
  const visibleHistoryEntries = historyEntries.slice(
    (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
    currentHistoryPage * HISTORY_PAGE_SIZE
  );

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

  const openEntryDialog = (mode: EntryMode = "PURCHASE") => {
    setEntryForm((current) => ({ ...createEmptyEntryForm(mode), entryDate: current.entryDate || todayVietnamText() }));
    setEntryDialogMode(mode);
  };

  const togglePartnerForm = () => {
    setShowPartnerForm((current) => !current);
  };

  const closeEntryDialog = () => {
    if (isSavingEntry) return;
    setEntryDialogMode(null);
    setEntryForm(createEmptyEntryForm());
  };

  const saveEntry = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedPartner) {
      showToast("Chưa chọn đối tác.", "error");
      return;
    }

    const productName = entryForm.productName.trim();
    const paymentDescription = entryForm.paymentDescription.trim();
    const amount = isPaymentMode ? parseMoneyText(entryForm.paymentAmount) : entryLineTotal;

    if (!isPaymentMode && !productName) {
      showToast("Vui lòng nhập tên mặt hàng.", "error");
      return;
    }

    if (entryForm.entryMode === "PURCHASE" && !isEntryDiscountValid) {
      showToast("Chiết khấu phải nằm trong khoảng 0 đến 100%.", "error");
      return;
    }

    const hasValidLineInputs = entryPurchaseAmounts.grossAmount > 0;
    if ((isPaymentMode && amount <= 0) || (!isPaymentMode && !hasValidLineInputs)) {
      showToast(isPaymentMode ? "Vui lòng nhập số tiền thanh toán." : "Vui lòng nhập số lượng và đơn giá hợp lệ.", "error");
      return;
    }

    setIsSavingEntry(true);
    try {
      const response = await fetch("/api/admin/partner-ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          countsInDebt: true,
          description: isPaymentMode ? paymentDescription || `Thanh toán cho ${selectedPartner.name}` : productName,
          discountPercent: entryForm.entryMode === "PURCHASE" ? entryDiscountPercent ?? "" : "",
          entryDate: entryForm.entryDate,
          entryType: entryForm.entryMode,
          notes: entryForm.notes.trim(),
          partnerId: selectedPartner.id,
          paymentMethod: isPaymentMode ? entryForm.paymentMethod.trim() : "",
          quantity: isPaymentMode ? "" : entryQuantity,
          reference: entryForm.reference.trim(),
          unit: isPaymentMode ? "" : entryForm.unit.trim(),
          unitPrice: isPaymentMode ? "" : entryUnitPrice,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        showToast(data.message || "Chưa ghi được giao dịch.", "error");
        return;
      }

      setPartners((current) => upsertPartner(current, data.partner));
      setSelectedPartnerId(data.partner.id);
      setEntryDialogMode(null);
      setEntryForm(createEmptyEntryForm(entryForm.entryMode));
      showToast(`Đã ghi ${entryModeLabels[entryForm.entryMode].toLowerCase()}.`, "success");
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
    showConfirm("Xuất sổ đối tác hiện tại trên web sang tab WEB_Đơn đối tác? Tab nhập Đơn đối tác và tab đơn hàng sẽ không bị ghi hoặc xoá.", async () => {
      setSyncingSheet(true);
      try {
        const response = await fetch("/api/admin/sheets-sync?scope=partners", { method: "POST" });
        const data = await response.json();

        if (!response.ok || !data.success) {
          showToast(data.message || "Chưa xuất được dữ liệu web sang Google Sheet.", "error");
          return;
        }

        showToast("Đã xuất sổ đối tác từ web sang Google Sheet.", "success");
      } catch {
        showToast("Kết nối bị gián đoạn khi xuất web sang Google Sheet.", "error");
      } finally {
        setSyncingSheet(false);
      }
    }, "Xuất");
  };

  const renderEntryCard = (entry: VisibleEntry, compact = false) => {
    const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
    const meta = getPartnerEntryDisplayDetails(entry);
    const amountLabel = getPartnerEntryAmountLabel(entry.entryType);
    const historyNote = getPartnerEntryHistoryNote(entry.countsInDebt);
    const amountTone = entry.entryType === "PURCHASE"
      ? "text-red-700"
      : entry.entryType === "PAYMENT"
        ? "text-green-700"
        : entry.entryType === "RETURN"
          ? "text-amber-700"
          : "text-slate-700";

    return (
      <div key={entry.id} className={`rounded-lg border border-slate-100 bg-white p-4 shadow-sm ${deletingEntryId === entry.id ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-heading text-base font-extrabold text-slate-900">{entry.description}</p>
            <p className="mt-1 font-body text-sm text-slate-600">{entry.partnerName} · {formatDate(entry.entryDate)}</p>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>{type.label}</span>
        </div>
        <p className="mt-3 font-body text-xs font-bold text-slate-500">{amountLabel}</p>
        <p className={`mt-0.5 font-heading text-xl font-extrabold tabular-nums ${amountTone}`}>
          {formatEntryAmount(entry)}
        </p>
        {meta ? <p className="mt-2 font-body text-sm text-slate-600">{meta}</p> : null}
        {historyNote ? <p className="mt-2 font-body text-sm font-semibold text-amber-700">{historyNote}</p> : null}
        {entry.reference ? <p className="mt-2 font-body text-sm text-slate-600">Mã chứng từ: {entry.reference}</p> : null}
        {!compact && entry.countsInDebt && entry.notes ? <p className="mt-1 break-words font-body text-sm text-slate-500">{entry.notes}</p> : null}
        <button
          type="button"
          onClick={() => deleteEntry(entry)}
          disabled={deletingEntryId === entry.id}
          className="mt-3 min-h-11 rounded-lg bg-red-50 px-4 py-2 text-sm font-body font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
        >
          Xoá
        </button>
      </div>
    );
  };

  return (
    <div data-testid="dashboard-partner-ledger" className="space-y-5 animate-fade-in-up">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-body text-xs font-bold uppercase tracking-wider text-red-600">Sổ phải trả đối tác</p>
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Đối Tác & Mua Hàng</h2>
          <p className="font-body text-sm text-slate-600">
            Mua hàng làm tăng số Minh Hồng phải trả; thanh toán và trả hàng làm giảm số phải trả.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={syncGoogleSheet}
            disabled={syncingSheet}
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white disabled:bg-slate-300"
          >
            {syncingSheet ? "Đang xuất…" : "Xuất sang Sheet"}
          </button>
          <button
            type="button"
            onClick={togglePartnerForm}
            data-testid="partner-add-button"
            className="min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
          >
            + Đối tác
          </button>
          <button
            type="button"
            data-testid="partner-open-entry-top"
            onClick={() => openEntryDialog("PURCHASE")}
            className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-body font-bold text-white hover:bg-red-700"
          >
            Ghi giao dịch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-slate-500">Tổng tiền mua</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">{formatMoney(metrics.purchased)}</p>
        </div>
        <div className="rounded-lg border border-green-100 bg-green-50 p-4 sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-green-700">Đã thanh toán</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-green-700">{formatMoney(metrics.paid)}</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-4 sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-amber-700">Đã trả hàng</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-amber-700">{formatMoney(metrics.returned)}</p>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50 p-4 sm:p-5">
          <p className="font-body text-xs uppercase tracking-wider text-red-700">Minh Hồng cần trả</p>
          <p className="mt-1 font-heading text-2xl font-extrabold text-red-700">{formatMoney(metrics.balance)}</p>
          <p className="mt-1 font-body text-xs text-red-700">{metrics.payablePartners} đối tác còn phải trả</p>
        </div>
      </div>

      {partnerImportEnabled ? (
        <MinhHongWorkbookImportPanel scope="partners" onImported={() => window.location.reload()} />
      ) : null}

      {showPartnerForm ? (
        <form ref={partnerFormRef} onSubmit={savePartner} className="scroll-mt-24 rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="font-body text-xs font-bold text-slate-700">Tên đối tác</span>
              <input
                ref={partnerFirstFieldRef}
                data-testid="partner-form-name"
                value={partnerForm.name}
                onChange={(event) => setPartnerForm({ ...partnerForm, name: event.target.value })}
                placeholder="Ví dụ: Long"
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">Mã</span>
              <input
                value={partnerForm.code}
                onChange={(event) => setPartnerForm({ ...partnerForm, code: event.target.value })}
                placeholder="LONG"
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">SĐT</span>
              <input
                value={partnerForm.phone}
                onChange={(event) => setPartnerForm({ ...partnerForm, phone: event.target.value })}
                placeholder="Tuỳ chọn"
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
            <label className="space-y-1.5">
              <span className="font-body text-xs font-bold text-slate-700">Nhóm</span>
              <select
                value={partnerForm.type}
                onChange={(event) => setPartnerForm({ ...partnerForm, type: event.target.value })}
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
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
                className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={isSavingPartner} className="min-h-11 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
              {isSavingPartner ? "Đang lưu..." : "Lưu đối tác"}
            </button>
            <button type="button" onClick={() => setShowPartnerForm(false)} className="min-h-11 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-700">
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-heading text-base font-extrabold text-slate-900">Chọn đối tác</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-body font-bold text-slate-600">{filteredPartners.length}</span>
          </div>
          <input
            value={partnerQuery}
            onChange={(event) => updatePartnerQuery(event.target.value)}
            placeholder="Tìm theo tên, mã, SĐT"
            className="mt-3 min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
            data-testid="partner-search-input"
          />
          <select
            value={selectedPartner?.id || ""}
            onChange={(event) => setSelectedPartnerId(event.target.value)}
            className="mt-3 min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
            title="Chọn đối tác"
            data-testid="partner-select"
          >
            {filteredPartners.map((partner) => (
              <option key={partner.id} value={partner.id}>{partner.name} · {formatMoney(partner.balance)}</option>
            ))}
          </select>
          {filteredPartners.length === 0 ? (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 font-body text-sm text-slate-600">Không có đối tác phù hợp.</p>
          ) : null}
        </aside>

        <section className="min-w-0 space-y-4">
          {selectedPartner ? (
            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-body text-xs font-bold uppercase tracking-wider text-slate-500">Đối tác đang xem</p>
                  <h3 className="mt-1 font-heading text-xl font-extrabold text-slate-900">{selectedPartner.name}</h3>
                  <p className="font-body text-sm text-slate-600">{selectedPartner.phone || "Chưa có SĐT"} · {partnerTypeLabels[selectedPartner.type] || selectedPartner.type}</p>
                </div>
                <button
                  type="button"
                  data-testid="partner-open-entry-selected"
                  onClick={() => openEntryDialog("PURCHASE")}
                  className="min-h-11 rounded-lg bg-red-600 px-4 py-2 text-sm font-body font-bold text-white hover:bg-red-700"
                >
                  Ghi giao dịch
                </button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="font-body text-xs font-bold text-slate-600">Tổng tiền mua</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">{formatMoney(selectedStats?.purchased || 0)}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <p className="font-body text-xs font-bold text-green-700">Đã thanh toán</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-green-700">{formatMoney(selectedStats?.paid || 0)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="font-body text-xs font-bold text-amber-700">Đã trả hàng</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-amber-700">{formatMoney(selectedStats?.returned || 0)}</p>
                </div>
                <div className="rounded-lg bg-red-50 p-3">
                  <p className="font-body text-xs font-bold text-red-700">Minh Hồng cần trả</p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-red-700">{formatMoney(selectedPartner.balance)}</p>
                </div>
              </div>
              <div className="mt-3">
                <p className="rounded-lg bg-slate-50 px-3 py-2 font-body text-sm text-slate-600">
                  Giao dịch gần nhất: <strong>{selectedStats?.latest ? formatDate(selectedStats.latest.entryDate) : "Chưa có"}</strong>
                </p>
              </div>
              {selectedPartner.notes ? <p className="mt-3 font-body text-sm text-slate-500">{selectedPartner.notes}</p> : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-heading text-lg font-extrabold text-slate-900">Giao dịch gần nhất</h3>
                <p className="font-body text-sm text-slate-600">{recentEntries.length} giao dịch mới nhất của {selectedPartner?.name || "đối tác"}.</p>
              </div>
              <button
                type="button"
                data-testid="partner-open-history"
                onClick={() => {
                  setShowHistoryFilters(false);
                  setShowHistoryDialog(true);
                }}
                className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-body font-bold text-white hover:bg-slate-800"
              >
                Xem tất cả giao dịch
              </button>
            </div>
            <div className="mt-4" data-testid="partner-recent-entries">
              {recentEntries.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-8 text-center font-body text-sm text-slate-500">Chưa có giao dịch nào cho đối tác này.</p>
              ) : (
                <>
                  <div className="space-y-3 lg:hidden">
                    {recentEntries.map((entry) => renderEntryCard(entry, true))}
                  </div>
                  <div className="hidden overflow-hidden rounded-lg border border-slate-100 lg:block">
                    <div className="overflow-x-auto">
                      <table className="min-w-[920px] w-full border-collapse text-left font-body text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                          <tr>
                            <th className="px-4 py-3">Ngày</th>
                            <th className="px-4 py-3">Loại</th>
                            <th className="px-4 py-3">Tên mặt hàng / Nội dung thanh toán</th>
                            <th className="px-4 py-3">Chi tiết</th>
                            <th className="px-4 py-3 text-right">Thành tiền</th>
                            <th className="px-4 py-3">Chứng từ</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recentEntries.map((entry) => {
                            const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
                            const meta = getPartnerEntryDisplayDetails(entry);
                            const historyNote = getPartnerEntryHistoryNote(entry.countsInDebt);
                            return (
                              <tr key={entry.id} className={deletingEntryId === entry.id ? "opacity-60" : ""}>
                                <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(entry.entryDate)}</td>
                                <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>{type.label}</span></td>
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-slate-900">{entry.description}</p>
                                  {historyNote ? <p className="mt-1 text-xs font-semibold text-amber-700">{historyNote}</p> : null}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-600">{meta || "-"}</td>
                                <td className="px-4 py-3 text-right font-bold text-slate-900">{formatEntryAmount(entry)}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{entry.reference || "-"}</td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => deleteEntry(entry)}
                                    disabled={deletingEntryId === entry.id}
                                    className="min-h-10 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
                                  >
                                    Xoá
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {entryDialogMode ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/35 p-0 sm:items-center sm:justify-center sm:p-4" data-testid="partner-entry-dialog">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Đóng ghi giao dịch" onClick={closeEntryDialog} />
          <form ref={entryDialogPanelRef} onSubmit={saveEntry} className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-lg bg-white p-4 shadow-2xl sm:max-w-[min(94vw,1040px)] sm:rounded-lg sm:p-5">
            <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:-mx-5 sm:-mt-5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg font-extrabold text-slate-900">Ghi giao dịch</h3>
                  <p className="font-body text-sm text-slate-600">{selectedPartner ? `Đang ghi cho ${selectedPartner.name}` : "Chọn đối tác trước khi ghi."}</p>
                </div>
                <button
                  type="button"
                  data-testid="partner-entry-close"
                  onClick={closeEntryDialog}
                  className="min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-6 lg:grid-cols-12">
              <div className="md:col-span-2 lg:col-span-3">
                <VietnameseDateInput
                  label="Ngày"
                  name="partnerEntryDate"
                  value={entryForm.entryDate}
                  onChange={(value) => setEntryForm({ ...entryForm, entryDate: value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-4 lg:col-span-9">
                <span className="font-body text-xs font-bold text-slate-700">Loại giao dịch</span>
                <div className="grid grid-cols-3 gap-2">
                  {(["PURCHASE", "PAYMENT", "RETURN"] as EntryMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`partner-entry-mode-${mode}`}
                      onClick={() => setEntryForm((current) => ({ ...createEmptyEntryForm(mode), entryDate: current.entryDate, reference: current.reference }))}
                      className={`min-h-11 rounded-lg px-3 py-2 text-sm font-body font-bold ${entryForm.entryMode === mode ? "bg-red-600 text-white" : "bg-slate-100 text-slate-700"}`}
                    >
                      {entryModeLabels[mode]}
                    </button>
                  ))}
                </div>
              </div>

              {isPaymentMode ? (
                <>
                  <label className="space-y-1.5 md:col-span-2 lg:col-span-3">
                    <span className="font-body text-xs font-bold text-slate-700">Số tiền thanh toán</span>
                    <input
                      ref={entryPaymentAmountRef}
                      inputMode="numeric"
                      data-testid="partner-entry-payment-amount"
                      value={entryForm.paymentAmount}
                      onChange={(event) => setEntryForm({ ...entryForm, paymentAmount: event.target.value })}
                      onBlur={() => setEntryForm((current) => ({ ...current, paymentAmount: formatMoneyInputValue(current.paymentAmount) }))}
                      placeholder="Ví dụ: 1000k"
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-2 lg:col-span-6">
                    <span className="font-body text-xs font-bold text-slate-700">Nội dung thanh toán</span>
                    <input
                      value={entryForm.paymentDescription}
                      onChange={(event) => setEntryForm({ ...entryForm, paymentDescription: event.target.value })}
                      placeholder="Ví dụ: chuyển khoản trả Long"
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-2 lg:col-span-3">
                    <span className="font-body text-xs font-bold text-slate-700">Phương thức</span>
                    <input
                      value={entryForm.paymentMethod}
                      onChange={(event) => setEntryForm({ ...entryForm, paymentMethod: event.target.value })}
                      placeholder="Tiền mặt / CK"
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                </>
              ) : (
                <>
                  <label className="space-y-1.5 md:col-span-3 lg:col-span-5">
                    <span className="font-body text-xs font-bold text-slate-700">Tên mặt hàng</span>
                    <input
                      ref={entryProductRef}
                      data-testid="partner-entry-product"
                      value={entryForm.productName}
                      onChange={(event) => setEntryForm({ ...entryForm, productName: event.target.value })}
                      placeholder={entryForm.entryMode === "RETURN" ? "Ví dụ: trả lại cell lỗi" : "Ví dụ: 300 cell EVE 25P"}
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-1 lg:col-span-2">
                    <span className="font-body text-xs font-bold text-slate-700">Số lượng</span>
                    <input
                      inputMode="decimal"
                      data-testid="partner-entry-quantity"
                      value={entryForm.quantity}
                      onChange={(event) => setEntryForm({ ...entryForm, quantity: event.target.value })}
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-1 lg:col-span-2">
                    <span className="font-body text-xs font-bold text-slate-700">Đơn vị</span>
                    <input
                      value={entryForm.unit}
                      onChange={(event) => setEntryForm({ ...entryForm, unit: event.target.value })}
                      placeholder="cell / chiếc"
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  <label className="space-y-1.5 md:col-span-1 lg:col-span-3">
                    <span className="font-body text-xs font-bold text-slate-700">Đơn giá</span>
                    <input
                      inputMode="numeric"
                      data-testid="partner-entry-unit-price"
                      value={entryForm.unitPrice}
                      onChange={(event) => setEntryForm({ ...entryForm, unitPrice: event.target.value })}
                      onBlur={() => setEntryForm((current) => ({ ...current, unitPrice: formatMoneyInputValue(current.unitPrice) }))}
                      placeholder="Ví dụ: 25k"
                      className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                    />
                  </label>
                  {entryForm.entryMode === "PURCHASE" ? (
                    <label className="space-y-1.5 md:col-span-1 lg:col-span-2">
                      <span className="font-body text-xs font-bold text-slate-700">Chiết khấu (%)</span>
                      <div className="relative">
                        <input
                          inputMode="decimal"
                          data-testid="partner-entry-discount"
                          value={entryForm.discountPercent}
                          onChange={(event) => setEntryForm({ ...entryForm, discountPercent: event.target.value })}
                          placeholder="Ví dụ: 15"
                          className="min-h-11 w-full rounded-lg border border-slate-200 py-3 pl-4 pr-10 text-sm font-body outline-none focus:border-red-400"
                        />
                        <span
                          aria-hidden="true"
                          data-testid="partner-entry-discount-suffix"
                          className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-body text-sm font-bold text-slate-500"
                        >
                          %
                        </span>
                      </div>
                      <p className="font-body text-xs text-slate-500">Nhập 15 để áp dụng chiết khấu 15%.</p>
                    </label>
                  ) : null}
                  <div className={`rounded-lg border px-4 py-3 md:col-span-3 lg:col-span-4 ${entryForm.entryMode === "RETURN" ? "border-amber-100 bg-amber-50" : "border-red-100 bg-red-50"}`}>
                    {entryForm.entryMode === "PURCHASE" ? (
                      <div className="mb-2 space-y-1 border-b border-red-100 pb-2 font-body text-xs text-slate-600">
                        <p>Tạm tính: <strong data-testid="partner-entry-gross-total">{formatMoney(entryPurchaseAmounts.grossAmount)}</strong></p>
                        <p>Chiết khấu: <strong className="text-emerald-700" data-testid="partner-entry-discount-amount">{entryPurchaseAmounts.discountAmount > 0 ? "-" : ""}{formatMoney(entryPurchaseAmounts.discountAmount)}</strong></p>
                      </div>
                    ) : null}
                    <p className={`font-body text-xs font-bold uppercase tracking-wider ${entryForm.entryMode === "RETURN" ? "text-amber-700" : "text-red-700"}`}>{entryForm.entryMode === "RETURN" ? "Tổng tiền trả hàng" : "Phải trả sau chiết khấu"}</p>
                    <p className={`mt-1 font-heading text-2xl font-extrabold ${entryForm.entryMode === "RETURN" ? "text-amber-700" : "text-red-700"}`} data-testid="partner-entry-total">{formatMoney(entryLineTotal)}</p>
                  </div>
                </>
              )}

              <label className="space-y-1.5 md:col-span-3 lg:col-span-4">
                <span className="font-body text-xs font-bold text-slate-700">Chứng từ</span>
                <input
                  value={entryForm.reference}
                  onChange={(event) => setEntryForm({ ...entryForm, reference: event.target.value })}
                  placeholder="Mã chuyển khoản, số phiếu hoặc link ảnh"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                />
              </label>
              <label className="space-y-1.5 md:col-span-3 lg:col-span-4">
                <span className="font-body text-xs font-bold text-slate-700">Ghi chú</span>
                <input
                  value={entryForm.notes}
                  onChange={(event) => setEntryForm({ ...entryForm, notes: event.target.value })}
                  placeholder={entryForm.entryMode === "RETURN" ? "Lý do trả hàng" : "Ghi chú nội bộ"}
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus:border-red-400"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="submit" data-testid="partner-entry-submit" disabled={isSavingEntry || !selectedPartner} className="min-h-11 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-body font-bold text-white disabled:bg-slate-300">
                {isSavingEntry ? "Đang ghi..." : `Ghi ${entryModeLabels[entryForm.entryMode].toLowerCase()}`}
              </button>
              <button type="button" onClick={closeEntryDialog} className="min-h-11 rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-body font-bold text-slate-700">
                Hủy
              </button>
              {selectedPartner ? (
                <p className="font-body text-sm font-semibold text-slate-600">
                  Minh Hồng cần trả {selectedPartner.name}: {formatMoney(selectedPartner.balance)}.
                </p>
              ) : null}
            </div>
          </form>
        </div>
      ) : null}

      {showHistoryDialog ? (
        <div className="fixed inset-0 z-50 flex items-end overscroll-contain bg-slate-950/35 p-0 sm:items-center sm:justify-center sm:p-4" data-testid="partner-history-dialog" role="dialog" aria-modal="true" aria-labelledby="partner-history-title">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Đóng lịch sử giao dịch"
            onClick={() => {
              setShowHistoryFilters(false);
              setShowHistoryDialog(false);
            }}
          />
          <div className="relative flex h-[94vh] w-full flex-col rounded-t-lg bg-white shadow-2xl sm:h-[92vh] sm:max-w-[min(96vw,1400px)] sm:rounded-lg">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 id="partner-history-title" className="font-heading text-lg font-extrabold text-slate-900 text-pretty">Lịch sử giao dịch</h3>
                  <p className="font-body text-sm text-slate-600">Đang hiển thị {historyEntries.length} giao dịch.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="partner-history-filter-toggle"
                    onClick={() => setShowHistoryFilters((current) => !current)}
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-50 sm:hidden"
                  >
                    {showHistoryFilters ? "Ẩn lọc" : "Lọc"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryFilters(false);
                      setShowHistoryDialog(false);
                    }}
                    className="min-h-11 rounded-lg bg-slate-100 px-4 py-2 text-sm font-body font-bold text-slate-700 hover:bg-slate-200"
                  >
                    Đóng
                  </button>
                </div>
              </div>
              <div
                data-testid="partner-history-filter-panel"
                className={`${showHistoryFilters ? "grid" : "hidden"} mt-3 gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:mt-4 sm:grid sm:grid-cols-2 sm:border-0 sm:bg-white sm:p-0 xl:grid-cols-5`}
              >
                <input
                  value={historyQuery}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Tìm tên hàng, chứng từ hoặc ghi chú…"
                  aria-label="Tìm trong lịch sử giao dịch"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-body outline-none focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100 md:col-span-2 xl:col-span-2"
                  data-testid="partner-history-search"
                />
                <select
                  value={historyTimePreset}
                  onChange={(event) => setHistoryTimePreset(event.target.value as AdminTimePreset)}
                  title="Lọc thời gian"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-body outline-none focus:border-red-400"
                  data-testid="partner-history-time-filter"
                >
                  {Object.entries(adminTimePresetLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                {historyTimePreset === "CUSTOM" ? (
                  <div className="md:col-span-2 xl:col-span-2">
                    <AdminVietnameseDateRangeFilter
                      fromDataTestId="partner-history-from-date"
                      fromName="partnerHistoryFromDate"
                      fromValue={historyCustomFromDate}
                      onFromChange={setHistoryCustomFromDate}
                      onToChange={setHistoryCustomToDate}
                      toDataTestId="partner-history-to-date"
                      toName="partnerHistoryToDate"
                      toValue={historyCustomToDate}
                      className="grid gap-3 sm:grid-cols-2"
                    />
                  </div>
                ) : null}
                <select
                  value={historyScope}
                  onChange={(event) => setHistoryScope(event.target.value as EntryScope)}
                  title="Phạm vi giao dịch"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="SELECTED">Đối tác đang xem</option>
                  <option value="ALL">Tất cả đối tác</option>
                </select>
                <select
                  value={historyType}
                  onChange={(event) => setHistoryType(event.target.value as EntryFilter)}
                  title="Loại giao dịch"
                  className="min-h-11 w-full rounded-lg border border-slate-200 px-3 py-3 text-sm font-body outline-none focus:border-red-400"
                >
                  <option value="ALL">Tất cả loại</option>
                  {Object.entries(entryTypeLabels).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
              </div>
              <p className="mt-3 font-body text-xs font-bold text-slate-500">Tổng giá trị trong danh sách đang xem</p>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                <div className="rounded-lg bg-red-50 px-3 py-2">
                  <p className="font-body text-xs font-bold text-red-700">Mua hàng</p>
                  <p className="font-heading text-base font-extrabold text-red-700 tabular-nums">{formatMoney(historyStats.purchased)}</p>
                </div>
                <div className="rounded-lg bg-green-50 px-3 py-2">
                  <p className="font-body text-xs font-bold text-green-700">Đã thanh toán</p>
                  <p className="font-heading text-base font-extrabold text-green-700 tabular-nums">{formatMoney(historyStats.paid)}</p>
                </div>
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <p className="font-body text-xs font-bold text-amber-700">Đã trả hàng</p>
                  <p className="font-heading text-base font-extrabold text-amber-700 tabular-nums">{formatMoney(historyStats.returned)}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="font-body text-xs font-bold text-slate-600">Số giao dịch</p>
                  <p className="font-heading text-base font-extrabold text-slate-900">{historyEntries.length.toLocaleString("vi-VN")}</p>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5" data-testid="partner-history-results">
              <div className="space-y-3 lg:hidden">
                {visibleHistoryEntries.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-4 py-8 text-center font-body text-sm text-slate-500">Chưa có giao dịch nào khớp bộ lọc.</p>
                ) : visibleHistoryEntries.map((entry) => renderEntryCard(entry))}
              </div>

              <div className="hidden overflow-hidden rounded-lg border border-slate-100 lg:block">
                <div className="overflow-x-auto">
                  <table className="min-w-[1080px] w-full border-collapse text-left font-body text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Ngày</th>
                        <th className="px-4 py-3">Đối tác</th>
                        <th className="px-4 py-3">Loại</th>
                        <th className="px-4 py-3">Tên mặt hàng / Nội dung thanh toán</th>
                        <th className="px-4 py-3">Chi tiết</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-4 py-3">Chứng từ</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleHistoryEntries.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">Chưa có giao dịch nào khớp bộ lọc.</td>
                        </tr>
                      ) : visibleHistoryEntries.map((entry) => {
                        const type = entryTypeLabels[entry.entryType] || entryTypeLabels.PURCHASE;
                        const meta = getPartnerEntryDisplayDetails(entry);
                        const historyNote = getPartnerEntryHistoryNote(entry.countsInDebt);
                        return (
                          <tr key={entry.id} className={deletingEntryId === entry.id ? "opacity-60" : ""}>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(entry.entryDate)}</td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{entry.partnerName}</p>
                              <p className="text-xs text-slate-500">{entry.partnerCode}</p>
                            </td>
                            <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${type.color}`}>{type.label}</span></td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-800">{entry.description}</p>
                              {historyNote ? <p className="mt-1 text-xs font-semibold text-amber-700">{historyNote}</p> : null}
                              {entry.countsInDebt && entry.notes ? <p className="mt-1 break-words text-xs text-slate-500">{entry.notes}</p> : null}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600">{meta || "-"}</td>
                            <td className="px-4 py-3 text-right font-bold text-slate-900">{formatEntryAmount(entry)}</td>
                            <td className="px-4 py-3 text-xs text-slate-600">{entry.reference || "-"}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => deleteEntry(entry)}
                                disabled={deletingEntryId === entry.id}
                                className="min-h-10 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600 disabled:bg-slate-100 disabled:text-slate-300"
                              >
                                Xoá
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 p-4 sm:p-5">
              <PaginationControls
                itemLabel="giao dịch"
                labelTestId="partner-history-page-label"
                onPageChange={setHistoryPage}
                page={currentHistoryPage}
                pageCount={historyPageCount}
                pageSize={HISTORY_PAGE_SIZE}
                totalItems={historyEntries.length}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
