import type { MinhHongParsedCustomerOrder } from "./workbook-parser";

export interface ApprovedInitialOrderGroup {
  orderCode: string;
  sourceCodes: string[];
}

export interface ApprovedStandaloneWarrantyLink {
  serialNo: string;
  sourceCode: string;
}

export interface ApprovedDuplicateWarrantyPair {
  canonicalSerialNo: string;
  duplicateSerialNo: string;
}

export const APPROVED_INITIAL_ORDER_GROUPS: ApprovedInitialOrderGroup[] = [
  {
    orderCode: "MH-DH-20260427-16CF49",
    sourceCodes: ["DON_KHACH:MH_A8F88167E6844765B97371A136776B0A"],
  },
  {
    orderCode: "MH-DH-20260506-1A0B56",
    sourceCodes: ["DON_KHACH:MH_F582E6AD656C4F4AB58616BF533D8B47"],
  },
  {
    orderCode: "MH-DH-20260506-4D8BB2",
    sourceCodes: ["DON_KHACH:MH_C2C4F881247E4D94AAEB03F052392B9F"],
  },
  {
    orderCode: "MH-DH-20260511-73FDCA",
    sourceCodes: ["DON_KHACH:MH_38677C6C80334F6094CD6CF5501CC074"],
  },
  {
    orderCode: "MH-DH-20260515-F785E2",
    sourceCodes: ["DON_KHACH:MH_7F0413C9FDEC463CB347E7FC9689DA7B"],
  },
  {
    orderCode: "MH-DH-20260518-A453DE",
    sourceCodes: ["DON_KHACH:MH_EEAD213E07ED46DCB59B0C491B112A45"],
  },
  {
    orderCode: "MH-DH-20260519-1F1121",
    sourceCodes: ["DON_KHACH:MH_CB058E0020A4498DA15B1966B65A22F4"],
  },
  {
    orderCode: "MH-DH-20260527-6E97C7",
    sourceCodes: ["DON_KHACH:MH_0FDA11574DAD4630AFE03CFC8D52F0FB"],
  },
  {
    orderCode: "MH-DH-20260529-A059F2",
    sourceCodes: ["DON_KHACH:MH_E73499BC1EB34A18B724A7CBF28E1D4F"],
  },
  {
    orderCode: "MH-DH-20260605-764910",
    sourceCodes: ["DON_KHACH:MH_59DF83D8BF61444C9C739839CAC7577C"],
  },
  {
    orderCode: "MH-DH-20260619-CF0FE5",
    sourceCodes: ["DON_KHACH:MH_17439F64D1C74E6689858CDC9328E172"],
  },
  {
    orderCode: "MH-DH-20260714-5E8932",
    sourceCodes: [
      "DON_KHACH:MH_85DAEF2673514BADA1057ABA1577A036",
      "DON_KHACH:MH_3B49822D0F9B4B94A30A065EDB357F4A",
      "DON_KHACH:MH_543F93D3ED8D491489A6200CD290EC9E",
    ],
  },
];

export const APPROVED_STANDALONE_WARRANTY_LINKS: ApprovedStandaloneWarrantyLink[] = [
  {
    serialNo: "MH-BH-20260502-AB2327",
    sourceCode: "DON_KHACH:MH_3BA742354332448B8FFE9A5557E86B5E",
  },
  {
    serialNo: "MH-BH-20260529-861EFC",
    sourceCode: "DON_KHACH:MH_E73499BC1EB34A18B724A7CBF28E1D4F",
  },
  {
    serialNo: "MH-BH-20260621-07C0EB",
    sourceCode: "DON_KHACH:MH_41FEEA116C144299BAC81BD0BD64A59D",
  },
  {
    serialNo: "MH-BH-20260622-3181D3",
    sourceCode: "DON_KHACH:MH_AF033312AA9A43D0806DBFE7A022DC67",
  },
  {
    serialNo: "MH-BH-20260711-D43C4D",
    sourceCode: "DON_KHACH:MH_F466AA2165F542A18919DAECBFA48D2E",
  },
];

