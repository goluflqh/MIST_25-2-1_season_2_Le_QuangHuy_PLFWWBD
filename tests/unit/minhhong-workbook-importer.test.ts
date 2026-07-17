import assert from "node:assert/strict";
import test from "node:test";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { importMinhHongParsedWorkbook, previewMinhHongParsedWorkbook, type ImportRunner } from "../../lib/minhhong-import/workbook-importer";
import {
  APPROVED_DUPLICATE_WARRANTY_PAIRS,
  APPROVED_INITIAL_ORDER_GROUPS,
  APPROVED_STANDALONE_WARRANTY_LINKS,
} from "../../lib/minhhong-import/initial-reconciliation";
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

  const findServiceOrder = (where: { id?: string; orderCode?: string; sourceCode?: string }) => {
    if (where.sourceCode) {
      return [...state.serviceOrders.values()].find((order) => order.sourceCode === where.sourceCode) || null;
    }
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
        if (existing && where.sourceCode !== value.sourceCode) {
          state.partnerLedgerEntries.delete(where.sourceCode);
        }
        state.partnerLedgerEntries.set(String(value.sourceCode || where.sourceCode), value);
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
      findMany: async ({ where, include }: { where: Record<string, unknown>; include?: Record<string, unknown> }) => {
        const conditions = Array.isArray(where.OR)
          ? where.OR as Array<Record<string, { in?: string[] }>>
          : [where as Record<string, { in?: string[] }>];
        const matches = [...state.serviceOrders.values()].filter((order) => conditions.some((condition) => (
          condition.orderCode?.in?.includes(String(order.orderCode))
          || condition.sourceCode?.in?.includes(String(order.sourceCode))
        )));
        return matches.map((order) => withServiceOrderRelations(order, include) as Record<string, unknown>);
      },
      findUnique: async ({ where, include }: { where: { id?: string; orderCode?: string; sourceCode?: string }; include?: Record<string, unknown> }) => (
        withServiceOrderRelations(findServiceOrder(where), include)
      ),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const value = { id: `order-${data.orderCode}`, ...data };
        state.serviceOrders.set(String(data.orderCode), value);
        return value;
      },
      update: async ({ where, data }: { where: { id?: string; orderCode?: string; sourceCode?: string }; data: Record<string, unknown> }) => {
        const existing = findServiceOrder(where) || {
          id: `order-${where.orderCode || where.sourceCode || where.id}`,
          orderCode: where.orderCode || where.sourceCode || where.id,
        };
        const orderCode = String(existing.orderCode || data.orderCode || where.orderCode || where.sourceCode || where.id);
        const value: Record<string, unknown> = {
          ...existing,
          ...data,
          id: String(existing.id || `order-${orderCode}`),
        };
        if (existing.orderCode && existing.orderCode !== value.orderCode) {
          state.serviceOrders.delete(String(existing.orderCode));
        }
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

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { scope: "all", userId: "admin-test" });

  assert.equal(summary.partnersUpserted, parsed.partners.length);
  assert.equal(summary.partnerEntriesUpserted, 80);
  assert.equal(summary.serviceOrdersUpserted, 41);
  assert.equal(state.partners.size, parsed.partners.length);
  assert.equal(state.partnerLedgerEntries.size, 80);
  assert.equal(state.serviceOrders.size, 41);
  assert.equal(state.warranties.size, parsed.customerOrders.length);
  assert.equal(
    [...state.warranties.values()].every((warranty) => Boolean(warranty.serviceOrderId)),
    true
  );
  assert.equal([...state.partnerLedgerEntries.keys()].some((key) => key.startsWith("DON_KHACH")), false);
  assert.equal([...state.serviceOrders.values()].every((order) => order.source === "IMPORT" && order.sourceName === "Đơn khách"), true);
  assert.equal([...state.serviceOrders.values()].every((order) => typeof order.sourceCode === "string" && order.sourceCode.length > 0), true);
  assert.equal([...state.serviceOrders.values()].every((order) => String(order.customerPhone || "").length >= 10), true);
  assert.equal(state.auditLogs.length, 1);
  assert.deepEqual(state.transactionOptions, [{ maxWait: 10_000, timeout: 120_000 }]);
});

