import assert from "node:assert/strict";
import test from "node:test";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { importMinhHongParsedWorkbook, previewMinhHongParsedWorkbook, type ImportRunner } from "../../lib/minhhong-import/workbook-importer";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";
import { getVietnamDateKey } from "../../lib/vietnam-time";

async function parsedWorkbook() {
  return parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
}

function createFakeImportRunner() {
  const state = {
    partners: new Map<string, Record<string, unknown>>(),
    partnerLedgerEntries: new Map<string, Record<string, unknown>>(),
    customers: new Map<string, Record<string, unknown>>(),
    serviceOrders: new Map<string, Record<string, unknown>>(),
    auditLogs: [] as Array<Record<string, unknown>>,
  };

  const runner: ImportRunner = {
    $transaction: async <T>(callback: (tx: ImportRunner) => Promise<T>) => callback(runner),
    partner: {
      findUnique: async ({ where }: { where: { code: string } }) => state.partners.get(where.code) || null,
      upsert: async ({ where, create, update }: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = state.partners.get(where.code);
        const value = { ...(existing || { id: `partner-${where.code}` }), ...(existing ? update : create) };
        state.partners.set(where.code, value);
        return value;
      },
    },
    partnerLedgerEntry: {
      findUnique: async ({ where }: { where: { sourceCode: string } }) => state.partnerLedgerEntries.get(where.sourceCode) || null,
      upsert: async ({ where, create, update }: { where: { sourceCode: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = state.partnerLedgerEntries.get(where.sourceCode);
        const value = { ...(existing || { id: `entry-${where.sourceCode}` }), ...(existing ? update : create) };
        state.partnerLedgerEntries.set(where.sourceCode, value);
        return value;
      },
    },
    customer: {
      upsert: async ({ where, create, update }: { where: { phone: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = state.customers.get(where.phone);
        const value = { ...(existing || { id: `customer-${where.phone}` }), ...(existing ? update : create) };
        state.customers.set(where.phone, value);
        return value;
      },
    },
    serviceOrder: {
      findUnique: async ({ where }: { where: { orderCode: string } }) => state.serviceOrders.get(where.orderCode) || null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const value = { id: `order-${data.orderCode}`, ...data };
        state.serviceOrders.set(String(data.orderCode), value);
        return value;
      },
      update: async ({ where, data }: { where: { orderCode: string }; data: Record<string, unknown> }) => {
        const existing = state.serviceOrders.get(where.orderCode) || { id: `order-${where.orderCode}`, orderCode: where.orderCode };
        const value = { ...existing, ...data };
        state.serviceOrders.set(where.orderCode, value);
        return value;
      },
    },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        state.auditLogs.push(data);
        return data;
      },
    },
  };

  return { runner, state };
}

test("imports the parsed workbook into idempotent partner and order records", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  assert.equal(summary.partnersUpserted, parsed.partners.length);
  assert.equal(summary.partnerEntriesUpserted, 80);
  assert.equal(summary.serviceOrdersUpserted, 41);
  assert.equal(state.partners.size, parsed.partners.length);
  assert.equal(state.partnerLedgerEntries.size, 80);
  assert.equal(state.serviceOrders.size, 41);
  assert.equal([...state.partnerLedgerEntries.keys()].some((key) => key.startsWith("DON_KHACH")), false);
  assert.equal([...state.serviceOrders.values()].every((order) => order.source === "IMPORT" && order.sourceName === "Đơn khách"), true);
  assert.equal([...state.serviceOrders.values()].every((order) => String(order.customerPhone || "").length >= 10), true);
  assert.equal(state.auditLogs.length, 1);
});

test("service-order scoped import leaves partner ledger records untouched", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(summary.partnersUpserted, 0);
  assert.equal(summary.partnerEntriesUpserted, 0);
  assert.equal(summary.serviceOrdersUpserted, 41);
  assert.equal(state.partners.size, 0);
  assert.equal(state.partnerLedgerEntries.size, 0);
  assert.equal(state.serviceOrders.size, 41);
  assert.equal(state.auditLogs.length, 1);
});

test("partner scoped import leaves service orders untouched", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { scope: "partners", userId: "admin-test" });

  assert.equal(summary.partnersUpserted, 10);
  assert.equal(summary.partnerEntriesUpserted, 80);
  assert.equal(summary.serviceOrdersUpserted, 0);
  assert.equal(summary.customersUpserted, 0);
  assert.equal(state.partners.size, parsed.partners.length);
  assert.equal(state.partnerLedgerEntries.size, 80);
  assert.equal(state.customers.size, 0);
  assert.equal(state.serviceOrders.size, 0);
  assert.equal(state.auditLogs.length, 1);
});

