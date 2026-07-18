import { createHash } from "node:crypto";
import { getPayableAmount } from "@/lib/coupon-discounts";
import { shouldHideImportedFallbackDate } from "@/lib/admin-order-display";
import { getServiceOrderDisplayPhone } from "@/lib/service-order-phone";
import { getVisibleDebtPartners } from "@/lib/partner-legacy";
import { PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT } from "@/lib/partner-discounts";
import { normalizeServiceOrderPriceStatus } from "@/lib/service-orders";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/vietnam-time";

export const MINHHONG_WEB_EXPORT_TAB_TITLES = [
  "WEB_Đơn hàng",
  "WEB_Đơn đối tác",
  "WEB_Đối soát",
] as const;
export const MINHHONG_TECHNICAL_COLUMN_HEADERS = ["web_id", "source_code", "source_row", "updated_at", "sync_hash"] as const;

const targetTabs = MINHHONG_WEB_EXPORT_TAB_TITLES;
type MinhHongWebExportTabTitle = (typeof MINHHONG_WEB_EXPORT_TAB_TITLES)[number];
export type MinhHongSheetSyncScope = "all" | "service-orders" | "partners";
type SheetCellValue = string | number;

export interface SheetTab {
  rows: Array<Array<SheetCellValue>>;
  title: MinhHongWebExportTabTitle;
}

export interface SpreadsheetSheetProperties {
  sheetId: number;
  title: string;
}

interface SheetOrderForExport {
  customerAddress?: string | null;
  customerName: string;
  customerPhone: string;
  customerPhoneMissing?: boolean | null;
  discountAmount: number;
  id?: string;
  issueDescription?: string | null;
  notes?: string | null;
  orderCode: string;
  createdAt?: Date | string;
  orderDate: Date | string;
  paidAmount: number;
  paidAt?: Date | string | null;
  priceStatus: string;
  productName: string;
  quotedPrice?: number | null;
  service: string;
  solution?: string | null;
  source: string;
  sourceCode?: string | null;
  sourceName?: string | null;
  sourceRow?: number | null;
  status: string;
  updatedAt: Date | string;
  warranty?: { serialNo?: string | null } | null;
}

interface SheetPartnerEntryForExport {
  amount: number;
  category?: string | null;
  countsInDebt?: boolean | null;
  createdAt: Date | string;
  description: string;
  discountAmount?: number | null;
  discountPercent?: number | null;
  entryDate: Date | string;
  entryType: string;
  id?: string;
  notes?: string | null;
  paymentMethod?: string | null;
  quantity?: number | null;
  receivedGoods?: boolean | null;
  reference?: string | null;
  signedAmount: number;
  sourceCode?: string | null;
  sourceName?: string | null;
  sourceRow?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  updatedAt?: Date | string;
}

interface SheetPartnerForExport {
  active: boolean;
  balance: number;
  code: string;
  createdAt: Date | string;
  id?: string;
  ledgerEntries: SheetPartnerEntryForExport[];
  name: string;
  notes?: string | null;
  phone?: string | null;
  totals: {
    adjusted: number;
    openingBalance: number;
    paid: number;
    purchased: number;
    referenceOnly: number;
    returned: number;
  };
  type: string;
  updatedAt: Date | string;
}

interface GoogleSheetsGridRange {
  endColumnIndex?: number;
  endRowIndex?: number;
  sheetId: number;
  startColumnIndex?: number;
  startRowIndex?: number;
}

export type GoogleSheetsFormatRequest =
  | {
      updateSheetProperties: {
        fields: string;
        properties: { gridProperties: { frozenColumnCount: number; frozenRowCount: number }; sheetId: number };
      };
    }
  | {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor?: { blue: number; green: number; red: number };
            numberFormat?: { pattern?: string; type: string };
            textFormat?: { bold: boolean };
          };
        };
        fields: string;
        range: GoogleSheetsGridRange;
      };
    }
  | {
      autoResizeDimensions: {
        dimensions: { dimension: string; endIndex: number; sheetId: number; startIndex: number };
      };
    }
  | {
      updateDimensionProperties: {
        fields: string;
        properties: { hiddenByUser?: boolean; pixelSize?: number };
        range: { dimension: string; endIndex: number; sheetId: number; startIndex: number };
      };
    }
  | {
      addProtectedRange: {
        protectedRange: {
          description: string;
          range: GoogleSheetsGridRange;
          warningOnly: boolean;
        };
      };
    };

