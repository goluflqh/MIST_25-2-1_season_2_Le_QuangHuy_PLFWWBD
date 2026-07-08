import type { MinhHongImportSummary } from "./workbook-importer";
import type { MinhHongParsedWorkbook } from "./workbook-parser";
import type { MinhHongReconciliationResult } from "./reconciliation";

export type MinhHongRehearsalMode = "dry-run" | "confirm";
export type MinhHongRehearsalBaselinePolicy = "rolling" | "locked";

const EXPECTED_REHEARSAL_TOTALS = {
  customerOrders: 41,
  customerOrderTotal: 36_825_000,
  longPayable: 12_720_000,
  partnerEntries: 80,
  partners: 10,
} as const;

export interface MinhHongRehearsalReport {
  ok: boolean;
  mode: MinhHongRehearsalMode;
  baselinePolicy: MinhHongRehearsalBaselinePolicy;
  cleanDbRequiredForConfirm: true;
  counts: {
    partners: number;
    partnerEntries: number;
    customerOrders: number;
    skippedRows: number;
    parserErrors: number;
  };
  totals: {
    longPayable: number;
    longHistoricalPaid: number;
    customerOrderTotal: number;
    customerOrderPaid: number;
  };
  blockingIssues: string[];
  warnings: string[];
  importResult?: MinhHongImportSummary;
}

export interface MinhHongRehearsalOptions {
  baselinePolicy?: MinhHongRehearsalBaselinePolicy;
}

function formatVnd(value: number) {
  return value.toLocaleString("vi-VN");
}

function pushExpectedNumberIssue(issues: string[], label: string, actual: number, expected: number) {
  if (actual === expected) return;
  issues.push(`${label} lệch: đang là ${formatVnd(actual)}, kỳ vọng ${formatVnd(expected)}.`);
}

function pushMinimumNumberIssue(issues: string[], label: string, actual: number, minimum: number) {
  if (actual >= minimum) return;
  issues.push(`${label} thiếu dữ liệu: đang là ${formatVnd(actual)}, tối thiểu phải có ${formatVnd(minimum)}.`);
}

export function buildMinhHongRehearsalReport(
  parsed: MinhHongParsedWorkbook,
  reconciliation: MinhHongReconciliationResult,
  mode: MinhHongRehearsalMode,
  importResult?: MinhHongImportSummary,
  options: MinhHongRehearsalOptions = {}
): MinhHongRehearsalReport {
  const baselinePolicy = options.baselinePolicy || "rolling";
  const blockingIssues = [...reconciliation.blockingIssues];

  if (baselinePolicy === "locked") {
    pushExpectedNumberIssue(blockingIssues, "Số đối tác", parsed.partners.length, EXPECTED_REHEARSAL_TOTALS.partners);
    pushExpectedNumberIssue(blockingIssues, "Số dòng ledger đối tác", parsed.partnerEntries.length, EXPECTED_REHEARSAL_TOTALS.partnerEntries);
    pushExpectedNumberIssue(blockingIssues, "Đơn khách", parsed.customerOrders.length, EXPECTED_REHEARSAL_TOTALS.customerOrders);
    pushExpectedNumberIssue(blockingIssues, "Long cần trả", parsed.partnerTotals.longPayable, EXPECTED_REHEARSAL_TOTALS.longPayable);
    pushExpectedNumberIssue(blockingIssues, "Tổng tiền Đơn khách", parsed.customerOrderTotals.quoted, EXPECTED_REHEARSAL_TOTALS.customerOrderTotal);
  } else {
    pushMinimumNumberIssue(blockingIssues, "Số đối tác", parsed.partners.length, EXPECTED_REHEARSAL_TOTALS.partners);
    pushMinimumNumberIssue(blockingIssues, "Số dòng ledger đối tác", parsed.partnerEntries.length, EXPECTED_REHEARSAL_TOTALS.partnerEntries);
    pushMinimumNumberIssue(blockingIssues, "Đơn khách", parsed.customerOrders.length, EXPECTED_REHEARSAL_TOTALS.customerOrders);
  }

  return {
    ok: reconciliation.ok && blockingIssues.length === 0,
    mode,
    baselinePolicy,
    cleanDbRequiredForConfirm: true,
    counts: {
      partners: parsed.partners.length,
      partnerEntries: parsed.partnerEntries.length,
      customerOrders: parsed.customerOrders.length,
      skippedRows: parsed.skippedRows.length,
      parserErrors: parsed.errors.length,
    },
    totals: {
      longPayable: parsed.partnerTotals.longPayable,
      longHistoricalPaid: parsed.partnerTotals.longHistoricalPaid,
      customerOrderTotal: parsed.customerOrderTotals.quoted,
      customerOrderPaid: parsed.customerOrderTotals.paid,
    },
    blockingIssues,
    warnings: reconciliation.warnings,
    ...(importResult ? { importResult } : {}),
  };
}
