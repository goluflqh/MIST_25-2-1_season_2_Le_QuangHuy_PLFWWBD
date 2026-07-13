import { parseAdminDateInput } from "@/lib/admin-date";
import { formatVietnamDate, getVietnamDateKey } from "@/lib/vietnam-time";
import ExcelJS from "exceljs";
import {
  MINHHONG_CUSTOMER_ORDER_COLUMNS,
  MINHHONG_IMPORT_SHEETS,
  MINHHONG_PARTNER_COLUMNS,
  MINHHONG_PAYMENT_COLUMNS,
  MINHHONG_PURCHASE_COLUMNS,
  MINHHONG_RECONCILIATION_KEYS,
  MINHHONG_RETURN_COLUMNS,
  type MinhHongImportSheet,
  type MinhHongReconciliationKey,
} from "./workbook-contract";

export interface MinhHongWorkbookIssue {
  sheet: MinhHongImportSheet | string;
  rowNumber: number | null;
  message: string;
}

export interface MinhHongSkippedRow {
  sheet: MinhHongImportSheet | string;
  rowNumber: number;
  reason: string;
}

export interface MinhHongParsedPartner {
  partnerCode: string;
  partnerName: string;
  partnerType: string;
  phone: string;
  notes: string;
  status: string;
}

export interface MinhHongParsedPartnerEntry {
  legacySourceCode?: string | null;
  sourceCode: string;
  sourceRow: number | null;
  sourceSheet: "Nhập hàng" | "Thanh toán" | "Trả hàng";
  partnerCode: string;
  partnerName: string;
  entryDate: string;
  entryType: "OPENING_BALANCE" | "PURCHASE" | "PAYMENT" | "RETURN";
  description: string;
  category: string | null;
  amount: number;
  countsInDebt: boolean;
  reference: string | null;
  receivedGoods: boolean | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  paymentMethod: string | null;
  notes: string | null;
}

export interface MinhHongParsedCustomerOrder {
  legacyOrderCode?: string | null;
  sourceCode: string;
  sourceRow: number | null;
  orderCode: string;
  orderDate: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  quotedPrice: number | null;
  paidAmount: number;
  debtAmount: number;
  priceStatus: "CONFIRMED" | "LEGACY_MISSING" | "UNKNOWN";
  notes: string | null;
}

export interface MinhHongPartnerTotals {
  longOpeningBalance: number;
  longCountedPurchase: number;
  longCountedPayment: number;
  longCountedReturn: number;
  longPayable: number;
  longHistoricalPaid: number;
  longReferenceOnlyAmount: number;
}

export interface MinhHongCustomerOrderTotals {
  rows: number;
  pricedRows: number;
  quoted: number;
  paid: number;
  debt: number;
  legacyMissingPriceRows: number;
}

export interface MinhHongParsedWorkbook {
  partners: MinhHongParsedPartner[];
  partnerEntries: MinhHongParsedPartnerEntry[];
  customerOrders: MinhHongParsedCustomerOrder[];
  reconciliation: Partial<Record<MinhHongReconciliationKey, number>>;
  partnerTotals: MinhHongPartnerTotals;
  customerOrderTotals: MinhHongCustomerOrderTotals;
  skippedRows: MinhHongSkippedRow[];
  errors: MinhHongWorkbookIssue[];
  warnings: string[];
}

type CellValue = unknown;

function clean(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value !== "object") return String(value).trim();

  const record = value as Record<string, unknown>;
  if ("result" in record) return clean(record.result);
  if ("text" in record) return clean(record.text);
  if (Array.isArray(record.richText)) {
    return record.richText.map((part) => clean((part as Record<string, unknown>).text)).join("").trim();
  }

  return String(value).trim();
}

function parseMoney(value: CellValue) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Math.round(value);
  const raw = String(value).trim();
  const negative = raw.startsWith("-");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return 0;
  return (negative ? -1 : 1) * Number.parseInt(digits, 10);
}