function getMinhHongWebExportTabTitlesForScope(scope: MinhHongSheetSyncScope = "all") {
  if (scope === "service-orders") return ["WEB_Đơn hàng"] satisfies MinhHongWebExportTabTitle[];
  if (scope === "partners") return ["WEB_Đơn đối tác"] satisfies MinhHongWebExportTabTitle[];
  return [...targetTabs];
}

function filterTabsForScope(tabs: SheetTab[], scope: MinhHongSheetSyncScope = "all") {
  const allowed = new Set(getMinhHongWebExportTabTitlesForScope(scope));
  return tabs.filter((tab) => allowed.has(tab.title));
}

function quoteSheetName(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function buildPrepareSpreadsheetRequests(
  existing: SpreadsheetSheetProperties[],
  scope: MinhHongSheetSyncScope = "all"
) {
  const existingTitles = new Set(existing.map((sheet) => sheet.title));

  return getMinhHongWebExportTabTitlesForScope(scope)
    .filter((title) => !existingTitles.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));
}

const technicalColumnStartIndexes: Partial<Record<MinhHongWebExportTabTitle, number>> = {
  "WEB_Đơn hàng": 22,
};

const moneyColumnRanges: Partial<Record<MinhHongWebExportTabTitle, Array<{ end: number; start: number }>>> = {
  "WEB_Đơn hàng": [
    { start: 5, end: 7 },
    { start: 8, end: 9 },
    { start: 16, end: 18 },
  ],
  "WEB_Đơn đối tác": [
    { start: 5, end: 7 },
    { start: 8, end: 10 },
    { start: 11, end: 12 },
  ],
};

const frozenColumnCounts: Partial<Record<MinhHongWebExportTabTitle, number>> = {
  "WEB_Đơn hàng": 3,
  "WEB_Đơn đối tác": 2,
  "WEB_Đối soát": 1,
};

const columnWidthRanges: Partial<Record<MinhHongWebExportTabTitle, Array<{ end: number; pixelSize: number; start: number }>>> = {
  "WEB_Đơn hàng": [
    { start: 0, end: 1, pixelSize: 205 },
    { start: 1, end: 2, pixelSize: 105 },
    { start: 2, end: 3, pixelSize: 175 },
    { start: 3, end: 4, pixelSize: 125 },
    { start: 4, end: 5, pixelSize: 260 },
    { start: 5, end: 7, pixelSize: 115 },
    { start: 7, end: 9, pixelSize: 120 },
    { start: 9, end: 10, pixelSize: 260 },
    { start: 10, end: 11, pixelSize: 145 },
    { start: 11, end: 12, pixelSize: 180 },
    { start: 12, end: 13, pixelSize: 105 },
    { start: 13, end: 14, pixelSize: 190 },
    { start: 14, end: 16, pixelSize: 145 },
    { start: 16, end: 18, pixelSize: 120 },
    { start: 18, end: 19, pixelSize: 175 },
    { start: 19, end: 21, pixelSize: 230 },
    { start: 21, end: 22, pixelSize: 155 },
  ],
  "WEB_Đơn đối tác": [
    { start: 0, end: 1, pixelSize: 105 },
    { start: 1, end: 2, pixelSize: 125 },
    { start: 2, end: 3, pixelSize: 135 },
    { start: 3, end: 4, pixelSize: 270 },
    { start: 4, end: 5, pixelSize: 80 },
    { start: 5, end: 7, pixelSize: 115 },
    { start: 7, end: 8, pixelSize: 105 },
    { start: 8, end: 10, pixelSize: 120 },
    { start: 10, end: 11, pixelSize: 165 },
    { start: 11, end: 12, pixelSize: 135 },
    { start: 12, end: 13, pixelSize: 260 },
  ],
  "WEB_Đối soát": [
    { start: 0, end: 1, pixelSize: 230 },
    { start: 1, end: 2, pixelSize: 150 },
    { start: 2, end: 3, pixelSize: 360 },
  ],
};

