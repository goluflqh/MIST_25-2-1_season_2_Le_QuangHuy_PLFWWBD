import assert from "node:assert/strict";
import test from "node:test";
import { getPartnerBalance, getPartnerEntrySignedAmount, serializePartner } from "../../lib/partner-ledger";

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
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: "Chốt công nợ",
        sourceCode: "NHAP_HANG:NH-0001",
        sourceRow: 2,
        paymentMethod: null,
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
        quantity: 300,
        unit: "cell",
        unitPrice: 24_967,
        sourceName: "Long",
        sourceCode: "NHAP_HANG:NH-0002",
        sourceRow: 3,
        paymentMethod: null,
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
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: null,
        sourceCode: "THANH_TOAN:TT-OLD",
        sourceRow: 2,
        paymentMethod: "Chuyển khoản",
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
        quantity: null,
        unit: null,
        unitPrice: null,
        sourceName: null,
        sourceCode: "THANH_TOAN:TT-0002",
        sourceRow: 3,
        paymentMethod: "Chuyển khoản",
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
  assert.equal(serialized.totals.referenceOnly, 45_000_000);
  assert.equal(serialized.ledgerEntries[2].signedAmount, 0);
});
