import { parseAdminDateInput } from "@/lib/admin-date";
import { parseMoneyText } from "@/lib/money";
import { sanitizeText } from "@/lib/sanitize";

export interface LegacyPurchaseRow {
  code?: unknown;
  date?: unknown;
  debtPartner?: unknown;
  sourceName?: unknown;
  description?: unknown;
  category?: unknown;
  quantity?: unknown;
  unit?: unknown;
  unitPrice?: unknown;
  amount?: unknown;
  receivedGoods?: unknown;
  countsInDebt?: unknown;
  sourceRow?: unknown;
}

export interface LegacyPaymentRow {
  code?: unknown;
  date?: unknown;
  partner?: unknown;
  amount?: unknown;
  paymentMethod?: unknown;
  notes?: unknown;
  countsInDebt?: unknown;
  sourceRow?: unknown;
}

export interface LegacyReturnRow {
  code?: unknown;
  date?: unknown;
  partner?: unknown;
  description?: unknown;
  category?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  amount?: unknown;
  countsInDebt?: unknown;
  notes?: unknown;
  sourceRow?: unknown;
}

export interface LegacyCustomerOrderRow {
  code?: unknown;
  date?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  productName?: unknown;
  totalAmount?: unknown;
  paidAmount?: unknown;
  debtAmount?: unknown;
  notes?: unknown;
  dataStatus?: unknown;
  sourceRow?: unknown;
}

export interface LegacyWorkbookRows {
  purchases: LegacyPurchaseRow[];
  payments: LegacyPaymentRow[];
  returns: LegacyReturnRow[];
  customerOrders: LegacyCustomerOrderRow[];
}

export interface LegacyPartnerEntryImport {
  amount: number;
  category: string | null;
  countsInDebt: boolean;
  description: string;
  entryDate: string;
  entryType: "OPENING_BALANCE" | "PURCHASE" | "PAYMENT" | "RETURN";
  notes: string | null;
  partnerCode: string;
  partnerName: string;
  paymentMethod: string | null;
  quantity: number | null;
  reference: string | null;
  receivedGoods: boolean | null;
  sourceCode: string;
  sourceName: string | null;
  sourceRow: number | null;
  unit: string | null;
  unitPrice: number | null;
}

export interface LegacyServiceOrderImport {
  customerName: string;
  customerPhone: string;
  issueDescription: string | null;
  notes: string | null;
  orderCode: string;
  orderDate: string;
  paidAmount: number;
  priceStatus: "CONFIRMED" | "FREE" | "LEGACY_MISSING";
  productName: string;
  quotedPrice: number | null;
  service: "KHAC";
  source: "IMPORT";
  sourceName: string;
  sourceRow: number | null;
  status: "COMPLETED" | "PENDING";
}

