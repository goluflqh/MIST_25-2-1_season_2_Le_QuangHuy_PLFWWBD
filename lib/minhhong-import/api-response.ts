import type { MinhHongImportPreview, MinhHongImportSummary } from "./workbook-importer";
import type { MinhHongParsedWorkbook } from "./workbook-parser";
import type { MinhHongReconciliationResult } from "./reconciliation";
import type { MinhHongImportScope } from "./import-scope";

export type MinhHongImportMode = "preview" | "confirm";

export interface MinhHongImportResponse {
  success: boolean;
  mode: MinhHongImportMode;
  sourceSheetDateRepairs?: number;
  reconciliation: MinhHongReconciliationResult;
  counts: {
    partners: number;
    partnerEntries: number;
    customerOrders: number;
    skippedRows: number;
    errors: number;
  };
  totals: {
    longPayable: number;
    longHistoricalPaid: number;
    customerOrderTotal: number;
    customerOrderPaid: number;
  };
  changes?: MinhHongImportPreview;
  importResult?: MinhHongImportSummary;
}

function isServiceOrderSkippedRow(row: MinhHongParsedWorkbook["skippedRows"][number]) {
  return row.sheet === "Đơn khách" || /Đơn khách|Đơn hàng đã bán|Mã đơn|Dòng Excel|đơn khách|khách/i.test(row.reason);
}

export function countMinhHongScopedSkippedRows(parsed: MinhHongParsedWorkbook, scope: MinhHongImportScope | undefined) {
  if (scope === "service-orders") return parsed.skippedRows.filter(isServiceOrderSkippedRow).length;
  if (scope === "partners") return parsed.skippedRows.filter((row) => !isServiceOrderSkippedRow(row)).length;
  return parsed.skippedRows.length;
}

export function buildMinhHongImportResponse(
  mode: MinhHongImportMode,
  parsed: MinhHongParsedWorkbook,
  reconciliation: MinhHongReconciliationResult,
  importResult?: MinhHongImportSummary,
  changes?: MinhHongImportPreview,
  options: { scope?: MinhHongImportScope; sourceSheetDateRepairs?: number } = {}
): MinhHongImportResponse {
  const serviceOrderScope = options.scope === "service-orders";
  const partnerScope = options.scope === "partners";
  return {
    success: true,
    mode,
    ...(typeof options.sourceSheetDateRepairs === "number" ? { sourceSheetDateRepairs: options.sourceSheetDateRepairs } : {}),
    reconciliation,
    counts: {
      partners: serviceOrderScope ? 0 : parsed.partners.length,
      partnerEntries: serviceOrderScope ? 0 : parsed.partnerEntries.length,
      customerOrders: partnerScope ? 0 : parsed.customerOrders.length,
      skippedRows: countMinhHongScopedSkippedRows(parsed, options.scope),
      errors: reconciliation.blockingIssues.length,
    },
    totals: {
      longPayable: serviceOrderScope ? 0 : parsed.partnerTotals.longPayable,
      longHistoricalPaid: serviceOrderScope ? 0 : parsed.partnerTotals.longHistoricalPaid,
      customerOrderTotal: partnerScope ? 0 : parsed.customerOrderTotals.quoted,
      customerOrderPaid: partnerScope ? 0 : parsed.customerOrderTotals.paid,
    },
    ...(changes ? { changes } : {}),
    ...(importResult ? { importResult, changes: importResult.changes } : {}),
  };
}
