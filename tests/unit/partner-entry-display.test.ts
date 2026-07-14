import assert from "node:assert/strict";
import test from "node:test";
import {
  getPartnerEntryAmountLabel,
  getPartnerEntryDisplayDetails,
  getPartnerEntryHistoryNote,
} from "../../lib/partner-entry-display";

test("shows business details without internal source codes or source rows", () => {
  const details = getPartnerEntryDisplayDetails({
    quantity: 3,
    unit: "cái",
    unitPrice: 1_300_000,
    paymentMethod: null,
    sourceName: "Long",
    sourceCode: "NHAP_HANG:NH-0004",
    sourceRow: 5,
  });

  assert.equal(details, "3 cái × 1.300.000đ");
  assert.doesNotMatch(details, /NHAP_HANG|dòng 5|Long/);
});

test("uses plain business labels for each transaction amount", () => {
  assert.equal(getPartnerEntryAmountLabel("PURCHASE"), "Tiền mua hàng");
  assert.equal(getPartnerEntryAmountLabel("PAYMENT"), "Số tiền đã trả");
  assert.equal(getPartnerEntryAmountLabel("RETURN"), "Giá trị hàng trả");
  assert.equal(getPartnerEntryAmountLabel("OPENING_BALANCE"), "Số dư đầu kỳ");
});

test("shows optional partner discounts without exposing technical metadata", () => {
  const details = getPartnerEntryDisplayDetails({
    discountAmount: 74_250,
    discountPercent: 15,
    paymentMethod: null,
    quantity: 9,
    unit: "món",
    unitPrice: 55_000,
  });

  assert.equal(details, "9 món × 55.000đ · CK 15% (-74.250đ)");
});

test("shows a non-zero discount even when VND rounding produces zero discount amount", () => {
  const details = getPartnerEntryDisplayDetails({
    discountAmount: 0,
    discountPercent: 1,
    paymentMethod: null,
    quantity: 1,
    unit: "món",
    unitPrice: 1,
  });

  assert.equal(details, "1 món × 1đ · CK 1% (0đ)");
});

test("explains historical rows without exposing reconciliation wording", () => {
  const note = getPartnerEntryHistoryNote(false);

  assert.equal(note, "Bản ghi cũ, đã tính trong số dư đầu kỳ.");
  assert.doesNotMatch(note, /đối chiếu|không cộng|source|dòng/i);
  assert.equal(getPartnerEntryHistoryNote(true), "");
});
