import { createSign } from "node:crypto";
import {
  buildMinhHongSheetExportPlan,
  type GoogleSheetsFormatRequest,
  type MinhHongSheetExportPlan,
  type MinhHongSheetSyncScope,
  type SpreadsheetSheetProperties,
} from "@/lib/google-sheets-export-plan";
import { partnerInclude, serializePartner } from "@/lib/partner-ledger";
import { prisma } from "@/lib/prisma";
import { listActiveServiceOrderViews } from "@/lib/service-orders";

export type { MinhHongSheetSyncScope } from "@/lib/google-sheets-export-plan";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SERVICE_ACCOUNT_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.readonly",
] as const;
export const DEFAULT_MINHHONG_SHEET_ID = "1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA";
export const MINHHONG_RAW_SOURCE_SHEET_IDS = [
  "1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA",
] as const;

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

async function googleSheetsFetch<T>(
  fetchImpl: typeof fetch,
  accessToken: string,
  spreadsheetId: string,
  path: string,
  init: RequestInit = {}
) {
  const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`, {
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

export interface GoogleSheetsExportClient {
  batchUpdate(requests: unknown[]): Promise<void>;
  clearValues(payload: MinhHongSheetExportPlan["tailClearPayload"]): Promise<void>;
  getSheetProperties(): Promise<SpreadsheetSheetProperties[]>;
  updateValues(payload: MinhHongSheetExportPlan["updatePayload"]): Promise<{ totalUpdatedCells?: number }>;
}

function createGoogleSheetsExportClient(
  accessToken: string,
  spreadsheetId: string,
  fetchImpl: typeof fetch = fetch
): GoogleSheetsExportClient {
  return {
    async batchUpdate(requests) {
      await googleSheetsFetch(fetchImpl, accessToken, spreadsheetId, ":batchUpdate", {
        method: "POST",
        body: JSON.stringify({ requests }),
      });
    },
    async clearValues(payload) {
      await googleSheetsFetch(fetchImpl, accessToken, spreadsheetId, "/values:batchClear", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async getSheetProperties() {
      const metadata = await googleSheetsFetch<{
        sheets: Array<{ properties: SpreadsheetSheetProperties }>;
      }>(fetchImpl, accessToken, spreadsheetId, "?fields=sheets.properties");
      return metadata.sheets.map((sheet) => sheet.properties);
    },
    updateValues(payload) {
      return googleSheetsFetch(fetchImpl, accessToken, spreadsheetId, "/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
  };
}

export async function executeMinhHongSheetExport(
  client: GoogleSheetsExportClient,
  plan: MinhHongSheetExportPlan
) {
  const existing = await client.getSheetProperties();
  const prepareRequests = plan.prepareRequests(existing);
  if (prepareRequests.length > 0) await client.batchUpdate(prepareRequests);

  const refreshed = await client.getSheetProperties();
  const formatRequests: GoogleSheetsFormatRequest[] = plan.formatRequests(refreshed);
  if (formatRequests.length > 0) await client.batchUpdate(formatRequests);

  const updateResult = await client.updateValues(plan.updatePayload);
  await client.clearValues(plan.tailClearPayload);

  return { totalUpdatedCells: updateResult.totalUpdatedCells || 0 };
}

async function loadMinhHongSheetExportSnapshot() {
  const [orders, partners] = await Promise.all([
    listActiveServiceOrderViews(),
    prisma.partner.findMany({
      where: { deletedAt: null },
      include: partnerInclude,
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  return { orders, partners: partners.map(serializePartner) };
}

export async function syncMinhHongGoogleSheet(scope: MinhHongSheetSyncScope = "all") {
  const spreadsheetId = assertSafeMinhHongSheetSyncTarget(
    process.env.GOOGLE_SHEETS_SYNC_SPREADSHEET_ID || DEFAULT_MINHHONG_SHEET_ID
  );
  const accessToken = await getGoogleAccessToken();
  const snapshot = await loadMinhHongSheetExportSnapshot();
  const plan = buildMinhHongSheetExportPlan(snapshot.orders, snapshot.partners, scope);
  const result = await executeMinhHongSheetExport(
    createGoogleSheetsExportClient(accessToken, spreadsheetId),
    plan
  );

  return {
    spreadsheetId,
    spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    tabs: plan.tabTitles,
    totalUpdatedCells: result.totalUpdatedCells,
  };
}