export const APPROVED_DUPLICATE_WARRANTY_PAIRS: ApprovedDuplicateWarrantyPair[] = [
  { canonicalSerialNo: "MH-BH-20260511-2E9CE8", duplicateSerialNo: "MH-BH-20260511-15E74B" },
  { canonicalSerialNo: "MH-BH-20260515-9C4AEB", duplicateSerialNo: "MH-BH-20260515-8D8941" },
  { canonicalSerialNo: "MH-BH-20260518-5E5B00", duplicateSerialNo: "MH-BH-20260518-217DFB" },
  { canonicalSerialNo: "MH-BH-20260519-494A29", duplicateSerialNo: "MH-BH-20260519-57DA77" },
  { canonicalSerialNo: "MH-BH-20260527-EBB410", duplicateSerialNo: "MH-BH-20260527-869F53" },
  { canonicalSerialNo: "MH-BH-20260605-CF574C", duplicateSerialNo: "MH-BH-20260605-00648A" },
  { canonicalSerialNo: "MH-BH-20260619-D57D7E", duplicateSerialNo: "MH-BH-20260619-AA9642" },
  { canonicalSerialNo: "MH-BH-20260714-92B3F7", duplicateSerialNo: "MH-BH-20260714-D99484" },
];

const approvedOrderGroupBySourceCode = new Map(
  APPROVED_INITIAL_ORDER_GROUPS.flatMap((group) => (
    group.sourceCodes.map((sourceCode) => [sourceCode, group] as const)
  ))
);

export function getApprovedInitialOrderGroup(sourceCode: string) {
  return approvedOrderGroupBySourceCode.get(sourceCode) || null;
}

export function isApprovedInitialOrderMatch(order: MinhHongParsedCustomerOrder, existingOrderCode: unknown) {
  const group = getApprovedInitialOrderGroup(order.sourceCode);
  return Boolean(group && group.orderCode === String(existingOrderCode || ""));
}

function combineText(values: Array<string | null | undefined>, separator: string) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))].join(separator);
}

function combineOrderGroup(group: ApprovedInitialOrderGroup, rows: MinhHongParsedCustomerOrder[]) {
  const primary = rows[0];
  const quotedPrices = rows.map((row) => row.quotedPrice);
  const quotedPrice = quotedPrices.some((value) => value === null)
    ? null
    : quotedPrices.reduce<number>((sum, value) => sum + Number(value || 0), 0);
  const priceStatus = rows.some((row) => row.priceStatus === "LEGACY_MISSING")
    ? "LEGACY_MISSING" as const
    : rows.every((row) => row.priceStatus === "CONFIRMED")
      ? "CONFIRMED" as const
      : "UNKNOWN" as const;

  return {
    ...primary,
    orderCode: group.orderCode,
    sourceCode: group.sourceCodes.find((sourceCode) => rows.some((row) => row.sourceCode === sourceCode)) || primary.sourceCode,
    sourceRow: Math.min(...rows.map((row) => row.sourceRow || Number.MAX_SAFE_INTEGER)),
    customerName: rows.find((row) => row.customerName)?.customerName || primary.customerName,
    customerPhone: rows.find((row) => row.customerPhone)?.customerPhone || "",
    productName: combineText(rows.map((row) => row.productName), " + "),
    quotedPrice,
    paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0),
    debtAmount: rows.reduce((sum, row) => sum + row.debtAmount, 0),
    priceStatus,
    notes: combineText(rows.map((row) => row.notes), " · ") || null,
  } satisfies MinhHongParsedCustomerOrder;
}

export function reconcileApprovedInitialCustomerOrders(
  orders: MinhHongParsedCustomerOrder[],
  existingApprovedOrderCodes: Set<string>
) {
  const consumedSourceCodes = new Set<string>();
  const reconciled: MinhHongParsedCustomerOrder[] = [];

  for (const group of APPROVED_INITIAL_ORDER_GROUPS) {
    if (!existingApprovedOrderCodes.has(group.orderCode)) continue;
    const rows = group.sourceCodes.flatMap((sourceCode) => {
      const order = orders.find((candidate) => candidate.sourceCode === sourceCode);
      return order ? [order] : [];
    });
    if (rows.length !== group.sourceCodes.length) continue;
    rows.forEach((row) => consumedSourceCodes.add(row.sourceCode));
    reconciled.push(combineOrderGroup(group, rows));
  }

  reconciled.push(...orders.filter((order) => !consumedSourceCodes.has(order.sourceCode)));
  return reconciled;
}
