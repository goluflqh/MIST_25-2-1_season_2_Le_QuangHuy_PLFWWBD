import { createHash, createSign } from "node:crypto";
import { getPayableAmount } from "@/lib/coupon-discounts";
import { shouldHideImportedFallbackDate } from "@/lib/admin-order-display";
import { getVisibleDebtPartners } from "@/lib/partner-legacy";
import { partnerInclude, serializePartner } from "@/lib/partner-ledger";
import { prisma } from "@/lib/prisma";
import {
  normalizeServiceOrderPriceStatus,
  serializeServiceOrder,
  serviceOrderInclude,
} from "@/lib/service-orders";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/vietnam-time";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SERVICE_ACCOUNT_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;
export const DEFAULT_MINHHONG_SHEET_ID = "1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA";
export const MINHHONG_RAW_SOURCE_SHEET_IDS = [
  "1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA",
  "1JHIFHgbUnTcDCqqysmh6D6DN8fMqQl5tUNdI7uVsoOw",
] as const;

export const MINHHONG_WEB_EXPORT_TAB_TITLES = [
  "WEB_Đơn hàng",
  "WEB_Công nợ đối tác",
  "WEB_Giao dịch đối tác",
  "WEB_Đối tác",
  "WEB_Đối soát",
] as const;
export const MINHHONG_TECHNICAL_COLUMN_HEADERS = ["web_id", "source_code", "source_row", "updated_at", "sync_hash"] as const;

const targetTabs = MINHHONG_WEB_EXPORT_TAB_TITLES;
type MinhHongWebExportTabTitle = (typeof MINHHONG_WEB_EXPORT_TAB_TITLES)[number];
export type MinhHongSheetSyncScope = "all" | "service-orders" | "partners";
type SheetCellValue = string | number;

interface SheetTab {
  rows: Array<Array<SheetCellValue>>;
  title: MinhHongWebExportTabTitle;
}

type SpreadsheetSheetProperties = SpreadsheetSheet["properties"];

interface SheetOrderForExport {
  customerAddress?: string | null;
  customerName: string;
  customerPhone: string;
  discountAmount: number;
  id?: string;
  issueDescription?: string | null;
  notes?: string | null;
  orderCode: string;
  createdAt?: Date | string;
  orderDate: Date | string;
  paidAmount: number;
  priceStatus: string;
  productName: string;
  quotedPrice?: number | null;
  service: string;
  solution?: string | null;
  source: string;
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

interface SpreadsheetSheet {
  properties: {
    sheetId: number;
    title: string;
  };
}

interface SpreadsheetMetadata {
  sheets: SpreadsheetSheet[];
}

export class SheetSyncConfigError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "SheetSyncConfigError";
  }
}

export function assertSafeMinhHongSheetSyncTarget(spreadsheetId: string) {
  const normalized = spreadsheetId.trim();

  if (!normalized) {
    throw new SheetSyncConfigError("Thiếu mã Google Sheet đích để xuất dữ liệu web.");
  }

  return normalized;
}

export function getMinhHongWebExportTabTitlesForScope(scope: MinhHongSheetSyncScope = "all") {
  if (scope === "service-orders") return ["WEB_Đơn hàng"] satisfies MinhHongWebExportTabTitle[];
  if (scope === "partners") {
    return [
      "WEB_Công nợ đối tác",
      "WEB_Giao dịch đối tác",
      "WEB_Đối tác",
    ] satisfies MinhHongWebExportTabTitle[];
  }
  return [...targetTabs];
}

function filterTabsForScope(tabs: SheetTab[], scope: MinhHongSheetSyncScope = "all") {
  const allowed = new Set(getMinhHongWebExportTabTitlesForScope(scope));
  return tabs.filter((tab) => allowed.has(tab.title));
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function hasGoogleServiceAccountCredentials() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function getGoogleCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new SheetSyncConfigError(
      "Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_PRIVATE_KEY để sync Google Sheet."
    );
  }

  return { clientEmail, privateKey };
}

export async function getGoogleAccessToken(fetchImpl: typeof fetch = fetch) {
  const { clientEmail, privateKey } = getGoogleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
    iss: clientEmail,
    scope: GOOGLE_SERVICE_ACCOUNT_SCOPES.join(" "),
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey);
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetchImpl(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
  });
  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Không lấy được Google access token.");
  }

  return data.access_token as string;
}