function parseOptionalNumber(value: CellValue) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDebtFlag(value: CellValue) {
  const normalized = clean(value).toLocaleLowerCase("vi-VN");
  if (!normalized) return true;
  return ["có", "co", "yes", "true", "1"].includes(normalized);
}

function parseReceivedGoods(value: CellValue) {
  const normalized = clean(value).toLocaleLowerCase("vi-VN");
  if (!normalized) return null;
  if (["có", "co", "đã", "da", "yes", "true", "1"].includes(normalized)) return true;
  if (["không", "khong", "chưa", "chua", "no", "false", "0"].includes(normalized)) return false;
  return null;
}

function parseDateKey(
  value: CellValue,
  errors?: MinhHongWorkbookIssue[],
  context?: { rowNumber: number; sheet: MinhHongImportSheet | string },
  warnings?: string[]
) {
  if (value === null || value === undefined || value === "") return "";
  const text = value instanceof Date ? "" : clean(value);
  const missingYearSlash = text.match(/^(\d{1,2})\/(\d{1,2})(\d{4})$/);
  const raw = value instanceof Date
    ? value
    : missingYearSlash
      ? Number(missingYearSlash[1]) + "/" + Number(missingYearSlash[2]) + "/" + missingYearSlash[3]
      : text;
  const parsed = parseAdminDateInput(raw);
  if (parsed && missingYearSlash && warnings && context) {
    warnings.push(context.sheet + " dòng " + context.rowNumber + ": ngày \"" + text + "\" được tự sửa thành \"" + formatVietnamDate(parsed) + "\".");
  }
  if (!parsed) {
    const text = clean(value);
    if (text && errors && context) {
      errors.push({
        sheet: context.sheet,
        rowNumber: context.rowNumber,
        message: "Ngày \"" + text + "\" không hợp lệ; không tự dùng ngày fallback cho dòng này.",
      });
    }
    return text;
  }
  return getVietnamDateKey(parsed);
}

function parseSourceRow(value: CellValue, fallbackRow: number) {
  const text = clean(value);
  const rangeMatch = text.match(/![A-Z]+(\d+)(?::[A-Z]+\d+)?/i);
  if (rangeMatch) return Number.parseInt(rangeMatch[1], 10);
  const match = text.match(/(\d+)(?!.*\d)/);
  return match ? Number.parseInt(match[1], 10) : fallbackRow;
}

function parseStableSourceId(value: CellValue) {
  return clean(value).match(/\bsource_id=(MH_[0-9A-F]{32})\b/i)?.[1]?.toUpperCase() || null;
}

function stableInternalCode(prefix: string, businessCode: string, sourceId: string | null) {
  return `${prefix}:${sourceId || businessCode}`;
}

function displayOrderCode(orderCode: string, sourceId: string | null, rowNumber: number) {
  if (orderCode) return orderCode;
  if (sourceId) return `MH-DH-${sourceId.slice(-8)}`;
  return `ROW-${rowNumber}`;
}

function rowHasBusinessContent(row: CellValue[], skipIndexes: number[]) {
  return row.some((cell, index) => !skipIndexes.includes(index) && clean(cell) !== "" && parseMoney(cell) !== 0);
}

function assertHeaders(sheet: string, actual: CellValue[] | undefined, expected: readonly string[], errors: MinhHongWorkbookIssue[]) {
  const actualHeaders = (actual || []).slice(0, expected.length).map(clean);
  expected.forEach((header, index) => {
    if (actualHeaders[index] !== header) {
      errors.push({
        sheet,
        rowNumber: 1,
        message: `Thiếu hoặc sai cột bắt buộc ${header}`,
      });
    }
  });
}

function sheetRows(workbook: ExcelJS.Workbook, sheetName: MinhHongImportSheet, errors: MinhHongWorkbookIssue[]) {
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet) {
    errors.push({ sheet: sheetName, rowNumber: null, message: `Thiếu sheet ${sheetName}` });
    return [] as CellValue[][];
  }

  const rows: CellValue[][] = [];
  const columnCount = worksheet.columnCount;
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: CellValue[] = [];
    for (let index = 1; index <= columnCount; index += 1) {
      cells.push(row.getCell(index).value);
    }
    rows.push(cells);
  });
  return rows;
}