test("defaults direct imports to service orders only", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  const summary = await importMinhHongParsedWorkbook(parsed, runner, { userId: "admin-test" });

  assert.equal(summary.partnersUpserted, 0);
  assert.equal(summary.partnerEntriesUpserted, 0);
  assert.equal(summary.serviceOrdersUpserted, parsed.customerOrders.length);
  assert.equal(state.partners.size, 0);
  assert.equal(state.partnerLedgerEntries.size, 0);
  assert.equal(state.serviceOrders.size, parsed.customerOrders.length);
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

test("service-order scoped import creates exactly one linked warranty for each historical Sheet order", async () => {
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
  assert.ok(savedOrder);
  assert.equal(savedOrder.status, "COMPLETED");
  assert.equal(state.warranties.size, 1);
  const savedWarranty = [...state.warranties.values()][0];
  assert.equal(savedWarranty.serviceOrderId, savedOrder.id);
  assert.equal(savedWarranty.productName, sourceOrder.productName);
  assert.equal(getVietnamDateKey(savedWarranty.startDate as Date), "2026-01-10");

  const changed = {
    ...parsed,
    customerOrders: [{
      ...sourceOrder,
      orderDate: "20/01/2026",
      productName: "Pin warranty sync updated",
    }],
  };
  await importMinhHongParsedWorkbook(changed, runner, { scope: "service-orders", userId: "admin-test" });

  const refreshedOrder = state.serviceOrders.get("DH-WARRANTY-SYNC");
  const refreshedWarranty = [...state.warranties.values()][0];
  assert.equal(state.warranties.size, 1);
  assert.equal(refreshedOrder?.productName, "Pin warranty sync updated");
  assert.equal(refreshedWarranty.productName, "Pin warranty sync updated");
  assert.equal(getVietnamDateKey(refreshedWarranty.startDate as Date), "2026-01-20");
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
  assert.equal(firstOrder?.status, "COMPLETED");
  assert.equal(firstOrder?.warrantyEndDate, null);
  const firstWarranty = [...state.warranties.values()].find(
    (warranty) => warranty.serviceOrderId === firstOrder?.id
  );
  assert.ok(firstWarranty);
  assert.equal((firstWarranty.startDate as Date).getUTCFullYear(), 1900);
  assert.equal((firstWarranty.endDate as Date).getUTCFullYear(), 1900);
  assert.match(String(firstWarranty.notes), /bổ sung ngày/i);
});

test("running the same parsed workbook twice does not create duplicate records", async () => {
  const parsed = await parsedWorkbook();
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "all", userId: "admin-test" });
  const second = await importMinhHongParsedWorkbook(parsed, runner, { scope: "all", userId: "admin-test" });

  assert.equal(state.partners.size, parsed.partners.length);
  assert.equal(state.partnerLedgerEntries.size, 80);
  assert.equal(state.serviceOrders.size, 41);
  assert.equal(state.warranties.size, parsed.customerOrders.length);
  assert.equal(state.auditLogs.length, 2);
  assert.deepEqual(second.changes.partnerEntries, { created: 0, updated: 0, unchanged: 80 });
  assert.deepEqual(second.changes.serviceOrders, { created: 0, updated: 0, unchanged: 41 });
  assert.deepEqual(second.changes.warranties, {
    archivedDuplicates: 0,
    created: 0,
    linked: 0,
    missingDate: parsed.customerOrders.filter((order) => !order.orderDate).length,
    unchanged: parsed.customerOrders.length,
  });
  assert.equal(second.partnerEntriesUpserted, 0);
  assert.equal(second.serviceOrdersUpserted, 0);
  assert.equal([...state.partnerLedgerEntries.keys()].every((sourceCode) => !sourceCode.includes(":MH_")), true);
  assert.equal([...state.serviceOrders.values()].every((order) => !String(order.sourceCode).includes(":MH_")), true);
});