function quoteSheetName(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

async function googleSheetsFetch<T>(
  accessToken: string,
  spreadsheetId: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Google Sheets API trả lỗi.");
  }

  return data as T;
}

export function buildPrepareSpreadsheetRequests(
  existing: SpreadsheetSheetProperties[],
  scope: MinhHongSheetSyncScope = "all"
) {
  const existingTitles = new Set(existing.map((sheet) => sheet.title));

  return getMinhHongWebExportTabTitlesForScope(scope)
    .filter((title) => !existingTitles.has(title))
    .map((title) => ({ addSheet: { properties: { title } } }));
}

const technicalColumnStartIndexes: Partial<Record<MinhHongWebExportTabTitle, number>> = {
  "WEB_Đơn hàng": 21,
  "WEB_Công nợ đối tác": 15,
  "WEB_Giao dịch đối tác": 20,
  "WEB_Đối tác": 8,
};

const moneyColumnRanges: Partial<Record<MinhHongWebExportTabTitle, Array<{ end: number; start: number }>>> = {
  "WEB_Đơn hàng": [
    { start: 5, end: 8 },
    { start: 15, end: 17 },
  ],
  "WEB_Công nợ đối tác": [
    { start: 5, end: 12 },
  ],
  "WEB_Giao dịch đối tác": [
    { start: 8, end: 10 },
    { start: 11, end: 12 },
  ],
};

const textColumnRanges: Partial<Record<MinhHongWebExportTabTitle, Array<{ end: number; start: number }>>> = {
  "WEB_Đơn hàng": [
    { start: 3, end: 4 },
  ],
  "WEB_Công nợ đối tác": [
    { start: 2, end: 3 },
  ],
  "WEB_Đối tác": [
    { start: 2, end: 3 },
  ],
};

