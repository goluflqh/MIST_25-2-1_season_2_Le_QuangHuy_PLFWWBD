import assert from "node:assert/strict";
import test from "node:test";
import {
  APPROVED_DUPLICATE_WARRANTY_PAIRS,
  APPROVED_INITIAL_ORDER_GROUPS,
  APPROVED_STANDALONE_WARRANTY_LINKS,
  reconcileApprovedInitialCustomerOrders,
} from "../../lib/minhhong-import/initial-reconciliation";
import type { MinhHongParsedCustomerOrder } from "../../lib/minhhong-import/workbook-parser";

const EXPECTED_INITIAL_ORDER_GROUPS = [
  ["MH-DH-20260427-16CF49", "DON_KHACH:MH_A8F88167E6844765B97371A136776B0A"],
  ["MH-DH-20260506-1A0B56", "DON_KHACH:MH_F582E6AD656C4F4AB58616BF533D8B47"],
  ["MH-DH-20260506-4D8BB2", "DON_KHACH:MH_C2C4F881247E4D94AAEB03F052392B9F"],
  ["MH-DH-20260511-73FDCA", "DON_KHACH:MH_38677C6C80334F6094CD6CF5501CC074"],
  ["MH-DH-20260515-F785E2", "DON_KHACH:MH_7F0413C9FDEC463CB347E7FC9689DA7B"],
  ["MH-DH-20260518-A453DE", "DON_KHACH:MH_EEAD213E07ED46DCB59B0C491B112A45"],
  ["MH-DH-20260519-1F1121", "DON_KHACH:MH_CB058E0020A4498DA15B1966B65A22F4"],
  ["MH-DH-20260527-6E97C7", "DON_KHACH:MH_0FDA11574DAD4630AFE03CFC8D52F0FB"],
  ["MH-DH-20260529-A059F2", "DON_KHACH:MH_E73499BC1EB34A18B724A7CBF28E1D4F"],
  ["MH-DH-20260605-764910", "DON_KHACH:MH_59DF83D8BF61444C9C739839CAC7577C"],
  ["MH-DH-20260619-CF0FE5", "DON_KHACH:MH_17439F64D1C74E6689858CDC9328E172"],
  [
    "MH-DH-20260714-5E8932",
    "DON_KHACH:MH_85DAEF2673514BADA1057ABA1577A036",
    "DON_KHACH:MH_3B49822D0F9B4B94A30A065EDB357F4A",
    "DON_KHACH:MH_543F93D3ED8D491489A6200CD290EC9E",
  ],
] as const;

const EXPECTED_STANDALONE_WARRANTY_LINKS = [
  ["MH-BH-20260502-AB2327", "DON_KHACH:MH_3BA742354332448B8FFE9A5557E86B5E"],
  ["MH-BH-20260529-861EFC", "DON_KHACH:MH_E73499BC1EB34A18B724A7CBF28E1D4F"],
  ["MH-BH-20260621-07C0EB", "DON_KHACH:MH_41FEEA116C144299BAC81BD0BD64A59D"],
  ["MH-BH-20260622-3181D3", "DON_KHACH:MH_AF033312AA9A43D0806DBFE7A022DC67"],
  ["MH-BH-20260711-D43C4D", "DON_KHACH:MH_F466AA2165F542A18919DAECBFA48D2E"],
] as const;

const EXPECTED_DUPLICATE_WARRANTY_PAIRS = [
  ["MH-BH-20260511-2E9CE8", "MH-BH-20260511-15E74B"],
  ["MH-BH-20260515-9C4AEB", "MH-BH-20260515-8D8941"],
  ["MH-BH-20260518-5E5B00", "MH-BH-20260518-217DFB"],
  ["MH-BH-20260519-494A29", "MH-BH-20260519-57DA77"],
  ["MH-BH-20260527-EBB410", "MH-BH-20260527-869F53"],
  ["MH-BH-20260605-CF574C", "MH-BH-20260605-00648A"],
  ["MH-BH-20260619-D57D7E", "MH-BH-20260619-AA9642"],
  ["MH-BH-20260714-92B3F7", "MH-BH-20260714-D99484"],
] as const;

function sourceOrder(
  sourceCode: string,
  sourceRow: number,
  customerName: string,
  productName: string,
  quotedPrice: number
): MinhHongParsedCustomerOrder {
  return {
    sourceCode,
    sourceRow,
    orderCode: `DH-${sourceRow}`,
    orderDate: "2026-07-14",
    customerName,
    customerPhone: "",
    productName,
    quotedPrice,
    paidAmount: quotedPrice,
    debtAmount: 0,
    priceStatus: "CONFIRMED",
    notes: null,
  };
}

