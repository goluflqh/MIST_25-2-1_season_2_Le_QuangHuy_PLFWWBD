import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeMinhHongSheetSyncTarget,
  buildGoogleSheetsBatchClearPayload,
  buildGoogleSheetsBatchUpdatePayload,
  buildGoogleSheetsFormatRequests,
  buildMinhHongSheetTabsFromData,
  buildPrepareSpreadsheetRequests,
  DEFAULT_MINHHONG_SHEET_ID,
  MINHHONG_RAW_SOURCE_SHEET_IDS,
  MINHHONG_WEB_EXPORT_TAB_TITLES,
  SheetSyncConfigError,
} from "../../lib/google-sheets-sync";

test("allows the dedicated web-to-sheet export target", () => {
  assert.equal(assertSafeMinhHongSheetSyncTarget(DEFAULT_MINHHONG_SHEET_ID), DEFAULT_MINHHONG_SHEET_ID);
});

test("rejects a missing web-to-sheet export target", () => {
  assert.throws(
    () => assertSafeMinhHongSheetSyncTarget(" "),
    (error) => error instanceof SheetSyncConfigError && /Google Sheet/.test(error.message)
  );
});

test("allows exporting WEB tabs into raw source spreadsheets without touching raw ranges", () => {
  for (const sourceSheetId of MINHHONG_RAW_SOURCE_SHEET_IDS) {
    assert.equal(assertSafeMinhHongSheetSyncTarget(sourceSheetId), sourceSheetId);
  }

  assert.ok(buildGoogleSheetsBatchClearPayload().ranges.every((range) => /^'WEB_/.test(range)));
});

test("trims and returns an explicit custom export target", () => {
  assert.equal(assertSafeMinhHongSheetSyncTarget(" custom-target-id "), "custom-target-id");
});

test("exports only protected WEB-prefixed report tabs", () => {
  assert.deepEqual([...MINHHONG_WEB_EXPORT_TAB_TITLES], [
    "WEB_Đơn hàng",
    "WEB_Công nợ đối tác",
    "WEB_Giao dịch đối tác",
    "WEB_Đối tác",
    "WEB_Đối soát",
  ]);
  assert.ok(MINHHONG_WEB_EXPORT_TAB_TITLES.every((title) => title.startsWith("WEB_")));
});

test("prepares WEB tabs without deleting or renaming raw source tabs", () => {
  const requests = buildPrepareSpreadsheetRequests([
    { sheetId: 1, title: "Sheet1" },
    { sheetId: 2, title: "Đơn hàng đã bán" },
    { sheetId: 3, title: "WEB_Đơn hàng" },
  ]);

  assert.equal(requests.some((request) => "deleteSheet" in request), false);
  assert.equal(requests.some((request) => "updateSheetProperties" in request), false);
  assert.ok(
    requests.some((request) =>
      "addSheet" in request && request.addSheet.properties.title === "WEB_Công nợ đối tác"
    )
  );
});

test("writes formulas with USER_ENTERED so exported sheets recalculate", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [
      {
        orderCode: "MH-DH-1",
        orderDate: "2026-07-08T00:00:00.000Z",
        customerName: "Anh Minh",
        customerPhone: "0900000000",
        productName: "Pin lưu trữ",
        priceStatus: "CONFIRMED",
        quotedPrice: 1000000,
        discountAmount: 100000,
        paidAmount: 400000,
        notes: "",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 5,
        source: "LEGACY",
        customerAddress: "",
        id: "order-1",
        service: "PIN_LUU_TRU",
        status: "COMPLETED",
        warranty: null,
        issueDescription: "",
        solution: "",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
    ],
    [
      {
        code: "LONG",
        id: "partner-1",
        name: "Long",
        phone: "",
        type: "SUPPLIER",
        active: true,
        balance: 12720000,
        totals: {
          adjusted: -10000,
          openingBalance: 20230000,
          paid: 15000000,
          purchased: 7500000,
          referenceOnly: 0,
          returned: 0,
        },
        ledgerEntries: [],
        notes: "",
        createdAt: "2026-07-08T08:00:00.000Z",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
    ],
    new Date("2026-07-08T10:00:00.000Z")
  );
  const updatePayload = buildGoogleSheetsBatchUpdatePayload(tabs);
  const orderTab = tabs.find((tab) => tab.title === "WEB_Đơn hàng");
  const partnerDebtTab = tabs.find((tab) => tab.title === "WEB_Công nợ đối tác");
  const reconciliationTab = tabs.find((tab) => tab.title === "WEB_Đối soát");

  assert.equal(updatePayload.valueInputOption, "USER_ENTERED");
  assert.equal(orderTab?.rows[1][7], "=MAX(F2-G2;0)");
  assert.equal(partnerDebtTab?.rows[1][5], "=MAX(G2+J2+K2-H2-I2;0)");
  assert.match(String(reconciliationTab?.rows[2][1]), /^=COUNTA\(/);
});

test("exports imported missing dates as a clear label and adds order total rows", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [
      {
        customerAddress: "",
        customerName: "Chị Khoá",
        customerPhone: "0900000001",
        discountAmount: 0,
        id: "missing-date-order",
        issueDescription: "",
        notes: "",
        orderCode: "MH-MISSING-DATE",
        orderDate: "1900-01-04T00:00:00.000Z",
        paidAmount: 400000,
        priceStatus: "CONFIRMED",
        productName: "Pin test",
        quotedPrice: 1000000,
        service: "DONG_PIN",
        solution: "",
        source: "IMPORT",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 4,
        status: "COMPLETED",
        updatedAt: "2026-07-08T09:00:00.000Z",
        warranty: null,
      },
      {
        customerAddress: "",
        customerName: "Anh Minh",
        customerPhone: "0900000002",
        discountAmount: 0,
        id: "dated-order",
        issueDescription: "",
        notes: "",
        orderCode: "MH-DATED",
        orderDate: "2026-07-08T00:00:00.000Z",
        paidAmount: 800000,
        priceStatus: "CONFIRMED",
        productName: "Đèn test",
        quotedPrice: 2000000,
        service: "DEN_NLMT",
        solution: "",
        source: "IMPORT",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 5,
        status: "COMPLETED",
        updatedAt: "2026-07-08T09:00:00.000Z",
        warranty: null,
      },
    ],
    []
  );
  const orderTab = tabs.find((tab) => tab.title === "WEB_Đơn hàng");
  assert.ok(orderTab);

  assert.equal(orderTab.rows[1][1], "Chưa có ngày");
  assert.equal(orderTab.rows[2][1], "08/07/2026");
  assert.deepEqual(orderTab.rows.slice(-3).map((row) => [row[4], row[5]]), [
    ["Tổng tiền", "=SUM(F2:INDEX(F:F;ROW()-1))"],
    ["Tổng đã thu", "=SUM(G2:INDEX(G:G;ROW()-1))"],
    ["Còn nợ", "=SUM(H2:INDEX(H:H;ROW()-1))"],
  ]);
});

test("does not export generated placeholder customer phones as real phone numbers", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [
      {
        customerAddress: "",
        customerName: "Khách thiếu SĐT",
        customerPhone: "0990000058",
        discountAmount: 0,
        id: "missing-phone-order",
        issueDescription: "",
        notes: "",
        orderCode: "DH-0055",
        orderDate: "2026-07-07T00:00:00.000Z",
        paidAmount: 800000,
        priceStatus: "CONFIRMED",
        productName: "Pin 15 cell",
        quotedPrice: 800000,
        service: "KHAC",
        solution: "",
        source: "IMPORT",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 58,
        status: "COMPLETED",
        updatedAt: "2026-07-08T09:00:00.000Z",
        warranty: null,
      },
      {
        customerAddress: "",
        customerName: "Khách có SĐT",
        customerPhone: "0900000059",
        discountAmount: 0,
        id: "real-phone-order",
        issueDescription: "",
        notes: "",
        orderCode: "DH-0056",
        orderDate: "2026-07-08T00:00:00.000Z",
        paidAmount: 1200000,
        priceStatus: "CONFIRMED",
        productName: "Pin 15 cell",
        quotedPrice: 1200000,
        service: "KHAC",
        solution: "",
        source: "IMPORT",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 59,
        status: "COMPLETED",
        updatedAt: "2026-07-08T09:00:00.000Z",
        warranty: null,
      },
    ],
    []
  );
  const orderTab = tabs.find((tab) => tab.title === "WEB_Đơn hàng");
  assert.ok(orderTab);

  assert.equal(orderTab.rows[1][3], "");
  assert.equal(orderTab.rows[2][3], "0900000059");
});

