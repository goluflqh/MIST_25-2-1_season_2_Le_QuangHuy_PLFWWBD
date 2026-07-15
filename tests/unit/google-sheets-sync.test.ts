import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSafeMinhHongSheetSyncTarget,
  buildGoogleSheetsBatchClearPayload,
  buildGoogleSheetsBatchUpdatePayload,
  buildGoogleSheetsFormatRequests,
  buildGoogleSheetsTailClearPayload,
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
});

test("trims and returns an explicit custom export target", () => {
  assert.equal(assertSafeMinhHongSheetSyncTarget(" custom-target-id "), "custom-target-id");
});

test("exports only protected WEB-prefixed report tabs", () => {
  assert.deepEqual([...MINHHONG_WEB_EXPORT_TAB_TITLES], [
    "WEB_Đơn hàng",
    "WEB_Đơn đối tác",
    "WEB_Đối soát",
  ]);
  assert.ok(MINHHONG_WEB_EXPORT_TAB_TITLES.every((title) => title.startsWith("WEB_")));
  assert.ok(buildGoogleSheetsBatchClearPayload().ranges.every((range) => /^'WEB_/.test(range)));
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
      "addSheet" in request && request.addSheet.properties.title === "WEB_Đơn đối tác"
    )
  );
});

test("writes formulas with USER_ENTERED so exported sheets recalculate", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [
      {
        orderCode: "MH-DH-1",
        orderDate: "2026-07-08T00:00:00.000Z",
        customerName: "=HYPERLINK(\"https://example.test\")",
        customerPhone: "0900000000",
        productName: "+SUM(1;1)",
        priceStatus: "CONFIRMED",
        quotedPrice: 1000000,
        discountAmount: 100000,
        paidAmount: 400000,
        notes: "@private-note",
        sourceName: "=UNTRUSTED_SOURCE",
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
        name: "-10+20",
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
  const reconciliationTab = tabs.find((tab) => tab.title === "WEB_Đối soát");

  assert.equal(updatePayload.valueInputOption, "USER_ENTERED");
  assert.equal(orderTab?.rows[1][2], "'=HYPERLINK(\"https://example.test\")");
  assert.equal(orderTab?.rows[1][4], "'+SUM(1;1)");
  assert.equal(orderTab?.rows[1][9], "'@private-note");
  assert.equal(orderTab?.rows[1][11], "'=UNTRUSTED_SOURCE:A5:K5");
  assert.equal(orderTab?.rows[1][8], "=MAX(F2-G2;0)");
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
        paidAt: "2026-07-09T00:00:00.000Z",
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
  assert.equal(orderTab.rows[0][7], "Ngày thu gần nhất");
  assert.equal(orderTab.rows[1][7], "");
  assert.equal(orderTab.rows[2][7], "09/07/2026");
  assert.deepEqual(orderTab.rows.slice(-3).map((row) => [row[4], row[5]]), [
    ["Tổng tiền", "=SUM(F2:INDEX(F:F;ROW()-1))"],
    ["Tổng đã thu", "=SUM(G2:INDEX(G:G;ROW()-1))"],
    ["Còn nợ", "=SUM(I2:INDEX(I:I;ROW()-1))"],
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
        sourceCode: "DON_KHACH:DH-MH_STABLE_SOURCE",
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

  const orderTab = tabs.find((candidate) => candidate.title === "WEB_Đơn hàng");
  const partnerTab = tabs.find((candidate) => candidate.title === "WEB_Đơn đối tác");
  assert.deepEqual(orderTab?.rows[0].slice(-5), technicalHeaders);
  assert.equal(typeof orderTab?.rows[1].at(-1), "string");
  assert.ok(String(orderTab?.rows[1].at(-1)).length >= 12);
  assert.equal(orderTab?.rows[1].at(-4), "DON_KHACH:DH-MH_STABLE_SOURCE");
  assert.equal(partnerTab?.rows[0].some((header) => technicalHeaders.includes(String(header))), false);

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
    && request.repeatCell.range.endColumnIndex === 7
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.pattern === "#,##0"
  ));
  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 10
    && request.repeatCell.range.startColumnIndex === 8
    && request.repeatCell.range.endColumnIndex === 9
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.pattern === "#,##0"
  ));
});

test("formats WEB partner discounts as literal percentages", () => {
  const formatRequests = buildGoogleSheetsFormatRequests([{ sheetId: 11, title: "WEB_Đơn đối tác" }], "partners");

  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 11
    && request.repeatCell.range.startColumnIndex === 7
    && request.repeatCell.range.endColumnIndex === 8
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.type === "NUMBER"
        && request.repeatCell.cell.userEnteredFormat?.numberFormat?.pattern === 'General"%"'
  ));
});

test("formats service-order phone columns as text so Sheets keeps leading zeroes", () => {
  const formatRequests = buildGoogleSheetsFormatRequests([
    { sheetId: 10, title: "WEB_Đơn hàng" },
  ]);

  assert.ok(formatRequests.some((request) =>
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 10
    && request.repeatCell.range.startColumnIndex === 3
    && request.repeatCell.range.endColumnIndex === 4
    && request.repeatCell.cell.userEnteredFormat?.numberFormat?.type === "TEXT"
  ));
});

