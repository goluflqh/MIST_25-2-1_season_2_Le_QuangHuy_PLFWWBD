import { calculateServiceOrderFinancials, getPartnerBalance, getPartnerEntrySignedAmount } from "@/lib/financial-calculations";
import type { MinhHongImportScope } from "@/lib/minhhong-import/import-scope";
import { reconcileMinhHongWorkbook, type MinhHongReconciliationResult } from "@/lib/minhhong-import/reconciliation";
import { MINHHONG_RECONCILIATION_KEYS, type MinhHongReconciliationKey } from "@/lib/minhhong-import/workbook-contract";
import type { MinhHongParsedCustomerOrder, MinhHongParsedPartnerEntry, MinhHongParsedWorkbook } from "@/lib/minhhong-import/workbook-parser";

export type FinancialAuditSeverity = "error" | "warning";

export interface FinancialAuditIssue {
  code: string;
  message: string;
  severity: FinancialAuditSeverity;
}

export interface FinancialAuditCheck {
  actual: number;
  expected: number;
  label: string;
  ok: boolean;
}

export interface FinancialAuditSection {
  checks: FinancialAuditCheck[];
  issues: FinancialAuditIssue[];
  ok: boolean;
  summary: Record<string, number>;
}

export interface FinancialAuditReport {
  database?: FinancialAuditSection;
  issues: FinancialAuditIssue[];
  ok: boolean;
  source?: FinancialAuditSection;
}

export interface DatabaseAuditSnapshot {
  partnerEntries: Array<{
    amount: number;
    countsInDebt: boolean;
    discountAmount: number;
    discountPercent: number | null;
    entryType: string;
    id: string;
    partnerCode: string;
    sourceCode: string | null;
  }>;
  serviceOrders: Array<{
    discountAmount: number;
    id: string;
    orderCode: string;
    paidAmount: number;
    priceStatus: string;
    quotedPrice: number | null;
    source: string;
  }>;
}

type IssueList = FinancialAuditIssue[];

function issue(severity: FinancialAuditSeverity, code: string, message: string): FinancialAuditIssue {
  return { code, message, severity };
}

function addCheck(checks: FinancialAuditCheck[], issues: IssueList, label: string, actual: number, expected: number, code: string) {
  const ok = actual === expected;
  checks.push({ actual, expected, label, ok });
  if (!ok) {
    issues.push(issue("error", code, `${label}: expected ${expected.toLocaleString("vi-VN")}, got ${actual.toLocaleString("vi-VN")}.`));
  }
}

