import type { MinhHongParsedWorkbook } from "./workbook-parser";
import type { MinhHongReconciliationKey } from "./workbook-contract";
import type { MinhHongImportScope } from "./import-scope";

export interface MinhHongReconciliationCheck {
  actual: number;
  expected: number;
  label: string;
  ok: boolean;
}

export interface MinhHongReconciliationResult {
  ok: boolean;
  checks: Record<MinhHongReconciliationKey, MinhHongReconciliationCheck>;
  blockingIssues: string[];
  warnings: string[];
}

const EXPECTED: Record<MinhHongReconciliationKey, { expected: number; label: string }> = {
  long_opening_balance: { expected: 20_230_000, label: "Long - số dư chốt 07/05/2026" },
  long_counted_purchase: { expected: 7_490_000, label: "Long - phát sinh mua sau chốt" },
  long_counted_payment: { expected: 15_000_000, label: "Long - đã thanh toán sau chốt" },
  long_payable: { expected: 12_720_000, label: "Long - Minh Hồng cần trả" },
  long_historical_paid: { expected: 60_000_000, label: "Long - đã thanh toán lịch sử" },
  customer_order_rows: { expected: 41, label: "Đơn khách - số dòng nghiệp vụ" },
  customer_order_total: { expected: 36_825_000, label: "Đơn khách - tổng tiền" },
  customer_order_paid: { expected: 29_790_000, label: "Đơn khách - đã thu" },
  customer_legacy_missing_price_rows: { expected: 4, label: "Đơn khách - dòng cũ quên giá" },
};

const SERVICE_ORDER_RECONCILIATION_KEYS = new Set<MinhHongReconciliationKey>([
  "customer_order_rows",
  "customer_order_total",
  "customer_order_paid",
  "customer_legacy_missing_price_rows",
]);

function isServiceOrderReconciliationKey(key: string) {
  return SERVICE_ORDER_RECONCILIATION_KEYS.has(key as MinhHongReconciliationKey);
}