test("service-order scoped import skips invalid typed dates but applies corrected valid order dates", async () => {
  const baseline = await parsedWorkbook();
  const validOrder = {
    ...baseline.customerOrders[0],
    orderCode: "DH-0055",
    sourceCode: "DON_KHACH:DH-0055",
    sourceRow: 58,
    orderDate: "2026-07-07",
    customerName: "Phế liệu qs",
    productName: "Pin 15 cell ss25r",
    quotedPrice: 800_000,
    paidAmount: 800_000,
    debtAmount: 0,
  };
  const invalidOrder = {
    ...baseline.customerOrders[1],
    orderCode: "DH-BAD-DATE",
    sourceCode: "DON_KHACH:DH-BAD-DATE",
    sourceRow: 19,
    orderDate: "37/1/2026",
  };
  const parsed = {
    ...baseline,
    customerOrders: [validOrder, invalidOrder],
    errors: [
      { sheet: "Đối soát", rowNumber: 13, message: "Đơn hàng đã bán dòng 19: ngày \"37/1/2026\" không hợp lệ." },
    ],
    warnings: [
      "Đơn hàng đã bán dòng 58: ngày \"7/72026\" được tự sửa thành \"07/07/2026\".",
    ],
  };
  const { runner, state } = createFakeImportRunner();
  state.serviceOrders.set("DH-0055", {
    orderCode: "DH-0055",
    source: "IMPORT",
    sourceRow: 58,
    orderDate: new Date(Date.UTC(1900, 0, 58)),
  });

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });
  const updatedOrderDate = state.serviceOrders.get("DH-0055")?.orderDate;

  assert.equal(summary.serviceOrdersUpserted, 1);
  assert.equal(state.serviceOrders.has("DH-BAD-DATE"), false);
  assert.ok(updatedOrderDate instanceof Date);
  assert.equal(getVietnamDateKey(updatedOrderDate), "2026-07-07");
  assert.equal(summary.warnings.some((warning) => warning.includes("Dòng Excel 19")), true);
  assert.equal(summary.warnings.some((warning) => warning.includes("Dòng Excel 58")), true);
});

test("imports missing Excel order dates as stable source-row sentinels instead of import time", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  const firstOrder = state.serviceOrders.get("DH-0001");
  const orderDate = firstOrder?.orderDate;

  assert.ok(orderDate instanceof Date);
  assert.equal(orderDate.getUTCFullYear(), 1900);
  assert.equal(firstOrder?.sourceRow, 4);
});

test("running the same parsed workbook twice does not create duplicate records", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });
  const second = await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  assert.equal(state.partners.size, parsed.partners.length);
  assert.equal(state.partnerLedgerEntries.size, 80);
  assert.equal(state.serviceOrders.size, 41);
  assert.equal(state.auditLogs.length, 2);
  assert.deepEqual(second.changes.partnerEntries, { created: 0, updated: 0, unchanged: 80 });
  assert.deepEqual(second.changes.serviceOrders, { created: 0, updated: 0, unchanged: 41 });
  assert.equal(second.partnerEntriesUpserted, 0);
  assert.equal(second.serviceOrdersUpserted, 0);
});

test("previews new, changed, and unchanged rows before writing", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();
  await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  const changed = {
    ...parsed,
    customerOrders: parsed.customerOrders.map((order, index) => index === 0 ? { ...order, paidAmount: order.paidAmount + 10_000 } : order),
    partnerEntries: [
      ...parsed.partnerEntries,
      { ...parsed.partnerEntries[0], sourceCode: "NHAP_HANG:NH-NEW", sourceRow: 999 },
    ],
  };
  const before = {
    entries: state.partnerLedgerEntries.size,
    orders: state.serviceOrders.size,
  };

  const preview = await previewMinhHongParsedWorkbook(changed, runner);

  assert.deepEqual(preview.partnerEntries, { created: 1, updated: 0, unchanged: 80 });
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 40 });
  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.records.partnerEntries, [{
    action: "created",
    key: "NHAP_HANG:NH-NEW",
    label: changed.partnerEntries.at(-1)?.description,
  }]);
  assert.deepEqual(preview.records.serviceOrders, [{
    action: "updated",
    key: changed.customerOrders[0].orderCode,
    label: `Dòng Excel ${changed.customerOrders[0].sourceRow} · ${changed.customerOrders[0].customerName} · ${changed.customerOrders[0].productName}`,
  }]);
  assert.equal(state.partnerLedgerEntries.size, before.entries);
  assert.equal(state.serviceOrders.size, before.orders);
});

test("preview reports a manual order conflict before confirm", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();
  const conflictingCode = parsed.customerOrders[0].orderCode;
  state.serviceOrders.set(conflictingCode, { orderCode: conflictingCode, source: "MANUAL", deletedAt: null });

  const preview = await previewMinhHongParsedWorkbook(parsed, runner);

  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0], new RegExp(conflictingCode));
});

test("blocks import instead of overwriting a non-import manual order with the same code", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();
  const conflictingCode = parsed.customerOrders[0].orderCode;
  state.serviceOrders.set(conflictingCode, { orderCode: conflictingCode, source: "MANUAL", deletedAt: null });

  await assert.rejects(
    () => importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" }),
    /không ghi đè đơn thủ công/i
  );
});

test("allows replacing a deleted manual order with an imported order of the same code", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();
  const reusableCode = parsed.customerOrders[0].orderCode;
  state.serviceOrders.set(reusableCode, { orderCode: reusableCode, source: "MANUAL", deletedAt: new Date("2026-05-01T00:00:00.000Z") });

  await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  assert.equal(state.serviceOrders.get(reusableCode)?.source, "IMPORT");
});