function isLong(partnerCode: string, partnerName: string) {
  return partnerCode === "LONG" || partnerName.toLocaleLowerCase("vi-VN") === "long";
}

function isOpeningBalance(category: string, description: string, seller: string) {
  const text = `${category} ${description} ${seller}`.toLocaleLowerCase("vi-VN");
  return text.includes("số dư chốt") || text.includes("nợ tạm tính") || text.includes("chốt công nợ");
}

export async function parseMinhHongAdminWorkbook(buffer: Buffer): Promise<MinhHongParsedWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const errors: MinhHongWorkbookIssue[] = [];
  const skippedRows: MinhHongSkippedRow[] = [];
  const warnings: string[] = [];

  for (const sheetName of MINHHONG_IMPORT_SHEETS) {
    if (!workbook.getWorksheet(sheetName)) {
      errors.push({ sheet: sheetName, rowNumber: null, message: `Thiếu sheet ${sheetName}` });
    }
  }

  const partnerRows = sheetRows(workbook, "Đối tác", errors);
  const purchaseRows = sheetRows(workbook, "Nhập hàng", errors);
  const paymentRows = sheetRows(workbook, "Thanh toán", errors);
  const returnRows = sheetRows(workbook, "Trả hàng", errors);
  const customerRows = sheetRows(workbook, "Đơn khách", errors);
  const reconciliationRows = sheetRows(workbook, "Đối soát", errors);

  assertHeaders("Đối tác", partnerRows[0], MINHHONG_PARTNER_COLUMNS, errors);
  assertHeaders("Nhập hàng", purchaseRows[0], MINHHONG_PURCHASE_COLUMNS, errors);
  assertHeaders("Thanh toán", paymentRows[0], MINHHONG_PAYMENT_COLUMNS, errors);
  assertHeaders("Trả hàng", returnRows[0], MINHHONG_RETURN_COLUMNS, errors);
  assertHeaders("Đơn khách", customerRows[0], MINHHONG_CUSTOMER_ORDER_COLUMNS, errors);

  const partners = partnerRows.slice(1).flatMap((row) => {
    const partnerCode = clean(row[0]);
    const partnerName = clean(row[1]);
    if (!partnerCode && !partnerName) return [];
    return [{ partnerCode, partnerName, partnerType: clean(row[2]), phone: clean(row[3]), notes: clean(row[4]), status: clean(row[5]) }];
  });

  const partnerEntries: MinhHongParsedPartnerEntry[] = [];
  const partnerTotals: MinhHongPartnerTotals = {
    longOpeningBalance: 0,
    longCountedPurchase: 0,
    longCountedPayment: 0,
    longCountedReturn: 0,
    longPayable: 0,
    longHistoricalPaid: 0,
    longReferenceOnlyAmount: 0,
  };

  for (const [index, row] of purchaseRows.slice(1).entries()) {
    const workbookRow = index + 2;
    const amount = parseMoney(row[10]);
    const description = clean(row[5]);
    if (!amount || !description) continue;

    const partnerCode = clean(row[2]);
    const partnerName = clean(row[3]);
    const purchaseCode = clean(row[0]) || `ROW-${workbookRow}`;
    const stableSourceId = parseStableSourceId(row[14]);
    const category = clean(row[6]);
    const seller = clean(row[4]);
    const countsInDebt = parseDebtFlag(row[12]);
    const entryType = isOpeningBalance(category, description, seller) ? "OPENING_BALANCE" : "PURCHASE";
    const entry: MinhHongParsedPartnerEntry = {
      legacySourceCode: stableSourceId ? `NHAP_HANG:${purchaseCode}` : null,
      sourceCode: stableInternalCode("NHAP_HANG", purchaseCode, stableSourceId),
      sourceRow: parseSourceRow(row[14], workbookRow),
      sourceSheet: "Nhập hàng",
      partnerCode,
      partnerName,
      entryDate: parseDateKey(row[1], errors, { sheet: "Nhập hàng", rowNumber: workbookRow }, warnings),
      entryType,
      description,
      category: category || null,
      amount,
      countsInDebt,
      reference: clean(row[0]) || null,
      receivedGoods: parseReceivedGoods(row[11]),
      quantity: parseOptionalNumber(row[7]),
      unit: clean(row[8]) || null,
      unitPrice: parseMoney(row[9]) || null,
      paymentMethod: null,
      notes: clean(row[13]) || null,
    };
    partnerEntries.push(entry);

    if (!isLong(partnerCode, partnerName)) continue;
    if (countsInDebt && entryType === "OPENING_BALANCE") partnerTotals.longOpeningBalance += amount;
    if (countsInDebt && entryType === "PURCHASE") partnerTotals.longCountedPurchase += amount;
    if (!countsInDebt) partnerTotals.longReferenceOnlyAmount += amount;
  }

  for (const [index, row] of paymentRows.slice(1).entries()) {
    const workbookRow = index + 2;
    const amount = parseMoney(row[4]);
    if (!amount) continue;

    const partnerCode = clean(row[2]);
    const partnerName = clean(row[3]);
    const paymentCode = clean(row[0]) || `ROW-${workbookRow}`;
    const stableSourceId = parseStableSourceId(row[8]);
    const countsInDebt = parseDebtFlag(row[6]);
    partnerEntries.push({
      legacySourceCode: stableSourceId ? `THANH_TOAN:${paymentCode}` : null,
      sourceCode: stableInternalCode("THANH_TOAN", paymentCode, stableSourceId),
      sourceRow: parseSourceRow(row[8], workbookRow),
      sourceSheet: "Thanh toán",
      partnerCode,
      partnerName,
      entryDate: parseDateKey(row[1], errors, { sheet: "Thanh toán", rowNumber: workbookRow }, warnings),
      entryType: "PAYMENT",
      description: clean(row[7]) || "Thanh toán cho đối tác",
      category: null,
      amount,
      countsInDebt,
      reference: clean(row[0]) || null,
      receivedGoods: null,
      quantity: null,
      unit: null,
      unitPrice: null,
      paymentMethod: clean(row[5]) || null,
      notes: clean(row[7]) || null,
    });

    if (!isLong(partnerCode, partnerName)) continue;
    partnerTotals.longHistoricalPaid += amount;
    if (countsInDebt) partnerTotals.longCountedPayment += amount;
    else partnerTotals.longReferenceOnlyAmount += amount;
  }

  for (const [index, row] of returnRows.slice(1).entries()) {
    const workbookRow = index + 2;
    const amount = parseMoney(row[8]);
    const description = clean(row[4]);
    if (!amount || !description) continue;

    const partnerCode = clean(row[2]);
    const partnerName = clean(row[3]);
    const returnCode = clean(row[0]) || `ROW-${workbookRow}`;
    const stableSourceId = parseStableSourceId(row[11]);
    const countsInDebt = parseDebtFlag(row[9]);
    partnerEntries.push({
      legacySourceCode: stableSourceId ? `TRA_HANG:${returnCode}` : null,
      sourceCode: stableInternalCode("TRA_HANG", returnCode, stableSourceId),
      sourceRow: parseSourceRow(row[11], workbookRow),
      sourceSheet: "Trả hàng",
      partnerCode,
      partnerName,
      entryDate: parseDateKey(row[1], errors, { sheet: "Trả hàng", rowNumber: workbookRow }, warnings),
      entryType: "RETURN",
      description,
      category: clean(row[5]) || null,
      amount,
      countsInDebt,
      reference: clean(row[0]) || null,
      receivedGoods: null,
      quantity: parseOptionalNumber(row[6]),
      unit: null,
      unitPrice: parseMoney(row[7]) || null,
      paymentMethod: null,
      notes: clean(row[10]) || null,
    });

    if (!isLong(partnerCode, partnerName)) continue;
    if (countsInDebt) partnerTotals.longCountedReturn += amount;
    else partnerTotals.longReferenceOnlyAmount += amount;
  }

  partnerTotals.longPayable = partnerTotals.longOpeningBalance + partnerTotals.longCountedPurchase - partnerTotals.longCountedPayment - partnerTotals.longCountedReturn;

  const customerOrders: MinhHongParsedCustomerOrder[] = [];
  const customerOrderTotals: MinhHongCustomerOrderTotals = {
    rows: 0,
    pricedRows: 0,
    quoted: 0,
    paid: 0,
    debt: 0,
    legacyMissingPriceRows: 0,
  };

  for (const [index, row] of customerRows.slice(1).entries()) {
    const workbookRow = index + 2;
    const orderCode = clean(row[0]);
    const hasOnlyGeneratedCode = /^DH-\d+$/i.test(orderCode) && !rowHasBusinessContent(row, [0]);
    if (hasOnlyGeneratedCode) {
      skippedRows.push({ sheet: "Đơn khách", rowNumber: workbookRow, reason: `Bỏ qua dòng chỉ có mã đơn ${orderCode}` });
      continue;
    }

    const customerName = clean(row[2]);
    const customerPhone = clean(row[3]);
    const productName = clean(row[4]);
    const quoted = parseMoney(row[5]);
    const paid = parseMoney(row[6]);
    const statusText = clean(row[8]);
    const hasBusinessContent = rowHasBusinessContent(row, [0]);
    if (!hasBusinessContent) continue;

    const priceStatus = !quoted && (statusText === "Quên giá" || customerName || productName) ? "LEGACY_MISSING" : quoted ? "CONFIRMED" : "UNKNOWN";
    const debtAmount = quoted || paid ? Math.max(quoted - paid, 0) : parseMoney(row[7]);
    const sourceRow = parseSourceRow(row[10], workbookRow);
    const stableSourceId = parseStableSourceId(row[10]);
    const visibleOrderCode = displayOrderCode(orderCode, stableSourceId, workbookRow);
    customerOrders.push({
      legacyOrderCode: stableSourceId && orderCode ? orderCode : null,
      sourceCode: stableInternalCode("DON_KHACH", visibleOrderCode, stableSourceId),
      sourceRow,
      orderCode: visibleOrderCode,
      orderDate: parseDateKey(row[1], errors, { sheet: "Đơn khách", rowNumber: workbookRow }, warnings),
      customerName,
      customerPhone,
      productName,
      quotedPrice: quoted || null,
      paidAmount: paid,
      debtAmount,
      priceStatus,
      notes: clean(row[9]) || null,
    });

    customerOrderTotals.rows += 1;
    customerOrderTotals.quoted += quoted;
    customerOrderTotals.paid += paid;
    customerOrderTotals.debt += debtAmount;
    if (quoted) customerOrderTotals.pricedRows += 1;
    if (priceStatus === "LEGACY_MISSING") customerOrderTotals.legacyMissingPriceRows += 1;
  }

  const reconciliation: Partial<Record<MinhHongReconciliationKey, number>> = {};
  for (const [index, row] of reconciliationRows.slice(1).entries()) {
    const rowNumber = index + 2;
    const rawKey = clean(row[0]);
    if (rawKey === "warning") {
      const message = clean(row[3]) || clean(row[1]);
      if (message) warnings.push(message);
      continue;
    }
    if (rawKey === "blocking_issue") {
      errors.push({
        sheet: "Đối soát",
        rowNumber,
        message: clean(row[3]) || clean(row[1]) || "Dữ liệu nguồn cần kiểm tra trước khi import.",
      });
      continue;
    }
    const key = rawKey as MinhHongReconciliationKey;
    if (!MINHHONG_RECONCILIATION_KEYS.includes(key)) continue;
    reconciliation[key] = parseMoney(row[2]);
  }

  return {
    partners,
    partnerEntries,
    customerOrders,
    reconciliation,
    partnerTotals,
    customerOrderTotals,
    skippedRows,
    errors,
    warnings,
  };
}