test("adds hidden technical columns for future conflict detection", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [
      {
        customerAddress: "",
        customerName: "Anh Minh",
        customerPhone: "0900000000",
        discountAmount: 100000,
        id: "order-1",
        issueDescription: "",
        notes: "",
        orderCode: "MH-DH-1",
        orderDate: "2026-07-08T00:00:00.000Z",
        paidAmount: 400000,
        priceStatus: "CONFIRMED",
        productName: "Pin lưu trữ",
        quotedPrice: 1000000,
        service: "PIN_LUU_TRU",
        solution: "",
        source: "LEGACY",
        sourceName: "Đơn hàng đã bán",
        sourceRow: 5,
        status: "COMPLETED",
        updatedAt: "2026-07-08T09:00:00.000Z",
        warranty: null,
      },
    ],
    [
      {
        active: true,
        balance: 12720000,
        code: "LONG",
        createdAt: "2026-07-08T08:00:00.000Z",
        id: "partner-1",
        ledgerEntries: [
          {
            amount: 7500000,
            category: "Pin",
            countsInDebt: true,
            createdAt: "2026-07-08T09:00:00.000Z",
            description: "300cell eve",
            entryDate: "2026-07-08T00:00:00.000Z",
            entryType: "PURCHASE",
            notes: "",
            paymentMethod: "",
            quantity: 300,
            receivedGoods: true,
            reference: "",
            signedAmount: 7500000,
            sourceCode: "NHAP_HANG:300CELL",
            sourceName: "Nhập hàng",
            sourceRow: 12,
            unit: "cell",
            unitPrice: 25000,
            updatedAt: "2026-07-08T09:00:00.000Z",
          },
        ],
        name: "Long",
        notes: "",
        phone: "",
        totals: { adjusted: -10000, openingBalance: 20230000, paid: 15000000, purchased: 7500000, referenceOnly: 0, returned: 0 },
        type: "SUPPLIER",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
    ]
  );
  const technicalHeaders = ["web_id", "source_code", "source_row", "updated_at", "sync_hash"];

  for (const title of ["WEB_Đơn hàng", "WEB_Công nợ đối tác", "WEB_Giao dịch đối tác", "WEB_Đối tác"] as const) {
    const tab = tabs.find((candidate) => candidate.title === title);
    assert.deepEqual(tab?.rows[0].slice(-5), technicalHeaders);
    assert.equal(typeof tab?.rows[1].at(-1), "string");
    assert.ok(String(tab?.rows[1].at(-1)).length >= 12);
  }

  const formatRequests = buildGoogleSheetsFormatRequests([{ sheetId: 10, title: "WEB_Đơn hàng" }]);
  assert.ok(formatRequests.some((request) =>
    "updateDimensionProperties" in request
    && request.updateDimensionProperties.range.sheetId === 10
    && request.updateDimensionProperties.properties.hiddenByUser === true
  ));
  assert.ok(formatRequests.some((request) =>
    "addProtectedRange" in request
    && request.addProtectedRange.protectedRange.range.sheetId === 10
    && request.addProtectedRange.protectedRange.warningOnly === true
  ));
});