function buildMoneyFormatRequests(sheet: SpreadsheetSheetProperties, title: MinhHongWebExportTabTitle) {
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

function buildTextFormatRequests(sheet: SpreadsheetSheetProperties, title: MinhHongWebExportTabTitle) {
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

export function buildGoogleSheetsFormatRequests(
  sheets: SpreadsheetSheetProperties[],
  scope: MinhHongSheetSyncScope = "all"
) {
  const scopedTabs = new Set(getMinhHongWebExportTabTitlesForScope(scope));

  return sheets
    .filter((sheet) => scopedTabs.has(sheet.title as MinhHongWebExportTabTitle))
    .flatMap((sheet) => {
      const title = sheet.title as MinhHongWebExportTabTitle;
      const technicalStartIndex = technicalColumnStartIndexes[title];
      const baseRequests = [
        {
          updateSheetProperties: {
            fields: "gridProperties.frozenRowCount",
            properties: { gridProperties: { frozenRowCount: 1 }, sheetId: sheet.sheetId },
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
        ...buildTextFormatRequests(sheet, title),
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

async function prepareSpreadsheet(accessToken: string, spreadsheetId: string, scope: MinhHongSheetSyncScope = "all") {
  const metadata = await googleSheetsFetch<SpreadsheetMetadata>(accessToken, spreadsheetId, "?fields=sheets.properties");
  const existing = metadata.sheets.map((sheet) => sheet.properties);
  const requests = buildPrepareSpreadsheetRequests(existing, scope);

  if (requests.length > 0) {
    await googleSheetsFetch(accessToken, spreadsheetId, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  const refreshed = await googleSheetsFetch<SpreadsheetMetadata>(accessToken, spreadsheetId, "?fields=sheets.properties");
  const formatRequests = buildGoogleSheetsFormatRequests(refreshed.sheets.map((sheet) => sheet.properties), scope);

  if (formatRequests.length > 0) {
    await googleSheetsFetch(accessToken, spreadsheetId, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: formatRequests }),
    });
  }
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

function appendTechnicalColumns(
  row: SheetCellValue[],
  technical: { sourceCode?: string | null; sourceRow?: number | string | null; updatedAt?: Date | string | null; webId?: string | null }
): SheetCellValue[] {
  const updatedAt = formatVietnamDateTime(technical.updatedAt) || "";
  const technicalValues: SheetCellValue[] = [
    technical.webId || "",
    technical.sourceCode || "",
    technical.sourceRow ?? "",
    updatedAt,
    buildSyncHash([...row, technical.webId || "", technical.sourceCode || "", technical.sourceRow ?? "", updatedAt]),
  ];

  return [...row, ...technicalValues];
}

function formatExportOrderDate(order: SheetOrderForExport) {
  return shouldHideImportedFallbackDate(order) ? "Chưa có ngày" : formatVietnamDate(order.orderDate);
}

function buildGeneratedPlaceholderPhone(sourceRow: number) {
  return `099${String(sourceRow || 0).padStart(7, "0").slice(-7)}`;
}

function isGeneratedMissingCustomerPhone(order: SheetOrderForExport) {
  if (order.source !== "IMPORT" || !order.sourceRow) return false;
  return order.customerPhone === buildGeneratedPlaceholderPhone(order.sourceRow);
}

function formatExportCustomerPhone(order: SheetOrderForExport) {
  if (isGeneratedMissingCustomerPhone(order)) return "";
  return order.customerPhone || "";
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
    ["", "", "", "", "Còn nợ", `=SUM(H${firstDataRow}:INDEX(H:H;ROW()-1))`],
  ];
}

export async function buildMinhHongSheetTabs(): Promise<SheetTab[]> {
  const [orders, partners] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: { deletedAt: null },
      include: serviceOrderInclude,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      take: 1000,
    }),
    prisma.partner.findMany({
      where: { deletedAt: null },
      include: partnerInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);
  const serializedOrders = orders.map(serializeServiceOrder);
  const serializedPartners = partners.map(serializePartner);

  return buildMinhHongSheetTabsFromData(serializedOrders, serializedPartners);
}

export function buildMinhHongSheetTabsFromData(
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

    row[7] = `=MAX(F${index + 2}-G${index + 2};0)`;

    return appendTechnicalColumns(row, {
      sourceCode: order.sourceName || order.source,
      sourceRow: order.sourceRow,
      updatedAt: order.updatedAt,
      webId: order.id || order.orderCode,
    });
  });
  const partnerRows = visiblePartners.map((partner, index) => {
    const row: SheetCellValue[] = [
      partner.code,
      partner.name,
      partner.phone || "",
      partner.type,
      partner.active ? "Đang dùng" : "Tạm dừng",
      "",
      partner.totals.purchased,
      partner.totals.paid,
      partner.totals.returned,
      partner.totals.openingBalance,
      partner.totals.adjusted,
      partner.totals.referenceOnly,
      partner.ledgerEntries.length,
      partner.notes || "",
      formatVietnamDateTime(partner.updatedAt),
    ];

    row[5] = `=MAX(G${index + 2}+J${index + 2}+K${index + 2}-H${index + 2}-I${index + 2};0)`;

    return appendTechnicalColumns(row, {
      sourceCode: partner.code,
      updatedAt: partner.updatedAt,
      webId: partner.id || partner.code,
    });
  });
  const ledgerRows = visiblePartners.flatMap((partner) =>
    partner.ledgerEntries.map((entry) => {
      const row: SheetCellValue[] = [
        formatVietnamDate(entry.entryDate),
        partner.code,
        partner.name,
        formatEntryType(entry.entryType),
        entry.description,
        entry.category || "",
        entry.quantity ?? "",
        entry.unit || "",
        entry.unitPrice ?? "",
        entry.amount,
        entry.receivedGoods === null || entry.receivedGoods === undefined ? "" : entry.receivedGoods ? "Có" : "Không",
        entry.signedAmount,
        entry.countsInDebt ? "Có" : "Không",
        entry.sourceName || "",
        entry.sourceCode || "",
        entry.sourceRow || "",
        entry.paymentMethod || "",
        entry.reference || "",
        entry.notes || "",
        formatVietnamDateTime(entry.createdAt),
      ];

      return appendTechnicalColumns(row, {
        sourceCode: entry.sourceCode,
        sourceRow: entry.sourceRow,
        updatedAt: entry.updatedAt || entry.createdAt,
        webId: entry.id || entry.sourceCode || `${partner.code}:${entry.entryDate}:${entry.description}`,
      });
    })
  );

  return [
    {
      title: "WEB_Đối soát",
      rows: [
        ["Chỉ số", "Giá trị", "Ghi chú"],
        ["Thời điểm xuất", formatVietnamDateTime(exportedAt), "Web ghi một chiều sang tab WEB_*, không ghi đè Sheet gốc"],
        ["Tổng đơn hàng", "=COUNTA('WEB_Đơn hàng'!A2:A)", "Đếm mã đơn trên tab WEB_Đơn hàng"],
        ["Tổng đã thu", "=SUM('WEB_Đơn hàng'!G2:G)", "Tự tính từ cột Đã thu"],
        ["Tổng còn phải thu khách", "=SUM('WEB_Đơn hàng'!H2:H)", "Tự tính từ cột Còn nợ"],
        ["Tổng Minh Hồng phải trả đối tác", "=SUM('WEB_Công nợ đối tác'!F2:F)", "Tự tính từ cột Minh Hồng phải trả"],
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
      title: "WEB_Công nợ đối tác",
      rows: [
        ["Mã", "Đối tác", "SĐT", "Loại", "Trạng thái", "Minh Hồng phải trả", "Đã mua", "Đã thanh toán", "Đã trả hàng", "Số dư chốt", "Điều chỉnh", "Dòng đối chiếu không tính nợ", "Số giao dịch", "Ghi chú", "Cập nhật", ...MINHHONG_TECHNICAL_COLUMN_HEADERS],
        ...partnerRows,
      ],
    },
    {
      title: "WEB_Giao dịch đối tác",
      rows: [
        ["Ngày nhập", "Mã đối tác", "Đối tác công nợ", "Loại giao dịch", "Tên hàng/Nội dung", "Loại", "Số lượng", "Đơn vị", "Đơn giá", "Thành tiền", "Đã nhận hàng", "Tác động công nợ", "Tính công nợ", "Người bán/nguồn gốc", "Mã dòng cũ", "Dòng gốc", "Phương thức", "Chứng từ", "Ghi chú", "Tạo lúc", ...MINHHONG_TECHNICAL_COLUMN_HEADERS],
        ...ledgerRows,
      ],
    },
    {
      title: "WEB_Đối tác",
      rows: [
        ["Mã", "Tên", "SĐT", "Loại", "Trạng thái", "Ghi chú", "Tạo lúc", "Cập nhật", ...MINHHONG_TECHNICAL_COLUMN_HEADERS],
        ...visiblePartners.map((partner) => appendTechnicalColumns([
          partner.code,
          partner.name,
          partner.phone || "",
          partner.type,
          partner.active ? "Đang dùng" : "Tạm dừng",
          partner.notes || "",
          formatVietnamDateTime(partner.createdAt),
          formatVietnamDateTime(partner.updatedAt),
        ], {
          sourceCode: partner.code,
          updatedAt: partner.updatedAt,
          webId: partner.id || partner.code,
        })),
      ],
    },
  ];
}

export function buildGoogleSheetsBatchClearPayload(scope: MinhHongSheetSyncScope = "all") {
  return {
    ranges: getMinhHongWebExportTabTitlesForScope(scope).map((title) => `${quoteSheetName(title)}!A:Z`),
  };
}

export function buildGoogleSheetsBatchUpdatePayload(tabs: SheetTab[], scope: MinhHongSheetSyncScope = "all") {
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

export async function syncMinhHongGoogleSheet(scope: MinhHongSheetSyncScope = "all") {
  const spreadsheetId = assertSafeMinhHongSheetSyncTarget(
    process.env.GOOGLE_SHEETS_SYNC_SPREADSHEET_ID || DEFAULT_MINHHONG_SHEET_ID
  );
  const accessToken = await getGoogleAccessToken();
  const tabs = filterTabsForScope(await buildMinhHongSheetTabs(), scope);

  await prepareSpreadsheet(accessToken, spreadsheetId, scope);

  await googleSheetsFetch(accessToken, spreadsheetId, "/values:batchClear", {
    method: "POST",
    body: JSON.stringify(buildGoogleSheetsBatchClearPayload(scope)),
  });

  const updateResult = await googleSheetsFetch<{ totalUpdatedCells?: number }>(accessToken, spreadsheetId, "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify(buildGoogleSheetsBatchUpdatePayload(tabs, scope)),
  });

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabs: tabs.map((tab) => tab.title),
    totalUpdatedCells: updateResult.totalUpdatedCells || 0,
  };
}