function buildColumnWidthRequests(
  sheet: SpreadsheetSheetProperties,
  title: MinhHongWebExportTabTitle
): GoogleSheetsFormatRequest[] {
  return (columnWidthRanges[title] || []).map((columns) => ({
    updateDimensionProperties: {
      fields: "pixelSize",
      properties: { pixelSize: columns.pixelSize },
      range: {
        dimension: "COLUMNS",
        endIndex: columns.end,
        sheetId: sheet.sheetId,
        startIndex: columns.start,
      },
    },
  }));
}

function buildKeyDebtColumnFormatRequests(
  sheet: SpreadsheetSheetProperties,
  title: MinhHongWebExportTabTitle
): GoogleSheetsFormatRequest[] {
  const columnIndex = title === "WEB_Đơn hàng" ? 8 : title === "WEB_Đơn đối tác" ? 11 : null;
  if (columnIndex === null) return [];

  return [
    {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 0.88, blue: 0.88 },
            textFormat: { bold: true },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
        range: {
          endColumnIndex: columnIndex + 1,
          endRowIndex: 1,
          sheetId: sheet.sheetId,
          startColumnIndex: columnIndex,
          startRowIndex: 0,
        },
      },
    },
    {
      repeatCell: {
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 0.97, blue: 0.97 },
            textFormat: { bold: true },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
        range: {
          endColumnIndex: columnIndex + 1,
          sheetId: sheet.sheetId,
          startColumnIndex: columnIndex,
          startRowIndex: 1,
        },
      },
    },
  ];
}

const textColumnRanges: Partial<Record<MinhHongWebExportTabTitle, Array<{ end: number; start: number }>>> = {
  "WEB_Đơn hàng": [
    { start: 3, end: 4 },
  ],
};

function buildMoneyFormatRequests(
  sheet: SpreadsheetSheetProperties,
  title: MinhHongWebExportTabTitle
): GoogleSheetsFormatRequest[] {
  return (moneyColumnRanges[title] || []).map((columns) => ({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          numberFormat: { type: "NUMBER", pattern: "#,##0" },
        },
      },
      fields: "userEnteredFormat.numberFormat",
      range: {
        endColumnIndex: columns.end,
        sheetId: sheet.sheetId,
        startColumnIndex: columns.start,
        startRowIndex: 1,
      },
    },
  }));
}

function buildTextFormatRequests(
  sheet: SpreadsheetSheetProperties,
  title: MinhHongWebExportTabTitle
): GoogleSheetsFormatRequest[] {
  return (textColumnRanges[title] || []).map((columns) => ({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          numberFormat: { type: "TEXT" },
        },
      },
      fields: "userEnteredFormat.numberFormat",
      range: {
        endColumnIndex: columns.end,
        sheetId: sheet.sheetId,
        startColumnIndex: columns.start,
        startRowIndex: 1,
      },
    },
  }));
}

function buildPartnerDiscountFormatRequests(
  sheet: SpreadsheetSheetProperties,
  title: MinhHongWebExportTabTitle
): GoogleSheetsFormatRequest[] {
  if (title !== "WEB_Đơn đối tác") return [];
  return [{
    repeatCell: {
      cell: {
        userEnteredFormat: {
          numberFormat: { type: "NUMBER", pattern: PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT },
        },
      },
      fields: "userEnteredFormat.numberFormat",
      range: {
        endColumnIndex: 8,
        sheetId: sheet.sheetId,
        startColumnIndex: 7,
        startRowIndex: 1,
      },
    },
  }];
}