test("reconciles approved manual orders and warranties without deleting history", async () => {
  const baseline = await parsedWorkbook();
  const approvedGroup = APPROVED_INITIAL_ORDER_GROUPS[0];
  const manualApprovedGroup = APPROVED_INITIAL_ORDER_GROUPS[1];
  const standaloneLink = APPROVED_STANDALONE_WARRANTY_LINKS[0];
  const duplicatePair = APPROVED_DUPLICATE_WARRANTY_PAIRS[0];
  const approvedSource = {
    ...baseline.customerOrders[0],
    orderCode: approvedGroup.orderCode,
    sourceCode: approvedGroup.sourceCodes[0],
    sourceRow: 901,
    orderDate: "01/05/2026",
  };
  const manualApprovedSource = {
    ...baseline.customerOrders[2],
    orderCode: manualApprovedGroup.orderCode,
    sourceCode: manualApprovedGroup.sourceCodes[0],
    sourceRow: 903,
    orderDate: "06/05/2026",
  };
  const standaloneSource = {
    ...baseline.customerOrders[1],
    orderCode: "DH-STANDALONE-WARRANTY",
    sourceCode: standaloneLink.sourceCode,
    sourceRow: 902,
    orderDate: "02/05/2026",
  };

  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [approvedSource, manualApprovedSource, standaloneSource],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const { runner, state } = createFakeImportRunner();
  state.serviceOrders.set(approvedGroup.orderCode, {
    id: "approved-order-id",
    orderCode: approvedGroup.orderCode,
    customerId: "existing-customer-id",
    customerName: "Tên khách rõ hơn trên web",
    customerPhone: "0909000000",
    service: "DONG_PIN",
    productName: "Cách ghi sản phẩm cũ trên web",
    issueDescription: "Ghi chú vận hành trên web",
    solution: "Đã bàn giao",
    status: "COMPLETED",
    source: "PHONE",
    orderDate: new Date("2026-01-01T00:00:00.000Z"),
    quotedPrice: 1,
    paidAmount: 1,
    warrantyMonths: 6,
    warrantyEndDate: new Date("2026-12-31T23:59:59.999Z"),
    customerVisible: true,
    discountAmount: 0,
    notes: "Ghi chú web cần giữ",
    deletedAt: null,
  });
  state.serviceOrders.set(manualApprovedGroup.orderCode, {
    ...state.serviceOrders.get(approvedGroup.orderCode),
    id: "manual-approved-order-id",
    orderCode: manualApprovedGroup.orderCode,
    customerId: "manual-existing-customer-id",
    source: "MANUAL",
  });
  const canonicalStart = new Date("2026-05-01T00:00:00.000Z");
  const canonicalEnd = new Date("2026-11-01T23:59:59.999Z");
  state.warranties.set("canonical-warranty-id", {
    id: "canonical-warranty-id",
    serialNo: duplicatePair.canonicalSerialNo,
    productName: "Tên sản phẩm cũ trên phiếu",
    customerName: "Tên khách cũ trên phiếu",
    customerPhone: "0909000000",
    service: "DONG_PIN",
    startDate: canonicalStart,
    endDate: canonicalEnd,
    notes: "Ghi chú phiếu chính",
    serviceOrderId: "approved-order-id",
    deletedAt: null,
  });
  state.warranties.set("duplicate-warranty-id", {
    id: "duplicate-warranty-id",
    serialNo: duplicatePair.duplicateSerialNo,
    productName: "Cách ghi trên phiếu trùng",
    customerName: "Khách trên phiếu trùng",
    customerPhone: "0909000000",
    service: "DONG_PIN",
    startDate: canonicalStart,
    endDate: canonicalEnd,
    notes: "Ghi chú phiếu trùng cần lưu",
    serviceOrderId: null,
    deletedAt: null,
  });
  const standaloneStart = new Date("2026-05-02T00:00:00.000Z");
  const standaloneEnd = new Date("2026-08-02T23:59:59.999Z");
  state.warranties.set("standalone-warranty-id", {
    id: "standalone-warranty-id",
    serialNo: standaloneLink.serialNo,
    productName: "Phiếu độc lập hợp lệ",
    customerName: "Khách phiếu độc lập",
    customerPhone: "0911000000",
    service: "KHAC",
    startDate: standaloneStart,
    endDate: standaloneEnd,
    notes: "Giữ nguyên thông tin phiếu độc lập",
    serviceOrderId: null,
    deletedAt: null,
  });

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });
  assert.equal(preview.warranties.archivedDuplicates, 1);
  assert.equal(preview.warranties.created, 1);
  assert.equal(preview.warranties.linked, 1);
  assert.deepEqual(preview.conflicts, []);

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });

  const approvedOrder = state.serviceOrders.get(approvedGroup.orderCode);
  assert.equal(approvedOrder?.id, "approved-order-id");
  assert.equal(approvedOrder?.customerName, "Tên khách rõ hơn trên web");
  assert.equal(approvedOrder?.productName, approvedSource.productName);
  assert.equal(approvedOrder?.source, "PHONE");
  assert.equal(approvedOrder?.sourceName, "Đơn khách");
  assert.equal(approvedOrder?.quotedPrice, approvedSource.quotedPrice);
  assert.match(String(approvedOrder?.notes), /Ghi chú web cần giữ/);
  assert.match(String(approvedOrder?.notes), /Cách ghi sản phẩm cũ trên web/);

  const manualApprovedOrder = state.serviceOrders.get(manualApprovedGroup.orderCode);
  assert.equal(manualApprovedOrder?.id, "manual-approved-order-id");
  assert.equal(manualApprovedOrder?.source, "MANUAL");
  assert.equal(manualApprovedOrder?.sourceName, "Đơn khách");

  const canonical = state.warranties.get("canonical-warranty-id");
  assert.equal(canonical?.serialNo, duplicatePair.canonicalSerialNo);
  assert.equal(getVietnamDateKey(canonical?.startDate as Date), "2026-05-01");
  assert.equal(getVietnamDateKey(canonical?.endDate as Date), "2026-11-01");
  assert.equal(canonical?.productName, approvedSource.productName);
  assert.match(String(canonical?.notes), new RegExp(duplicatePair.duplicateSerialNo));
  assert.match(String(canonical?.notes), /Ghi chú phiếu trùng cần lưu/);
  assert.ok(state.warranties.get("duplicate-warranty-id")?.deletedAt instanceof Date);

  const importedStandaloneOrder = [...state.serviceOrders.values()].find(
    (order) => order.sourceCode === standaloneLink.sourceCode
  );
  assert.ok(importedStandaloneOrder);
  const standalone = state.warranties.get("standalone-warranty-id");
  assert.equal(standalone?.serviceOrderId, importedStandaloneOrder.id);
  assert.equal(getVietnamDateKey(standalone?.startDate as Date), "2026-05-02");
  assert.equal(getVietnamDateKey(standalone?.endDate as Date), "2026-11-02");
});