test("builds Google Sheets repeatCell format requests with the API field shape", () => {
  const formatRequests = buildGoogleSheetsFormatRequests([{ sheetId: 10, title: "WEB_Đơn hàng" }]);
  const headerFormatRequest = formatRequests.find((request) => "repeatCell" in request);
  assert.ok(headerFormatRequest && "repeatCell" in headerFormatRequest);

  const cell = headerFormatRequest.repeatCell.cell as Record<string, unknown>;
  assert.equal("textFormat" in cell, false);
  assert.equal("backgroundColor" in cell, false);
  assert.deepEqual(cell.userEnteredFormat, {
    textFormat: { bold: true },
    backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
  });
});

test("formats money columns in WEB sheets without converting numbers to text", () => {
  const formatRequests = buildGoogleSheetsFormatRequests([{ sheetId: 10, title: "WEB_Đơn hàng" }]);

  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 10
    && request.repeatCell.range.startColumnIndex === 5
    && request.repeatCell.range.endColumnIndex === 8
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.pattern === "#,##0"
  ));
});

test("formats phone columns as text so Sheets keeps leading zeroes", () => {
  const formatRequests = buildGoogleSheetsFormatRequests([
    { sheetId: 10, title: "WEB_Đơn hàng" },
    { sheetId: 11, title: "WEB_Công nợ đối tác" },
  ]);

  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 10
    && request.repeatCell.range.startColumnIndex === 3
    && request.repeatCell.range.endColumnIndex === 4
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.type === "TEXT"
  ));
  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 11
    && request.repeatCell.range.startColumnIndex === 2
    && request.repeatCell.range.endColumnIndex === 3
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.type === "TEXT"
  ));
});