function buildOrderSummaryFormatRequests(
  sheet: SpreadsheetSheetProperties,
  rowCount: number | undefined
): GoogleSheetsFormatRequest[] {
  if (!rowCount || rowCount < 4) return [];
  const summaryStartRowIndex = rowCount - 3;
  const summaryCells = [
    { backgroundColor: { red: 0.35, green: 0.95, blue: 0.35 }, columnIndex: 5, rowIndex: summaryStartRowIndex },
    { backgroundColor: { red: 0.45, green: 0.85, blue: 1 }, columnIndex: 5, rowIndex: summaryStartRowIndex + 1 },
    { backgroundColor: { red: 1, green: 0.2, blue: 0.2 }, columnIndex: 5, rowIndex: summaryStartRowIndex + 2 },
  ];

  return summaryCells.map((summary) => ({
    repeatCell: {
      cell: {
        userEnteredFormat: {
          backgroundColor: summary.backgroundColor,
          textFormat: { bold: true },
        },
      },
      fields: "userEnteredFormat(backgroundColor,textFormat)",
      range: {
        endColumnIndex: summary.columnIndex + 1,
        endRowIndex: summary.rowIndex + 1,
        sheetId: sheet.sheetId,
        startColumnIndex: summary.columnIndex,
        startRowIndex: summary.rowIndex,
      },
    },
  }));
}

function buildGoogleSheetsFormatRequests(
  sheets: SpreadsheetSheetProperties[],
  scope: MinhHongSheetSyncScope = "all",
  tabRowCounts: Partial<Record<MinhHongWebExportTabTitle, number>> = {}
): GoogleSheetsFormatRequest[] {
  const scopedTabs = new Set(getMinhHongWebExportTabTitlesForScope(scope));

  return sheets
    .filter((sheet) => scopedTabs.has(sheet.title as MinhHongWebExportTabTitle))
    .flatMap((sheet) => {
      const title = sheet.title as MinhHongWebExportTabTitle;
      const technicalStartIndex = technicalColumnStartIndexes[title];
      const baseRequests: GoogleSheetsFormatRequest[] = [
        {
          updateSheetProperties: {
            fields: "gridProperties(frozenColumnCount,frozenRowCount)",
            properties: {
              gridProperties: {
                frozenColumnCount: frozenColumnCounts[title] || 0,
                frozenRowCount: 1,
              },
              sheetId: sheet.sheetId,
            },
          },
        },
        {
          repeatCell: {
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
              },
            },
            fields: "userEnteredFormat(textFormat,backgroundColor)",
            range: { endRowIndex: 1, sheetId: sheet.sheetId, startRowIndex: 0 },
          },
        },
        {
          autoResizeDimensions: {
            dimensions: { dimension: "COLUMNS", sheetId: sheet.sheetId, startIndex: 0, endIndex: 26 },
          },
        },
        ...buildMoneyFormatRequests(sheet, title),
        ...buildPartnerDiscountFormatRequests(sheet, title),
        ...buildTextFormatRequests(sheet, title),
        ...buildColumnWidthRequests(sheet, title),
        ...buildKeyDebtColumnFormatRequests(sheet, title),
        ...(title === "WEB_Đơn hàng" ? buildOrderSummaryFormatRequests(sheet, tabRowCounts[title]) : []),
      ];

      if (technicalStartIndex === undefined) return baseRequests;

      return [
        ...baseRequests,
        {
          updateDimensionProperties: {
            fields: "hiddenByUser",
            properties: { hiddenByUser: true },
            range: {
              dimension: "COLUMNS",
              endIndex: technicalStartIndex + MINHHONG_TECHNICAL_COLUMN_HEADERS.length,
              sheetId: sheet.sheetId,
              startIndex: technicalStartIndex,
            },
          },
        },
        {
          addProtectedRange: {
            protectedRange: {
              description: `${title} technical sync columns`,
              range: {
                endColumnIndex: technicalStartIndex + MINHHONG_TECHNICAL_COLUMN_HEADERS.length,
                sheetId: sheet.sheetId,
                startColumnIndex: technicalStartIndex,
              },
              warningOnly: true,
            },
          },
        },
      ];
    });
}

