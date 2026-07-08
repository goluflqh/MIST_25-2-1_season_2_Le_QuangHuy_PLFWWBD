import { parseAdminDateInput } from "@/lib/admin-date";
import { getImportedFallbackOrderDate } from "@/lib/admin-order-display";
import { sanitizeText } from "@/lib/sanitize";
import type { MinhHongImportScope } from "./import-scope";
import { getServiceOrderInvalidDateSourceRows, reconcileMinhHongWorkbook } from "./reconciliation";
import type { MinhHongParsedCustomerOrder, MinhHongParsedPartner, MinhHongParsedPartnerEntry, MinhHongParsedWorkbook } from "./workbook-parser";

interface ImportTransaction {
  partner: {
    findUnique(args: { where: { code: string } }): Promise<Record<string, unknown> | null>;
    upsert(args: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  partnerLedgerEntry: {
    findUnique(args: { where: { sourceCode: string } }): Promise<Record<string, unknown> | null>;
    upsert(args: { where: { sourceCode: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  customer: {
    upsert(args: { where: { phone: string }; create: Record<string, unknown>; update: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  serviceOrder: {
    findUnique(args: { where: { orderCode: string } }): Promise<Record<string, unknown> | null>;
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
    update(args: { where: { orderCode: string }; data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
  auditLog?: {
    create(args: { data: Record<string, unknown> }): Promise<Record<string, unknown>>;
  };
}

export interface ImportRunner extends ImportTransaction {
  $transaction<T>(callback: (tx: ImportTransaction) => Promise<T>): Promise<T>;
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

export interface MinhHongImportChangeRecord {
  action: "created" | "updated";
  key: string;
  label: string;
}

export interface MinhHongImportPreview {
  partners: MinhHongImportChangeCounts;
  partnerEntries: MinhHongImportChangeCounts;
  serviceOrders: MinhHongImportChangeCounts;
  conflicts: string[];
  records: {
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
  action: ImportAction;
  entry: MinhHongParsedPartnerEntry;
}

interface ServiceOrderPlanItem {
  action: ImportAction | "conflict";
  order: MinhHongParsedCustomerOrder;
}

interface ImportPlan {
  preview: MinhHongImportPreview;
  partners: PartnerPlanItem[];
  partnerEntries: PartnerEntryPlanItem[];
  serviceOrders: ServiceOrderPlanItem[];
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

function serviceOrderData(order: MinhHongParsedCustomerOrder, customerId: string) {
  const phone = customerPhone(order);
  return {
    orderCode: order.orderCode,
    customerId,
    customerName: order.customerName || "Khách chưa rõ tên",
    customerPhone: phone,
    customerAddress: null,
    service: "KHAC",
    productName: order.productName || "Đơn khách cũ",
    issueDescription: order.productName || null,
    solution: null,
    status: serviceOrderStatus(order),
    source: "IMPORT",
    sourceName: "Đơn khách",
    sourceRow: order.sourceRow,
    orderDate: toOrderDate(order.orderDate, order.sourceRow),
    quotedPrice: order.quotedPrice,
    priceStatus: priceStatus(order),
    paidAmount: order.paidAmount,
    warrantyMonths: null,
    warrantyEndDate: null,
    customerVisible: false,
    couponCode: null,
    couponDiscount: null,
    discountAmount: 0,
    notes: order.notes,
    deletedAt: null,
  };
}

function serviceOrderBusinessData(order: MinhHongParsedCustomerOrder) {
  return Object.fromEntries(
    Object.entries(serviceOrderData(order, "preview-customer")).filter(([key]) => key !== "customerId")
  );
}

function serviceOrderPreviewLabel(order: MinhHongParsedCustomerOrder) {
  return [
    order.sourceRow ? `Dòng Excel ${order.sourceRow}` : "",
    order.customerName,
    order.productName,
  ].filter(Boolean).join(" · ") || order.orderCode;
}

function hasInvalidTypedOrderDate(order: MinhHongParsedCustomerOrder) {
  const value = sanitizeText(order.orderDate);
  return Boolean(value && !parseAdminDateInput(value));
}

async function buildImportPlan(tx: ImportTransaction, parsed: MinhHongParsedWorkbook, options: ImportPlanOptions = {}): Promise<ImportPlan> {
  const includePartnerLedger = options.scope !== "service-orders";
  const includeServiceOrders = options.scope !== "partners";
  const invalidServiceOrderDateRows = options.scope === "service-orders"
    ? getServiceOrderInvalidDateSourceRows(parsed)
    : new Set<number>();
  const preview: MinhHongImportPreview = {
    partners: emptyChangeCounts(),
    partnerEntries: emptyChangeCounts(),
    serviceOrders: emptyChangeCounts(),
    conflicts: [],
    records: { partnerEntries: [], serviceOrders: [] },
  };
  const partnerPlans: PartnerPlanItem[] = [];
  const partnerIds = new Map<string, string>();

  if (includePartnerLedger) {
    for (const partner of parsed.partners) {
      const data = partnerData(partner);
      const existing = await tx.partner.findUnique({ where: { code: partner.partnerCode } });
      const action: ImportAction = !existing ? "created" : recordMatches(existing, data) ? "unchanged" : "updated";
      countAction(preview.partners, action);
      partnerPlans.push({ action, code: partner.partnerCode, data, existing });
      if (existing) partnerIds.set(partner.partnerCode, asId(existing));
    }
  }

  const partnerEntryPlans: PartnerEntryPlanItem[] = [];
  if (includePartnerLedger) {
    for (const entry of parsed.partnerEntries) {
      const existing = await tx.partnerLedgerEntry.findUnique({ where: { sourceCode: entry.sourceCode } });
      const partnerId = partnerIds.get(entry.partnerCode);
      const action: ImportAction = !existing
        ? "created"
        : partnerId && recordMatches(existing, ledgerData(entry, partnerId))
          ? "unchanged"
          : "updated";
      countAction(preview.partnerEntries, action);
      if (action !== "unchanged") {
        preview.records.partnerEntries.push({ action, key: entry.sourceCode, label: entry.description });
      }
      partnerEntryPlans.push({ action, entry });
    }
  }

  const serviceOrderPlans: ServiceOrderPlanItem[] = [];
  if (includeServiceOrders) {
    for (const order of parsed.customerOrders) {
      if (
        options.scope === "service-orders"
        && ((order.sourceRow && invalidServiceOrderDateRows.has(order.sourceRow)) || hasInvalidTypedOrderDate(order))
      ) {
        continue;
      }

      const existing = await tx.serviceOrder.findUnique({ where: { orderCode: order.orderCode } });
      if (existing && existing.source !== "IMPORT" && !existing.deletedAt) {
        const message = `Không ghi đè đơn thủ công ${order.orderCode}; dữ liệu trên web được giữ nguyên.`;
        preview.conflicts.push(message);
        serviceOrderPlans.push({ action: "conflict", order });
        continue;
      }

      const action: ImportAction = !existing
        ? "created"
        : recordMatches(existing, serviceOrderBusinessData(order))
          ? "unchanged"
          : "updated";
      countAction(preview.serviceOrders, action);
      if (action !== "unchanged") {
        preview.records.serviceOrders.push({
          action,
          key: order.orderCode,
          label: serviceOrderPreviewLabel(order),
        });
      }
      serviceOrderPlans.push({ action, order });
    }
  }

  return {
    preview,
    partners: partnerPlans,
    partnerEntries: partnerEntryPlans,
    serviceOrders: serviceOrderPlans,
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
    if (plan.action === "unchanged") continue;
    const entry = plan.entry;
    const partnerId = partnersByCode.get(entry.partnerCode);
    if (!partnerId) {
      throw new MinhHongWorkbookImportError(`Không tìm thấy đối tác ${entry.partnerCode} cho dòng ${entry.sourceCode}.`);
    }
    const data = ledgerData(entry, partnerId);
    await tx.partnerLedgerEntry.upsert({
      where: { sourceCode: entry.sourceCode },
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

async function upsertServiceOrders(tx: ImportTransaction, plans: ServiceOrderPlanItem[]) {
  for (const plan of plans) {
    if (plan.action === "unchanged") continue;
    if (plan.action === "conflict") {
      throw new MinhHongWorkbookImportError(`Không ghi đè đơn thủ công ${plan.order.orderCode}; hãy đổi mã đơn hoặc xử lý trùng trước khi import.`);
    }
    const order = plan.order;
    const customer = await upsertCustomer(tx, order);
    const data = serviceOrderData(order, asId(customer));
    if (plan.action === "updated") {
      await tx.serviceOrder.update({ where: { orderCode: order.orderCode }, data });
    } else {
      await tx.serviceOrder.create({ data });
    }
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
  const scope = options.scope || "all";
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
  });
}
