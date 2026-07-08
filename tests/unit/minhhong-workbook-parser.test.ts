import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";

const workbookPath = resolve("operations/minhhong-admin-import-template-2026-05-26.xlsx");

function readGeneratedWorkbook() {
  return readFileSync(workbookPath);
}

async function buildDhOnlyWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Đối tác").addRows([
    ["Mã đối tác", "Tên đối tác", "Loại", "Số điện thoại", "Ghi chú", "Trạng thái"],
    ["LONG", "Long", "Đối tác công nợ", "", "", "Đang theo dõi"],
  ]);
  workbook.addWorksheet("Nhập hàng").addRow(["Mã nhập", "Ngày nhập", "Mã đối tác", "Tên đối tác", "Người bán/nguồn gốc", "Tên hàng", "Loại", "Số lượng", "Đơn vị", "Đơn giá", "Thành tiền", "Đã nhận hàng", "Tính công nợ", "Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Thanh toán").addRow(["Mã thanh toán", "Ngày", "Mã đối tác", "Tên đối tác", "Số tiền", "Phương thức", "Tính công nợ", "Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Trả hàng").addRow(["Mã trả", "Ngày", "Mã đối tác", "Tên đối tác", "Tên hàng", "Loại", "Số lượng", "Đơn giá", "Thành tiền", "Tính công nợ", "Lý do/Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Đơn khách").addRows([
    ["Mã đơn", "Ngày mua", "Tên khách", "Số điện thoại", "Sản phẩm", "Tổng tiền", "Đã thu", "Còn nợ", "Trạng thái giá", "Ghi chú", "Dòng gốc"],
    ["DH-9999", "", "", "", "", "", "", "", "", "", ""],
  ]);
  workbook.addWorksheet("Đối soát").addRow(["Khoá", "Nhãn", "Giá trị kỳ vọng", "Ghi chú"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("parses approved Minh Hong admin import workbook totals", async () => {
  const result = await parseMinhHongAdminWorkbook(readGeneratedWorkbook());

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.customerOrders.length, 41);
  assert.equal(result.customerOrderTotals.quoted, 36_825_000);
  assert.equal(result.customerOrderTotals.paid, 29_790_000);
  assert.equal(result.customerOrderTotals.legacyMissingPriceRows, 4);
  assert.equal(result.partnerEntries.length, 80);
  assert.equal(result.partnerTotals.longOpeningBalance, 20_230_000);
  assert.equal(result.partnerTotals.longCountedPurchase, 7_490_000);
  assert.equal(result.partnerTotals.longCountedPayment, 15_000_000);
  assert.equal(result.partnerTotals.longPayable, 12_720_000);
  assert.equal(result.partnerTotals.longHistoricalPaid, 60_000_000);
  assert.equal(result.partnerTotals.longReferenceOnlyAmount, 112_945_500);
  assert.equal(result.partnerEntries.some((entry) => entry.sourceCode.startsWith("DON_KHACH")), false);
});

test("keeps customer workbook rows out of partner ledger entries", async () => {
  const result = await parseMinhHongAdminWorkbook(readGeneratedWorkbook());

  assert.equal(result.customerOrders.some((order) => order.sourceCode.startsWith("DON_KHACH")), true);
  assert.equal(result.partnerEntries.some((entry) => entry.sourceCode.startsWith("DON_KHACH")), false);
});

test("skips generated customer order rows that only contain a DH code", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDhOnlyWorkbookBuffer());

  assert.equal(result.customerOrders.length, 0);
  assert.equal(result.skippedRows.some((row) => row.sheet === "Đơn khách" && row.reason.includes("chỉ có mã đơn")), true);
});
