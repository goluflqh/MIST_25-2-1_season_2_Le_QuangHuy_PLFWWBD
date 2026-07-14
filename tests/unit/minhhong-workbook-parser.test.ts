import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  MINHHONG_CUSTOMER_ORDER_COLUMNS,
  MINHHONG_PARTNER_COLUMNS,
  MINHHONG_PAYMENT_COLUMNS,
  MINHHONG_PURCHASE_COLUMNS,
  MINHHONG_RETURN_COLUMNS,
} from "../../lib/minhhong-import/workbook-contract";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";
import { readCleanMinhHongAdminWorkbookBuffer } from "./minhhong-test-workbook";

async function readGeneratedWorkbook() {
  return readCleanMinhHongAdminWorkbookBuffer();
}

test("parses the shipped 17-column admin workbook without fixture upgrades", async () => {
  const result = await parseMinhHongAdminWorkbook(
    readFileSync(resolve("operations/minhhong-admin-import-template-2026-05-26.xlsx"))
  );

  assert.deepEqual(result.errors, []);
});

async function buildDhOnlyWorkbookBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Đối tác").addRows([
    ["Mã đối tác", "Tên đối tác", "Loại", "Số điện thoại", "Ghi chú", "Trạng thái"],
    ["LONG", "Long", "Đối tác công nợ", "", "", "Đang theo dõi"],
  ]);
  workbook.addWorksheet("Nhập hàng").addRow(["Mã nhập", "Ngày nhập", "Mã đối tác", "Tên đối tác", "Người bán/nguồn gốc", "Tên hàng", "Loại", "Số lượng", "Đơn vị", "Đơn giá", "Chiết khấu (%)", "Tiền chiết khấu", "Thành tiền", "Đã nhận hàng", "Tính công nợ", "Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Thanh toán").addRow(["Mã thanh toán", "Ngày", "Mã đối tác", "Tên đối tác", "Số tiền", "Phương thức", "Tính công nợ", "Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Trả hàng").addRow(["Mã trả", "Ngày", "Mã đối tác", "Tên đối tác", "Tên hàng", "Loại", "Số lượng", "Đơn giá", "Thành tiền", "Tính công nợ", "Lý do/Ghi chú", "Dòng gốc"]);
  workbook.addWorksheet("Đơn khách").addRows([
    ["Mã đơn", "Ngày mua", "Tên khách", "Số điện thoại", "Sản phẩm", "Tổng tiền", "Đã thu", "Còn nợ", "Trạng thái giá", "Ghi chú", "Dòng gốc"],
    ["DH-9999", "", "", "", "", "", "", "", "", "", ""],
  ]);
  workbook.addWorksheet("Đối soát").addRow(["Khoá", "Nhãn", "Giá trị kỳ vọng", "Ghi chú"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildDiscountWorkbookBuffer(options: {
  amount: number;
  category?: string;
  discountAmount: number;
  discountNumberFormat?: string;
  discountPercent: number | string;
  sourceReference?: string;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Đối tác").addRows([
    [...MINHHONG_PARTNER_COLUMNS],
    ["LONG", "Long", "Đối tác công nợ", "", "", "Đang theo dõi"],
  ]);
  workbook.addWorksheet("Nhập hàng").addRows([
    [...MINHHONG_PURCHASE_COLUMNS],
    [
      "NH-DISCOUNT",
      "26/05/2026",
      "LONG",
      "Long",
      "Long",
      "9 món có chiết khấu",
      options.category ?? "Mua hàng",
      9,
      "món",
      55_000,
      options.discountPercent,
      options.discountAmount,
      options.amount,
      "Có",
      "Có",
      "",
      options.sourceReference ?? "Nhập hàng!A2:Q2",
    ],
  ]);
  if (options.discountNumberFormat) {
    workbook.getWorksheet("Nhập hàng")!.getRow(2).getCell(11).numFmt = options.discountNumberFormat;
  }
  workbook.addWorksheet("Thanh toán").addRow([...MINHHONG_PAYMENT_COLUMNS]);
  workbook.addWorksheet("Trả hàng").addRow([...MINHHONG_RETURN_COLUMNS]);
  workbook.addWorksheet("Đơn khách").addRow([...MINHHONG_CUSTOMER_ORDER_COLUMNS]);
  workbook.addWorksheet("Đối soát").addRow(["Khoá", "Nhãn", "Giá trị kỳ vọng", "Ghi chú"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("parses approved Minh Hong admin import workbook totals", async () => {
  const result = await parseMinhHongAdminWorkbook(await readGeneratedWorkbook());

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
  const result = await parseMinhHongAdminWorkbook(await readGeneratedWorkbook());

  assert.equal(result.customerOrders.some((order) => order.sourceCode.startsWith("DON_KHACH")), true);
  assert.equal(result.partnerEntries.some((entry) => entry.sourceCode.startsWith("DON_KHACH")), false);
});

test("derives workbook purchase discount values from quantity and unit price", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 420_750,
    discountAmount: 74_250,
    discountPercent: 15,
  }));

  assert.deepEqual(result.errors, []);
  assert.equal(result.partnerEntries[0]?.amount, 420_750);
  assert.equal(result.partnerEntries[0]?.discountAmount, 74_250);
  assert.equal(result.partnerEntries[0]?.discountPercent, 15);
});

test("reads an Excel percentage-formatted discount cell at its displayed value", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 420_750,
    discountAmount: 74_250,
    discountNumberFormat: "0%",
    discountPercent: 0.15,
  }));

  assert.deepEqual(result.errors, []);
  assert.equal(result.partnerEntries[0]?.amount, 420_750);
  assert.equal(result.partnerEntries[0]?.discountAmount, 74_250);
  assert.equal(result.partnerEntries[0]?.discountPercent, 15);
});

