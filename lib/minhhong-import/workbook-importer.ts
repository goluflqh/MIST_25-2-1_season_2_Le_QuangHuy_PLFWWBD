import { parseAdminDateInput } from "@/lib/admin-date";
import { getImportedFallbackOrderDate, isImportedOrderDateFallback } from "@/lib/admin-order-display";
import { normalizePhone, sanitizeText } from "@/lib/sanitize";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranties";
import { formatVietnamDate, getVietnamDateKey } from "@/lib/vietnam-time";
import {
  APPROVED_DUPLICATE_WARRANTY_PAIRS,
  APPROVED_INITIAL_ORDER_GROUPS,
  APPROVED_STANDALONE_WARRANTY_LINKS,
  isApprovedInitialOrderMatch,
  reconcileApprovedInitialCustomerOrders,
} from "./initial-reconciliation";
import type { MinhHongImportScope } from "./import-scope";
import { getServiceOrderInvalidDateSourceRows, reconcileMinhHongWorkbook } from "./reconciliation";
import type { MinhHongParsedCustomerOrder, MinhHongParsedPartner, MinhHongParsedPartnerEntry, MinhHongParsedWorkbook } from "./workbook-parser";

interface ImportTransaction {
  partner: {
    findMany(args: { where: { code: { in: string[] } } }): Promise<Array<Record<string, unknown>>>;
    findUnique(args: { where: { code: string } }): Promise<Record<string, unknown> | null>;
    upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  partnerLedgerEntry: {
    findMany(args: { where: { sourceCode: { in: string[] } } }): Promise<Array<Record<string, unknown>>>;
    findUnique(args: { where: { sourceCode: string } }): Promise<Record<string, unknown> | null>;
    upsert(args: { where: { sourceCode: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  customer: {
    upsert(args: { where: { phone: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  serviceOrder: {
    findMany(args: { where: Record<string, unknown>; include?: Record<string, unknown> }): Promise<Array<Record<string, unknown>>>;
    findUnique(args: { where: { id?: string; orderCode?: string; sourceCode?: string }; include?: Record<string, unknown> }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { id?: string; orderCode?: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  warranty: {
    findUnique(args: { where: { serialNo?: string; serviceOrderId?: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  auditLog?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
}

export interface ImportRunner extends ImportTransaction {
  $transaction<T>(
    callback: (tx: ImportTransaction) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T>;
}

export interface MinhHongImportOptions {
  scope?: MinhHongImportScope;
  userId?: string;
}

interface ImportPlanOptions {
  scope?: MinhHongImportScope;
}

export interface MinhHongImportChangeCounts {
  created: number;
  updated: number;
  unchanged: number;
}

export interface MinhHongImportFieldChange {
  after: string;
  before: string;
  field: string;
  label: string;
}

export interface MinhHongImportChangeRecord {
  action: "created" | "updated";
  changes?: MinhHongImportFieldChange[];
  key: string;
  label: string;
}

export interface MinhHongImportPreview {
  partners: MinhHongImportChangeCounts;
  partnerEntries: MinhHongImportChangeCounts;
  serviceOrders: MinhHongImportChangeCounts;
  conflicts: string[];
  warranties: {
    archivedDuplicates: number;
    linked: number;
    unchanged: number;
  };
  records: {
    partners?: MinhHongImportChangeRecord[];
    partnerEntries: MinhHongImportChangeRecord[];
    serviceOrders: MinhHongImportChangeRecord[];
  };
}

export interface MinhHongImportSummary {
  partnersUpserted: number;
  partnerEntriesUpserted: number;
  customersUpserted: number;
  serviceOrdersUpserted: number;
  sourceSheetDateRepairs?: number;
  skippedRows: number;
  warnings: string[];
  changes: MinhHongImportPreview;
}

type ImportAction = "created" | "updated" | "unchanged";

interface PartnerPlanItem {
  action: ImportAction;
  code: string;
  data: Record<string, unknown>;
  existing: Record<string, unknown> | null;
}

interface PartnerEntryPlanItem {
  action: ImportAction | "conflict";
  entry: MinhHongParsedPartnerEntry;
  matchSourceCode: string;
}

interface ServiceOrderPlanItem {
  action: ImportAction | "conflict";
  approvedInitialMatch: boolean;
  existing: Record<string, unknown> | null;
  order: MinhHongParsedCustomerOrder;
}

type WarrantyPlanItem =
  | {
      action: "archive-duplicate";
      canonicalSerialNo: string;
      duplicateSerialNo: string;
    }
  | {
      action: "link";
      serialNo: string;
      sourceCode: string;
    };

interface ImportPlan {
  preview: MinhHongImportPreview;
  partners: PartnerPlanItem[];
  partnerEntries: PartnerEntryPlanItem[];
  serviceOrders: ServiceOrderPlanItem[];
  warranties: WarrantyPlanItem[];
}

export class MinhHongWorkbookImportError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "MinhHongWorkbookImportError";
  }
}

function asId(record: Record<string, unknown>) {
  return sanitizeText(String(record.id || ""));
}

function comparableValue(value: unknown) {
  if (value instanceof Date) return value.getTime();
  return value ?? null;
}

function recordMatches(existing: Record<string, unknown>, data: Record<string, unknown>) {
  return Object.entries(data).every(([key, value]) => comparableValue(existing[key]) === comparableValue(value));
}

type FieldChangeConfig = {
  format?: (value: unknown) => string;
  hideInPreview?: boolean;
  label: string;
};

type FieldChangeMap = Record<string, string | FieldChangeConfig>;

function fieldChangeConfig(value: string | FieldChangeConfig | undefined, fallback: string): FieldChangeConfig {
  if (!value) return { label: fallback };
  if (typeof value === "string") return { label: value };
  return value;
}

function formatDiffValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Trống";
  if (value instanceof Date) return formatVietnamDate(value) || value.toISOString();
  if (typeof value === "boolean") return value ? "Có" : "Không";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  return sanitizeText(String(value)) || "Trống";
}

function formatMoneyDiffValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Trống";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return formatDiffValue(value);
  return `${amount.toLocaleString("vi-VN")}đ`;
}

function formatDateDiffValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "Trống";
  if (value instanceof Date) return formatVietnamDate(value) || value.toISOString();
  if (typeof value === "string") return formatVietnamDate(value) || sanitizeText(value) || "Trống";
  return formatDiffValue(value);
}

function recordChanges(existing: Record<string, unknown>, data: Record<string, unknown>, labels: FieldChangeMap) {
  return Object.entries(data).flatMap(([field, value]) => {
    if (comparableValue(existing[field]) === comparableValue(value)) return [];
    const config = fieldChangeConfig(labels[field], field);
    if (config.hideInPreview) return [];
    const formatter = config.format || formatDiffValue;
    return [{
      after: formatter(value),
      before: formatter(existing[field]),
      field,
      label: config.label,
    }];
  });
}

function emptyChangeCounts(): MinhHongImportChangeCounts {
  return { created: 0, updated: 0, unchanged: 0 };
}

function countAction(counts: MinhHongImportChangeCounts, action: ImportAction) {
  counts[action] += 1;
}

function toDate(value: string, sourceRow: number | null) {
  return parseAdminDateInput(value) || getImportedFallbackOrderDate(sourceRow);
}

function toOrderDate(value: string, sourceRow: number | null) {
  return parseAdminDateInput(value) || getImportedFallbackOrderDate(sourceRow);
}

function partnerType(partner: MinhHongParsedPartner) {
  const text = `${partner.partnerType} ${partner.notes}`.toLocaleLowerCase("vi-VN");
  if (text.includes("dịch vụ")) return "SERVICE_PARTNER";
  if (text.includes("dự phòng") || text.includes("tham khảo")) return "OTHER";
  return "SUPPLIER";
}

function isActivePartner(partner: MinhHongParsedPartner) {
  return !partner.status.toLocaleLowerCase("vi-VN").includes("ngưng");
}

function partnerData(partner: MinhHongParsedPartner) {
  return {
    code: partner.partnerCode,
    name: partner.partnerName,
    phone: partner.phone || null,
    type: partnerType(partner),
    notes: partner.notes || null,
    active: isActivePartner(partner),
    deletedAt: null,
  };
}

function buildPlaceholderPhone(sourceRow: number | null) {
  return `099${String(sourceRow || 0).padStart(7, "0").slice(-7)}`;
}

function priceStatus(order: MinhHongParsedCustomerOrder) {
  if (order.priceStatus === "LEGACY_MISSING") return "LEGACY_MISSING";
  if (order.quotedPrice === 0) return "FREE";
  if (order.quotedPrice === null) return "PENDING_QUOTE";
  return "CONFIRMED";
}

function serviceOrderStatus(order: MinhHongParsedCustomerOrder) {
  if (order.priceStatus === "LEGACY_MISSING") return "PENDING";
  return "COMPLETED";
}

function ledgerData(entry: MinhHongParsedPartnerEntry, partnerId: string) {
  return {
    partnerId,
    entryType: entry.entryType,
    entryDate: toDate(entry.entryDate, entry.sourceRow),
    amount: entry.amount,
    discountAmount: entry.discountAmount,
    discountPercent: entry.discountPercent,
    description: entry.description,
    reference: entry.reference,
    category: entry.category,
    quantity: entry.quantity,
    unit: entry.unit,
    unitPrice: entry.unitPrice,
    sourceName: entry.sourceSheet,
    sourceCode: entry.sourceCode,
    sourceRow: entry.sourceRow,
    paymentMethod: entry.paymentMethod,
    receivedGoods: entry.receivedGoods,
    countsInDebt: entry.countsInDebt,
    notes: entry.notes,
    deletedAt: null,
  };
}

function customerPhone(order: MinhHongParsedCustomerOrder) {
  return sanitizeText(order.customerPhone) || buildPlaceholderPhone(order.sourceRow);
}

function mergeNotes(...values: unknown[]) {
  return [...new Set(values
    .map((value) => sanitizeText(String(value || "")))
    .filter(Boolean))]
    .join(" · ") || null;
}

function serviceOrderData(order: MinhHongParsedCustomerOrder, customerId: string, existingOrderCode?: string) {
  const phone = customerPhone(order);
  const status = serviceOrderStatus(order);
  const warrantyMonths = DEFAULT_WARRANTY_MONTHS;
  return {
    orderCode: existingOrderCode || order.orderCode,
    customerId,
    customerName: order.customerName || "Khách chưa rõ tên",
    customerPhone: phone,
    service: "KHAC",
    productName: order.productName || "Đơn khách cũ",
    issueDescription: order.productName || null,
    solution: null,
    status,
    source: "IMPORT",
    sourceName: "Đơn khách",
    sourceCode: order.sourceCode,
    sourceRow: order.sourceRow,
    orderDate: toOrderDate(order.orderDate, order.sourceRow),
    quotedPrice: order.quotedPrice,
    priceStatus: priceStatus(order),
    paidAmount: order.paidAmount,
    warrantyMonths,
    warrantyEndDate: null,
    customerVisible: false,
    couponCode: null,
    couponDiscount: null,
    discountAmount: 0,
    notes: order.notes,
    deletedAt: null,
  };
}

function approvedExistingServiceOrderData(
  order: MinhHongParsedCustomerOrder,
  existing: Record<string, unknown>
) {
  const previousProduct = sanitizeText(String(existing.productName || ""));
  const nextProduct = order.productName || previousProduct || "Đơn khách cũ";
  const wordingNote = previousProduct && normalizedBusinessText(previousProduct) !== normalizedBusinessText(nextProduct)
    ? `Cách ghi trước đồng bộ: ${previousProduct}`
    : null;

  return {
    orderCode: String(existing.orderCode || order.orderCode),
    customerName: sanitizeText(String(existing.customerName || "")) || order.customerName || "Khách chưa rõ tên",
    customerPhone: sanitizeText(String(existing.customerPhone || "")) || customerPhone(order),
    service: sanitizeText(String(existing.service || "")) || "KHAC",
    productName: nextProduct,
    issueDescription: existing.issueDescription || order.productName || null,
    solution: existing.solution ?? null,
    status: sanitizeText(String(existing.status || "")) || serviceOrderStatus(order),
    source: sanitizeText(String(existing.source || "")) || "IMPORT",
    sourceName: "Đơn khách",
    sourceCode: order.sourceCode,
    sourceRow: order.sourceRow,
    orderDate: toOrderDate(order.orderDate, order.sourceRow),
    quotedPrice: order.quotedPrice,
    priceStatus: priceStatus(order),
    paidAmount: order.paidAmount,
    warrantyMonths: existing.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
    warrantyEndDate: existing.warrantyEndDate ?? null,
    customerVisible: Boolean(existing.customerVisible),
    discountAmount: Number(existing.discountAmount || 0),
    notes: mergeNotes(existing.notes, order.notes, wordingNote),
    deletedAt: null,
  };
}

function serviceOrderBusinessData(order: MinhHongParsedCustomerOrder, existing?: Record<string, unknown> | null) {
  if (existing && isApprovedInitialOrderMatch(order, existing.orderCode)) {
    return approvedExistingServiceOrderData(order, existing);
  }
  return Object.fromEntries(
    Object.entries(serviceOrderData(
      order,
      "preview-customer",
      existing?.orderCode ? String(existing.orderCode) : undefined
    )).filter(([key]) => key !== "customerId")
  );
}

function normalizedBusinessText(value: unknown) {
  return sanitizeText(String(value ?? ""))
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");
}

function normalizedBusinessDate(value: unknown) {
  const date = parseAdminDateInput(value);
  return date ? getVietnamDateKey(date) : normalizedBusinessText(value);
}

function normalizedBusinessNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : normalizedBusinessText(value);
}

function normalizedBusinessBoolean(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return value === true;
}

function normalizedCustomerIdentity(name: unknown, phone: unknown, sourceRow: unknown) {
  const normalizedPhone = normalizePhone(sanitizeText(String(phone ?? "")));
  const row = typeof sourceRow === "number" && Number.isFinite(sourceRow) ? sourceRow : null;
  return {
    name: normalizedBusinessText(name) || normalizedBusinessText("Khách chưa rõ tên"),
    phone: normalizedPhone === buildPlaceholderPhone(row) ? "" : normalizedPhone,
  };
}

function serviceOrderRolloutSignature(order: MinhHongParsedCustomerOrder) {
  return JSON.stringify({
    customer: normalizedCustomerIdentity(order.customerName, order.customerPhone, order.sourceRow),
    notes: normalizedBusinessText(order.notes),
    orderDate: normalizedBusinessDate(order.orderDate),
    paidAmount: normalizedBusinessNumber(order.paidAmount),
    priceStatus: normalizedBusinessText(priceStatus(order)),
    productName: normalizedBusinessText(order.productName) || normalizedBusinessText("Đơn khách cũ"),
    quotedPrice: normalizedBusinessNumber(order.quotedPrice),
  });
}

function existingServiceOrderRolloutSignature(order: Record<string, unknown>) {
  return JSON.stringify({
    customer: normalizedCustomerIdentity(order.customerName, order.customerPhone, order.sourceRow),
    notes: normalizedBusinessText(order.notes),
    orderDate: isImportedOrderDateFallback(order) ? "" : normalizedBusinessDate(order.orderDate),
    paidAmount: normalizedBusinessNumber(order.paidAmount),
    priceStatus: normalizedBusinessText(order.priceStatus),
    productName: normalizedBusinessText(order.productName) || normalizedBusinessText("Đơn khách cũ"),
    quotedPrice: normalizedBusinessNumber(order.quotedPrice),
  });
}

function serviceOrderAnchorDate(value: unknown, sourceRow: unknown) {
  const parsedDate = parseAdminDateInput(value);
  const row = typeof sourceRow === "number" && Number.isFinite(sourceRow) ? sourceRow : null;
  return getVietnamDateKey(parsedDate || getImportedFallbackOrderDate(row));
}

function serviceOrderAnchorSignature(order: MinhHongParsedCustomerOrder) {
  return JSON.stringify({
    customer: normalizedCustomerIdentity(order.customerName, order.customerPhone, order.sourceRow),
    orderDate: serviceOrderAnchorDate(order.orderDate, order.sourceRow),
    productName: normalizedBusinessText(order.productName),
  });
}

function hasStableServiceOrderAnchor(order: MinhHongParsedCustomerOrder, existing: Record<string, unknown>) {
  const incomingCustomer = normalizedCustomerIdentity(order.customerName, order.customerPhone, order.sourceRow);
  const existingCustomer = normalizedCustomerIdentity(existing.customerName, existing.customerPhone, existing.sourceRow);
  const sameCustomer = incomingCustomer.phone && existingCustomer.phone
    ? incomingCustomer.phone === existingCustomer.phone
    : incomingCustomer.name === existingCustomer.name;

  return sameCustomer
    && normalizedBusinessText(order.productName) === normalizedBusinessText(existing.productName)
    && serviceOrderAnchorDate(order.orderDate, order.sourceRow) === serviceOrderAnchorDate(existing.orderDate, existing.sourceRow);
}

function canRefreshDerivedServiceOrderIdentity(
  order: MinhHongParsedCustomerOrder,
  existing: Record<string, unknown>,
  incomingSourceCodes: Set<string>
) {
  const existingSourceCode = sanitizeText(String(existing.sourceCode || ""));
  const existingSourceRow = Number(existing.sourceRow);
  if (!existingSourceCode || !order.sourceRow || !Number.isFinite(existingSourceRow)) return false;
  if (existingSourceRow !== order.sourceRow || incomingSourceCodes.has(existingSourceCode)) return false;
  return hasStableServiceOrderAnchor(order, existing);
}

function partnerEntryRolloutSignature(entry: MinhHongParsedPartnerEntry, partnerId: string | null) {
  return JSON.stringify({
    amount: normalizedBusinessNumber(entry.amount),
    category: normalizedBusinessText(entry.category),
    countsInDebt: normalizedBusinessBoolean(entry.countsInDebt),
    description: normalizedBusinessText(entry.description),
    discountAmount: normalizedBusinessNumber(entry.discountAmount),
    discountPercent: normalizedBusinessNumber(entry.discountPercent),
    entryDate: normalizedBusinessDate(entry.entryDate),
    entryType: normalizedBusinessText(entry.entryType),
    notes: normalizedBusinessText(entry.notes),
    partnerId: normalizedBusinessText(partnerId),
    paymentMethod: normalizedBusinessText(entry.paymentMethod),
    quantity: normalizedBusinessNumber(entry.quantity),
    receivedGoods: normalizedBusinessBoolean(entry.receivedGoods),
    sourceName: normalizedBusinessText(entry.sourceSheet),
    unit: normalizedBusinessText(entry.unit),
    unitPrice: normalizedBusinessNumber(entry.unitPrice),
  });
}

function existingPartnerEntryRolloutSignature(entry: Record<string, unknown>) {
  return JSON.stringify({
    amount: normalizedBusinessNumber(entry.amount),
    category: normalizedBusinessText(entry.category),
    countsInDebt: normalizedBusinessBoolean(entry.countsInDebt),
    description: normalizedBusinessText(entry.description),
    discountAmount: normalizedBusinessNumber(entry.discountAmount),
    discountPercent: normalizedBusinessNumber(entry.discountPercent),
    entryDate: normalizedBusinessDate(entry.entryDate),
    entryType: normalizedBusinessText(entry.entryType),
    notes: normalizedBusinessText(entry.notes),
    partnerId: normalizedBusinessText(entry.partnerId),
    paymentMethod: normalizedBusinessText(entry.paymentMethod),
    quantity: normalizedBusinessNumber(entry.quantity),
    receivedGoods: normalizedBusinessBoolean(entry.receivedGoods),
    sourceName: normalizedBusinessText(entry.sourceName),
    unit: normalizedBusinessText(entry.unit),
    unitPrice: normalizedBusinessNumber(entry.unitPrice),
  });
}

function partnerEntryRolloutIdentitySignature(entry: MinhHongParsedPartnerEntry, partnerId: string | null) {
  const signature = JSON.parse(partnerEntryRolloutSignature(entry, partnerId)) as Record<string, unknown>;
  delete signature.entryDate;
  return JSON.stringify(signature);
}

function existingPartnerEntryRolloutIdentitySignature(entry: Record<string, unknown>) {
  const signature = JSON.parse(existingPartnerEntryRolloutSignature(entry)) as Record<string, unknown>;
  delete signature.entryDate;
  return JSON.stringify(signature);
}

function duplicateRolloutSignatures(signatures: string[]) {
  const counts = new Map<string, number>();
  for (const signature of signatures) {
    counts.set(signature, (counts.get(signature) || 0) + 1);
  }
  return new Set([...counts].flatMap(([signature, count]) => count > 1 ? [signature] : []));
}

function legacyServiceOrderSourceCode(order: MinhHongParsedCustomerOrder) {
  return order.legacyOrderCode ? `DON_KHACH:${order.legacyOrderCode}` : null;
}

function serviceOrderPreviewLabel(order: MinhHongParsedCustomerOrder) {
  return [
    order.sourceRow ? `Dòng Excel ${order.sourceRow}` : "",
    order.customerName,
    order.productName,
  ].filter(Boolean).join(" · ") || order.orderCode;
}

const partnerFieldLabels: FieldChangeMap = {
  active: "Đang dùng",
  code: "Mã đối tác",
  deletedAt: { label: "Trạng thái xóa", format: formatDateDiffValue },
  name: "Tên đối tác",
  notes: "Ghi chú",
  phone: "Số điện thoại",
  type: "Nhóm đối tác",
};

const partnerEntryFieldLabels: FieldChangeMap = {
  amount: { label: "Số tiền", format: formatMoneyDiffValue },
  discountAmount: { label: "Tiền chiết khấu", format: formatMoneyDiffValue },
  discountPercent: "Chiết khấu (%)",
  category: "Nhóm giao dịch",
  countsInDebt: "Tính vào công nợ",
  deletedAt: { label: "Trạng thái xóa", format: formatDateDiffValue },
  description: "Nội dung",
  entryDate: { label: "Ngày giao dịch", format: formatDateDiffValue },
  entryType: "Loại giao dịch",
  notes: "Ghi chú",
  partnerId: "Đối tác",
  paymentMethod: "Phương thức thanh toán",
  quantity: "Số lượng",
  receivedGoods: "Đã nhận hàng",
  reference: "Chứng từ",
  sourceCode: { label: "Mã dòng Sheet", hideInPreview: true },
  sourceName: "Tab nguồn",
  sourceRow: "Dòng Excel",
  unit: "Đơn vị",
  unitPrice: { label: "Đơn giá", format: formatMoneyDiffValue },
};

const serviceOrderFieldLabels: FieldChangeMap = {
  couponCode: "Mã giảm giá",
  couponDiscount: "Ưu đãi giảm giá",
  customerName: "Tên khách",
  customerPhone: "Số điện thoại",
  customerVisible: "Hiện cho khách",
  deletedAt: { label: "Trạng thái xóa", format: formatDateDiffValue },
  discountAmount: { label: "Số tiền giảm", format: formatMoneyDiffValue },
  issueDescription: "Mô tả vấn đề",
  notes: "Ghi chú",
  orderCode: "Mã đơn",
  orderDate: { label: "Ngày đơn", format: formatDateDiffValue },
  paidAmount: { label: "Đã thu", format: formatMoneyDiffValue },
  priceStatus: "Trạng thái giá",
  productName: "Sản phẩm/dịch vụ",
  quotedPrice: { label: "Giá báo", format: formatMoneyDiffValue },
  service: "Loại dịch vụ",
  solution: "Cách xử lý",
  source: "Nguồn dữ liệu",
  sourceCode: { label: "Mã dòng Sheet", hideInPreview: true },
  sourceName: "Tab nguồn",
  sourceRow: "Dòng Excel",
  status: "Trạng thái đơn",
  warrantyEndDate: { label: "Hạn bảo hành", format: formatDateDiffValue },
  warrantyMonths: "Số tháng bảo hành",
};

function hasInvalidTypedOrderDate(order: MinhHongParsedCustomerOrder) {
  const value = sanitizeText(order.orderDate);
  return Boolean(value && !parseAdminDateInput(value));
}

async function buildImportPlan(tx: ImportTransaction, parsed: MinhHongParsedWorkbook, options: ImportPlanOptions = {}): Promise<ImportPlan> {
  const scope = options.scope || "service-orders";
  const includePartnerLedger = scope !== "service-orders";
  const includeServiceOrders = scope !== "partners";
  const invalidServiceOrderDateRows = scope === "service-orders"
    ? getServiceOrderInvalidDateSourceRows(parsed)
    : new Set<number>();
  const preview: MinhHongImportPreview = {
    partners: emptyChangeCounts(),
    partnerEntries: emptyChangeCounts(),
    serviceOrders: emptyChangeCounts(),
    conflicts: [],
    warranties: { archivedDuplicates: 0, linked: 0, unchanged: 0 },
    records: { partners: [], partnerEntries: [], serviceOrders: [] },
  };
  const partnerPlans: PartnerPlanItem[] = [];
  const partnerIds = new Map<string, string>();

  if (includePartnerLedger) {
    const existingPartners = new Map(
      (await tx.partner.findMany({
        where: { code: { in: parsed.partners.map((partner) => partner.partnerCode) } },
      })).map((partner) => [String(partner.code), partner])
    );

    for (const partner of parsed.partners) {
      const data = partnerData(partner);
      const existing = existingPartners.get(partner.partnerCode) || null;
      const action: ImportAction = !existing ? "created" : recordMatches(existing, data) ? "unchanged" : "updated";
      countAction(preview.partners, action);
      if (action !== "unchanged") {
        preview.records.partners?.push({
          action,
          changes: action === "updated" && existing ? recordChanges(existing, data, partnerFieldLabels) : [],
          key: partner.partnerCode,
          label: partner.partnerName,
        });
      }
      partnerPlans.push({ action, code: partner.partnerCode, data, existing });
      if (existing) partnerIds.set(partner.partnerCode, asId(existing));
    }
  }

  const partnerEntryPlans: PartnerEntryPlanItem[] = [];
  if (includePartnerLedger) {
    const duplicatePartnerEntryRolloutSignatures = duplicateRolloutSignatures(
      parsed.partnerEntries
        .filter((entry) => Boolean(entry.legacySourceCode))
        .map((entry) => partnerEntryRolloutSignature(entry, partnerIds.get(entry.partnerCode) || null))
    );
    const duplicatePartnerEntryRolloutIdentitySignatures = duplicateRolloutSignatures(
      parsed.partnerEntries
        .filter((entry) => Boolean(entry.legacySourceCode))
        .map((entry) => partnerEntryRolloutIdentitySignature(entry, partnerIds.get(entry.partnerCode) || null))
    );
    const partnerEntrySourceCodes = [...new Set(parsed.partnerEntries.flatMap((entry) => [
      entry.sourceCode,
      entry.legacySourceCode || "",
    ]).filter(Boolean))];
    const existingPartnerEntries = new Map(
      (await tx.partnerLedgerEntry.findMany({
        where: { sourceCode: { in: partnerEntrySourceCodes } },
      })).map((entry) => [String(entry.sourceCode), entry])
    );

    for (const entry of parsed.partnerEntries) {
      const stableMatch = existingPartnerEntries.get(entry.sourceCode) || null;
      const legacyMatch = entry.legacySourceCode
        ? existingPartnerEntries.get(entry.legacySourceCode) || null
        : null;
      if (stableMatch && legacyMatch && stableMatch !== legacyMatch) {
        preview.conflicts.push(`source_id của dòng ${entry.sourceCode} đang thuộc một giao dịch khác; chưa thể tự động hợp nhất.`);
        partnerEntryPlans.push({ action: "conflict", entry, matchSourceCode: entry.sourceCode });
        continue;
      }

      const partnerId = partnerIds.get(entry.partnerCode);
      if (!stableMatch && legacyMatch && entry.legacySourceCode) {
        const signature = partnerEntryRolloutSignature(entry, partnerId || null);
        const identitySignature = partnerEntryRolloutIdentitySignature(entry, partnerId || null);
        const isUniqueSignature = !duplicatePartnerEntryRolloutSignatures.has(signature);
        const matchesLegacyBusinessIdentity = Boolean(
          partnerId && (
            signature === existingPartnerEntryRolloutSignature(legacyMatch)
            || (
              !duplicatePartnerEntryRolloutIdentitySignatures.has(identitySignature)
              && identitySignature === existingPartnerEntryRolloutIdentitySignature(legacyMatch)
            )
          )
        );
        if (!isUniqueSignature || !matchesLegacyBusinessIdentity) {
          preview.conflicts.push(
            !isUniqueSignature
              ? `source_id của dòng ${entry.sourceCode} trùng dữ liệu nghiệp vụ trong lần gắn source_id đầu tiên; chưa thể tự động hợp nhất.`
              : `source_id của dòng ${entry.sourceCode} không khớp dữ liệu nghiệp vụ của giao dịch cũ; chưa thể tự động hợp nhất.`
          );
          partnerEntryPlans.push({
            action: "conflict",
            entry,
            matchSourceCode: String(legacyMatch.sourceCode),
          });
          continue;
        }
      }

      const existing = stableMatch || legacyMatch;
      const data = partnerId ? ledgerData(entry, partnerId) : null;
      const action: ImportAction = !existing
        ? "created"
        : data && recordMatches(existing, data)
          ? "unchanged"
          : "updated";
      countAction(preview.partnerEntries, action);
      if (action !== "unchanged") {
        const changes = action === "updated" && existing && data
          ? recordChanges(existing, data, partnerEntryFieldLabels).filter(
              (change) => change.field !== "entryDate" || Boolean(sanitizeText(entry.entryDate))
            )
          : [];
        preview.records.partnerEntries.push({
          action,
          changes,
          key: entry.sourceCode,
          label: entry.description,
        });
      }
      partnerEntryPlans.push({
        action,
        entry,
        matchSourceCode: existing ? String(existing.sourceCode) : entry.sourceCode,
      });
    }
  }

  const serviceOrderPlans: ServiceOrderPlanItem[] = [];
  const warrantyPlans: WarrantyPlanItem[] = [];
  if (includeServiceOrders) {
    const existingApprovedOrders = await tx.serviceOrder.findMany({
      where: { orderCode: { in: APPROVED_INITIAL_ORDER_GROUPS.map((group) => group.orderCode) } },
      include: { warranty: true },
    });
    const existingApprovedOrderCodes = new Set(existingApprovedOrders.map((order) => String(order.orderCode)));
    const standaloneWarrantiesBySourceCode = new Map<string, Record<string, unknown>>();
    for (const link of APPROVED_STANDALONE_WARRANTY_LINKS) {
      const warranty = await tx.warranty.findUnique({ where: { serialNo: link.serialNo } });
      if (warranty && !warranty.deletedAt) standaloneWarrantiesBySourceCode.set(link.sourceCode, warranty);
    }
    const incomingApprovedSourceCodes = new Set(parsed.customerOrders.map((order) => order.sourceCode));
    for (const group of APPROVED_INITIAL_ORDER_GROUPS) {
      if (!existingApprovedOrderCodes.has(group.orderCode) || group.sourceCodes.length === 1) continue;
      const presentRows = group.sourceCodes.filter((sourceCode) => incomingApprovedSourceCodes.has(sourceCode)).length;
      if (presentRows > 0 && presentRows < group.sourceCodes.length) {
        preview.conflicts.push(
          `Đơn ${group.orderCode} thiếu ${group.sourceCodes.length - presentRows}/${group.sourceCodes.length} dòng Sheet đã duyệt; chưa thể đồng bộ an toàn.`
        );
      }
    }
    const customerOrders = reconcileApprovedInitialCustomerOrders(
      parsed.customerOrders,
      existingApprovedOrderCodes
    ).map((order) => {
      const warranty = standaloneWarrantiesBySourceCode.get(order.sourceCode);
      if (!warranty || order.customerPhone) return order;
      return {
        ...order,
        customerName: order.customerName || sanitizeText(String(warranty.customerName || "")),
        customerPhone: sanitizeText(String(warranty.customerPhone || "")),
      };
    });
    const incomingServiceOrderSourceCodes = new Set(customerOrders.map((order) => order.sourceCode));
    const duplicateServiceOrderAnchorSignatures = duplicateRolloutSignatures(
      customerOrders.map(serviceOrderAnchorSignature)
    );
    const existingServiceOrderRows = await tx.serviceOrder.findMany({
      where: {
        OR: [
          { sourceCode: { in: customerOrders.map((order) => order.sourceCode) } },
          {
            orderCode: {
              in: [...new Set(customerOrders.flatMap((order) => [
                order.orderCode,
                order.legacyOrderCode || "",
              ]).filter(Boolean))],
            },
          },
        ],
      },
      include: { warranty: true },
    });
    const existingServiceOrdersBySourceCode = new Map(
      existingServiceOrderRows
        .filter((order) => order.sourceCode)
        .map((order) => [String(order.sourceCode), order])
    );
    const existingServiceOrdersByOrderCode = new Map(
      existingServiceOrderRows.map((order) => [String(order.orderCode), order])
    );
    const duplicateServiceOrderRolloutSignatures = duplicateRolloutSignatures(
      customerOrders
        .filter((order) => Boolean(order.legacyOrderCode))
        .map(serviceOrderRolloutSignature)
    );

    for (const order of customerOrders) {
      if (
        scope === "service-orders"
        && ((order.sourceRow && invalidServiceOrderDateRows.has(order.sourceRow)) || hasInvalidTypedOrderDate(order))
      ) {
        continue;
      }

      const sourceCodeMatch = existingServiceOrdersBySourceCode.get(order.sourceCode) || null;
      const orderCodeMatch = existingServiceOrdersByOrderCode.get(order.orderCode) || null;
      const legacyOrderCodeMatch = order.legacyOrderCode
        ? existingServiceOrdersByOrderCode.get(order.legacyOrderCode) || null
        : null;
      const codeMatches = [...new Set([orderCodeMatch, legacyOrderCodeMatch].filter(Boolean))];
      if (!sourceCodeMatch && codeMatches.length > 1) {
        const message = `source_id của ${order.orderCode} đang thuộc một đơn khác; chưa thể tự động hợp nhất.`;
        preview.conflicts.push(message);
        serviceOrderPlans.push({ action: "conflict", approvedInitialMatch: false, existing: sourceCodeMatch, order });
        continue;
      }

      const legacyCandidate = !sourceCodeMatch && order.legacyOrderCode
        ? legacyOrderCodeMatch
        : null;
      const expectedLegacySourceCode = legacyServiceOrderSourceCode(order);
      const legacyRekeyCandidate = legacyCandidate
        && (!legacyCandidate.sourceCode || String(legacyCandidate.sourceCode) === expectedLegacySourceCode)
        ? legacyCandidate
        : null;
      const orderFallbackMatch = orderCodeMatch || legacyOrderCodeMatch;
      const approvedInitialMatch = Boolean(
        orderFallbackMatch && isApprovedInitialOrderMatch(order, orderFallbackMatch.orderCode)
      );
      const safeIdentityRefresh = Boolean(
        orderFallbackMatch
        && !duplicateServiceOrderAnchorSignatures.has(serviceOrderAnchorSignature(order))
        && canRefreshDerivedServiceOrderIdentity(order, orderFallbackMatch, incomingServiceOrderSourceCodes)
      );
      if (
        !sourceCodeMatch
        && orderFallbackMatch?.sourceCode
        && String(orderFallbackMatch.sourceCode) !== order.sourceCode
        && !legacyRekeyCandidate
        && !safeIdentityRefresh
        && !approvedInitialMatch
      ) {
        const message = `Mã đơn ${order.orderCode} đã có source_id khác; chưa ghi đè danh tính ổn định.`;
        preview.conflicts.push(message);
        serviceOrderPlans.push({ action: "conflict", approvedInitialMatch, existing: orderFallbackMatch, order });
        continue;
      }

      const existing = sourceCodeMatch || orderFallbackMatch;
      if (existing && existing.source !== "IMPORT" && !existing.deletedAt && !approvedInitialMatch) {
        const message = `Không ghi đè đơn thủ công ${order.orderCode}; dữ liệu trên web được giữ nguyên.`;
        preview.conflicts.push(message);
        serviceOrderPlans.push({ action: "conflict", approvedInitialMatch, existing, order });
        continue;
      }

      if (legacyRekeyCandidate) {
        const signature = serviceOrderRolloutSignature(order);
        const isUniqueSignature = !duplicateServiceOrderRolloutSignatures.has(signature);
        const matchesLegacyBusinessIdentity = signature === existingServiceOrderRolloutSignature(legacyRekeyCandidate);
        if ((!isUniqueSignature || !matchesLegacyBusinessIdentity) && !safeIdentityRefresh) {
          preview.conflicts.push(
            !isUniqueSignature
              ? `source_id của ${order.orderCode} trùng dữ liệu nghiệp vụ trong lần gắn source_id đầu tiên; chưa thể tự động hợp nhất.`
              : `source_id của ${order.orderCode} không khớp dữ liệu nghiệp vụ của đơn cũ; chưa thể tự động hợp nhất.`
          );
          serviceOrderPlans.push({ action: "conflict", approvedInitialMatch, existing: legacyRekeyCandidate, order });
          continue;
        }
      }

      const action: ImportAction = !existing
        ? "created"
        : recordMatches(existing, serviceOrderBusinessData(order, existing))
          ? "unchanged"
          : "updated";
      countAction(preview.serviceOrders, action);
      if (action !== "unchanged") {
        const data = serviceOrderBusinessData(order, existing);
        const changes = action === "updated" && existing
          ? recordChanges(existing, data, serviceOrderFieldLabels).filter(
              (change) => change.field !== "orderDate" || Boolean(sanitizeText(order.orderDate))
            )
          : [];
        preview.records.serviceOrders.push({
          action,
          changes,
          key: existing?.orderCode ? String(existing.orderCode) : order.orderCode,
          label: serviceOrderPreviewLabel(order),
        });
      }
      serviceOrderPlans.push({ action, approvedInitialMatch, existing, order });
    }

    for (const link of APPROVED_STANDALONE_WARRANTY_LINKS) {
      const warranty = standaloneWarrantiesBySourceCode.get(link.sourceCode);
      const targetPlan = serviceOrderPlans.find((plan) => plan.order.sourceCode === link.sourceCode);
      if (!warranty || !targetPlan || targetPlan.action === "conflict") continue;
      if (warranty.serviceOrderId) {
        const targetId = targetPlan.existing ? asId(targetPlan.existing) : "";
        if (targetId && String(warranty.serviceOrderId) !== targetId) {
          const message = `Phiếu ${link.serialNo} đang gắn với một đơn khác; chưa thể tự động nối lại.`;
          preview.conflicts.push(message);
        } else {
          preview.warranties.unchanged += 1;
        }
        continue;
      }
      preview.warranties.linked += 1;
      warrantyPlans.push({ action: "link", serialNo: link.serialNo, sourceCode: link.sourceCode });
    }

    for (const pair of APPROVED_DUPLICATE_WARRANTY_PAIRS) {
      const [canonical, duplicate] = await Promise.all([
        tx.warranty.findUnique({ where: { serialNo: pair.canonicalSerialNo } }),
        tx.warranty.findUnique({ where: { serialNo: pair.duplicateSerialNo } }),
      ]);
      if (!duplicate || duplicate.deletedAt) {
        if (canonical && !canonical.deletedAt) preview.warranties.unchanged += 1;
        continue;
      }
      if (!canonical || canonical.deletedAt) {
        const message = `Không tìm thấy phiếu chính ${pair.canonicalSerialNo} để gộp phiếu trùng ${pair.duplicateSerialNo}.`;
        preview.conflicts.push(message);
        continue;
      }
      preview.warranties.archivedDuplicates += 1;
      warrantyPlans.push({ action: "archive-duplicate", ...pair });
    }
  }

  return {
    preview,
    partners: partnerPlans,
    partnerEntries: partnerEntryPlans,
    serviceOrders: serviceOrderPlans,
    warranties: warrantyPlans,
  };
}

export async function previewMinhHongParsedWorkbook(
  parsed: MinhHongParsedWorkbook,
  runner: ImportTransaction,
  options: ImportPlanOptions = {}
) {
  return (await buildImportPlan(runner, parsed, options)).preview;
}

async function upsertPartners(tx: ImportTransaction, plans: PartnerPlanItem[]) {
  const partnersByCode = new Map<string, string>();

  for (const plan of plans) {
    if (plan.action === "unchanged" && plan.existing) {
      partnersByCode.set(plan.code, asId(plan.existing));
      continue;
    }
    const saved = await tx.partner.upsert({
      where: { code: plan.code },
      create: plan.data,
      update: plan.data,
    });
    partnersByCode.set(plan.code, asId(saved));
  }

  return partnersByCode;
}

async function upsertLedgerEntries(tx: ImportTransaction, plans: PartnerEntryPlanItem[], partnersByCode: Map<string, string>) {
  for (const plan of plans) {
    if (plan.action === "conflict") {
      throw new MinhHongWorkbookImportError(`Không thể hợp nhất giao dịch ${plan.entry.sourceCode} do source_id bị trùng.`);
    }
    if (plan.action === "unchanged") continue;
    const entry = plan.entry;
    const partnerId = partnersByCode.get(entry.partnerCode);
    if (!partnerId) {
      throw new MinhHongWorkbookImportError(`Không tìm thấy đối tác ${entry.partnerCode} cho dòng ${entry.sourceCode}.`);
    }
    const data = ledgerData(entry, partnerId);
    await tx.partnerLedgerEntry.upsert({
      where: { sourceCode: plan.matchSourceCode },
      create: data,
      update: data,
    });
  }
}

async function upsertCustomer(tx: ImportTransaction, order: MinhHongParsedCustomerOrder) {
  const phone = customerPhone(order);
  return tx.customer.upsert({
    where: { phone },
    create: {
      name: order.customerName || "Khách chưa rõ tên",
      phone,
      address: null,
      notes: "Tạo từ import workbook Minh Hồng.",
      deletedAt: null,
    },
    update: {
      name: order.customerName || "Khách chưa rõ tên",
      deletedAt: null,
    },
  });
}

async function refreshApprovedLinkedWarranty(
  tx: ImportTransaction,
  plan: ServiceOrderPlanItem,
  savedOrder: Record<string, unknown>
) {
  if (!plan.approvedInitialMatch) return;

  const serviceOrderId = asId(savedOrder);
  const includedWarranty = plan.existing?.warranty as Record<string, unknown> | null | undefined;
  const warranty = includedWarranty || (serviceOrderId
    ? await tx.warranty.findUnique({ where: { serviceOrderId } })
    : null);
  if (!warranty || warranty.deletedAt) return;

  const previousProduct = sanitizeText(String(warranty.productName || ""));
  const previousCustomer = sanitizeText(String(warranty.customerName || ""));
  const nextProduct = sanitizeText(String(savedOrder.productName || "")) || previousProduct;
  const nextCustomer = sanitizeText(String(savedOrder.customerName || "")) || previousCustomer;
  const wordingNotes = [
    previousProduct && normalizedBusinessText(previousProduct) !== normalizedBusinessText(nextProduct)
      ? `Tên sản phẩm trên phiếu trước đồng bộ: ${previousProduct}`
      : null,
    previousCustomer && normalizedBusinessText(previousCustomer) !== normalizedBusinessText(nextCustomer)
      ? `Tên khách trên phiếu trước đồng bộ: ${previousCustomer}`
      : null,
  ];
  const data = {
    customerName: nextCustomer,
    customerPhone: sanitizeText(String(savedOrder.customerPhone || "")) || warranty.customerPhone,
    notes: mergeNotes(warranty.notes, ...wordingNotes),
    productName: nextProduct,
    service: sanitizeText(String(savedOrder.service || "")) || warranty.service,
  };
  if (recordMatches(warranty, data)) return;
  await tx.warranty.update({ where: { id: asId(warranty) }, data });
}

async function upsertServiceOrders(tx: ImportTransaction, plans: ServiceOrderPlanItem[]) {
  for (const plan of plans) {
    if (plan.action === "conflict") {
      throw new MinhHongWorkbookImportError(`Không ghi đè đơn thủ công ${plan.order.orderCode}; hãy đổi mã đơn hoặc xử lý trùng trước khi import.`);
    }

    if (plan.action === "unchanged") {
      if (plan.existing) await refreshApprovedLinkedWarranty(tx, plan, plan.existing);
      continue;
    }

    const order = plan.order;
    const data = plan.approvedInitialMatch && plan.existing
      ? approvedExistingServiceOrderData(order, plan.existing)
      : serviceOrderData(
          order,
          asId(await upsertCustomer(tx, order)),
          plan.existing?.orderCode ? String(plan.existing.orderCode) : undefined
        );
    let savedOrder: Record<string, unknown>;
    if (plan.action === "updated") {
      const existingId = plan.existing ? asId(plan.existing) : "";
      savedOrder = await tx.serviceOrder.update({
        where: existingId ? { id: existingId } : { orderCode: order.orderCode },
        data,
      });
    } else {
      savedOrder = await tx.serviceOrder.create({ data });
    }
    await refreshApprovedLinkedWarranty(tx, plan, savedOrder);
  }
}

async function applyWarrantyPlans(tx: ImportTransaction, plans: WarrantyPlanItem[]) {
  for (const plan of plans) {
    if (plan.action === "link") {
      const warranty = await tx.warranty.findUnique({ where: { serialNo: plan.serialNo } });
      const order = await tx.serviceOrder.findUnique({ where: { sourceCode: plan.sourceCode } });
      if (!warranty || warranty.deletedAt || !order) {
        throw new MinhHongWorkbookImportError(`Không thể nối phiếu ${plan.serialNo} với đơn đã nhập.`);
      }

      await tx.warranty.update({
        where: { id: asId(warranty) },
        data: { serviceOrderId: asId(order) },
      });
      if (warranty.endDate instanceof Date) {
        await tx.serviceOrder.update({
          where: { id: asId(order) },
          data: { warrantyEndDate: warranty.endDate },
        });
      }
      continue;
    }

    const canonical = await tx.warranty.findUnique({ where: { serialNo: plan.canonicalSerialNo } });
    const duplicate = await tx.warranty.findUnique({ where: { serialNo: plan.duplicateSerialNo } });
    if (!canonical || canonical.deletedAt || !duplicate || duplicate.deletedAt) {
      throw new MinhHongWorkbookImportError(`Không thể lưu trữ phiếu trùng ${plan.duplicateSerialNo}.`);
    }

    const duplicateWording = [
      sanitizeText(String(duplicate.customerName || "")),
      sanitizeText(String(duplicate.productName || "")),
    ].filter(Boolean).join(" · ");
    await tx.warranty.update({
      where: { id: asId(canonical) },
      data: {
        notes: mergeNotes(
          canonical.notes,
          duplicate.notes,
          `Đã lưu trữ phiếu trùng ${duplicate.serialNo}${duplicateWording ? ` (${duplicateWording})` : ""}`
        ),
      },
    });
    await tx.warranty.update({
      where: { id: asId(duplicate) },
      data: { deletedAt: new Date() },
    });
  }
}

async function writeAuditLog(tx: ImportTransaction, summary: MinhHongImportSummary, userId?: string) {
  if (!userId || !tx.auditLog) return;
  await tx.auditLog.create({
    data: {
      userId,
      action: "MINHHONG_WORKBOOK_IMPORT",
      entity: "MINHHONG_IMPORT",
      entityId: "minhhong-admin-import-template-2026-05-26",
      oldData: null,
      newData: summary,
    },
  });
}

export async function importMinhHongParsedWorkbook(parsed: MinhHongParsedWorkbook, runner: ImportRunner, options: MinhHongImportOptions = {}) {
  const scope = options.scope || "service-orders";
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope });
  if (!reconciliation.ok) {
    throw new MinhHongWorkbookImportError(reconciliation.blockingIssues.join("\n"));
  }

  return runner.$transaction(async (tx) => {
    const plan = await buildImportPlan(tx, parsed, { scope });
    if (plan.preview.conflicts.length > 0) {
      throw new MinhHongWorkbookImportError(plan.preview.conflicts.join("\n"));
    }

    if (scope !== "service-orders") {
      const partnersByCode = await upsertPartners(tx, plan.partners);
      await upsertLedgerEntries(tx, plan.partnerEntries, partnersByCode);
    }
    if (scope !== "partners") {
      await upsertServiceOrders(tx, plan.serviceOrders);
      await applyWarrantyPlans(tx, plan.warranties);
    }

    const summary: MinhHongImportSummary = {
      partnersUpserted: plan.preview.partners.created + plan.preview.partners.updated,
      partnerEntriesUpserted: plan.preview.partnerEntries.created + plan.preview.partnerEntries.updated,
      customersUpserted: plan.preview.serviceOrders.created + plan.preview.serviceOrders.updated,
      serviceOrdersUpserted: plan.preview.serviceOrders.created + plan.preview.serviceOrders.updated,
      skippedRows: parsed.skippedRows.length,
      warnings: reconciliation.warnings,
      changes: plan.preview,
    };
    await writeAuditLog(tx, summary, options.userId);
    return summary;
  }, { maxWait: 10_000, timeout: 120_000 });
}
