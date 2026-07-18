import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLegacyPartnerEntries,
  buildLegacyServiceOrders,
  isLegacyDebtCounted,
  summarizeLegacyImport,
  type LegacyWorkbookRows,
} from "../../lib/legacy-minhhong-import";

const sampleRows: LegacyWorkbookRows = {
  purchases: [
    {
      code: "NH-0001",
      date: "07/05/2026",
      debtPartner: "Long",
      category: "Số dư cũ",
      sourceName: "Chốt công nợ",
      description: "Nợ tạm tính đến 07/05/2026",
      quantity: 1,
      unit: "lần",
      unitPrice: 20_230_000,
      amount: 20_230_000,
      receivedGoods: "Có",
      countsInDebt: "Có",
      sourceRow: 2,
    },
    {
      code: "NH-0002",
      date: "2026-05-08",
      debtPartner: "Long",
      category: "Cell",
      sourceName: "Long",
      description: "300cell eve 25p",
      quantity: 300,
      unit: "cell",
      unitPrice: 24_966.666,
      amount: 7_490_000,
      receivedGoods: "Có",
      countsInDebt: "Có",
      sourceRow: 3,
    },
  ],
  payments: [
    {
      code: "TT-0001",
      date: "07/05/2026",
      partner: "Long",
      amount: 45_000_000,
      paymentMethod: "Chuyển khoản",
      notes: "Thanh toán cũ đã nằm trong số dư chốt",
      countsInDebt: "Không",
      sourceRow: 2,
    },
    {
      code: "TT-0002",
      date: "08/05/2026",
      partner: "Long",
      amount: 15_000_000,
      paymentMethod: "Chuyển khoản",
      notes: "Trả trước cho Long",
      countsInDebt: "Có",
      sourceRow: 3,
    },
  ],
  returns: [
    {
      code: "TH-0001",
      date: "09/05/2026",
      partner: "Long",
      category: "Cell lỗi",
      description: "Trả cell lỗi",
      quantity: 10,
      unitPrice: 150_000,
      amount: 1_500_000,
      countsInDebt: "Không",
      notes: "Dòng cũ để đối chiếu",
      sourceRow: 4,
    },
  ],
  customerOrders: [
    {
      code: "DH-0001",
      date: "09/05/2026",
      customerName: "Anh Test",
      customerPhone: "0912345678",
      productName: "Đóng pin",
      totalAmount: 1_200_000,
      paidAmount: 700_000,
      debtAmount: 500_000,
      notes: "Đơn cũ",
      dataStatus: "Đủ dữ liệu",
      sourceRow: 2,
    },
    {
      code: "DH-0002",
      date: "10/05/2026",
      customerName: "Chị Quên Giá",
      customerPhone: "0987654321",
      productName: "Sửa thiết bị",
      totalAmount: 0,
      paidAmount: 0,
      notes: "Thiếu giá",
      dataStatus: "Quên giá",
      sourceRow: 3,
    },
    {
      code: "DH-0003",
      date: "11/05/2026",
      customerName: "Khách thiếu SĐT",
      customerPhone: "",
      productName: "Dòng bán cũ",
      totalAmount: 300_000,
      paidAmount: 300_000,
      notes: "Thiếu số điện thoại trên sheet",
      dataStatus: "Đủ dữ liệu",
      sourceRow: 42,
    },
  ],
};

test("recognizes legacy debt-counting flags", () => {
  assert.equal(isLegacyDebtCounted("Có"), true);
  assert.equal(isLegacyDebtCounted("Không"), false);
  assert.equal(isLegacyDebtCounted(""), true);
});

test("builds partner ledger entries from purchase, payment and return tabs only", () => {
  const entries = buildLegacyPartnerEntries(sampleRows);

  assert.equal(entries.length, 5);
  assert.equal(entries[0].entryType, "OPENING_BALANCE");
  assert.equal(entries[0].category, "Số dư cũ");
  assert.equal(entries[0].receivedGoods, true);
  assert.match(entries[0].notes || "", /07\/05\/2026/);
  assert.match(entries[0].notes || "", /08\/05\/2026/);
  assert.equal(entries[1].entryType, "PURCHASE");
  assert.equal(entries[1].category, "Cell");
  assert.equal(entries[1].quantity, 300);
  assert.equal(entries[1].receivedGoods, true);
  assert.equal(entries[1].unit, "cell");
  assert.equal(entries[2].entryType, "PAYMENT");
  assert.equal(entries[2].countsInDebt, false);
  assert.match(entries[2].notes || "", /không cộng lại/);
  assert.equal(entries[4].entryType, "RETURN");
  assert.equal(entries[4].category, "Cell lỗi");
  assert.equal(entries[4].countsInDebt, false);
});

test("keeps customer sheet rows separate as service-order imports", () => {
  const serviceOrders = buildLegacyServiceOrders(sampleRows);
  const partnerEntries = buildLegacyPartnerEntries(sampleRows);

  assert.equal(serviceOrders.length, 3);
  assert.equal(partnerEntries.some((entry) => entry.sourceCode.startsWith("DON_KHACH")), false);
  assert.equal(serviceOrders[0].orderCode, "DH-0001");
  assert.equal(serviceOrders[0].source, "IMPORT");
  assert.equal(serviceOrders[0].sourceName, "Đơn hàng đã bán");
  assert.equal(serviceOrders[0].sourceRow, 2);
  assert.equal(serviceOrders[0].priceStatus, "CONFIRMED");
  assert.equal(serviceOrders[0].quotedPrice, 1_200_000);
  assert.equal(serviceOrders[0].paidAmount, 700_000);
  assert.equal(serviceOrders[1].priceStatus, "LEGACY_MISSING");
  assert.equal(serviceOrders[2].customerPhone, "0990000042");
  assert.equal(serviceOrders[2].customerPhoneMissing, true);
  assert.match(serviceOrders[2].notes || "", /Sheet cũ thiếu SĐT/);
});

test("summarizes legacy workbook rows without double-counting old comparison payments", () => {
  const summary = summarizeLegacyImport(sampleRows);

  assert.equal(summary.partnerEntries, 5);
  assert.equal(summary.serviceOrders, 3);
  assert.equal(summary.totalLegacyPurchased, 7_490_000);
  assert.equal(summary.totalLegacyPaid, 60_000_000);
  assert.equal(summary.totalLegacyReturned, 1_500_000);
  assert.equal(summary.partnerReferenceOnly, 2);
  assert.equal(summary.countedPayableDelta, 12_720_000);
});
