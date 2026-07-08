import assert from "node:assert/strict";
import test from "node:test";
import { parseMinhHongAdminWorkbook, type MinhHongParsedWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";

async function parsedWorkbook() {
  return parseMinhHongAdminWorkbook(await readCleanMinhHongAdminWorkbookBuffer());
}

test("accepts the approved Minh Hong workbook reconciliation totals", async () => {
  const result = reconcileMinhHongWorkbook(await parsedWorkbook());

  assert.equal(result.ok, true);
  assert.deepEqual(result.blockingIssues, []);
  assert.equal(result.checks.long_payable.actual, 12_720_000);
  assert.equal(result.checks.customer_order_rows.actual, 41);
  assert.equal(result.checks.customer_order_total.actual, 36_825_000);
});

test("allows newer valid rows while reporting baseline differences as warnings", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerTotals: {
      ...baseline.partnerTotals,
      longPayable: 12_730_000,
    },
  };

  const result = reconcileMinhHongWorkbook(parsed);

  assert.equal(result.ok, true);
  assert.deepEqual(result.blockingIssues, []);
  assert.match(result.warnings.join("\n"), /Long - Minh Hồng cần trả/);
  assert.match(result.warnings.join("\n"), /12\.730\.000/);
});

test("service-order scope reports row-level customer date issues without blocking valid rows", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerTotals: {
      ...baseline.partnerTotals,
      longPayable: 99_000_000,
    },
    errors: [
      { sheet: "Đối soát", rowNumber: 11, message: "Đơn hàng mua từ long dòng 5: cột Còn 11.000.000 không khớp." },
      { sheet: "Đối soát", rowNumber: 12, message: "Đơn hàng đã bán dòng 19: ngày \"37/1/2026\" không hợp lệ." },
    ],
    warnings: [
      "Long - Minh Hồng cần trả đã thay đổi: hiện tại 99.000.000, mốc cũ 12.720.000.",
      "Đơn khách - tổng tiền đã thay đổi: hiện tại 47.835.000, mốc cũ 36.825.000.",
      "Đơn hàng đã bán dòng 58: ngày \"7/72026\" được tự sửa thành \"07/07/2026\".",
    ],
  };

  const result = reconcileMinhHongWorkbook(parsed, { scope: "service-orders" });

  assert.equal(result.ok, true);
  assert.doesNotMatch(result.blockingIssues.join("\n"), /Đơn hàng đã bán dòng 19/);
  assert.doesNotMatch(result.blockingIssues.join("\n"), /Đơn hàng mua từ long/);
  assert.match(result.warnings.join("\n"), /Dòng Excel 19/);
  assert.match(result.warnings.join("\n"), /chưa áp dụng dòng này/);
  assert.match(result.warnings.join("\n"), /Dòng Excel 58/);
  assert.match(result.warnings.join("\n"), /07\/07\/2026/);
  assert.doesNotMatch(result.warnings.join("\n"), /Đối soát/);
  assert.doesNotMatch(result.warnings.join("\n"), /Đơn khách - tổng tiền/);
  assert.doesNotMatch(result.warnings.join("\n"), /Long - Minh Hồng cần trả/);
});

test("partner scope reports partner data issues without blocking on customer rows", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerTotals: {
      ...baseline.partnerTotals,
      longPayable: 99_000_000,
    },
    customerOrderTotals: {
      ...baseline.customerOrderTotals,
      quoted: 47_835_000,
    },
    errors: [
      { sheet: "Đối soát", rowNumber: 11, message: "Đơn hàng mua từ long dòng 5: cột Còn 11.000.000 không khớp." },
      { sheet: "Đối soát", rowNumber: 12, message: "Đơn hàng đã bán dòng 19: ngày \"37/1/2026\" không hợp lệ." },
    ],
    warnings: [
      "Đơn hàng đã bán dòng 58: ngày \"7/72026\" được tự sửa thành \"07/07/2026\".",
    ],
  };

  const result = reconcileMinhHongWorkbook(parsed, { scope: "partners" });

  assert.equal(result.ok, false);
  assert.match(result.blockingIssues.join("\n"), /Đơn hàng mua từ long dòng 5/);
  assert.doesNotMatch(result.blockingIssues.join("\n"), /Đơn hàng đã bán dòng 19/);
  assert.match(result.warnings.join("\n"), /Long - Minh Hồng cần trả/);
  assert.doesNotMatch(result.warnings.join("\n"), /Đơn khách - tổng tiền/);
  assert.doesNotMatch(result.warnings.join("\n"), /Dòng Excel 58/);
});

test("blocks confirm import when parser errors exist", async () => {
  const baseline = await parsedWorkbook();
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    errors: [{ sheet: "Đơn khách", rowNumber: 2, message: "Thiếu cột bắt buộc" }],
  };

  const result = reconcileMinhHongWorkbook(parsed);

  assert.equal(result.ok, false);
  assert.match(result.blockingIssues.join("\n"), /Thiếu cột bắt buộc/);
});

test("blocks duplicate stable identities inside one workbook", async () => {
  const baseline = await parsedWorkbook();
  const duplicateEntry = baseline.partnerEntries[0];
  const duplicateOrder = baseline.customerOrders[0];
  const parsed: MinhHongParsedWorkbook = {
    ...baseline,
    partnerEntries: [...baseline.partnerEntries, { ...duplicateEntry }],
    customerOrders: [...baseline.customerOrders, { ...duplicateOrder }],
  };

  const result = reconcileMinhHongWorkbook(parsed);

  assert.equal(result.ok, false);
  assert.match(result.blockingIssues.join("\n"), new RegExp(duplicateEntry.sourceCode));
  assert.match(result.blockingIssues.join("\n"), new RegExp(duplicateOrder.orderCode));
});