test("groups the three approved Nghĩa Sheet rows into one existing web order", () => {
  const nghiaGroup = APPROVED_INITIAL_ORDER_GROUPS.find((group) => group.sourceCodes.length === 3);
  assert.ok(nghiaGroup);

  const orders = [
    sourceOrder(nghiaGroup.sourceCodes[0], 60, "Nghĩa cháu Nghiệp", "2Pin 15cell.25r", 1_600_000),
    sourceOrder(nghiaGroup.sourceCodes[1], 61, "Nghĩa", "1pin15cell25p", 700_000),
    sourceOrder(nghiaGroup.sourceCodes[2], 62, "Nghĩa", "1 sạc 21v tốt", 150_000),
  ];

  const reconciled = reconcileApprovedInitialCustomerOrders(orders, new Set([nghiaGroup.orderCode]));

  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].orderCode, nghiaGroup.orderCode);
  assert.equal(reconciled[0].quotedPrice, 2_450_000);
  assert.equal(reconciled[0].paidAmount, 2_450_000);
  assert.equal(reconciled[0].sourceRow, 60);
  assert.match(reconciled[0].productName, /2Pin 15cell\.25r/);
  assert.match(reconciled[0].productName, /1pin15cell25p/);
  assert.match(reconciled[0].productName, /1 sạc 21v tốt/);
});

test("locks every approved production reconciliation mapping to an independent golden fixture", () => {
  assert.deepEqual(
    APPROVED_INITIAL_ORDER_GROUPS.map((group) => [group.orderCode, ...group.sourceCodes]),
    EXPECTED_INITIAL_ORDER_GROUPS
  );
  assert.deepEqual(
    APPROVED_STANDALONE_WARRANTY_LINKS.map((link) => [link.serialNo, link.sourceCode]),
    EXPECTED_STANDALONE_WARRANTY_LINKS
  );
  assert.deepEqual(
    APPROVED_DUPLICATE_WARRANTY_PAIRS.map((pair) => [pair.canonicalSerialNo, pair.duplicateSerialNo]),
    EXPECTED_DUPLICATE_WARRANTY_PAIRS
  );
});

test("does not partially combine an approved multi-row order when one Sheet row is missing", () => {
  const nghiaGroup = APPROVED_INITIAL_ORDER_GROUPS.find((group) => group.sourceCodes.length === 3);
  assert.ok(nghiaGroup);
  const partialOrders = [
    sourceOrder(nghiaGroup.sourceCodes[0], 60, "Nghĩa", "2Pin 15cell.25r", 1_600_000),
    sourceOrder(nghiaGroup.sourceCodes[1], 61, "Nghĩa", "1pin15cell25p", 700_000),
  ];

  const reconciled = reconcileApprovedInitialCustomerOrders(partialOrders, new Set([nghiaGroup.orderCode]));

  assert.equal(reconciled.length, 2);
  assert.deepEqual(reconciled.map((order) => order.orderCode), ["DH-60", "DH-61"]);
});

test("reconciles 60 Sheet rows into 58 real orders after all approved matches", () => {
  const approvedRows = APPROVED_INITIAL_ORDER_GROUPS.flatMap((group, groupIndex) => (
    group.sourceCodes.map((sourceCode, rowIndex) => sourceOrder(
      sourceCode,
      100 + groupIndex * 3 + rowIndex,
      `Khách ${groupIndex + 1}`,
      `Sản phẩm ${groupIndex + 1}.${rowIndex + 1}`,
      100_000 + rowIndex
    ))
  ));
  const otherRows = Array.from({ length: 60 - approvedRows.length }, (_, index) => sourceOrder(
    `DON_KHACH:UNMAPPED-${index + 1}`,
    500 + index,
    `Khách mới ${index + 1}`,
    `Sản phẩm mới ${index + 1}`,
    200_000 + index
  ));

  const reconciled = reconcileApprovedInitialCustomerOrders(
    [...approvedRows, ...otherRows],
    new Set(APPROVED_INITIAL_ORDER_GROUPS.map((group) => group.orderCode))
  );

  assert.equal(approvedRows.length + otherRows.length, 60);
  assert.equal(reconciled.length, 58);
  assert.equal(
    APPROVED_INITIAL_ORDER_GROUPS.every((group) => reconciled.some((order) => order.orderCode === group.orderCode)),
    true
  );
});