function formatPriceStatus(status: string) {
  const labels: Record<string, string> = {
    CONFIRMED: "Đã xác nhận",
    FREE: "Miễn phí",
    LEGACY_MISSING: "Quên giá",
    PENDING_QUOTE: "Chưa báo giá",
  };
  return labels[status] || status;
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    CANCELLED: "Huỷ",
    COMPLETED: "Hoàn thành",
    CONTACTED: "Đã liên hệ",
    IN_PROGRESS: "Đang xử lý",
    PENDING: "Chờ xử lý",
  };
  return labels[status] || status;
}

function formatEntryType(entryType: string) {
  const labels: Record<string, string> = {
    ADJUSTMENT: "Điều chỉnh",
    OPENING_BALANCE: "Số dư chốt",
    PAYMENT: "Thanh toán",
    PURCHASE: "Mua hàng",
    RETURN: "Trả hàng",
  };
  return labels[entryType] || entryType;
}

function buildSyncHash(values: unknown[]) {
  return createHash("sha256").update(JSON.stringify(values)).digest("hex").slice(0, 16);
}

function escapeGoogleSheetsUserText(value: SheetCellValue): SheetCellValue {
  return typeof value === "string" && /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeGoogleSheetsUserRow(row: SheetCellValue[]) {
  return row.map(escapeGoogleSheetsUserText);
}

function appendTechnicalColumns(
  row: SheetCellValue[],
  technical: { sourceCode?: string | null; sourceRow?: number | string | null; updatedAt?: Date | string | null; webId?: string | null }
): SheetCellValue[] {
  const updatedAt = formatVietnamDateTime(technical.updatedAt) || "";
  const technicalValues: SheetCellValue[] = [
    escapeGoogleSheetsUserText(technical.webId || ""),
    escapeGoogleSheetsUserText(technical.sourceCode || ""),
    technical.sourceRow ?? "",
    updatedAt,
    buildSyncHash([...row, technical.webId || "", technical.sourceCode || "", technical.sourceRow ?? "", updatedAt]),
  ];

  return [...row, ...technicalValues];
}

function formatExportOrderDate(order: SheetOrderForExport) {
  return shouldHideImportedFallbackDate(order) ? "Chưa có ngày" : formatVietnamDate(order.orderDate);
}

function formatExportCustomerPhone(order: SheetOrderForExport) {
  return getServiceOrderDisplayPhone(order);
}

function buildOrderSummaryRows(orderCount: number): SheetCellValue[][] {
  if (orderCount <= 0) {
    return [
      ["", "", "", "", "Tổng tiền", 0],
      ["", "", "", "", "Tổng đã thu", 0],
      ["", "", "", "", "Còn nợ", 0],
    ];
  }

  const firstDataRow = 2;

  return [
    ["", "", "", "", "Tổng tiền", `=SUM(F${firstDataRow}:INDEX(F:F;ROW()-1))`],
    ["", "", "", "", "Tổng đã thu", `=SUM(G${firstDataRow}:INDEX(G:G;ROW()-1))`],
    ["", "", "", "", "Còn nợ", `=SUM(I${firstDataRow}:INDEX(I:I;ROW()-1))`],
  ];
}

function buildMinhHongSheetTabsFromData(
  serializedOrders: SheetOrderForExport[],
  serializedPartners: SheetPartnerForExport[],
  exportedAt = new Date()
): SheetTab[] {
  const visiblePartners = getVisibleDebtPartners(serializedPartners);
  const orderRows = serializedOrders.map((order, index) => {
    const quotedPrice = order.quotedPrice ?? null;
    const priceStatus = normalizeServiceOrderPriceStatus(order.priceStatus, quotedPrice);
    const payable = priceStatus === "CONFIRMED" ? getPayableAmount(quotedPrice, order.discountAmount) : 0;
    const sourceRowLabel = order.sourceName && order.sourceRow
      ? `${order.sourceName}:A${order.sourceRow}:K${order.sourceRow}`
      : order.sourceRow
        ? `Dòng ${order.sourceRow}`
        : "";

    const row: SheetCellValue[] = [
      order.orderCode,
      formatExportOrderDate(order),
      order.customerName,
      formatExportCustomerPhone(order),
      order.productName,
      priceStatus === "CONFIRMED" || priceStatus === "FREE" ? quotedPrice ?? 0 : "",
      order.paidAmount,
      order.paidAt ? formatVietnamDate(order.paidAt) : "",
      "",
      order.notes || "",
      formatPriceStatus(priceStatus),
      sourceRowLabel,
      order.source,
      order.customerAddress || "",
      order.service,
      formatOrderStatus(order.status),
      order.discountAmount,
      payable,
      order.warranty?.serialNo || "",
      order.issueDescription || "",
      order.solution || "",
      formatVietnamDateTime(order.updatedAt),
    ];

    const safeRow = escapeGoogleSheetsUserRow(row);
    safeRow[8] = `=MAX(F${index + 2}-G${index + 2};0)`;

    return appendTechnicalColumns(safeRow, {
      sourceCode: order.sourceCode || order.sourceName || order.source,
      sourceRow: order.sourceRow,
      updatedAt: order.updatedAt,
      webId: order.id || order.orderCode,
    });
  });
  const partnerRows = visiblePartners.flatMap((partner) => {
    let runningBalance = 0;
    return [...partner.ledgerEntries]
      .sort((left, right) => {
        const dateDiff = new Date(left.entryDate).getTime() - new Date(right.entryDate).getTime();
        if (dateDiff) return dateDiff;
        const sourceRowDiff = (left.sourceRow ?? Number.MAX_SAFE_INTEGER) - (right.sourceRow ?? Number.MAX_SAFE_INTEGER);
        if (sourceRowDiff) return sourceRowDiff;
        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      })
      .map((entry) => {
        if (entry.countsInDebt) runningBalance += entry.signedAmount;
        const entryDate = new Date(entry.entryDate);
        const formattedDate = Number.isFinite(entryDate.getTime()) && entryDate.getUTCFullYear() > 1900
          ? formatVietnamDate(entry.entryDate)
          : "";
        const hasAmount = entry.countsInDebt || entry.amount !== 0;
        const discountAmount = entry.discountAmount || 0;
        return escapeGoogleSheetsUserRow([
          formattedDate,
          partner.name,
          formatEntryType(entry.entryType),
          entry.description,
          entry.quantity ?? "",
          entry.unitPrice ?? "",
          hasAmount ? entry.amount + discountAmount : "",
          entry.discountPercent ?? "",
          discountAmount || "",
          hasAmount ? entry.amount : "",
          entry.paymentMethod || "",
          entry.countsInDebt ? runningBalance : "",
          entry.notes || "",
        ]);
      });
  });
  const totalPartnerPayable = visiblePartners.reduce((sum, partner) => sum + partner.balance, 0);

  return [
    {
      title: "WEB_Đối soát",
      rows: [
        ["Chỉ số", "Giá trị", "Ghi chú"],
        ["Thời điểm xuất", formatVietnamDateTime(exportedAt), "Web ghi một chiều sang tab WEB_*, không ghi đè Sheet gốc"],
        ["Tổng đơn hàng", "=COUNTA('WEB_Đơn hàng'!A2:A)", "Đếm mã đơn trên tab WEB_Đơn hàng"],
        ["Tổng đã thu", "=SUM('WEB_Đơn hàng'!G2:G)", "Tự tính từ cột Đã thu"],
        ["Tổng còn phải thu khách", "=SUM('WEB_Đơn hàng'!I2:I)", "Tự tính từ cột Còn nợ"],
        ["Tổng Minh Hồng phải trả đối tác", totalPartnerPayable, "Tính từ sổ đối tác trên web"],
      ],
    },
    {
      title: "WEB_Đơn hàng",
      rows: [
        [
          "Mã đơn",
          "Ngày đơn",
          "Khách",
          "SĐT",
          "Sản phẩm",
          "Tổng tiền",
          "Đã thu",
          "Ngày thu gần nhất",
          "Còn nợ",
          "Ghi chú",
          "Trạng thái dữ liệu",
          "Dòng gốc",
          "Nguồn",
          "Địa chỉ",
          "Dịch vụ",
          "Trạng thái xử lý",
          "Giảm",
          "Phải thu sau giảm",
          "Bảo hành",
          "Tình trạng",
          "Phương án",
          "Cập nhật",
        ...MINHHONG_TECHNICAL_COLUMN_HEADERS,
        ],
        ...orderRows,
        ...buildOrderSummaryRows(orderRows.length),
      ],
    },
    {
      title: "WEB_Đơn đối tác",
      rows: [
        ["Ngày", "Đối tác", "Loại giao dịch", "Nội dung / mặt hàng", "Số lượng", "Đơn giá", "Tạm tính", "Chiết khấu (%)", "Tiền chiết khấu", "Số tiền", "Phương thức thanh toán", "Còn phải trả", "Ghi chú"],
        ...partnerRows,
      ],
    },
  ];
}

function buildGoogleSheetsTailClearPayload(tabs: SheetTab[], scope: MinhHongSheetSyncScope = "all") {
  return {
    ranges: filterTabsForScope(tabs, scope).map((tab) => (
      `${quoteSheetName(tab.title)}!A${tab.rows.length + 1}:Z`
    )),
  };
}

function buildGoogleSheetsBatchUpdatePayload(tabs: SheetTab[], scope: MinhHongSheetSyncScope = "all") {
  const scopedTabs = filterTabsForScope(tabs, scope);

  return {
    data: scopedTabs.map((tab) => ({
      majorDimension: "ROWS" as const,
      range: `${quoteSheetName(tab.title)}!A1`,
      values: tab.rows,
    })),
    valueInputOption: "USER_ENTERED" as const,
  };
}

export interface MinhHongSheetExportPlan {
  formatRequests(sheets: SpreadsheetSheetProperties[]): GoogleSheetsFormatRequest[];
  prepareRequests(existing: SpreadsheetSheetProperties[]): ReturnType<typeof buildPrepareSpreadsheetRequests>;
  scope: MinhHongSheetSyncScope;
  tabs: SheetTab[];
  tabTitles: MinhHongWebExportTabTitle[];
  tailClearPayload: ReturnType<typeof buildGoogleSheetsTailClearPayload>;
  updatePayload: ReturnType<typeof buildGoogleSheetsBatchUpdatePayload>;
}

export function buildMinhHongSheetExportPlan(
  serializedOrders: SheetOrderForExport[],
  serializedPartners: SheetPartnerForExport[],
  scope: MinhHongSheetSyncScope = "all",
  exportedAt = new Date()
): MinhHongSheetExportPlan {
  const tabs = filterTabsForScope(
    buildMinhHongSheetTabsFromData(serializedOrders, serializedPartners, exportedAt),
    scope
  );
  const tabRowCounts = Object.fromEntries(tabs.map((tab) => [tab.title, tab.rows.length]));

  return {
    formatRequests: (sheets) => buildGoogleSheetsFormatRequests(sheets, scope, tabRowCounts),
    prepareRequests: (existing) => buildPrepareSpreadsheetRequests(existing, scope),
    scope,
    tabs,
    tabTitles: tabs.map((tab) => tab.title),
    tailClearPayload: buildGoogleSheetsTailClearPayload(tabs, scope),
    updatePayload: buildGoogleSheetsBatchUpdatePayload(tabs, scope),
  };
}