test("reconciles the approved production snapshot into 58 linked active warranties", async () => {
  const baseline = await parsedWorkbook();
  const template = baseline.customerOrders[0];
  const approvedSourceCodes = APPROVED_INITIAL_ORDER_GROUPS.flatMap((group) => group.sourceCodes);
  const approvedSourceCodeSet = new Set(approvedSourceCodes);
  const newStandaloneLinks = APPROVED_STANDALONE_WARRANTY_LINKS.filter(
    (link) => !approvedSourceCodeSet.has(link.sourceCode)
  );
  const rawOrders = [
    ...approvedSourceCodes.map((sourceCode, index) => ({
      ...template,
      customerName: `Khách đã duyệt ${index + 1}`,
      customerPhone: `0901${String(index).padStart(6, "0")}`,
      orderCode: `RAW-APPROVED-${index + 1}`,
      orderDate: "01/05/2026",
      productName: `Sản phẩm đã duyệt ${index + 1}`,
      sourceCode,
      sourceRow: 100 + index,
    })),
    ...newStandaloneLinks.map((link, index) => ({
      ...template,
      customerName: `Khách phiếu tạo riêng ${index + 1}`,
      customerPhone: `0902${String(index).padStart(6, "0")}`,
      orderCode: `RAW-STANDALONE-${index + 1}`,
      orderDate: "02/05/2026",
      productName: `Sản phẩm phiếu tạo riêng ${index + 1}`,
      sourceCode: link.sourceCode,
      sourceRow: 200 + index,
    })),
    ...Array.from({ length: 42 }, (_, index) => ({
      ...template,
      customerName: `Khách mới ${index + 1}`,
      customerPhone: `0903${String(index).padStart(6, "0")}`,
      orderCode: `RAW-NEW-${index + 1}`,
      orderDate: index === 0 ? "" : "03/05/2026",
      productName: `Sản phẩm mới ${index + 1}`,
      sourceCode: `DON_KHACH:SNAPSHOT_NEW_${String(index + 1).padStart(3, "0")}`,
      sourceRow: 300 + index,
    })),
  ];
  assert.equal(rawOrders.length, 60);

  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: rawOrders,
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const { runner, state } = createFakeImportRunner();
  const standaloneExistingGroup = APPROVED_INITIAL_ORDER_GROUPS.find((group) => (
    APPROVED_STANDALONE_WARRANTY_LINKS.some((link) => group.sourceCodes.includes(link.sourceCode))
  ));
  assert.ok(standaloneExistingGroup);
  const linkedGroups = APPROVED_INITIAL_ORDER_GROUPS.filter((group) => group !== standaloneExistingGroup);

  for (const [index, group] of APPROVED_INITIAL_ORDER_GROUPS.entries()) {
    state.serviceOrders.set(group.orderCode, {
      id: `snapshot-order-${index + 1}`,
      orderCode: group.orderCode,
      customerId: `snapshot-customer-${index + 1}`,
      customerName: `Khách web ${index + 1}`,
      customerPhone: `0911${String(index).padStart(6, "0")}`,
      service: "KHAC",
      productName: `Sản phẩm web ${index + 1}`,
      status: "COMPLETED",
      source: index === 0 ? "PHONE" : "MANUAL",
      orderDate: new Date("2026-01-01T00:00:00.000Z"),
      quotedPrice: 1,
      paidAmount: 1,
      warrantyMonths: 6,
      warrantyEndDate: null,
      customerVisible: false,
      discountAmount: 0,
      deletedAt: null,
    });
  }

  const canonicalStart = new Date("2026-05-01T00:00:00.000Z");
  const canonicalEnd = new Date("2026-11-01T23:59:59.999Z");
  linkedGroups.forEach((group, index) => {
    const pair = APPROVED_DUPLICATE_WARRANTY_PAIRS[index];
    state.warranties.set(`snapshot-linked-${index + 1}`, {
      id: `snapshot-linked-${index + 1}`,
      serialNo: pair?.canonicalSerialNo || `MH-BH-SNAPSHOT-LINKED-${index + 1}`,
      productName: `Phiếu web ${index + 1}`,
      customerName: `Khách web ${index + 1}`,
      customerPhone: `0911${String(index).padStart(6, "0")}`,
      service: "KHAC",
      startDate: canonicalStart,
      endDate: canonicalEnd,
      notes: null,
      serviceOrderId: String(state.serviceOrders.get(group.orderCode)?.id),
      deletedAt: null,
    });
  });
  APPROVED_DUPLICATE_WARRANTY_PAIRS.forEach((pair, index) => {
    state.warranties.set(`snapshot-duplicate-${index + 1}`, {
      id: `snapshot-duplicate-${index + 1}`,
      serialNo: pair.duplicateSerialNo,
      productName: `Phiếu trùng ${index + 1}`,
      customerName: `Khách trùng ${index + 1}`,
      customerPhone: `0921${String(index).padStart(6, "0")}`,
      service: "KHAC",
      startDate: canonicalStart,
      endDate: canonicalEnd,
      notes: null,
      serviceOrderId: null,
      deletedAt: null,
    });
  });
  APPROVED_STANDALONE_WARRANTY_LINKS.forEach((link, index) => {
    state.warranties.set(`snapshot-standalone-${index + 1}`, {
      id: `snapshot-standalone-${index + 1}`,
      serialNo: link.serialNo,
      productName: `Phiếu tạo riêng ${index + 1}`,
      customerName: `Khách phiếu tạo riêng ${index + 1}`,
      customerPhone: `0931${String(index).padStart(6, "0")}`,
      service: "KHAC",
      startDate: canonicalStart,
      endDate: canonicalEnd,
      notes: null,
      serviceOrderId: null,
      deletedAt: null,
    });
  });
  assert.equal(state.warranties.size, 24);

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });
  assert.deepEqual(preview.serviceOrders, { created: 46, updated: 12, unchanged: 0 });
  assert.deepEqual(preview.warranties, {
    archivedDuplicates: 8,
    created: 42,
    linked: 5,
    missingDate: 1,
    unchanged: 11,
  });
  assert.deepEqual(preview.conflicts, []);

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });
  const activeWarranties = [...state.warranties.values()].filter((warranty) => !warranty.deletedAt);
  const archivedWarranties = [...state.warranties.values()].filter((warranty) => warranty.deletedAt);
  assert.equal(state.serviceOrders.size, 58);
  assert.equal(activeWarranties.length, 58);
  assert.equal(archivedWarranties.length, 8);
  assert.equal(activeWarranties.every((warranty) => Boolean(warranty.serviceOrderId)), true);
  assert.equal(new Set(activeWarranties.map((warranty) => warranty.serviceOrderId)).size, 58);
});

test("blocks an approved multi-row manual order when the Sheet group is incomplete", async () => {
  const baseline = await parsedWorkbook();
  const group = APPROVED_INITIAL_ORDER_GROUPS.find((candidate) => candidate.sourceCodes.length === 3);
  assert.ok(group);
  const partialOrders = group.sourceCodes.slice(0, 2).map((sourceCode, index) => ({
    ...baseline.customerOrders[index],
    orderCode: `DH-PARTIAL-${index + 1}`,
    sourceCode,
    sourceRow: 960 + index,
    customerName: "Nghĩa",
    customerPhone: "0901234567",
    productName: `Phần đơn ${index + 1}`,
    quotedPrice: 1_000_000,
    paidAmount: 1_000_000,
    debtAmount: 0,
    priceStatus: "CONFIRMED" as const,
  }));
  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: partialOrders,
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const { runner, state } = createFakeImportRunner();
  state.serviceOrders.set(group.orderCode, {
    id: "nghia-existing-order",
    orderCode: group.orderCode,
    customerId: "nghia-customer",
    customerName: "Nghĩa",
    customerPhone: "0901234567",
    service: "DONG_PIN",
    productName: "Đơn Nghĩa đầy đủ trên web",
    status: "COMPLETED",
    source: "MANUAL",
    orderDate: new Date("2026-07-14T00:00:00.000Z"),
    quotedPrice: 2_450_000,
    paidAmount: 2_450_000,
    customerVisible: false,
    discountAmount: 0,
    notes: null,
    deletedAt: null,
  });

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });

  assert.equal(preview.conflicts.some((message) => message.includes("thiếu") && message.includes(group.orderCode)), true);
  await assert.rejects(
    importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" }),
    /thiếu/
  );
  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.get(group.orderCode)?.quotedPrice, 2_450_000);
  assert.equal(state.serviceOrders.get(group.orderCode)?.source, "MANUAL");
});