function compactKey(value: unknown) {
  return sanitizeText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseDateText(value: unknown) {
  const parsed = parseAdminDateInput(value);
  if (!parsed) return todayFallback();

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayFallback() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseOptionalQuantity(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalMoney(value: unknown) {
  const parsed = parseMoneyText(value);
  return parsed > 0 ? parsed : null;
}

export function isLegacyDebtCounted(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "boolean") return value;
  const normalized = compactKey(value);
  return ["co", "có", "yes", "true", "1", "tinh", "tính"].includes(normalized);
}

function parseLegacyOptionalBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  const normalized = compactKey(value);
  if (["co", "có", "yes", "true", "1", "da", "đã"].includes(normalized)) return true;
  if (["khong", "không", "no", "false", "0", "chua", "chưa"].includes(normalized)) return false;
  return null;
}

function joinNotes(...parts: Array<string | null | undefined>) {
  return parts.map((part) => sanitizeText(part || "")).filter(Boolean).join(" · ") || null;
}

function buildLegacyEntryNotes(base: unknown, countsInDebt: boolean, isOpeningBalance: boolean, receivedGoods?: boolean | null) {
  const receivedNote = receivedGoods === null || receivedGoods === undefined ? "" : `Đã nhận hàng: ${receivedGoods ? "Có" : "Không"}`;
  const confirmedBalanceNote = isOpeningBalance
    ? "Số dư do Minh Hồng xác nhận đến 07/05/2026; nếu bảng cũ có chênh lệch thì ưu tiên số dư chốt này, từ 08/05/2026 trở đi tính theo từng dòng có Tính công nợ = Có."
    : "";
  const referenceOnlyNote = !countsInDebt
    ? "Dòng cũ để đối chiếu, đã nằm trong số dư chốt Minh Hồng xác nhận nên không cộng lại vào số Minh Hồng phải trả."
    : "";

  return joinNotes(String(base || ""), receivedNote, confirmedBalanceNote, referenceOnlyNote);
}

function buildPartnerCode(name: string) {
  return sanitizeText(name)
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "LEGACY_PARTNER";
}

function buildSourceCode(prefix: string, code: unknown, sourceRow: number | null) {
  const rawCode = sanitizeText(String(code || ""));
  if (rawCode) return `${prefix}:${rawCode}`;
  return `${prefix}:ROW-${sourceRow || "UNKNOWN"}`;
}

function buildLegacyPlaceholderPhone(sourceRow: number | null) {
  return `099${String(sourceRow || 0).padStart(7, "0").slice(-7)}`;
}

function isOpeningBalanceRow(row: LegacyPurchaseRow) {
  const source = compactKey(row.sourceName);
  const description = compactKey(row.description);
  return source.includes("chot cong no")
    || source.includes("chốt công nợ")
    || description.includes("no tam tinh")
    || description.includes("nợ tạm tính");
}

export function buildLegacyPartnerEntries(rows: LegacyWorkbookRows) {
  const purchaseEntries: LegacyPartnerEntryImport[] = rows.purchases.map((row) => {
    const partnerName = sanitizeText(String(row.debtPartner || "Long"));
    const sourceRow = parseOptionalInt(row.sourceRow);
    const amount = parseMoneyText(row.amount);
    const openingBalance = isOpeningBalanceRow(row);
    const entryType = openingBalance ? "OPENING_BALANCE" : "PURCHASE";
    const description = sanitizeText(String(row.description || "Mua hàng cũ"));
    const countsInDebt = isLegacyDebtCounted(row.countsInDebt);
    const receivedGoods = parseLegacyOptionalBoolean(row.receivedGoods);

    return {
      amount,
      category: sanitizeText(String(row.category || "")) || null,
      countsInDebt,
      description,
      entryDate: parseDateText(row.date),
      entryType,
      notes: buildLegacyEntryNotes(null, countsInDebt, openingBalance, receivedGoods),
      partnerCode: buildPartnerCode(partnerName),
      partnerName,
      paymentMethod: null,
      quantity: parseOptionalQuantity(row.quantity),
      reference: sanitizeText(String(row.code || "")) || null,
      receivedGoods,
      sourceCode: buildSourceCode("NHAP_HANG", row.code, sourceRow),
      sourceName: sanitizeText(String(row.sourceName || "")) || null,
      sourceRow,
      unit: sanitizeText(String(row.unit || "")) || null,
      unitPrice: parseOptionalMoney(row.unitPrice),
    };
  });

  const paymentEntries: LegacyPartnerEntryImport[] = rows.payments.map((row) => {
    const partnerName = sanitizeText(String(row.partner || "Long"));
    const sourceRow = parseOptionalInt(row.sourceRow);
    const countsInDebt = isLegacyDebtCounted(row.countsInDebt);

    return {
      amount: parseMoneyText(row.amount),
      category: null,
      countsInDebt,
      description: sanitizeText(String(row.notes || "Thanh toán cho đối tác")) || "Thanh toán cho đối tác",
      entryDate: parseDateText(row.date),
      entryType: "PAYMENT",
      notes: buildLegacyEntryNotes(row.notes, countsInDebt, false),
      partnerCode: buildPartnerCode(partnerName),
      partnerName,
      paymentMethod: sanitizeText(String(row.paymentMethod || "")) || null,
      quantity: null,
      reference: sanitizeText(String(row.code || "")) || null,
      receivedGoods: null,
      sourceCode: buildSourceCode("THANH_TOAN", row.code, sourceRow),
      sourceName: null,
      sourceRow,
      unit: null,
      unitPrice: null,
    };
  });

  const returnEntries: LegacyPartnerEntryImport[] = rows.returns.map((row) => {
    const partnerName = sanitizeText(String(row.partner || "Long"));
    const sourceRow = parseOptionalInt(row.sourceRow);
    const countsInDebt = isLegacyDebtCounted(row.countsInDebt);

    return {
      amount: parseMoneyText(row.amount),
      category: sanitizeText(String(row.category || "")) || null,
      countsInDebt,
      description: sanitizeText(String(row.description || "Trả hàng cho đối tác")) || "Trả hàng cho đối tác",
      entryDate: parseDateText(row.date),
      entryType: "RETURN",
      notes: buildLegacyEntryNotes(row.notes, countsInDebt, false),
      partnerCode: buildPartnerCode(partnerName),
      partnerName,
      paymentMethod: null,
      quantity: parseOptionalQuantity(row.quantity),
      reference: sanitizeText(String(row.code || "")) || null,
      receivedGoods: null,
      sourceCode: buildSourceCode("TRA_HANG", row.code, sourceRow),
      sourceName: null,
      sourceRow,
      unit: null,
      unitPrice: parseOptionalMoney(row.unitPrice),
    };
  });

  return [...purchaseEntries, ...paymentEntries, ...returnEntries].filter((entry) => entry.amount > 0 && entry.partnerName);
}

export function buildLegacyServiceOrders(rows: LegacyWorkbookRows) {
  return rows.customerOrders.map((row) => {
    const totalAmount = parseMoneyText(row.totalAmount);
    const paidAmount = parseMoneyText(row.paidAmount);
    const dataStatus = compactKey(row.dataStatus);
    const sourceRow = parseOptionalInt(row.sourceRow);
    const isMissingPrice = dataStatus.includes("quen gia") || dataStatus.includes("quên giá");
    const priceStatus = isMissingPrice ? "LEGACY_MISSING" : totalAmount === 0 ? "FREE" : "CONFIRMED";
    const customerPhone = sanitizeText(String(row.customerPhone || ""));
    const notes = [
      sanitizeText(String(row.notes || "")),
      customerPhone ? "" : `Sheet cũ thiếu SĐT, dùng SĐT tạm theo dòng ${sourceRow || "không rõ"}`,
      dataStatus ? `Trạng thái dữ liệu cũ: ${sanitizeText(String(row.dataStatus || ""))}` : "",
      sourceRow ? `Dòng gốc sheet: ${sourceRow}` : "",
      row.debtAmount !== undefined && row.debtAmount !== null && row.debtAmount !== "" ? `Còn nợ cũ: ${parseMoneyText(row.debtAmount).toLocaleString("vi-VN")}đ` : "",
    ].filter(Boolean).join(" · ");

    return {
      customerName: sanitizeText(String(row.customerName || "Khách cũ")),
      customerPhone: customerPhone || buildLegacyPlaceholderPhone(sourceRow),
      issueDescription: null,
      notes: notes || null,
      orderCode: sanitizeText(String(row.code || `LEGACY-${sourceRow || Date.now()}`)).toUpperCase(),
      orderDate: parseDateText(row.date),
      paidAmount: priceStatus === "CONFIRMED" ? Math.min(paidAmount, totalAmount) : paidAmount,
      priceStatus,
      productName: sanitizeText(String(row.productName || "Đơn cũ từ sheet")),
      quotedPrice: priceStatus === "CONFIRMED" ? totalAmount : priceStatus === "FREE" ? 0 : null,
      service: "KHAC",
      source: "IMPORT",
      sourceName: "Đơn hàng đã bán",
      sourceRow,
      status: paidAmount >= totalAmount && totalAmount > 0 ? "COMPLETED" : "PENDING",
    } satisfies LegacyServiceOrderImport;
  }).filter((order) => order.productName);
}

export function summarizeLegacyImport(rows: LegacyWorkbookRows) {
  const partnerEntries = buildLegacyPartnerEntries(rows);
  const serviceOrders = buildLegacyServiceOrders(rows);

  return {
    countedPayableDelta: partnerEntries.reduce((sum, entry) => {
      if (!entry.countsInDebt) return sum;
      if (entry.entryType === "PAYMENT" || entry.entryType === "RETURN") return sum - entry.amount;
      return sum + entry.amount;
    }, 0),
    partnerEntries: partnerEntries.length,
    partnerReferenceOnly: partnerEntries.filter((entry) => !entry.countsInDebt).length,
    serviceOrders: serviceOrders.length,
    totalLegacyPaid: partnerEntries.filter((entry) => entry.entryType === "PAYMENT").reduce((sum, entry) => sum + entry.amount, 0),
    totalLegacyPurchased: partnerEntries.filter((entry) => entry.entryType === "PURCHASE").reduce((sum, entry) => sum + entry.amount, 0),
    totalLegacyReturned: partnerEntries.filter((entry) => entry.entryType === "RETURN").reduce((sum, entry) => sum + entry.amount, 0),
  };
}
