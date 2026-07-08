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