test("matches imported service orders by sourceCode without changing the visible order code", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = baseline.customerOrders[0];
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
  const changedOrderCode = `${sourceOrder.orderCode}-RENAMED`;
  const changed = {
    ...parsed,
    customerOrders: [{ ...sourceOrder, orderCode: changedOrderCode }],
  };

  const preview = await previewMinhHongParsedWorkbook(changed, runner, { scope: "service-orders" });
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 0, unchanged: 1 });
  assert.deepEqual(preview.conflicts, []);

  await importMinhHongParsedWorkbook(changed, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.has(sourceOrder.orderCode), true);
  assert.equal(state.serviceOrders.has(changedOrderCode), false);
  assert.equal(state.serviceOrders.get(sourceOrder.orderCode)?.sourceCode, sourceOrder.sourceCode);
});

test("stable sourceCode stays authoritative when two rows exchange row-derived order codes", async () => {
  const baseline = await parsedWorkbook();
  const firstOrder = {
    ...baseline.customerOrders[0],
    legacyOrderCode: "DH-ROW-1",
    orderCode: "DH-ROW-1",
    orderDate: "2026-07-01",
    sourceCode: `DON_KHACH:MH_${"G".repeat(32)}`,
    sourceRow: 810,
  };
  const secondOrder = {
    ...baseline.customerOrders[1],
    legacyOrderCode: "DH-ROW-2",
    orderCode: "DH-ROW-2",
    orderDate: "2026-07-02",
    sourceCode: `DON_KHACH:MH_${"H".repeat(32)}`,
    sourceRow: 811,
  };
  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [firstOrder, secondOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const reordered = {
    ...parsed,
    customerOrders: [
      {
        ...firstOrder,
        legacyOrderCode: secondOrder.orderCode,
        orderCode: secondOrder.orderCode,
        sourceRow: secondOrder.sourceRow,
      },
      {
        ...secondOrder,
        legacyOrderCode: firstOrder.orderCode,
        orderCode: firstOrder.orderCode,
        sourceRow: firstOrder.sourceRow,
      },
    ],
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });
  const preview = await previewMinhHongParsedWorkbook(reordered, runner, { scope: "service-orders" });

  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 2, unchanged: 0 });
  assert.deepEqual(preview.conflicts, []);
  await importMinhHongParsedWorkbook(reordered, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.size, 2);
  assert.equal(state.serviceOrders.get(firstOrder.orderCode)?.sourceCode, firstOrder.sourceCode);
  assert.equal(state.serviceOrders.get(secondOrder.orderCode)?.sourceCode, secondOrder.sourceCode);
  assert.equal(state.serviceOrders.get(firstOrder.orderCode)?.sourceRow, secondOrder.sourceRow);
  assert.equal(state.serviceOrders.get(secondOrder.orderCode)?.sourceRow, firstOrder.sourceRow);
});

test("backfills sourceCode when a legacy imported order only matches by orderCode", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = baseline.customerOrders[0];
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
  const legacyOrder = state.serviceOrders.get(sourceOrder.orderCode);
  assert.ok(legacyOrder);
  delete legacyOrder.sourceCode;

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 0 });

  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.get(sourceOrder.orderCode)?.sourceCode, sourceOrder.sourceCode);
});

