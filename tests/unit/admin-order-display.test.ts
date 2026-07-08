import assert from "node:assert/strict";
import test from "node:test";
import {
  compareAdminOrders,
  getAdminOrderSortLabel,
  isImportedOrderDateFallback,
  matchesAdminOrderSearch,
  shouldHideImportedFallbackDate,
} from "../../lib/admin-order-display";

function order(overrides: Partial<Parameters<typeof compareAdminOrders>[0]> = {}) {
  return {
    id: "order",
    source: "IMPORT",
    sourceName: "Don khach",
    sourceRow: 10,
    orderDate: "2026-07-03T00:00:00.000Z",
    createdAt: "2026-07-03T00:00:20.000Z",
    customerName: "Khach",
    debtAmount: 0,
    ...overrides,
  };
}

test("detects imported Excel rows whose date fell back to import time", () => {
  const importedFallback = order();
  const importedRealDate = order({
    orderDate: "2026-05-16T00:00:00.000Z",
    createdAt: "2026-07-03T00:00:20.000Z",
  });
  const manualSameDay = order({
    source: "MANUAL",
    orderDate: "2026-07-03T00:00:00.000Z",
    createdAt: "2026-07-03T00:00:20.000Z",
  });

  assert.equal(isImportedOrderDateFallback(importedFallback), true);
  assert.equal(shouldHideImportedFallbackDate(importedFallback), true);
  assert.equal(isImportedOrderDateFallback(importedRealDate), false);
  assert.equal(isImportedOrderDateFallback(manualSameDay), false);
});

test("sorts Excel imports by original source row when requested", () => {
  const rows = [
    order({ id: "row-14", sourceRow: 14, createdAt: "2026-07-03T00:00:14.000Z" }),
    order({ id: "manual", source: "MANUAL", sourceRow: null, createdAt: "2026-07-04T00:00:00.000Z" }),
    order({ id: "row-4", sourceRow: 4, createdAt: "2026-07-03T00:00:04.000Z" }),
  ];

  rows.sort((first, second) => compareAdminOrders(first, second, "excel"));

  assert.deepEqual(rows.map((item) => item.id), ["row-4", "row-14", "manual"]);
});

test("newest sort does not put missing-date imports above real dated orders", () => {
  const rows = [
    order({ id: "missing-date-row-14", sourceRow: 14 }),
    order({
      id: "june-order",
      sourceRow: 57,
      orderDate: "2026-06-29T00:00:00.000Z",
      createdAt: "2026-07-03T00:00:00.000Z",
    }),
    order({
      id: "may-order",
      sourceRow: 44,
      orderDate: "2026-05-19T00:00:00.000Z",
      createdAt: "2026-07-03T00:00:00.000Z",
    }),
  ];

  rows.sort((first, second) => compareAdminOrders(first, second, "newest"));

  assert.deepEqual(rows.map((item) => item.id), ["june-order", "may-order", "missing-date-row-14"]);
});

test("keeps sort labels understandable for active filter chips", () => {
  assert.equal(getAdminOrderSortLabel("excel"), "Thứ tự bảng Excel");
  assert.equal(getAdminOrderSortLabel("newest"), "Mới nhất");
  assert.equal(getAdminOrderSortLabel("oldest"), "Cũ nhất");
});

test("matches Vietnamese customer search across accent placement and unaccented typing", () => {
  const importedOrder = {
    orderCode: "MH-KHOA",
    customerName: "Chị Khoá",
    customerPhone: "0900000000",
    productName: "Pin lưu trữ",
    issueDescription: "",
    solution: "",
    notes: "",
  };

  assert.equal(matchesAdminOrderSearch(importedOrder, "Khóa"), true);
  assert.equal(matchesAdminOrderSearch(importedOrder, "khoa"), true);
  assert.equal(matchesAdminOrderSearch(importedOrder, "khong-co"), false);
});
