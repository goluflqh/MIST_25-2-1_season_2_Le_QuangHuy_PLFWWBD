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
    warranties: new Map<string, Record<string, unknown>>(),
    auditLogs: [] as Array<Record<string, unknown>>,
    transactionOptions: [] as Array<{ maxWait?: number; timeout?: number } | undefined>,
  };

  const findServiceOrder = (where: { id?: string; orderCode?: string }) => {
    if (where.orderCode) return state.serviceOrders.get(where.orderCode) || null;
    if (where.id) {
      return [...state.serviceOrders.values()].find((order) => order.id === where.id) || null;
    }
    return null;
  };

  const withServiceOrderRelations = (order: Record<string, unknown> | null, include?: Record<string, unknown>) => {
    if (!order || !include) return order;
    return {
      ...order,
      customer: include.customer
        ? [...state.customers.values()].find((customer) => customer.id === order.customerId) || null
        : undefined,
      user: include.user ? null : undefined,
      warranty: include.warranty
        ? [...state.warranties.values()].find((warranty) => warranty.serviceOrderId === order.id) || null
        : undefined,
    };
  };

  const runner: ImportRunner = {
    $transaction: async <T>(
      callback: (tx: ImportRunner) => Promise<T>,
      options?: { maxWait?: number; timeout?: number }
    ) => {
      state.transactionOptions.push(options);
      return callback(runner);
    },
    partner: {
      findMany: async ({ where }: { where: { code: { in: string[] } } }) => (
        where.code.in.map((code) => state.partners.get(code)).filter(Boolean) as Array<Record<string, unknown>>
      ),
      findUnique: async ({ where }: { where: { code: string } }) => state.partners.get(where.code) || null,
      upsert: async ({ where, create, update }: { where: { code: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const existing = state.partners.get(where.code);
        const value = { ...(existing || { id: `partner-${where.code}` }), ...(existing ? update : create) };
        state.partners.set(where.code, value);
        return value;
      },
    },
    partnerLedgerEntry: {
      findMany: async ({ where }: { where: { sourceCode: { in: string[] } } }) => (
        where.sourceCode.in.map((sourceCode) => state.partnerLedgerEntries.get(sourceCode)).filter(Boolean) as Array<Record<string, unknown>>
      ),
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
      findMany: async ({ where, include }: { where: { orderCode: { in: string[] } }; include?: Record<string, unknown> }) => (
        where.orderCode.in
          .map((orderCode) => withServiceOrderRelations(findServiceOrder({ orderCode }), include))
          .filter(Boolean) as Array<Record<string, unknown>>
      ),
      findUnique: async ({ where, include }: { where: { id?: string; orderCode?: string }; include?: Record<string, unknown> }) => (
        withServiceOrderRelations(findServiceOrder(where), include)
      ),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const value = { id: `order-${data.orderCode}`, ...data };
        state.serviceOrders.set(String(data.orderCode), value);
        return value;
      },
      update: async ({ where, data }: { where: { id?: string; orderCode?: string }; data: Record<string, unknown> }) => {
        const existing = findServiceOrder(where) || { id: `order-${where.orderCode || where.id}`, orderCode: where.orderCode || where.id };
        const orderCode = String(existing.orderCode || data.orderCode || where.orderCode || where.id);
        const value: Record<string, unknown> = {
          ...existing,
          ...data,
          id: String(existing.id || `order-${orderCode}`),
        };
        state.serviceOrders.set(String(value.orderCode), value);
        return value;
      },
    },
    warranty: {
      findUnique: async ({ where }: { where: { serialNo?: string; serviceOrderId?: string } }) => {
        if (where.serialNo) {
          return [...state.warranties.values()].find((warranty) => warranty.serialNo === where.serialNo) || null;
        }
        if (where.serviceOrderId) {
          return [...state.warranties.values()].find((warranty) => warranty.serviceOrderId === where.serviceOrderId) || null;
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const value = { id: `warranty-${state.warranties.size + 1}`, ...data };
        state.warranties.set(String(value.id), value);
        return value;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = state.warranties.get(where.id) || { id: where.id };
        const value = { ...existing, ...data };
        state.warranties.set(where.id, value);
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
  const completedOrders = [...state.serviceOrders.values()].filter((order) => order.status === "COMPLETED");
  assert.equal(state.warranties.size, completedOrders.length);
  assert.equal(completedOrders.every((order) => order.warrantyMonths === 6 && order.warrantyEndDate instanceof Date), true);
  assert.equal([...state.partnerLedgerEntries.keys()].some((key) => key.startsWith("DON_KHACH")), false);
  assert.equal([...state.serviceOrders.values()].every((order) => order.source === "IMPORT" && order.sourceName === "Đơn khách"), true);
  assert.equal([...state.serviceOrders.values()].every((order) => String(order.customerPhone || "").length >= 10), true);
  assert.equal(state.auditLogs.length, 1);
  assert.deepEqual(state.transactionOptions, [{ maxWait: 10_000, timeout: 120_000 }]);
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

test("service-order scoped import creates and refreshes linked six-month warranties from source order dates", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = {
    ...baseline.customerOrders[0],
    orderCode: "DH-WARRANTY-SYNC",
    sourceCode: "DON_KHACH:DH-WARRANTY-SYNC",
    sourceRow: 777,
    orderDate: "10/01/2026",
    customerName: "Khach warranty sync",
    customerPhone: "0901234567",
    productName: "Pin warranty sync",
    quotedPrice: 1_200_000,
    paidAmount: 1_200_000,
    debtAmount: 0,
    priceStatus: "CONFIRMED" as const,
  };
  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [sourceOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });

  const savedOrder = state.serviceOrders.get("DH-WARRANTY-SYNC");
  const warranty = [...state.warranties.values()][0];
  assert.ok(savedOrder);
  assert.ok(warranty);
  assert.equal(state.warranties.size, 1);
  assert.equal(warranty.serviceOrderId, savedOrder.id);
  assert.equal(warranty.productName, "Pin warranty sync");
  assert.equal(getVietnamDateKey(warranty.startDate as Date), "2026-01-10");
  assert.equal(getVietnamDateKey(warranty.endDate as Date), "2026-07-10");
  assert.equal(getVietnamDateKey(savedOrder.warrantyEndDate as Date), "2026-07-10");

  const changed = {
    ...parsed,
    customerOrders: [{
      ...sourceOrder,
      orderDate: "20/01/2026",
      productName: "Pin warranty sync updated",
    }],
  };
  await importMinhHongParsedWorkbook(changed, runner, { scope: "service-orders", userId: "admin-test" });

  const refreshedWarranty = state.warranties.get(String(warranty.id));
  const refreshedOrder = state.serviceOrders.get("DH-WARRANTY-SYNC");
  assert.equal(state.warranties.size, 1);
  assert.equal(refreshedWarranty?.productName, "Pin warranty sync updated");
  assert.equal(getVietnamDateKey(refreshedWarranty?.startDate as Date), "2026-01-20");
  assert.equal(getVietnamDateKey(refreshedWarranty?.endDate as Date), "2026-07-20");
  assert.equal(getVietnamDateKey(refreshedOrder?.warrantyEndDate as Date), "2026-07-20");
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
  assert.equal(state.warranties.size, [...state.serviceOrders.values()].filter((order) => order.status === "COMPLETED").length);
  assert.equal(state.auditLogs.length, 2);
  assert.deepEqual(second.changes.partnerEntries, { created: 0, updated: 0, unchanged: 80 });
  assert.deepEqual(second.changes.serviceOrders, { created: 0, updated: 0, unchanged: 41 });
  assert.equal(second.partnerEntriesUpserted, 0);
  assert.equal(second.serviceOrdersUpserted, 0);
});

test("service-order import preserves web-only customer addresses that are not present in the Sheet", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });
  const orderCode = parsed.customerOrders[0].orderCode;
  const importedOrder = state.serviceOrders.get(orderCode);
  assert.ok(importedOrder);
  importedOrder.customerAddress = "123 Nguyen Van Linh";

  const second = await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.get(orderCode)?.customerAddress, "123 Nguyen Van Linh");
  assert.equal(second.changes.serviceOrders.updated, 0);
});

