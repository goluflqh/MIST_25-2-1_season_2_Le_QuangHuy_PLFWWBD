import assert from "node:assert/strict";
import test from "node:test";
import {
  auditDatabaseFinancialSnapshot,
  auditParsedMinhHongWorkbookFinancials,
} from "../../lib/minhhong-financial-audit";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";

test("passes the clean approved Minh Hong workbook financial audit", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const audit = auditParsedMinhHongWorkbookFinancials(parsed, {
    reconciliation: reconcileMinhHongWorkbook(parsed),
  });

  assert.equal(audit.ok, true);
  assert.equal(audit.summary.longPayable, 12_720_000);
  assert.equal(audit.summary.customerOrders, 41);
  assert.equal(audit.issues.filter((issue) => issue.severity === "error").length, 0);
});

test("fails when workbook reconciliation rows do not match parsed totals", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const audit = auditParsedMinhHongWorkbookFinancials({
    ...parsed,
    reconciliation: {
      ...parsed.reconciliation,
      long_payable: parsed.partnerTotals.longPayable + 1,
    },
  });

  assert.equal(audit.ok, false);
  assert.match(audit.issues.map((issue) => issue.code).join("\n"), /source\.reconciliation\.long_payable/);
});

test("accepts blank reference history and applies signed partner adjustments", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const adjustedPayable = parsed.partnerTotals.longPayable - 10_000;
  const audited = {
    ...parsed,
    partnerEntries: [
      ...parsed.partnerEntries,
      {
        ...parsed.partnerEntries[0],
        amount: 0,
        countsInDebt: false,
        description: "Đơn cũ thiếu giá",
        entryType: "PURCHASE" as const,
        sourceCode: "NHAP_HANG:REFERENCE-WITHOUT-AMOUNT",
      },
      {
        ...parsed.partnerEntries[0],
        amount: -10_000,
        countsInDebt: true,
        description: "Điều chỉnh giảm công nợ",
        entryType: "ADJUSTMENT" as const,
        sourceCode: "NHAP_HANG:NEGATIVE-ADJUSTMENT",
      },
    ],
    partnerTotals: {
      ...parsed.partnerTotals,
      longCountedAdjustment: -10_000,
      longPayable: adjustedPayable,
    },
    reconciliation: {
      ...parsed.reconciliation,
      long_payable: adjustedPayable,
    },
  };

  const audit = auditParsedMinhHongWorkbookFinancials(audited, {
    reconciliation: reconcileMinhHongWorkbook(audited, { scope: "partners" }),
    scope: "partners",
  });

  assert.equal(audit.ok, true, JSON.stringify(audit.issues, null, 2));
  assert.equal(audit.summary.longPayable, adjustedPayable);
  assert.equal(audit.issues.filter((item) => item.severity === "error").length, 0);
});

test("database audit fails closed on impossible money states", () => {
  const audit = auditDatabaseFinancialSnapshot({
    partnerEntries: [
      {
        amount: 100_000,
        countsInDebt: true,
        entryType: "PURCHASE",
        id: "entry-1",
        partnerCode: "LONG",
        sourceCode: "NHAP_HANG:NH-1",
      },
    ],
    serviceOrders: [
      {
        discountAmount: 0,
        id: "order-1",
        orderCode: "DH-1",
        paidAmount: 1_200_000,
        priceStatus: "CONFIRMED",
        quotedPrice: 1_000_000,
        source: "IMPORT",
      },
      {
        discountAmount: 200_000,
        id: "order-2",
        orderCode: "DH-2",
        paidAmount: 0,
        priceStatus: "CONFIRMED",
        quotedPrice: 100_000,
        source: "IMPORT",
      },
    ],
  });

  assert.equal(audit.ok, false);
  assert.match(audit.issues.map((issue) => issue.code).join("\n"), /db\.order_overpaid/);
  assert.match(audit.issues.map((issue) => issue.code).join("\n"), /db\.discount_exceeds_price/);
});

test("database audit allows reference blanks and signed adjustments but rejects zero adjustments", () => {
  const validAudit = auditDatabaseFinancialSnapshot({
    partnerEntries: [
      {
        amount: 0,
        countsInDebt: false,
        entryType: "PURCHASE",
        id: "reference-without-amount",
        partnerCode: "LONG",
        sourceCode: "NHAP_HANG:REFERENCE-WITHOUT-AMOUNT",
      },
      {
        amount: -10_000,
        countsInDebt: true,
        entryType: "ADJUSTMENT",
        id: "negative-adjustment",
        partnerCode: "LONG",
        sourceCode: "NHAP_HANG:NEGATIVE-ADJUSTMENT",
      },
    ],
    serviceOrders: [],
  });
  const invalidAudit = auditDatabaseFinancialSnapshot({
    partnerEntries: [
      {
        amount: 0,
        countsInDebt: true,
        entryType: "ADJUSTMENT",
        id: "zero-adjustment",
        partnerCode: "LONG",
        sourceCode: "NHAP_HANG:ZERO-ADJUSTMENT",
      },
    ],
    serviceOrders: [],
  });

  assert.equal(validAudit.ok, true, JSON.stringify(validAudit.issues, null, 2));
  assert.equal(validAudit.summary.partnerBalance, -10_000);
  assert.equal(invalidAudit.ok, false);
  assert.match(invalidAudit.issues.map((item) => item.code).join("\n"), /db\.partner_invalid_amount/);
});