function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function actuals(parsed: MinhHongParsedWorkbook): Record<MinhHongReconciliationKey, number> {
  return {
    long_opening_balance: parsed.partnerTotals.longOpeningBalance,
    long_counted_purchase: parsed.partnerTotals.longCountedPurchase,
    long_counted_payment: parsed.partnerTotals.longCountedPayment,
    long_payable: parsed.partnerTotals.longPayable,
    long_historical_paid: parsed.partnerTotals.longHistoricalPaid,
    customer_order_rows: parsed.customerOrderTotals.rows,
    customer_order_total: parsed.customerOrderTotals.quoted,
    customer_order_paid: parsed.customerOrderTotals.paid,
    customer_legacy_missing_price_rows: parsed.customerOrderTotals.legacyMissingPriceRows,
  };
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function isServiceOrderMessage(message: string) {
  return /Đơn khách|Đơn hàng đã bán|Mã đơn|Dòng Excel|đơn khách|khách/i.test(message);
}

function isServiceOrderIssue(issue: { sheet: string; message: string }) {
  return issue.sheet === "Đơn khách" || isServiceOrderMessage(issue.message);
}

function isServiceOrderSkippedRow(row: { sheet: string; reason: string }) {
  return row.sheet === "Đơn khách" || isServiceOrderMessage(row.reason);
}

const SOURCE_ROW_PATTERN = /(?:Đơn hàng đã bán|Đơn khách)\s+dòng\s+(\d+)/i;
const INVALID_DATE_PATTERN = /ngày\s+"([^"]+)"\s+không hợp lệ/i;
const CORRECTED_DATE_PATTERN = /(?:Đơn hàng đã bán|Đơn khách)\s+dòng\s+(\d+):\s*ngày\s+"([^"]+)"\s+được tự sửa thành\s+"([^"]+)"/i;

function formatIssue(issue: { sheet: string; rowNumber: number | null; message: string }) {
  return `${issue.sheet}${issue.rowNumber ? ` dòng ${issue.rowNumber}` : ""}: ${issue.message}`;
}

function sourceRowFromMessage(message: string) {
  const match = message.match(SOURCE_ROW_PATTERN);
  return match ? Number.parseInt(match[1], 10) : null;
}

function invalidDateFromMessage(message: string) {
  return message.match(INVALID_DATE_PATTERN)?.[1] || null;
}

function sourceRowForInvalidDateIssue(parsed: MinhHongParsedWorkbook, issue: { rowNumber: number | null; message: string }) {
  const sourceRow = sourceRowFromMessage(issue.message);
  if (sourceRow) return sourceRow;

  const invalidDate = invalidDateFromMessage(issue.message);
  if (!invalidDate) return issue.rowNumber;

  const matchingOrder = parsed.customerOrders.find((order) => order.orderDate === invalidDate);
  return matchingOrder?.sourceRow || issue.rowNumber;
}

function serviceOrderInvalidDateWarning(parsed: MinhHongParsedWorkbook, issue: { rowNumber: number | null; message: string }) {
  const invalidDate = invalidDateFromMessage(issue.message);
  if (!invalidDate) return null;
  const sourceRow = sourceRowForInvalidDateIssue(parsed, issue);
  if (!sourceRow) return null;
  return `Dòng Excel ${sourceRow}: ngày "${invalidDate}" sai định dạng, chưa áp dụng dòng này. Hãy sửa theo dd/mm/yyyy.`;
}

function isServiceOrderInvalidDateIssue(parsed: MinhHongParsedWorkbook, issue: { sheet: string; rowNumber: number | null; message: string }) {
  return Boolean(isServiceOrderIssue(issue) && serviceOrderInvalidDateWarning(parsed, issue));
}

export function getServiceOrderInvalidDateSourceRows(parsed: MinhHongParsedWorkbook) {
  const rows = new Set<number>();
  for (const issue of parsed.errors) {
    if (!isServiceOrderInvalidDateIssue(parsed, issue)) continue;
    const sourceRow = sourceRowForInvalidDateIssue(parsed, issue);
    if (sourceRow) rows.add(sourceRow);
  }
  return rows;
}

function isBaselineDriftWarning(message: string) {
  return /^Long\s+-/i.test(message) || /^Đơn khách\s+-/i.test(message) || /\bmốc cũ\b/i.test(message);
}

function friendlyServiceOrderWarning(message: string) {
  if (isBaselineDriftWarning(message)) return null;

  const correctedDate = message.match(CORRECTED_DATE_PATTERN);
  if (correctedDate) {
    return `Dòng Excel ${correctedDate[1]}: ngày "${correctedDate[2]}" đã được tự sửa thành "${correctedDate[3]}".`;
  }

  const invalidDate = invalidDateFromMessage(message);
  const sourceRow = sourceRowFromMessage(message);
  if (invalidDate && sourceRow) {
    return `Dòng Excel ${sourceRow}: ngày "${invalidDate}" sai định dạng, chưa áp dụng dòng này. Hãy sửa theo dd/mm/yyyy.`;
  }

  if (!isServiceOrderMessage(message)) return null;
  return message.replace(/^Đối soát\s+dòng\s+\d+:\s*/i, "").replace(/^Đơn khách\s+dòng\s+(\d+):\s*/i, "Dòng Excel $1: ");
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}

export function reconcileMinhHongWorkbook(
  parsed: MinhHongParsedWorkbook,
  options: { scope?: MinhHongImportScope } = {}
): MinhHongReconciliationResult {
  const scope = options.scope || "all";
  const values = actuals(parsed);
  const checks = Object.fromEntries(
    Object.entries(EXPECTED).map(([key, config]) => {
      const reconciliationKey = key as MinhHongReconciliationKey;
      const actual = values[reconciliationKey];
      return [
        reconciliationKey,
        {
          actual,
          expected: config.expected,
          label: config.label,
          ok: actual === config.expected,
        },
      ];
    })
  ) as Record<MinhHongReconciliationKey, MinhHongReconciliationCheck>;

  const blockingIssues: string[] = [];
  const checksForWarnings = Object.entries(checks).filter(([key]) => {
    if (scope === "service-orders") return isServiceOrderReconciliationKey(key);
    if (scope === "partners") return !isServiceOrderReconciliationKey(key);
    return true;
  });
  const baselineWarnings = checksForWarnings.flatMap(([, check]) => {
    if (check.ok) return [];
    return [`${check.label} đã thay đổi: hiện tại ${formatVnd(check.actual)}, mốc cũ ${formatVnd(check.expected)}.`];
  });
  const warnings = scope === "service-orders" ? [] : baselineWarnings;

  const serviceOrderWarnings: string[] = [];
  const parserErrors = scope === "service-orders"
    ? parsed.errors.filter(isServiceOrderIssue)
    : scope === "partners"
      ? parsed.errors.filter((issue) => !isServiceOrderIssue(issue))
      : parsed.errors;
  for (const error of parserErrors) {
    if (scope === "service-orders") {
      const warning = serviceOrderInvalidDateWarning(parsed, error);
      if (warning) {
        serviceOrderWarnings.push(warning);
        continue;
      }
    }
    blockingIssues.push(formatIssue(error));
  }

  const scopedWarnings = scope === "service-orders"
    ? [
        ...serviceOrderWarnings,
        ...parsed.warnings.map(friendlyServiceOrderWarning).filter((message): message is string => Boolean(message)),
      ]
    : scope === "partners"
      ? parsed.warnings.filter((message) => !isServiceOrderMessage(message))
      : parsed.warnings;
  const scopedSkippedRows = scope === "service-orders"
    ? parsed.skippedRows.filter(isServiceOrderSkippedRow)
    : scope === "partners"
      ? parsed.skippedRows.filter((row) => !isServiceOrderSkippedRow(row))
      : parsed.skippedRows;

  if (scope !== "service-orders") {
    for (const sourceCode of duplicateValues(parsed.partnerEntries.map((entry) => entry.sourceCode))) {
      blockingIssues.push(`Mã giao dịch ${sourceCode} xuất hiện nhiều lần trong workbook.`);
    }
  }

  if (scope !== "partners") {
    for (const orderCode of duplicateValues(parsed.customerOrders.map((order) => order.orderCode))) {
      blockingIssues.push(`Mã đơn ${orderCode} xuất hiện nhiều lần trong workbook.`);
    }
    if (duplicateValues(parsed.customerOrders.map((order) => order.sourceCode)).length > 0) {
      blockingIssues.push(
        "Có các dòng đơn khách trùng hoàn toàn nên chưa thể phân biệt an toàn. Hãy bổ sung thông tin khác biệt rồi kiểm tra lại."
      );
    }
  }

  return {
    ok: blockingIssues.length === 0,
    checks,
    blockingIssues,
    warnings: uniqueMessages([
      ...warnings,
      ...scopedWarnings,
      ...scopedSkippedRows
        .map((row) => scope === "service-orders" ? `Dòng Excel ${row.rowNumber}: ${row.reason}` : `${row.sheet} dòng ${row.rowNumber}: ${row.reason}`),
    ]),
  };
}