test("previews new, changed, and unchanged rows before writing", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();
  await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  const changed = {
    ...parsed,
    customerOrders: parsed.customerOrders.map((order, index) => index === 0 ? { ...order, paidAmount: order.paidAmount + 10_000 } : order),
    partnerEntries: [
      ...parsed.partnerEntries.map((entry, index) => index === 0 ? { ...entry, amount: entry.amount + 5_000 } : entry),
      { ...parsed.partnerEntries[0], sourceCode: "NHAP_HANG:NH-NEW", sourceRow: 999 },
    ],
  };
  const before = {
    entries: state.partnerLedgerEntries.size,
    orders: state.serviceOrders.size,
  };

  const preview = await previewMinhHongParsedWorkbook(changed, runner);

  assert.deepEqual(preview.partnerEntries, { created: 1, updated: 1, unchanged: 79 });
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 40 });
  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.records.partnerEntries, [
    {
      action: "updated",
      changes: [{
        after: `${changed.partnerEntries[0].amount.toLocaleString("vi-VN")}đ`,
        before: `${parsed.partnerEntries[0].amount.toLocaleString("vi-VN")}đ`,
        field: "amount",
        label: "Số tiền",
      }],
      key: changed.partnerEntries[0].sourceCode,
      label: changed.partnerEntries[0].description,
    },
    {
      action: "created",
      changes: [],
      key: "NHAP_HANG:NH-NEW",
      label: changed.partnerEntries.at(-1)?.description,
    },
  ]);
  assert.deepEqual(preview.records.serviceOrders, [{
    action: "updated",
    changes: [{
      after: `${changed.customerOrders[0].paidAmount.toLocaleString("vi-VN")}đ`,
      before: `${parsed.customerOrders[0].paidAmount.toLocaleString("vi-VN")}đ`,
      field: "paidAmount",
      label: "Đã thu",
    }],
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
