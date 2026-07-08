import assert from "node:assert/strict";
import test from "node:test";
import {
  getVisibleDebtPartners,
  isLegacyLongSourcePartner,
  summarizeLegacyLongRule,
} from "../../lib/partner-legacy";

function partner(overrides: Partial<Parameters<typeof isLegacyLongSourcePartner>[0]> = {}) {
  return {
    id: "partner",
    code: "DT_SHOPEE",
    name: "Shopee",
    type: "OTHER",
    notes: "Nguon mua ho qua Long trong du lieu cu; chi tinh cong no rieng neu Minh Hong tu mua truc tiep",
    balance: 0,
    ledgerEntries: [],
    ...overrides,
  };
}

test("detects old workbook source names that are not real debt partners", () => {
  assert.equal(isLegacyLongSourcePartner(partner({ code: "DT_SHOPEE", name: "Shopee" })), true);
  assert.equal(isLegacyLongSourcePartner(partner({ code: "DT_A_TAM", name: "a Tam" })), true);
  assert.equal(isLegacyLongSourcePartner(partner({ code: "LONG", name: "Long", type: "SUPPLIER" })), false);
  assert.equal(isLegacyLongSourcePartner(partner({
    code: "NEW_SUPPLIER",
    name: "Nha cung cap moi",
    type: "SUPPLIER",
    notes: "Minh Hong tu mua truc tiep",
    ledgerEntries: [{ id: "entry-1" }],
  })), false);
});

test("shows Long and real new partners while hiding legacy source-only partners", () => {
  const visible = getVisibleDebtPartners([
    partner({ id: "long", code: "LONG", name: "Long", type: "SUPPLIER", balance: 12_720_000 }),
    partner({ id: "khac", code: "KHAC", name: "Khac", type: "OTHER", notes: "" }),
    partner({ id: "shopee", code: "DT_SHOPEE", name: "Shopee", ledgerEntries: [{ id: "legacy-source-row" }] }),
    partner({ id: "new", code: "NEW_SUPPLIER", name: "Nha cung cap moi", type: "SUPPLIER", notes: "", ledgerEntries: [{ id: "entry-1" }] }),
  ]);

  assert.deepEqual(visible.map((item) => item.code), ["LONG", "NEW_SUPPLIER"]);
});

test("documents the official Long payable formula", () => {
  assert.deepEqual(summarizeLegacyLongRule(), {
    openingBalance: 20_230_000,
    countedPurchase: 7_490_000,
    countedPayment: 15_000_000,
    payable: 12_720_000,
  });
});
