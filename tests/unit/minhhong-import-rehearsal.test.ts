import assert from "node:assert/strict";
import test from "node:test";
import { parseMinhHongAdminWorkbook, type MinhHongParsedWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import { buildMinhHongRehearsalReport } from "../../lib/minhhong-import/rehearsal";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";

async function parsedWorkbook() {
  return parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
}

test("builds a rolling rehearsal report for the approved workbook totals", async () => {
  const parsed = await parsedWorkbook();
  const report = buildMinhHongRehearsalReport(parsed, reconcileMinhHongWorkbook(parsed), "dry-run");

  assert.equal(report.ok, true);
  assert.equal(report.mode, "dry-run");
  assert.equal(report.baselinePolicy, "rolling");
  assert.equal(report.cleanDbRequiredForConfirm, true);
  assert.equal(report.counts.partners, 10);
  assert.equal(report.counts.partnerEntries, 80);
  assert.equal(report.counts.customerOrders, 41);
  assert.equal(report.totals.longPayable, 12_720_000);
  assert.equal(report.totals.customerOrderTotal, 36_825_000);
  assert.equal(report.blockingIssues.length, 0);
});

test("warns but allows rolling rehearsal when Long payable changes", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerTotals: {
      ...baseline.partnerTotals,
      longPayable: 12_710_000,
    },
  };
  const report = buildMinhHongRehearsalReport(parsed, reconcileMinhHongWorkbook(parsed), "dry-run");

  assert.equal(report.ok, true);
  assert.equal(report.blockingIssues.length, 0);
  assert.match(report.warnings.join("\n"), /Long/);
  assert.match(report.warnings.join("\n"), /12\.710\.000/);
});

test("allows rolling rehearsal when new customer orders are added", async () => {
  const baseline = await parsedWorkbook();
  const addedOrder = {
    ...baseline.customerOrders[0],
    sourceCode: "DON_KHACH:DH-ROLLING-NEW",
    sourceRow: 999,
    orderCode: "DH-ROLLING-NEW",
    quotedPrice: 500_000,
    paidAmount: 200_000,
    debtAmount: 300_000,
  };
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    customerOrders: [...baseline.customerOrders, addedOrder],
    customerOrderTotals: {
      ...baseline.customerOrderTotals,
      rows: baseline.customerOrderTotals.rows + 1,
      pricedRows: baseline.customerOrderTotals.pricedRows + 1,
      quoted: baseline.customerOrderTotals.quoted + 500_000,
      paid: baseline.customerOrderTotals.paid + 200_000,
      debt: baseline.customerOrderTotals.debt + 300_000,
    },
  };
  const report = buildMinhHongRehearsalReport(parsed, reconcileMinhHongWorkbook(parsed), "dry-run");

  assert.equal(report.ok, true);
  assert.equal(report.counts.customerOrders, 42);
  assert.equal(report.blockingIssues.length, 0);
  assert.match(report.warnings.join("\n"), /Đơn khách/);
});

test("blocks rolling rehearsal when customer order rows drop below the approved baseline", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    customerOrders: baseline.customerOrders.slice(0, 40),
  };
  const report = buildMinhHongRehearsalReport(parsed, reconcileMinhHongWorkbook(parsed), "dry-run");

  assert.equal(report.ok, false);
  assert.match(report.blockingIssues.join("\n"), /Đơn khách/);
  assert.match(report.blockingIssues.join("\n"), /41/);
});

test("blocks locked-baseline rehearsal when any approved total drifts", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerTotals: {
      ...baseline.partnerTotals,
      longPayable: 12_710_000,
    },
  };
  const report = buildMinhHongRehearsalReport(
    parsed,
    reconcileMinhHongWorkbook(parsed),
    "dry-run",
    undefined,
    { baselinePolicy: "locked" }
  );

  assert.equal(report.ok, false);
  assert.equal(report.baselinePolicy, "locked");
  assert.match(report.blockingIssues.join("\n"), /Long/);
  assert.match(report.blockingIssues.join("\n"), /12\.720\.000/);
});