test("first stable source_id rollout rekeys a matching legacy order without duplication", async () => {
  const baseline = await parsedWorkbook();
  const legacyOrder = { ...baseline.customerOrders[0], orderDate: "2026-07-01" };
  const stableId = `MH_${"A".repeat(32)}`;
  const stableOrder = {
    ...legacyOrder,
    legacyOrderCode: legacyOrder.orderCode,
    orderCode: legacyOrder.orderCode,
    sourceCode: `DON_KHACH:${stableId}`,
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook({
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [legacyOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  }, runner, { scope: "service-orders", userId: "admin-test" });
  const existing = state.serviceOrders.get(legacyOrder.orderCode);
  assert.ok(existing);
  assert.equal(existing.sourceCode, legacyOrder.sourceCode);

  const rollout = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [stableOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders" });
  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(preview.records.serviceOrders[0]?.changes?.some((change) => change.field === "orderDate") ?? false, false);
  assert.equal(
    preview.records.serviceOrders[0]?.changes?.some((change) => change.field === "sourceCode"),
    false,
    "stable source_id must remain internal to the import workflow"
  );

  await importMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.has(legacyOrder.orderCode), true);
  assert.equal(state.serviceOrders.get(legacyOrder.orderCode)?.sourceCode, stableOrder.sourceCode);
});

test("first stable source_id rollout treats a stored fallback date as the same missing source date", async () => {
  const baseline = await parsedWorkbook();
  const legacyOrder = {
    ...baseline.customerOrders[0],
    orderDate: "",
  };
  const stableOrder = {
    ...legacyOrder,
    legacyOrderCode: legacyOrder.orderCode,
    sourceCode: `DON_KHACH:MH_${"A".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook({
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [legacyOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  }, runner, { scope: "service-orders", userId: "admin-test" });

  const rollout = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [stableOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders" });

  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(preview.records.serviceOrders[0]?.changes?.some((change) => change.field === "orderDate") ?? false, false);

  await importMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders", userId: "admin-test" });

  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.get(legacyOrder.orderCode)?.sourceCode, stableOrder.sourceCode);
});

test("updates a corrected source row when its stable business anchor still matches", async () => {
  const baseline = await parsedWorkbook();
  const initialOrder = {
    ...baseline.customerOrders[0],
    legacyOrderCode: baseline.customerOrders[0].orderCode,
    sourceCode: `DON_KHACH:MH_${"A".repeat(32)}`,
    sourceRow: 4,
  };
  const correctedOrder = {
    ...initialOrder,
    paidAmount: initialOrder.paidAmount + 100_000,
    sourceCode: `DON_KHACH:MH_${"B".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook({
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [initialOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  }, runner, { scope: "service-orders", userId: "admin-test" });

  const corrected = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [correctedOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const preview = await previewMinhHongParsedWorkbook(corrected, runner, { scope: "service-orders" });

  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(preview.records.serviceOrders[0]?.changes?.some((change) => change.field === "sourceCode"), false);

  await importMinhHongParsedWorkbook(corrected, runner, { scope: "service-orders", userId: "admin-test" });

  const saved = state.serviceOrders.get(initialOrder.orderCode);
  assert.equal(saved?.sourceCode, correctedOrder.sourceCode);
  assert.equal(saved?.paidAmount, correctedOrder.paidAmount);
});

test("blocks a changed source row after it moves because the match is no longer safe", async () => {
  const baseline = await parsedWorkbook();
  const initialOrder = {
    ...baseline.customerOrders[0],
    legacyOrderCode: baseline.customerOrders[0].orderCode,
    sourceCode: `DON_KHACH:MH_${"C".repeat(32)}`,
    sourceRow: 4,
  };
  const movedAndChangedOrder = {
    ...initialOrder,
    paidAmount: initialOrder.paidAmount + 100_000,
    sourceCode: `DON_KHACH:MH_${"D".repeat(32)}`,
    sourceRow: 5,
  };
  const { runner } = createFakeImportRunner();

  await importMinhHongParsedWorkbook({
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [initialOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  }, runner, { scope: "service-orders", userId: "admin-test" });

  const preview = await previewMinhHongParsedWorkbook({
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [movedAndChangedOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  }, runner, { scope: "service-orders" });

  assert.equal(preview.conflicts.length, 1);
});

test("first stable source_id rollout rekeys a legacy partner entry without duplication", async () => {
  const baseline = await parsedWorkbook();
  const sourceEntry = baseline.partnerEntries.find((entry) => entry.sourceCode === "NHAP_HANG:NH-0003");
  assert.ok(sourceEntry);
  const legacyEntry = { ...sourceEntry, entryDate: "2026-07-01" };
  assert.ok(legacyEntry);
  const stableEntry = {
    ...legacyEntry,
    legacySourceCode: legacyEntry.sourceCode,
    sourceCode: `NHAP_HANG:MH_${"B".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();

  const legacy = {
    ...baseline,
    partners: baseline.partners.filter((partner) => partner.partnerCode === legacyEntry.partnerCode),
    partnerEntries: [legacyEntry],
    customerOrders: [],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  await importMinhHongParsedWorkbook(legacy, runner, { scope: "partners", userId: "admin-test" });
  assert.equal(state.partnerLedgerEntries.get(legacyEntry.sourceCode)?.sourceCode, legacyEntry.sourceCode);

  const rollout = { ...legacy, partnerEntries: [stableEntry] };
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "partners" });
  assert.deepEqual(preview.partnerEntries, { created: 0, updated: 1, unchanged: 0 });
  assert.deepEqual(preview.conflicts, []);

  await importMinhHongParsedWorkbook(rollout, runner, { scope: "partners", userId: "admin-test" });

  assert.equal(state.partnerLedgerEntries.size, 1);
  assert.equal(state.partnerLedgerEntries.has(legacyEntry.sourceCode), false);
  assert.equal(state.partnerLedgerEntries.get(stableEntry.sourceCode)?.sourceCode, stableEntry.sourceCode);
});

test("first stable source_id rollout accepts a legacy placeholder date when the source date is still missing", async () => {
  const baseline = await parsedWorkbook();
  const sourceEntry = baseline.partnerEntries.find((entry) => entry.sourceCode === "NHAP_HANG:NH-0003");
  assert.ok(sourceEntry);
  const legacyEntry = { ...sourceEntry, entryDate: "" };
  const stableEntry = {
    ...legacyEntry,
    legacySourceCode: legacyEntry.sourceCode,
    sourceCode: `NHAP_HANG:MH_${"C".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();
  const legacy = {
    ...baseline,
    partners: baseline.partners.filter((partner) => partner.partnerCode === legacyEntry.partnerCode),
    partnerEntries: [legacyEntry],
    customerOrders: [],
    errors: [],
    warnings: [],
    skippedRows: [],
  };

  await importMinhHongParsedWorkbook(legacy, runner, { scope: "partners", userId: "admin-test" });
  const storedLegacyEntry = state.partnerLedgerEntries.get(legacyEntry.sourceCode);
  assert.ok(storedLegacyEntry);
  storedLegacyEntry.entryDate = new Date("2001-01-01T00:00:00.000Z");

  const rollout = { ...legacy, partnerEntries: [stableEntry] };
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "partners" });

  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.partnerEntries, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(preview.records.partnerEntries[0]?.changes?.some((change) => change.field === "entryDate") ?? false, false);

  await importMinhHongParsedWorkbook(rollout, runner, { scope: "partners", userId: "admin-test" });

  assert.equal(state.partnerLedgerEntries.size, 1);
  assert.equal(state.partnerLedgerEntries.has(legacyEntry.sourceCode), false);
  assert.equal(state.partnerLedgerEntries.get(stableEntry.sourceCode)?.sourceCode, stableEntry.sourceCode);
});

test("first stable source_id rollout accepts a unique date-only correction for a partner entry", async () => {
  const baseline = await parsedWorkbook();
  const sourceEntry = baseline.partnerEntries.find((entry) => entry.sourceCode === "NHAP_HANG:NH-0003");
  assert.ok(sourceEntry);
  const correctedEntry = { ...sourceEntry, entryDate: "2026-01-28" };
  const stableEntry = {
    ...correctedEntry,
    legacySourceCode: correctedEntry.sourceCode,
    sourceCode: `NHAP_HANG:MH_${"D".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();
  const legacy = {
    ...baseline,
    partners: baseline.partners.filter((partner) => partner.partnerCode === correctedEntry.partnerCode),
    partnerEntries: [{ ...correctedEntry, entryDate: "2029-01-28" }],
    customerOrders: [],
    errors: [],
    warnings: [],
    skippedRows: [],
  };

  await importMinhHongParsedWorkbook(legacy, runner, { scope: "partners", userId: "admin-test" });

  const rollout = { ...legacy, partnerEntries: [stableEntry] };
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "partners" });

  assert.deepEqual(preview.conflicts, []);
  assert.deepEqual(preview.partnerEntries, { created: 0, updated: 1, unchanged: 0 });
  assert.equal(preview.records.partnerEntries[0]?.changes?.some((change) => change.field === "entryDate") ?? false, true);

  await importMinhHongParsedWorkbook(rollout, runner, { scope: "partners", userId: "admin-test" });

  const saved = state.partnerLedgerEntries.get(stableEntry.sourceCode);
  assert.equal(state.partnerLedgerEntries.size, 1);
  assert.equal(saved?.sourceCode, stableEntry.sourceCode);
  const savedEntryDate = saved?.entryDate;
  assert.ok(typeof savedEntryDate === "string" || savedEntryDate instanceof Date);
  assert.equal(getVietnamDateKey(savedEntryDate), "2026-01-28");
});

test("rejects a pre-stamp customer row swap instead of rekeying the legacy order", async () => {
  const baseline = await parsedWorkbook();
  const legacyOrder = { ...baseline.customerOrders[0], orderDate: "2026-07-01" };
  const swappedCustomer = { ...baseline.customerOrders[1], orderDate: "2026-07-02" };
  const stableOrder = {
    ...swappedCustomer,
    legacyOrderCode: legacyOrder.orderCode,
    orderCode: legacyOrder.orderCode,
    sourceCode: `DON_KHACH:MH_${"C".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();
  const legacy = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [legacyOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };

  await importMinhHongParsedWorkbook(legacy, runner, { scope: "service-orders", userId: "admin-test" });
  const preview = await previewMinhHongParsedWorkbook(
    { ...legacy, customerOrders: [stableOrder] },
    runner,
    { scope: "service-orders" }
  );

  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 0, unchanged: 0 });
  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0], /không khớp dữ liệu nghiệp vụ/i);
  await assert.rejects(
    () => importMinhHongParsedWorkbook(
      { ...legacy, customerOrders: [stableOrder] },
      runner,
      { scope: "service-orders", userId: "admin-test" }
    ),
    /không khớp dữ liệu nghiệp vụ/i
  );
  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.get(legacyOrder.orderCode)?.sourceCode, legacyOrder.sourceCode);
  assert.equal(state.serviceOrders.get(legacyOrder.orderCode)?.customerName, legacyOrder.customerName || "Khách chưa rõ tên");
});

test("rejects a mismatched first purchase source_id rekey without writing", async () => {
  const baseline = await parsedWorkbook();
  const sourceEntry = baseline.partnerEntries.find((entry) => entry.sourceCode === "NHAP_HANG:NH-0003");
  assert.ok(sourceEntry);
  const legacyEntry = { ...sourceEntry, entryDate: "2026-07-01" };
  const legacy = {
    ...baseline,
    partners: baseline.partners.filter((partner) => partner.partnerCode === legacyEntry.partnerCode),
    partnerEntries: [legacyEntry],
    customerOrders: [],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const stableEntry = {
    ...legacyEntry,
    amount: legacyEntry.amount + 10_000,
    legacySourceCode: legacyEntry.sourceCode,
    sourceCode: `NHAP_HANG:MH_${"D".repeat(32)}`,
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(legacy, runner, { scope: "partners", userId: "admin-test" });
  const preview = await previewMinhHongParsedWorkbook(
    { ...legacy, partnerEntries: [stableEntry] },
    runner,
    { scope: "partners" }
  );

  assert.deepEqual(preview.partnerEntries, { created: 0, updated: 0, unchanged: 0 });
  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0], /không khớp dữ liệu nghiệp vụ/i);
  await assert.rejects(
    () => importMinhHongParsedWorkbook(
      { ...legacy, partnerEntries: [stableEntry] },
      runner,
      { scope: "partners", userId: "admin-test" }
    ),
    /không khớp dữ liệu nghiệp vụ/i
  );
  assert.equal(state.partnerLedgerEntries.size, 1);
  assert.equal(state.partnerLedgerEntries.get(legacyEntry.sourceCode)?.sourceCode, legacyEntry.sourceCode);
  assert.equal(state.partnerLedgerEntries.get(legacyEntry.sourceCode)?.amount, legacyEntry.amount);
});

test("rejects duplicate first-rollout order signatures without rekeying either legacy order", async () => {
  const baseline = await parsedWorkbook();
  const sharedOrder = {
    ...baseline.customerOrders[0],
    customerName: "Duplicate customer",
    customerPhone: "",
    notes: "same business order",
    orderDate: "2026-07-01",
    paidAmount: 50_000,
    priceStatus: "CONFIRMED" as const,
    productName: "Duplicate product",
    quotedPrice: 150_000,
  };
  const firstLegacyOrder = {
    ...sharedOrder,
    legacyOrderCode: null,
    orderCode: "DH-LEGACY-DUP-1",
    sourceCode: "DON_KHACH:DH-LEGACY-DUP-1",
    sourceRow: 700,
  };
  const secondLegacyOrder = {
    ...sharedOrder,
    legacyOrderCode: null,
    orderCode: "DH-LEGACY-DUP-2",
    sourceCode: "DON_KHACH:DH-LEGACY-DUP-2",
    sourceRow: 701,
  };
  const legacy = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [firstLegacyOrder, secondLegacyOrder],
    errors: [],
    warnings: [],
    skippedRows: [],
  };
  const rollout = {
    ...legacy,
    customerOrders: [
      {
        ...firstLegacyOrder,
        legacyOrderCode: firstLegacyOrder.orderCode,
        sourceCode: `DON_KHACH:MH_${"E".repeat(32)}`,
      },
      {
        ...secondLegacyOrder,
        legacyOrderCode: secondLegacyOrder.orderCode,
        sourceCode: `DON_KHACH:MH_${"F".repeat(32)}`,
      },
    ],
  };
  const { runner, state } = createFakeImportRunner();

  await importMinhHongParsedWorkbook(legacy, runner, { scope: "service-orders", userId: "admin-test" });
  const preview = await previewMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders" });

  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 0, unchanged: 0 });
  assert.equal(preview.conflicts.length, 2);
  assert.equal(preview.conflicts.every((conflict) => /trùng dữ liệu nghiệp vụ/i.test(conflict)), true);
  await assert.rejects(
    () => importMinhHongParsedWorkbook(rollout, runner, { scope: "service-orders", userId: "admin-test" }),
    /trùng dữ liệu nghiệp vụ/i
  );
  assert.equal(state.serviceOrders.size, 2);
  assert.equal(state.serviceOrders.get(firstLegacyOrder.orderCode)?.sourceCode, firstLegacyOrder.sourceCode);
  assert.equal(state.serviceOrders.get(secondLegacyOrder.orderCode)?.sourceCode, secondLegacyOrder.sourceCode);
});

test("blocks an order-code fallback that already owns another stable sourceCode", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = baseline.customerOrders[0];
  const { runner, state } = createFakeImportRunner();
  state.serviceOrders.set(sourceOrder.orderCode, {
    id: "order-existing-source",
    orderCode: sourceOrder.orderCode,
    sourceCode: "DON_KHACH:DH-ANOTHER-STABLE-ID",
    source: "IMPORT",
    deletedAt: null,
  });
  const parsed = {
    ...baseline,
    partners: [],
    partnerEntries: [],
    customerOrders: [{ ...sourceOrder, sourceCode: "DON_KHACH:DH-NEW-STABLE-ID" }],
    errors: [],
    warnings: [],
    skippedRows: [],
  };

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });
  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0], /source_id khác/i);
  await assert.rejects(
    () => importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" }),
    /source_id khác/i
  );
});

