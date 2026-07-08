import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateServiceOrderFinancials,
  getPartnerBalance,
  getPartnerEntrySignedAmount,
  getServiceOrderReceivableDebt,
  summarizePartnerLedgerEntries,
  summarizeServiceOrderFinancials,
} from "../../lib/financial-calculations";

test("calculates service-order receivables from one shared formula", () => {
  assert.deepEqual(
    calculateServiceOrderFinancials({
      discountAmount: 100_000,
      paidAmount: 400_000,
      priceStatus: "CONFIRMED",
      quotedPrice: 1_000_000,
    }),
    {
      debt: 500_000,
      discount: 100_000,
      overpaid: 0,
      paid: 400_000,
      payable: 900_000,
      quoted: 1_000_000,
    }
  );

  assert.equal(getServiceOrderReceivableDebt({
    paidAmount: 500_000,
    priceStatus: "LEGACY_MISSING",
    quotedPrice: null,
  }), 0);
});

test("summarizes service orders without counting unconfirmed debt", () => {
  const summary = summarizeServiceOrderFinancials([
    { discountAmount: 0, paidAmount: 700_000, priceStatus: "CONFIRMED", quotedPrice: 1_000_000 },
    { discountAmount: 0, paidAmount: 300_000, priceStatus: "LEGACY_MISSING", quotedPrice: null },
  ]);

  assert.equal(summary.quoted, 1_000_000);
  assert.equal(summary.payable, 1_000_000);
  assert.equal(summary.paid, 1_000_000);
  assert.equal(summary.debt, 300_000);
  assert.equal(summary.debtOrders, 1);
});

test("calculates partner ledger balances from signed business meaning", () => {
  const entries = [
    { amount: 20_230_000, countsInDebt: true, entryType: "OPENING_BALANCE" },
    { amount: 7_490_000, countsInDebt: true, entryType: "PURCHASE" },
    { amount: 45_000_000, countsInDebt: false, entryType: "PAYMENT" },
    { amount: 15_000_000, countsInDebt: true, entryType: "PAYMENT" },
    { amount: 1_500_000, countsInDebt: false, entryType: "RETURN" },
  ];

  assert.equal(getPartnerEntrySignedAmount(entries[2]), 0);
  assert.equal(getPartnerBalance(entries), 12_720_000);

  const summary = summarizePartnerLedgerEntries(entries);
  assert.equal(summary.openingBalance, 20_230_000);
  assert.equal(summary.purchased, 7_490_000);
  assert.equal(summary.paid, 60_000_000);
  assert.equal(summary.referenceOnly, 46_500_000);
  assert.equal(summary.countedPaid, 15_000_000);
});
