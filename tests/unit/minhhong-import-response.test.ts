import assert from "node:assert/strict";
import test from "node:test";
import { buildMinhHongImportResponse } from "../../lib/minhhong-import/api-response";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";

test("builds the stable preview response shape", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed);
  const response = buildMinhHongImportResponse("preview", parsed, reconciliation);

  assert.equal(response.success, true);
  assert.equal(response.mode, "preview");
  assert.deepEqual(response.counts, {
    partners: 10,
    partnerEntries: 80,
    customerOrders: 41,
    skippedRows: 0,
    errors: 0,
  });
  assert.deepEqual(response.totals, {
    longPayable: 12_720_000,
    longHistoricalPaid: 60_000_000,
    customerOrderTotal: 36_825_000,
    customerOrderPaid: 29_790_000,
  });
  assert.equal(response.reconciliation.ok, true);
  assert.equal("importResult" in response, false);
  assert.equal("changes" in response, false);
});

test("includes database change preview when supplied", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed);
  const changes = {
    partners: { created: 0, updated: 0, unchanged: 10 },
    partnerEntries: { created: 2, updated: 1, unchanged: 80 },
    serviceOrders: { created: 3, updated: 1, unchanged: 41 },
    conflicts: [],
    records: {
      partnerEntries: [{ action: "created" as const, key: "NH-0042", label: "Mua camera" }],
      serviceOrders: [{ action: "updated" as const, key: "DH-0041", label: "Anh Hiệp · Camera" }],
    },
  };

  const response = buildMinhHongImportResponse("preview", parsed, reconciliation, undefined, changes);

  assert.deepEqual(response.changes, changes);
});

test("includes pending source Sheet date repair count in preview responses", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed);
  const response = buildMinhHongImportResponse(
    "preview",
    parsed,
    reconciliation,
    undefined,
    undefined,
    { sourceSheetDateRepairs: 2 }
  );

  assert.equal(response.sourceSheetDateRepairs, 2);
});

test("builds a service-order scoped response without partner ledger numbers", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: "service-orders" });
  const changes = {
    partners: { created: 0, updated: 0, unchanged: 10 },
    partnerEntries: { created: 2, updated: 1, unchanged: 80 },
    serviceOrders: { created: 3, updated: 1, unchanged: 37 },
    conflicts: [],
    records: {
      partnerEntries: [{ action: "created" as const, key: "NH-0042", label: "Mua camera" }],
      serviceOrders: [{ action: "updated" as const, key: "DH-0041", label: "Anh Hiệp · Camera" }],
    },
  };

  const response = buildMinhHongImportResponse("preview", parsed, reconciliation, undefined, changes, { scope: "service-orders" });

  assert.deepEqual(response.counts, {
    partners: 0,
    partnerEntries: 0,
    customerOrders: 41,
    skippedRows: 0,
    errors: 0,
  });
  assert.deepEqual(response.totals, {
    longPayable: 0,
    longHistoricalPaid: 0,
    customerOrderTotal: 36_825_000,
    customerOrderPaid: 29_790_000,
  });
  assert.equal(response.changes?.partnerEntries.created, 2, "raw change data stays available for all-scope callers");
});

test("builds a partner scoped response without customer order numbers", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: "partners" });
  const changes = {
    partners: { created: 0, updated: 1, unchanged: 9 },
    partnerEntries: { created: 2, updated: 1, unchanged: 77 },
    serviceOrders: { created: 3, updated: 1, unchanged: 37 },
    conflicts: [],
    records: {
      partnerEntries: [{ action: "created" as const, key: "NH-0042", label: "Mua camera" }],
      serviceOrders: [{ action: "updated" as const, key: "DH-0041", label: "Anh Hiệp · Camera" }],
    },
  };

  const response = buildMinhHongImportResponse("preview", parsed, reconciliation, undefined, changes, { scope: "partners" });

  assert.deepEqual(response.counts, {
    partners: 10,
    partnerEntries: 80,
    customerOrders: 0,
    skippedRows: 0,
    errors: 0,
  });
  assert.deepEqual(response.totals, {
    longPayable: 12_720_000,
    longHistoricalPaid: 60_000_000,
    customerOrderTotal: 0,
    customerOrderPaid: 0,
  });
  assert.equal(response.changes?.serviceOrders.created, 3, "raw change data stays available for all-scope callers");
});

test("scopes skipped row counts to the active import domain", async () => {
  const baseline = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const parsed = {
    ...baseline,
    skippedRows: [
      { sheet: "Đơn khách", rowNumber: 12, reason: "Bỏ qua dòng chỉ có mã đơn DH-TEST" },
      { sheet: "Nhập hàng", rowNumber: 5, reason: "Thiếu mã giao dịch nhập hàng" },
    ],
  };
  const all = buildMinhHongImportResponse("preview", parsed, reconcileMinhHongWorkbook(parsed));
  const serviceOrders = buildMinhHongImportResponse(
    "preview",
    parsed,
    reconcileMinhHongWorkbook(parsed, { scope: "service-orders" }),
    undefined,
    undefined,
    { scope: "service-orders" }
  );
  const partners = buildMinhHongImportResponse(
    "preview",
    parsed,
    reconcileMinhHongWorkbook(parsed, { scope: "partners" }),
    undefined,
    undefined,
    { scope: "partners" }
  );

  assert.equal(all.counts.skippedRows, 2);
  assert.equal(serviceOrders.counts.skippedRows, 1);
  assert.equal(partners.counts.skippedRows, 1);
});

test("includes import result for confirm responses", async () => {
  const parsed = await parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
  const reconciliation = reconcileMinhHongWorkbook(parsed);
  const response = buildMinhHongImportResponse("confirm", parsed, reconciliation, {
    partnersUpserted: 10,
    partnerEntriesUpserted: 80,
    customersUpserted: 41,
    serviceOrdersUpserted: 41,
    sourceSheetDateRepairs: 2,
    skippedRows: 0,
    warnings: [],
    changes: {
      partners: { created: 10, updated: 0, unchanged: 0 },
      partnerEntries: { created: 80, updated: 0, unchanged: 0 },
      serviceOrders: { created: 41, updated: 0, unchanged: 0 },
      conflicts: [],
      records: { partnerEntries: [], serviceOrders: [] },
    },
  });

  assert.equal(response.success, true);
  assert.equal(response.mode, "confirm");
  assert.equal(response.importResult?.serviceOrdersUpserted, 41);
  assert.equal(response.importResult?.sourceSheetDateRepairs, 2);
});