test("uses the stable sourceCode owner when a row-derived orderCode points to another import", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = baseline.customerOrders[0];
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
  state.serviceOrders.set("DH-SOURCE-OWNER", {
    id: "order-source-owner",
    orderCode: "DH-SOURCE-OWNER",
    sourceCode: sourceOrder.sourceCode,
    source: "IMPORT",
    deletedAt: null,
  });
  state.serviceOrders.set(sourceOrder.orderCode, {
    id: "order-code-owner",
    orderCode: sourceOrder.orderCode,
    sourceCode: "DON_KHACH:DIFFERENT-SOURCE",
    source: "IMPORT",
    deletedAt: null,
  });

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });

  assert.deepEqual(preview.serviceOrders, { created: 0, updated: 1, unchanged: 0 });
  assert.deepEqual(preview.conflicts, []);
  await importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" });
  assert.equal(state.serviceOrders.size, 2);
  assert.equal(state.serviceOrders.get("DH-SOURCE-OWNER")?.sourceCode, sourceOrder.sourceCode);
  assert.equal(state.serviceOrders.get(sourceOrder.orderCode)?.sourceCode, "DON_KHACH:DIFFERENT-SOURCE");
});

test("blocks a manual order matched through sourceCode even when orderCode differs", async () => {
  const baseline = await parsedWorkbook();
  const sourceOrder = baseline.customerOrders[0];
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
  state.serviceOrders.set("WEB-MANUAL-ORDER", {
    id: "manual-source-owner",
    orderCode: "WEB-MANUAL-ORDER",
    sourceCode: sourceOrder.sourceCode,
    source: "MANUAL",
    deletedAt: null,
  });

  const preview = await previewMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders" });

  assert.equal(preview.conflicts.length, 1);
  assert.match(preview.conflicts[0], /không ghi đè đơn thủ công/i);
  await assert.rejects(
    () => importMinhHongParsedWorkbook(parsed, runner, { scope: "service-orders", userId: "admin-test" }),
    /không ghi đè đơn thủ công/i
  );
  assert.equal(state.serviceOrders.size, 1);
  assert.equal(state.serviceOrders.has(sourceOrder.orderCode), false);
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
  await importMinhHongParsedWorkbook(parsed, runner, { scope: "all", userId: "admin-test" });

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

  const preview = await previewMinhHongParsedWorkbook(changed, runner, { scope: "all" });

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
