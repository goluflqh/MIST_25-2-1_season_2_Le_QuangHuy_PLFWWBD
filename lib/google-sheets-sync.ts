import { createSign } from "node:crypto";
import { getPayableAmount, getRemainingAmount } from "@/lib/coupon-discounts";
import { partnerInclude, serializePartner } from "@/lib/partner-ledger";
import { prisma } from "@/lib/prisma";
import {
  normalizeServiceOrderPriceStatus,
  serializeServiceOrder,
  serviceOrderInclude,
} from "@/lib/service-orders";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/vietnam-time";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
export const DEFAULT_MINHHONG_SHEET_ID = "1AMTEU7KBYMjU4PYPhL3M5BxkJoWA2n2e_v0_E4fyEGw";

const targetTabs = ["Tổng quan", "Đơn hàng", "Công nợ đối tác", "Giao dịch đối tác", "Đối tác"] as const;

interface SheetTab {
  rows: Array<Array<string | number>>;
  title: (typeof targetTabs)[number];
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

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
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

async function getGoogleAccessToken() {
  const { clientEmail, privateKey } = getGoogleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    aud: GOOGLE_TOKEN_URL,
    exp: now + 3600,
    iat: now,
    iss: clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
  }));
  const unsignedJwt = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(unsignedJwt).sign(privateKey);
  const assertion = `${unsignedJwt}.${base64Url(signature)}`;

  const response = await fetch(GOOGLE_TOKEN_URL, {
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

async function prepareSpreadsheet(accessToken: string, spreadsheetId: string) {
  const metadata = await googleSheetsFetch<SpreadsheetMetadata>(accessToken, spreadsheetId, "?fields=sheets.properties");
  const existing = metadata.sheets.map((sheet) => sheet.properties);
  const existingTitles = new Set(existing.map((sheet) => sheet.title));
  const requests: unknown[] = [];
  const titlesAfterRename = new Set(existingTitles);

  const defaultSheet = existing.find((sheet) => sheet.title === "Sheet1");
  if (defaultSheet && !existingTitles.has(targetTabs[0])) {
    requests.push({
      updateSheetProperties: {
        fields: "title",
        properties: { sheetId: defaultSheet.sheetId, title: targetTabs[0] },
      },
    });
    titlesAfterRename.delete("Sheet1");
    titlesAfterRename.add(targetTabs[0]);
  }

  targetTabs.forEach((title) => {
    if (!titlesAfterRename.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
      titlesAfterRename.add(title);
    }
  });

  existing.forEach((sheet) => {
    const finalTitle = sheet.title === "Sheet1" && defaultSheet && !existingTitles.has(targetTabs[0])
      ? targetTabs[0]
      : sheet.title;
    if (!targetTabs.includes(finalTitle as (typeof targetTabs)[number])) {
      requests.push({ deleteSheet: { sheetId: sheet.sheetId } });
    }
  });

  if (requests.length > 0) {
    await googleSheetsFetch(accessToken, spreadsheetId, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  }

  const refreshed = await googleSheetsFetch<SpreadsheetMetadata>(accessToken, spreadsheetId, "?fields=sheets.properties");
  const formatRequests = refreshed.sheets
    .map((sheet) => sheet.properties)
    .filter((sheet) => targetTabs.includes(sheet.title as (typeof targetTabs)[number]))
    .flatMap((sheet) => [
      {
        updateSheetProperties: {
          fields: "gridProperties.frozenRowCount",
          properties: { gridProperties: { frozenRowCount: 1 }, sheetId: sheet.sheetId },
        },
      },
      {
        repeatCell: {
          cell: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.95, green: 0.96, blue: 0.98 },
          },
          fields: "userEnteredFormat(textFormat,backgroundColor)",
          range: { endRowIndex: 1, sheetId: sheet.sheetId, startRowIndex: 0 },
        },
      },
      {
        autoResizeDimensions: {
          dimensions: { dimension: "COLUMNS", sheetId: sheet.sheetId, startIndex: 0, endIndex: 16 },
        },
      },
    ]);

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
    OPENING_BALANCE: "Đầu kỳ",
    PAYMENT: "Thanh toán",
    PURCHASE: "Mua hàng",
    RETURN: "Trả hàng",
  };
  return labels[entryType] || entryType;
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
  const orderRows = serializedOrders.map((order) => {
    const priceStatus = normalizeServiceOrderPriceStatus(order.priceStatus, order.quotedPrice);
    const payable = priceStatus === "CONFIRMED" ? getPayableAmount(order.quotedPrice, order.discountAmount) : 0;
    const debt = priceStatus === "CONFIRMED"
      ? getRemainingAmount(order.quotedPrice, order.discountAmount, order.paidAmount)
      : 0;

    return [
      order.orderCode,
      formatVietnamDate(order.orderDate),
      order.customerName,
      order.customerPhone,
      order.customerAddress || "",
      order.service,
      order.productName,
      formatOrderStatus(order.status),
      formatPriceStatus(priceStatus),
      order.quotedPrice ?? "",
      order.discountAmount,
      payable,
      order.paidAmount,
      debt,
      order.source,
      order.warranty?.serialNo || "",
      order.issueDescription || "",
      order.solution || "",
      order.notes || "",
      formatVietnamDateTime(order.updatedAt),
    ];
  });
  const totalDebt = orderRows.reduce((sum, row) => sum + Number(row[13] || 0), 0);
  const totalPaid = orderRows.reduce((sum, row) => sum + Number(row[12] || 0), 0);
  const partnerBalance = serializedPartners.reduce((sum, partner) => sum + partner.balance, 0);
  const longBalance = serializedPartners.find((partner) => partner.code === "LONG")?.balance || 0;
  const partnerRows = serializedPartners.map((partner) => [
    partner.code,
    partner.name,
    partner.phone || "",
    partner.type,
    partner.active ? "Đang dùng" : "Tạm dừng",
    partner.balance,
    partner.totals.increase,
    partner.totals.decrease,
    partner.ledgerEntries.length,
    partner.notes || "",
    formatVietnamDateTime(partner.updatedAt),
  ]);
  const ledgerRows = serializedPartners.flatMap((partner) =>
    partner.ledgerEntries.map((entry) => [
      formatVietnamDate(entry.entryDate),
      partner.code,
      partner.name,
      formatEntryType(entry.entryType),
      entry.description,
      entry.amount,
      entry.signedAmount,
      entry.reference || "",
      entry.notes || "",
      formatVietnamDateTime(entry.createdAt),
    ])
  );

  return [
    {
      title: "Tổng quan",
      rows: [
        ["Chỉ số", "Giá trị", "Ghi chú"],
        ["Thời điểm sync", formatVietnamDateTime(new Date()), "Web ghi một chiều sang Google Sheet"],
        ["Tổng đơn hàng", serializedOrders.length, ""],
        ["Tổng đã thu", totalPaid, ""],
        ["Tổng còn phải thu khách", totalDebt, "Chỉ tính đơn đã xác nhận giá"],
        ["Tổng công nợ đối tác", partnerBalance, ""],
        ["Long còn nợ", longBalance, "Mục tiêu đã chốt: 12.720.000đ"],
      ],
    },
    {
      title: "Đơn hàng",
      rows: [
        [
          "Mã đơn",
          "Ngày đơn",
          "Khách",
          "SĐT",
          "Địa chỉ",
          "Dịch vụ",
          "Sản phẩm",
          "Trạng thái",
          "Tình trạng giá",
          "Giá gốc",
          "Giảm",
          "Phải thu",
          "Đã thu",
          "Còn nợ",
          "Nguồn",
          "Bảo hành",
          "Tình trạng",
          "Phương án",
          "Ghi chú",
          "Cập nhật",
        ],
        ...orderRows,
      ],
    },
    {
      title: "Công nợ đối tác",
      rows: [
        ["Mã", "Đối tác", "SĐT", "Loại", "Trạng thái", "Còn nợ", "Tăng nợ", "Giảm nợ", "Số giao dịch", "Ghi chú", "Cập nhật"],
        ...partnerRows,
      ],
    },
    {
      title: "Giao dịch đối tác",
      rows: [
        ["Ngày", "Mã đối tác", "Đối tác", "Loại", "Nội dung", "Số tiền nhập", "Tác động công nợ", "Chứng từ", "Ghi chú", "Tạo lúc"],
        ...ledgerRows,
      ],
    },
    {
      title: "Đối tác",
      rows: [
        ["Mã", "Tên", "SĐT", "Loại", "Trạng thái", "Ghi chú", "Tạo lúc", "Cập nhật"],
        ...serializedPartners.map((partner) => [
          partner.code,
          partner.name,
          partner.phone || "",
          partner.type,
          partner.active ? "Đang dùng" : "Tạm dừng",
          partner.notes || "",
          formatVietnamDateTime(partner.createdAt),
          formatVietnamDateTime(partner.updatedAt),
        ]),
      ],
    },
  ];
}

export async function syncMinhHongGoogleSheet() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SYNC_SPREADSHEET_ID || DEFAULT_MINHHONG_SHEET_ID;
  const accessToken = await getGoogleAccessToken();
  const tabs = await buildMinhHongSheetTabs();

  await prepareSpreadsheet(accessToken, spreadsheetId);

  await googleSheetsFetch(accessToken, spreadsheetId, "/values:batchClear", {
    method: "POST",
    body: JSON.stringify({
      ranges: targetTabs.map((title) => `${quoteSheetName(title)}!A:Z`),
    }),
  });

  const updateResult = await googleSheetsFetch<{ totalUpdatedCells?: number }>(accessToken, spreadsheetId, "/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      data: tabs.map((tab) => ({
        majorDimension: "ROWS",
        range: `${quoteSheetName(tab.title)}!A1`,
        values: tab.rows,
      })),
      valueInputOption: "RAW",
    }),
  });

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabs: tabs.map((tab) => tab.title),
    totalUpdatedCells: updateResult.totalUpdatedCells || 0,
  };
}
