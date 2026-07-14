import assert from "node:assert/strict";
import test from "node:test";
import {
  getPartnerBalance,
  getPartnerEntrySignedAmount,
  normalizePartnerEntryPayload,
  serializePartner,
} from "../../lib/partner-ledger";

const now = new Date("2026-05-26T00:00:00.000Z");

test("signs partner ledger entries by business meaning", () => {
  assert.equal(getPartnerEntrySignedAmount({ amount: 100_000, entryType: "PURCHASE" }), 100_000);
  assert.equal(getPartnerEntrySignedAmount({ amount: 100_000, entryType: "OPENING_BALANCE" }), 100_000);
  assert.equal(getPartnerEntrySignedAmount({ amount: 100_000, entryType: "PAYMENT" }), -100_000);
  assert.equal(getPartnerEntrySignedAmount({ amount: 100_000, entryType: "RETURN" }), -100_000);
  assert.equal(getPartnerEntrySignedAmount({ amount: -50_000, entryType: "ADJUSTMENT" }), -50_000);
  assert.equal(getPartnerEntrySignedAmount({ amount: 45_000_000, countsInDebt: false, entryType: "PAYMENT" }), 0);
});

test("calculates partner balance without double-counting reference-only legacy rows", () => {
  const balance = getPartnerBalance([
    { amount: 20_230_000, entryType: "OPENING_BALANCE" },
    { amount: 7_490_000, entryType: "PURCHASE" },
    { amount: 45_000_000, countsInDebt: false, entryType: "PAYMENT" },
    { amount: 15_000_000, entryType: "PAYMENT" },
    { amount: 1_500_000, countsInDebt: false, entryType: "RETURN" },
  ]);

  assert.equal(balance, 12_720_000);
});

test("normalizes an optional purchase discount and stores the net debt amount", () => {
  const entry = normalizePartnerEntryPayload({
    amount: 495_000,
    description: "Hóa đơn BH260714-001",
    discountPercent: 15,
    entryType: "PURCHASE",
    partnerId: "partner_long",
    quantity: 9,
    unitPrice: 55_000,
  });

  assert.equal(entry.amount, 420_750);
  assert.equal(entry.discountAmount, 74_250);
  assert.equal(entry.discountPercent, 15);
});

test("keeps legacy partner entries unchanged when discount is blank", () => {
  const entry = normalizePartnerEntryPayload({
    amount: 840_000,
    description: "Pin 35E",
    discountPercent: "",
    entryType: "PURCHASE",
    partnerId: "partner_long",
    quantity: 28,
    unitPrice: 30_000,
  });

  assert.equal(entry.amount, 840_000);
  assert.equal(entry.discountAmount, 0);
  assert.equal(entry.discountPercent, null);
});

test("rejects a discount percentage with trailing text", () => {
  assert.throws(() => normalizePartnerEntryPayload({
    amount: 495_000,
    description: "Hóa đơn sai chiết khấu",
    discountPercent: "15abc",
    entryType: "PURCHASE",
    partnerId: "partner_long",
    quantity: 9,
    unitPrice: 55_000,
  }), /0.*100/);
});

test("serializes partner totals with purchase, payment, return and reference buckets", () => {
  const partner = {
    id: "partner_long",
    code: "LONG",
    name: "Long",
    phone: null,
    type: "SUPPLIER",
    notes: null,
    active: true,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ledgerEntries: [
      {
        id: "opening",
        partnerId: "partner_long",
        entryType: "OPENING_BALANCE",
        entryDate: new Date("2026-05-07T00:00:00.000Z"),
        amount: 20_230_000,
        description: "Số dư chốt",
        reference: "CHOT-2026-05-07",
        category: "Số dư cũ",
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: "Chốt công nợ",
        sourceCode: "NHAP_HANG:NH-0001",
        sourceRow: 2,
        paymentMethod: null,
        receivedGoods: true,
        countsInDebt: true,
        notes: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "purchase",
        partnerId: "partner_long",
        entryType: "PURCHASE",
        entryDate: new Date("2026-05-08T00:00:00.000Z"),
        amount: 7_490_000,
        description: "300 cell EVE 25P",
        reference: "NH-0002",
        category: "Cell",
        quantity: 300,
        unit: "cell",
        unitPrice: 24_967,
        sourceName: "Long",
        sourceCode: "NHAP_HANG:NH-0002",
        sourceRow: 3,
        paymentMethod: null,
        receivedGoods: true,
        countsInDebt: true,
        notes: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "old-payment",
        partnerId: "partner_long",
        entryType: "PAYMENT",
        entryDate: new Date("2026-05-07T00:00:00.000Z"),
        amount: 45_000_000,
        description: "Thanh toán cũ để đối chiếu",
        reference: "TT-OLD",
        category: null,
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: null,
        sourceCode: "THANH_TOAN:TT-OLD",
        sourceRow: 2,
        paymentMethod: "Chuyển khoản",
        receivedGoods: null,
        countsInDebt: false,
        notes: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "payment",
        partnerId: "partner_long",
        entryType: "PAYMENT",
        entryDate: new Date("2026-05-08T00:00:00.000Z"),
        amount: 15_000_000,
        description: "Trả trước cho Long",
        reference: "TT-0002",
        category: null,
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: null,
        sourceCode: "THANH_TOAN:TT-0002",
        sourceRow: 3,
        paymentMethod: "Chuyển khoản",
        receivedGoods: null,
        countsInDebt: true,
        notes: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  const serialized = serializePartner(partner as never);

  assert.equal(serialized.balance, 12_720_000);
  assert.equal(serialized.totals.openingBalance, 20_230_000);
  assert.equal(serialized.totals.purchased, 7_490_000);
  assert.equal(serialized.totals.paid, 60_000_000);
  assert.equal(serialized.totals.returned, 0);
  assert.equal(serialized.totals.referenceOnly, 45_000_000);
  assert.equal(serialized.ledgerEntries[1].category, "Cell");
  assert.equal(serialized.ledgerEntries[1].receivedGoods, true);
  assert.equal(serialized.ledgerEntries[2].signedAmount, 0);
});
