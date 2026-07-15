import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildPartnerDiscountSheetValidationFormula,
  calculatePartnerPurchaseAmounts,
  PARTNER_DISCOUNT_SHEET_INPUT_MESSAGE,
  PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT,
  parseExcelPartnerDiscountPercent,
  parsePartnerDiscountPercent,
} from "../../lib/partner-discounts";

test("calculates an optional percentage discount from the purchase gross amount", () => {
  assert.deepEqual(calculatePartnerPurchaseAmounts(9, 55_000, 15), {
    discountAmount: 74_250,
    discountPercent: 15,
    grossAmount: 495_000,
    netAmount: 420_750,
  });
});

test("keeps legacy purchases unchanged when no discount is supplied", () => {
  assert.deepEqual(calculatePartnerPurchaseAmounts(28, 30_000, null), {
    discountAmount: 0,
    discountPercent: null,
    grossAmount: 840_000,
    netAmount: 840_000,
  });
});

test("allows a full discount with zero net debt", () => {
  assert.deepEqual(calculatePartnerPurchaseAmounts(1, 495_000, 100), {
    discountAmount: 495_000,
    discountPercent: 100,
    grossAmount: 495_000,
    netAmount: 0,
  });
});

test("rejects discount percentages outside the supported range", () => {
  assert.throws(() => calculatePartnerPurchaseAmounts(1, 100_000, 101), /0.*100/);
});

test("parses only complete optional discount percentages", () => {
  assert.equal(parsePartnerDiscountPercent("15"), 15);
  assert.equal(parsePartnerDiscountPercent("15%"), 15);
  assert.equal(parsePartnerDiscountPercent("0"), null);
  assert.equal(Number.isNaN(parsePartnerDiscountPercent("15abc")), true);
  assert.equal(Number.isNaN(parsePartnerDiscountPercent("15% off")), true);
});

test("parses both legacy scaling percentages and new literal-percent Sheet numbers", () => {
  assert.equal(parseExcelPartnerDiscountPercent(0.15, "0.##%"), 15);
  assert.equal(parseExcelPartnerDiscountPercent(15, '0"%"'), 15);
});

test("keeps decimal discounts consistent between the web parser and Google Sheet setup", () => {
  assert.equal(parsePartnerDiscountPercent("15,5"), 15.5);
  assert.equal(PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT, '0.##"%"');
  assert.match(PARTNER_DISCOUNT_SHEET_INPUT_MESSAGE, /15,5/);
  assert.equal(
    buildPartnerDiscountSheetValidationFormula(2),
    "=AND(ISNUMBER(M2);M2>=0;M2<=100)"
  );
});

test("database migration keeps blank discounts at zero and restricts non-blank discounts to purchases", () => {
  const migration = readFileSync(
    resolve("prisma/migrations/20260714170000_partner_ledger_optional_discount/migration.sql"),
    "utf8"
  ).replace(/\s+/g, " ");

  assert.match(
    migration,
    /CHECK \( \("discountPercent" IS NULL AND "discountAmount" = 0\) OR \("discountPercent" IS NOT NULL AND "entryType" = 'PURCHASE'\) \)/
  );
});