test("accepts an Excel percentage-formatted discount displayed as 100%", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 0,
    discountAmount: 495_000,
    discountNumberFormat: "0%",
    discountPercent: 1,
  }));

  assert.deepEqual(result.errors, []);
  assert.equal(result.partnerEntries[0]?.discountPercent, 100);
});

for (const storedPercent of [1.01, 2]) {
  test(`blocks an Excel percentage-formatted discount stored as ${storedPercent}`, async () => {
    const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
      amount: 0,
      discountAmount: 495_000,
      discountNumberFormat: "0%",
      discountPercent: storedPercent,
    }));

    assert.equal(result.errors.some((error) => error.message.includes("khoảng 0 đến 100%")), true);
  });
}

test("normalizes an explicit zero workbook discount to no discount", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 495_000,
    discountAmount: 0,
    discountPercent: 0,
  }));

  assert.deepEqual(result.errors, []);
  assert.equal(result.partnerEntries[0]?.amount, 495_000);
  assert.equal(result.partnerEntries[0]?.discountAmount, 0);
  assert.equal(result.partnerEntries[0]?.discountPercent, null);
});

test("blocks a tampered workbook net amount when discount is blank", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 1,
    discountAmount: 0,
    discountPercent: "",
    sourceReference: "x",
  }));

  assert.equal(result.errors.some((error) => error.message.toLocaleLowerCase("vi-VN").includes("thành tiền sau chiết khấu không khớp")), true);
});

test("blocks inconsistent workbook discount amounts before import", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 490_000,
    discountAmount: 5_000,
    discountPercent: 15,
  }));

  assert.equal(result.errors.some((error) => error.message.toLocaleLowerCase("vi-VN").includes("chiết khấu không khớp")), true);
  assert.equal(result.errors.some((error) => error.message.toLocaleLowerCase("vi-VN").includes("thành tiền sau chiết khấu không khớp")), true);
});

test("blocks discounts outside purchases or the supported percentage range", async () => {
  const adjustment = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 420_750,
    category: "Điều chỉnh",
    discountAmount: 74_250,
    discountPercent: 15,
  }));
  const outOfRange = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 0,
    discountAmount: 495_000,
    discountPercent: 101,
  }));

  assert.equal(adjustment.errors.some((error) => error.message.includes("chỉ áp dụng cho giao dịch mua hàng")), true);
  assert.equal(outOfRange.errors.some((error) => error.message.includes("khoảng 0 đến 100%")), true);
});

test("blocks non-numeric workbook discount percentages", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDiscountWorkbookBuffer({
    amount: 495_000,
    discountAmount: 0,
    discountPercent: "15abc",
  }));

  assert.equal(result.errors.some((error) => error.message.includes("khoảng 0 đến 100%")), true);
});

test("skips generated customer order rows that only contain a DH code", async () => {
  const result = await parseMinhHongAdminWorkbook(await buildDhOnlyWorkbookBuffer());

  assert.equal(result.customerOrders.length, 0);
  assert.equal(result.skippedRows.some((row) => row.sheet === "Đơn khách" && row.reason.includes("chỉ có mã đơn")), true);
});