test("partner exports keep only useful business fields and hide legacy source-only partners", () => {
  const tabs = buildMinhHongSheetTabsFromData(
    [],
    [
      {
        active: true,
        balance: 12720000,
        code: "LONG",
        createdAt: "2026-07-08T08:00:00.000Z",
        id: "partner-long",
        ledgerEntries: [
          {
            amount: 12_730_000,
            countsInDebt: true,
            createdAt: "2026-05-08T00:00:00.000Z",
            description: "Số dư Long đã chốt",
            entryDate: "2026-05-08T00:00:00.000Z",
            entryType: "OPENING_BALANCE",
            id: "opening-long",
            notes: "",
            signedAmount: 12_730_000,
          },
          {
            amount: 0,
            countsInDebt: false,
            createdAt: "2025-01-01T00:00:00.000Z",
            description: "Đơn cũ thiếu giá",
            entryDate: "1900-01-04T00:00:00.000Z",
            entryType: "PURCHASE",
            id: "legacy-missing-price",
            notes: "Đối chiếu lịch sử",
            quantity: 5,
            signedAmount: 0,
          },
        ],
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
        ledgerEntries: [{
          amount: 100_000,
          countsInDebt: false,
          createdAt: "2025-01-01T00:00:00.000Z",
          description: "Không xuất thành đối tác nợ riêng",
          entryDate: "2025-01-01T00:00:00.000Z",
          entryType: "PURCHASE",
          id: "source-only-entry",
          signedAmount: 0,
        }],
        name: "Shopee",
        notes: "Nguon mua ho qua Long trong du lieu cu",
        phone: "",
        totals: { adjusted: 0, openingBalance: 0, paid: 0, purchased: 0, referenceOnly: 0, returned: 0 },
        type: "OTHER",
        updatedAt: "2026-07-08T09:00:00.000Z",
      },
    ]
  );
  const partnerTab = tabs.find((tab) => tab.title === "WEB_Đơn đối tác");

  assert.deepEqual(partnerTab?.rows[0], [
    "Ngày",
    "Đối tác",
    "Loại giao dịch",
    "Nội dung / mặt hàng",
    "Số lượng",
    "Đơn giá",
    "Tạm tính",
    "Chiết khấu (%)",
    "Tiền chiết khấu",
    "Số tiền",
    "Phương thức thanh toán",
    "Ghi chú",
    "Còn phải trả",
  ]);
  assert.deepEqual(partnerTab?.rows.slice(1).map((row) => row[1]), ["Long", "Long"]);
  assert.equal(partnerTab?.rows[1][0], "");
  assert.equal(partnerTab?.rows[1][9], "");
  assert.equal(partnerTab?.rows[1][12], "");
  assert.equal(partnerTab?.rows[2][12], 12_730_000);
});

test("partner exports show optional discount details and keep debt on the net amount", () => {
  const tabs = buildMinhHongSheetTabsFromData([], [{
    active: true,
    balance: 420_750,
    code: "LONG",
    createdAt: "2026-07-14T00:00:00.000Z",
    id: "partner-long",
    ledgerEntries: [{
      amount: 420_750,
      countsInDebt: true,
      createdAt: "2026-07-14T00:00:00.000Z",
      description: "Hóa đơn BH260714-001",
      discountAmount: 74_250,
      discountPercent: 15,
      entryDate: "2026-07-14T00:00:00.000Z",
      entryType: "PURCHASE",
      quantity: 9,
      signedAmount: 420_750,
      unitPrice: 55_000,
    }],
    name: "Long",
    totals: { adjusted: 0, openingBalance: 0, paid: 0, purchased: 420_750, referenceOnly: 0, returned: 0 },
    type: "SUPPLIER",
    updatedAt: "2026-07-14T00:00:00.000Z",
  }]);
  const row = tabs.find((tab) => tab.title === "WEB_Đơn đối tác")?.rows[1];

  assert.deepEqual(row?.slice(4, 10), [9, 55_000, 495_000, 15, 74_250, 420_750]);
  assert.equal(row?.[12], 420_750);
});

test("can scope web-to-sheet sync to service orders or partner ledger tabs", () => {
  assert.deepEqual(buildGoogleSheetsBatchClearPayload("service-orders").ranges, ["'WEB_Đơn hàng'!A:Z"]);
  assert.deepEqual(buildGoogleSheetsBatchClearPayload("partners").ranges, [
    "'WEB_Đơn đối tác'!A:Z",
  ]);

  const tabs = buildMinhHongSheetTabsFromData([], []);
  assert.deepEqual(
    buildGoogleSheetsBatchUpdatePayload(tabs, "service-orders").data.map((range) => range.range),
    ["'WEB_Đơn hàng'!A1"]
  );
  const serviceOrderTab = tabs.find((tab) => tab.title === "WEB_Đơn hàng");
  assert.deepEqual(buildGoogleSheetsTailClearPayload(tabs, "service-orders").ranges, [
    `'WEB_Đơn hàng'!A${(serviceOrderTab?.rows.length ?? 0) + 1}:Z`,
  ]);
});

test("keeps the three order summary colors fixed after every WEB export", () => {
  const formatRequests = buildGoogleSheetsFormatRequests(
    [{ sheetId: 10, title: "WEB_Đơn hàng" }],
    "service-orders",
    { "WEB_Đơn hàng": 10 }
  );
  const summaryFormats = formatRequests.filter((request) => (
    "repeatCell" in request
    && request.repeatCell.range.sheetId === 10
    && request.repeatCell.range.startColumnIndex === 5
    && request.repeatCell.range.endColumnIndex === 6
    && Number(request.repeatCell.range.startRowIndex) >= 7
  ));

  assert.equal(summaryFormats.length, 3);
  assert.deepEqual(summaryFormats.map((request) => (
    "repeatCell" in request ? request.repeatCell.range.startRowIndex : null
  )), [7, 8, 9]);
  assert.deepEqual(summaryFormats.map((request) => (
    "repeatCell" in request ? request.repeatCell.cell.userEnteredFormat.backgroundColor : null
  )), [
    { red: 0.35, green: 0.95, blue: 0.35 },
    { red: 0.45, green: 0.85, blue: 1 },
    { red: 1, green: 0.2, blue: 0.2 },
  ]);
});