test("partner exports hide legacy source-only partners that are not real debt partners", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [],
    [
      {
        active: true,
        balance: 12720000,
        code: "LONG",
        createdAt: "2026-07-08T08:00:00.000Z",
        id: "partner-long",
        ledgerEntries: [],
        name: "Long",
        notes: "",
        phone: "",
        totals: { adjusted: 0, openingBalance: 20230000, paid: 15000000, purchased: 7500000, referenceOnly: 0, returned: 0 },
        type: "SUPPLIER",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
      {
        active: true,
        balance: 0,
        code: "DT_SHOPEE",
        createdAt: "2026-07-08T08:00:00.000Z",
        id: "partner-shopee",
        ledgerEntries: [],
        name: "Shopee",
        notes: "Nguon mua ho qua Long trong du lieu cu",
        phone: "",
        totals: { adjusted: 0, openingBalance: 0, paid: 0, purchased: 0, referenceOnly: 0, returned: 0 },
        type: "OTHER",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
    ]
  );
  const partnerDebtTab = tabs.find((tab) => tab.title === "WEB_Công nợ đối tác");
  const partnerListTab = tabs.find((tab) => tab.title === "WEB_Đối tác");

  assert.deepEqual(partnerDebtTab?.rows.slice(1).map((row) => row[0]), ["LONG"]);
  assert.deepEqual(partnerListTab?.rows.slice(1).map((row) => row[0]), ["LONG"]);
});

test("can scope web-to-sheet sync to service orders or partner ledger tabs", () => {
  assert.deepEqual(buildGoogleSheetsBatchClearPayload("service-orders").ranges, ["'WEB_Đơn hàng'!A:Z"]);
  assert.deepEqual(buildGoogleSheetsBatchClearPayload("partners").ranges, [
    "'WEB_Công nợ đối tác'!A:Z",
    "'WEB_Giao dịch đối tác'!A:Z",
    "'WEB_Đối tác'!A:Z",
  ]);

  const tabs = buildMinhHongSheetTabsFromData([], []);
  assert.deepEqual(
    buildGoogleSheetsBatchUpdatePayload(tabs, "service-orders").data.map((range) => range.range),
    ["'WEB_Đơn hàng'!A1"]
  );
});