function duplicateValues(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function hasInvalidPartnerAmount(entry: {
  amount: number;
  countsInDebt: boolean;
  discountAmount: number;
  discountPercent: number | null;
  entryType: string;
}) {
  const isFullyDiscountedPurchase = entry.entryType === "PURCHASE"
    && entry.amount === 0
    && entry.discountPercent === 100
    && entry.discountAmount > 0;
  const invalidAdjustment = entry.entryType === "ADJUSTMENT" && entry.amount === 0;
  const invalidCountedAmount = entry.entryType !== "ADJUSTMENT"
    && entry.countsInDebt
    && entry.amount <= 0
    && !isFullyDiscountedPurchase;
  const invalidReferenceAmount = entry.entryType !== "ADJUSTMENT" && !entry.countsInDebt && entry.amount < 0;
  return invalidAdjustment || invalidCountedAmount || invalidReferenceAmount;
}

function shouldAuditPartners(scope: MinhHongImportScope) {
  return scope !== "service-orders";
}

function shouldAuditServiceOrders(scope: MinhHongImportScope) {
  return scope !== "partners";
}

function isLongEntry(entry: MinhHongParsedPartnerEntry) {
  return entry.partnerCode === "LONG" || entry.partnerName.toLocaleLowerCase("vi-VN") === "long";
}

function expectedPriceStatus(order: MinhHongParsedCustomerOrder) {
  if (order.priceStatus === "LEGACY_MISSING") return "LEGACY_MISSING";
  if (order.quotedPrice === 0) return "FREE";
  if (order.quotedPrice === null) return "PENDING_QUOTE";
  return "CONFIRMED";
}

function actualReconciliationValues(parsed: MinhHongParsedWorkbook): Record<MinhHongReconciliationKey, number> {
  return {
    customer_legacy_missing_price_rows: parsed.customerOrderTotals.legacyMissingPriceRows,
    customer_order_paid: parsed.customerOrderTotals.paid,
    customer_order_rows: parsed.customerOrderTotals.rows,
    customer_order_total: parsed.customerOrderTotals.quoted,
    long_counted_payment: parsed.partnerTotals.longCountedPayment,
    long_counted_purchase: parsed.partnerTotals.longCountedPurchase,
    long_historical_paid: parsed.partnerTotals.longHistoricalPaid,
    long_opening_balance: parsed.partnerTotals.longOpeningBalance,
    long_payable: parsed.partnerTotals.longPayable,
  };
}

export function auditParsedMinhHongWorkbookFinancials(
  parsed: MinhHongParsedWorkbook,
  options: { reconciliation?: MinhHongReconciliationResult; scope?: MinhHongImportScope } = {}
): FinancialAuditSection {
  const scope = options.scope || "all";
  const reconciliation = options.reconciliation || reconcileMinhHongWorkbook(parsed, { scope });
  const issues: IssueList = [];
  const checks: FinancialAuditCheck[] = [];
  const actuals = actualReconciliationValues(parsed);

  for (const blockingIssue of reconciliation.blockingIssues) {
    issues.push(issue("error", "source.blocking_issue", blockingIssue));
  }
  for (const warning of reconciliation.warnings) {
    issues.push(issue("warning", "source.warning", warning));
  }

  for (const key of MINHHONG_RECONCILIATION_KEYS) {
    const isCustomerKey = key.startsWith("customer_");
    const isPartnerKey = key.startsWith("long_");
    if ((isCustomerKey && shouldAuditServiceOrders(scope)) || (isPartnerKey && shouldAuditPartners(scope))) {
      const sheetValue = parsed.reconciliation[key];
      if (sheetValue !== undefined) {
        addCheck(checks, issues, `Đối soát ${key}`, sheetValue, actuals[key], `source.reconciliation.${key}`);
      }
    }
  }

  if (shouldAuditPartners(scope)) {
    const longEntries = parsed.partnerEntries.filter(isLongEntry);
    const longOpeningBalance = longEntries
      .filter((entry) => entry.countsInDebt && entry.entryType === "OPENING_BALANCE")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longCountedPurchase = longEntries
      .filter((entry) => entry.countsInDebt && entry.entryType === "PURCHASE")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longCountedPayment = longEntries
      .filter((entry) => entry.countsInDebt && entry.entryType === "PAYMENT")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longCountedReturn = longEntries
      .filter((entry) => entry.countsInDebt && entry.entryType === "RETURN")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longCountedAdjustment = longEntries
      .filter((entry) => entry.countsInDebt && entry.entryType === "ADJUSTMENT")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longHistoricalPaid = longEntries
      .filter((entry) => entry.entryType === "PAYMENT")
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longReferenceOnlyAmount = longEntries
      .filter((entry) => !entry.countsInDebt)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const longPayable = longOpeningBalance
      + longCountedPurchase
      + longCountedAdjustment
      - longCountedPayment
      - longCountedReturn;

    addCheck(checks, issues, "Long opening balance formula", longOpeningBalance, parsed.partnerTotals.longOpeningBalance, "source.long.opening");
    addCheck(checks, issues, "Long counted purchase formula", longCountedPurchase, parsed.partnerTotals.longCountedPurchase, "source.long.purchase");
    addCheck(checks, issues, "Long counted payment formula", longCountedPayment, parsed.partnerTotals.longCountedPayment, "source.long.payment");
    addCheck(checks, issues, "Long counted adjustment formula", longCountedAdjustment, parsed.partnerTotals.longCountedAdjustment ?? 0, "source.long.adjustment");
    addCheck(checks, issues, "Long payable formula", longPayable, parsed.partnerTotals.longPayable, "source.long.payable");
    addCheck(checks, issues, "Long historical paid formula", longHistoricalPaid, parsed.partnerTotals.longHistoricalPaid, "source.long.historical_paid");
    addCheck(checks, issues, "Long reference-only formula", longReferenceOnlyAmount, parsed.partnerTotals.longReferenceOnlyAmount, "source.long.reference_only");

    for (const sourceCode of duplicateValues(parsed.partnerEntries.map((entry) => entry.sourceCode))) {
      issues.push(issue("error", "source.partner_duplicate_source_code", `Mã giao dịch ${sourceCode} bị trùng trong dữ liệu nguồn.`));
    }
    for (const entry of parsed.partnerEntries) {
      if (hasInvalidPartnerAmount(entry)) {
        issues.push(issue("error", "source.partner_invalid_amount", `Giao dịch ${entry.sourceCode} có số tiền không hợp lệ.`));
      }
    }
  }

  if (shouldAuditServiceOrders(scope)) {
    const customerQuoted = parsed.customerOrders.reduce((sum, order) => sum + Number(order.quotedPrice || 0), 0);
    const customerPaid = parsed.customerOrders.reduce((sum, order) => sum + order.paidAmount, 0);
    const customerDebt = parsed.customerOrders.reduce((sum, order) => sum + order.debtAmount, 0);
    const missingPriceRows = parsed.customerOrders.filter((order) => order.priceStatus === "LEGACY_MISSING").length;

    addCheck(checks, issues, "Đơn khách row count", parsed.customerOrders.length, parsed.customerOrderTotals.rows, "source.orders.rows");
    addCheck(checks, issues, "Đơn khách quoted total", customerQuoted, parsed.customerOrderTotals.quoted, "source.orders.quoted");
    addCheck(checks, issues, "Đơn khách paid total", customerPaid, parsed.customerOrderTotals.paid, "source.orders.paid");
    addCheck(checks, issues, "Đơn khách debt total", customerDebt, parsed.customerOrderTotals.debt, "source.orders.debt");
    addCheck(checks, issues, "Đơn khách missing price rows", missingPriceRows, parsed.customerOrderTotals.legacyMissingPriceRows, "source.orders.missing_price");

    for (const orderCode of duplicateValues(parsed.customerOrders.map((order) => order.orderCode))) {
      issues.push(issue("error", "source.order_duplicate_code", `Mã đơn ${orderCode} bị trùng trong dữ liệu nguồn.`));
    }
    for (const order of parsed.customerOrders) {
      if (!order.orderCode) {
        issues.push(issue("error", "source.order_missing_code", `Dòng nguồn ${order.sourceRow || "không rõ"} thiếu mã đơn.`));
      }
      if (order.paidAmount > Number(order.quotedPrice || 0) && expectedPriceStatus(order) === "CONFIRMED") {
        issues.push(issue("error", "source.order_overpaid", `Đơn ${order.orderCode} đã thu nhiều hơn tổng tiền.`));
      }
    }
  }

  return {
    checks,
    issues,
    ok: !issues.some((item) => item.severity === "error"),
    summary: {
      customerOrders: parsed.customerOrders.length,
      longPayable: parsed.partnerTotals.longPayable,
      partnerEntries: parsed.partnerEntries.length,
      partners: parsed.partners.length,
    },
  };
}

export function auditDatabaseFinancialSnapshot(snapshot: DatabaseAuditSnapshot): FinancialAuditSection {
  const issues: IssueList = [];
  const checks: FinancialAuditCheck[] = [];
  const sourceCodes = snapshot.partnerEntries.map((entry) => entry.sourceCode || "");

  for (const orderCode of duplicateValues(snapshot.serviceOrders.map((order) => order.orderCode))) {
    issues.push(issue("error", "db.order_duplicate_code", `Mã đơn ${orderCode} bị trùng trong DB.`));
  }
  for (const sourceCode of duplicateValues(sourceCodes)) {
    issues.push(issue("error", "db.partner_duplicate_source_code", `Mã giao dịch ${sourceCode} bị trùng trong DB.`));
  }

  const serviceSummary = snapshot.serviceOrders.reduce(
    (summary, order) => {
      const financials = calculateServiceOrderFinancials(order);
      summary.debt += financials.debt;
      summary.discount += financials.discount;
      summary.overpaid += financials.overpaid;
      summary.paid += financials.paid;
      summary.payable += financials.payable;
      summary.quoted += financials.quoted;

      if (order.priceStatus === "CONFIRMED" && (!order.quotedPrice || order.quotedPrice <= 0)) {
        issues.push(issue("error", "db.confirmed_order_missing_price", `Đơn ${order.orderCode} đã xác nhận giá nhưng thiếu tổng tiền.`));
      }
      if (financials.discount > financials.quoted) {
        issues.push(issue("error", "db.discount_exceeds_price", `Đơn ${order.orderCode} có giảm giá lớn hơn tổng tiền.`));
      }
      if (order.priceStatus === "CONFIRMED" && financials.overpaid > 0) {
        issues.push(issue("error", "db.order_overpaid", `Đơn ${order.orderCode} đã thu nhiều hơn phải thu.`));
      }
      if ((order.priceStatus === "PENDING_QUOTE" || order.priceStatus === "LEGACY_MISSING") && order.quotedPrice !== null) {
        issues.push(issue("error", "db.unpriced_order_has_price", `Đơn ${order.orderCode} chưa/chênh giá nhưng vẫn có tổng tiền.`));
      }
      return summary;
    },
    { debt: 0, discount: 0, overpaid: 0, paid: 0, payable: 0, quoted: 0 }
  );

  const partnerBalance = getPartnerBalance(snapshot.partnerEntries);
  const signedPartnerTotal = snapshot.partnerEntries.reduce((sum, entry) => sum + getPartnerEntrySignedAmount(entry), 0);
  addCheck(checks, issues, "Partner ledger signed balance", signedPartnerTotal, partnerBalance, "db.partner.balance_formula");

  for (const entry of snapshot.partnerEntries) {
    if (hasInvalidPartnerAmount(entry)) {
      issues.push(issue("error", "db.partner_invalid_amount", `Giao dịch ${entry.id} có số tiền không hợp lệ.`));
    }
  }

  return {
    checks,
    issues,
    ok: !issues.some((item) => item.severity === "error"),
    summary: {
      partnerBalance,
      partnerEntries: snapshot.partnerEntries.length,
      serviceDebt: serviceSummary.debt,
      serviceOrders: snapshot.serviceOrders.length,
      servicePaid: serviceSummary.paid,
      servicePayable: serviceSummary.payable,
      serviceQuoted: serviceSummary.quoted,
    },
  };
}

export function auditSourceMatchesDatabase(
  parsed: MinhHongParsedWorkbook,
  snapshot: DatabaseAuditSnapshot,
  scope: MinhHongImportScope = "all"
): FinancialAuditSection {
  const issues: IssueList = [];
  const checks: FinancialAuditCheck[] = [];
  const ordersByCode = new Map(snapshot.serviceOrders.map((order) => [order.orderCode, order]));
  const entriesBySourceCode = new Map(snapshot.partnerEntries.flatMap((entry) => entry.sourceCode ? [[entry.sourceCode, entry] as const] : []));

  if (shouldAuditServiceOrders(scope)) {
    let matchedOrders = 0;
    for (const order of parsed.customerOrders) {
      const dbOrder = ordersByCode.get(order.orderCode);
      if (!dbOrder) {
        issues.push(issue("error", "match.order_missing", `DB chưa có đơn ${order.orderCode} từ Sheet.`));
        continue;
      }
      matchedOrders += 1;
      if (dbOrder.priceStatus !== expectedPriceStatus(order)) {
        issues.push(issue("error", "match.order_price_status", `Đơn ${order.orderCode} lệch trạng thái giá.`));
      }
      if (Number(dbOrder.quotedPrice || 0) !== Number(order.quotedPrice || 0)) {
        issues.push(issue("error", "match.order_quoted", `Đơn ${order.orderCode} lệch tổng tiền.`));
      }
      if (dbOrder.paidAmount !== order.paidAmount) {
        issues.push(issue("error", "match.order_paid", `Đơn ${order.orderCode} lệch đã thu.`));
      }
    }
    addCheck(checks, issues, "Matched source orders in DB", matchedOrders, parsed.customerOrders.length, "match.orders.count");
  }

  if (shouldAuditPartners(scope)) {
    let matchedEntries = 0;
    for (const entry of parsed.partnerEntries) {
      const dbEntry = entriesBySourceCode.get(entry.sourceCode);
      if (!dbEntry) {
        issues.push(issue("error", "match.partner_entry_missing", `DB chưa có giao dịch ${entry.sourceCode} từ Sheet.`));
        continue;
      }
      matchedEntries += 1;
      if (dbEntry.amount !== entry.amount) {
        issues.push(issue("error", "match.partner_entry_amount", `Giao dịch ${entry.sourceCode} lệch số tiền.`));
      }
      if (dbEntry.countsInDebt !== entry.countsInDebt) {
        issues.push(issue("error", "match.partner_entry_counts", `Giao dịch ${entry.sourceCode} lệch cờ tính công nợ.`));
      }
      if (dbEntry.entryType !== entry.entryType) {
        issues.push(issue("error", "match.partner_entry_type", `Giao dịch ${entry.sourceCode} lệch loại giao dịch.`));
      }
      if (dbEntry.discountPercent !== entry.discountPercent) {
        issues.push(issue("error", "match.partner_entry_discount_percent", `Giao dịch ${entry.sourceCode} lệch phần trăm chiết khấu.`));
      }
      if (dbEntry.discountAmount !== entry.discountAmount) {
        issues.push(issue("error", "match.partner_entry_discount_amount", `Giao dịch ${entry.sourceCode} lệch số tiền chiết khấu.`));
      }
    }
    addCheck(checks, issues, "Matched source partner entries in DB", matchedEntries, parsed.partnerEntries.length, "match.partner_entries.count");
  }

  return {
    checks,
    issues,
    ok: !issues.some((item) => item.severity === "error"),
    summary: {},
  };
}

export function combineFinancialAuditSections(sections: { database?: FinancialAuditSection; source?: FinancialAuditSection }): FinancialAuditReport {
  const issues = [
    ...(sections.source?.issues || []),
    ...(sections.database?.issues || []),
  ];

  return {
    ...sections,
    issues,
    ok: !issues.some((item) => item.severity === "error"),
  };
}

export function buildDatabaseAuditSnapshotFromPrisma(
  serviceOrders: Array<{
    discountAmount: number;
    id: string;
    orderCode: string;
    paidAmount: number;
    priceStatus: string;
    quotedPrice: number | null;
    source: string;
  }>,
  partnerEntries: Array<{
    amount: number;
    countsInDebt: boolean;
    discountAmount: number;
    discountPercent: number | null;
    entryType: string;
    id: string;
    partner: { code: string };
    sourceCode: string | null;
  }>
): DatabaseAuditSnapshot {
  return {
    partnerEntries: partnerEntries.map((entry) => ({
      amount: entry.amount,
      countsInDebt: entry.countsInDebt,
      discountAmount: entry.discountAmount,
      discountPercent: entry.discountPercent,
      entryType: entry.entryType,
      id: entry.id,
      partnerCode: entry.partner.code,
      sourceCode: entry.sourceCode,
    })),
    serviceOrders: serviceOrders.map((order) => ({
      discountAmount: order.discountAmount,
      id: order.id,
      orderCode: order.orderCode,
      paidAmount: order.paidAmount,
      priceStatus: order.priceStatus,
      quotedPrice: order.quotedPrice,
      source: order.source,
    })),
  };
}
