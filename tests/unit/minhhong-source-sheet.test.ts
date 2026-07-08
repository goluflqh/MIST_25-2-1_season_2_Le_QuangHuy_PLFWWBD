import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import {
  applyMinhHongSourceSheetDateRepairs,
  buildMinhHongSourceSheetDateRepairsFromExports,
  buildMinhHongSourceImportWorkbook,
  buildSourceSheetExportUrl,
  fetchMinhHongSourceSheetExports,
  MINHHONG_SOURCE_SHEET_EXPORTS,
} from "../../lib/minhhong-import/source-sheet";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";

const legacyWorkbookPath = resolve("operations/minhhong-sheet-goc-export-2026-05-26.xlsx");
const manualWorkbookPath = resolve("operations/minhhong-sheet-moi-export-2026-05-26.xlsx");

async function withoutGoogleServiceAccountCredentials<T>(callback: () => Promise<T>) {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_PRIVATE_KEY;

  try {
    return await callback();
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
}

async function buildLegacyWorkbookWithExtraCustomerOrder() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(legacyWorkbookPath) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const soldSheet = workbook.getWorksheet("Đơn hàng đã bán");
  assert.ok(soldSheet, "raw legacy workbook should contain Đơn hàng đã bán");

  const newRow = soldSheet.addRow([
    "KHÁCH TEST MỚI",
    "1 pin test mới từ Sheet gốc",
    "0912345678",
    1_500_000,
    500_000,
    1_000_000,
    "Test dòng mới từ Sheet gốc",
    "2026-07-08",
  ]);
  newRow.commit();

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildLegacyWorkbookWithAmbiguousInvalidCustomerDate() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(legacyWorkbookPath) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const soldSheet = workbook.getWorksheet("Đơn hàng đã bán");
  assert.ok(soldSheet, "raw legacy workbook should contain Đơn hàng đã bán");

  const previousRow = soldSheet.getRow(18);
  previousRow.getCell(8).value = "23/01/2026";
  previousRow.commit();

  const invalidRow = soldSheet.getRow(19);
  invalidRow.getCell(8).value = "37/1/2026";
  invalidRow.commit();

  const nextRow = soldSheet.getRow(20);
  nextRow.getCell(8).value = "28/012026";
  nextRow.commit();

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildManualWorkbookWithExtraRows(rows: Array<Array<string | number>>) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(manualWorkbookPath) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Đơn hàng mua từ long");
  assert.ok(sheet, "manual workbook should contain Đơn hàng mua từ long");

  rows.forEach((row, index) => {
    const worksheetRow = sheet.getRow(index + 3);
    row.forEach((value, cellIndex) => {
      worksheetRow.getCell(cellIndex + 1).value = value;
    });
    worksheetRow.commit();
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("builds raw Google Sheet XLSX export URLs", () => {
  assert.equal(
    buildSourceSheetExportUrl("sheet-id-123"),
    "https://docs.google.com/spreadsheets/d/sheet-id-123/export?format=xlsx"
  );
});

test("fetches the configured raw source Sheet exports", async () => {
  const requestedUrls: string[] = [];
  const fetchImpl = async (url: string) => {
    requestedUrls.push(url);
    return {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      ok: true,
      status: 200,
      statusText: "OK",
    } as Response;
  };

  const exports = await withoutGoogleServiceAccountCredentials(() => fetchMinhHongSourceSheetExports(fetchImpl));

  assert.deepEqual(exports.map((item) => item.kind), ["legacy", "manual"]);
  assert.deepEqual(
    requestedUrls,
    MINHHONG_SOURCE_SHEET_EXPORTS.map((source) => buildSourceSheetExportUrl(source.spreadsheetId))
  );
  assert.deepEqual([...exports[0].buffer], [1, 2, 3]);
});

test("uses service account authorization for private raw source Sheet exports when configured", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requested: Array<{ url: string; init?: RequestInit }> = [];

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requested.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        const body = init?.body?.toString() || "";
        assert.match(body, /urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
        return {
          json: async () => ({ access_token: "private-sheet-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      return {
        arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response;
    };

    const exports = await fetchMinhHongSourceSheetExports(fetchImpl as typeof fetch);
    const exportRequests = requested.filter((request) => request.url.includes("docs.google.com/spreadsheets"));

    assert.equal(exports.length, 2);
    assert.equal(requested.some((request) => request.url.includes("oauth2.googleapis.com/token")), true);
    assert.equal(exportRequests.length, 2);
    assert.deepEqual(
      exportRequests.map((request) => (request.init?.headers as Record<string, string>)?.Authorization),
      ["Bearer private-sheet-token", "Bearer private-sheet-token"]
    );
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("normalizes raw Minh Hong source Sheet exports into the admin import contract", async () => {
  const workbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: readFileSync(legacyWorkbookPath),
    manualWorkbookBuffer: readFileSync(manualWorkbookPath),
  });
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed);

  assert.equal(parsed.partners.length, 10);
  assert.equal(parsed.partnerEntries.length, 80);
  assert.equal(parsed.customerOrders.length, 41);
  assert.equal(parsed.partnerTotals.longOpeningBalance, 20_230_000);
  assert.equal(parsed.partnerTotals.longCountedPurchase, 7_490_000);
  assert.equal(parsed.partnerTotals.longCountedPayment, 15_000_000);
  assert.equal(parsed.partnerTotals.longPayable, 12_720_000);
  assert.equal(parsed.customerOrderTotals.quoted, 36_825_000);
  assert.equal(parsed.customerOrderTotals.paid, 29_790_000);
  assert.equal(reconciliation.ok, false);
  assert.ok(
    reconciliation.blockingIssues.some((issue) => issue.includes("28/01/2029")),
    "future partner/source dates still block all-scope import"
  );
  assert.equal(
    reconciliation.blockingIssues.some((issue) => issue.includes("37/1/2026")),
    false,
    "neighbor-bounded customer date typos should no longer block import"
  );
  assert.ok(
    reconciliation.warnings.some((warning) => warning.includes("37/1/2026") && warning.includes("27/01/2026")),
    "neighbor-bounded typo dates should be corrected with a visible warning"
  );
  assert.ok(
    reconciliation.warnings.some((warning) => warning.includes("28/012026") && warning.includes("28/01/2026")),
    "safe missing-slash dates should be corrected with a visible warning"
  );
});

test("plans source Sheet date repairs for customer date cells that the importer can safely normalize", async () => {
  const repairs = await buildMinhHongSourceSheetDateRepairsFromExports([
    {
      kind: "legacy",
      spreadsheetId: "legacy-sheet-id",
      buffer: await buildLegacyWorkbookWithAmbiguousInvalidCustomerDate(),
    },
  ]);

  assert.deepEqual(
    repairs.filter((repair) => [19, 20].includes(repair.rowNumber)).map((repair) => ({
      correctedValue: repair.correctedValue,
      range: repair.range,
      rawValue: repair.rawValue,
      reason: repair.reason,
    })),
    [
      {
        correctedValue: "27/01/2026",
        range: "'Đơn hàng đã bán'!H19",
        rawValue: "37/1/2026",
        reason: "Suy luận từ ngày trước/sau trong Sheet.",
      },
      {
        correctedValue: "28/01/2026",
        range: "'Đơn hàng đã bán'!H20",
        rawValue: "28/012026",
        reason: "Chuẩn hóa định dạng ngày.",
      },
    ]
  );
});

test("applies source Sheet date repairs with USER_ENTERED values", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requested: Array<{ url: string; init?: RequestInit }> = [];

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requested.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "private-sheet-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      if (String(url).endsWith("?fields=sheets.properties(sheetId,title)")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 123, title: "Đơn hàng đã bán" } }] }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      if (String(url) === "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id:batchUpdate") {
        return {
          json: async () => ({}),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      assert.equal(String(url), "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id/values:batchUpdate");
      return {
        json: async () => ({ totalUpdatedCells: 2 }),
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response;
    };

    const result = await applyMinhHongSourceSheetDateRepairs(
      [
        {
          correctedValue: "27/01/2026",
          kind: "legacy",
          range: "'Đơn hàng đã bán'!H19",
          rawValue: "37/1/2026",
          reason: "Suy luận từ ngày trước/sau trong Sheet.",
          rowNumber: 19,
          sheetName: "Đơn hàng đã bán",
          spreadsheetId: "legacy-sheet-id",
        },
        {
          correctedValue: "28/01/2026",
          kind: "legacy",
          range: "'Đơn hàng đã bán'!H20",
          rawValue: "28/012026",
          reason: "Chuẩn hóa định dạng ngày.",
          rowNumber: 20,
          sheetName: "Đơn hàng đã bán",
          spreadsheetId: "legacy-sheet-id",
        },
      ],
      fetchImpl as typeof fetch
    );
    const updateRequest = requested.find((request) => request.url.includes("values:batchUpdate"));
    const body = JSON.parse(String(updateRequest?.init?.body || "{}"));

    assert.equal(result.updatedCells, 2);
    assert.equal(body.valueInputOption, "USER_ENTERED");
    assert.deepEqual(body.data, [
      { range: "'Đơn hàng đã bán'!H19", values: [["27/01/2026"]] },
      { range: "'Đơn hàng đã bán'!H20", values: [["28/01/2026"]] },
    ]);
    const formatRequest = requested.find((request) => request.url === "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id:batchUpdate");
    const formatBody = JSON.parse(String(formatRequest?.init?.body || "{}"));
    assert.deepEqual(formatBody.requests[0].repeatCell.range, {
      sheetId: 123,
      startColumnIndex: 7,
      startRowIndex: 3,
      endColumnIndex: 8,
    });
    assert.deepEqual(formatBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat, {
      type: "DATE",
      pattern: "dd/mm/yyyy",
    });
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("applies source Sheet customer date format even when there are no text repairs", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requested: Array<{ url: string; init?: RequestInit }> = [];

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requested.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "private-sheet-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      if (String(url).endsWith("?fields=sheets.properties(sheetId,title)")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 123, title: "Đơn hàng đã bán" } }] }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }
      assert.equal(String(url), "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id:batchUpdate");
      return {
        json: async () => ({}),
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response;
    };

    const result = await applyMinhHongSourceSheetDateRepairs([], fetchImpl as typeof fetch, {
      formatTargets: [{ spreadsheetId: "legacy-sheet-id", sheetName: "Đơn hàng đã bán" }],
    });

    assert.equal(result.updatedCells, 0);
    assert.equal(requested.some((request) => request.url.includes("values:batchUpdate")), false);
    const formatRequest = requested.find((request) => request.url === "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id:batchUpdate");
    const formatBody = JSON.parse(String(formatRequest?.init?.body || "{}"));
    assert.deepEqual(formatBody.requests[0].repeatCell.range, {
      sheetId: 123,
      startColumnIndex: 7,
      startRowIndex: 3,
      endColumnIndex: 8,
    });
    assert.deepEqual(formatBody.requests[0].repeatCell.cell.userEnteredFormat.numberFormat, {
      type: "DATE",
      pattern: "dd/mm/yyyy",
    });
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("keeps newer raw Sheet customer rows in preview without changing partner ledger totals", async () => {
  const workbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: await buildLegacyWorkbookWithExtraCustomerOrder(),
    manualWorkbookBuffer: readFileSync(manualWorkbookPath),
  });
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed);

  assert.equal(parsed.partnerEntries.length, 80);
  assert.equal(parsed.partnerTotals.longPayable, 12_720_000);
  assert.equal(parsed.customerOrders.length, 42);
  assert.equal(parsed.customerOrderTotals.quoted, 38_325_000);
  assert.equal(parsed.customerOrderTotals.paid, 30_290_000);
  assert.equal(
    parsed.customerOrders.some((order) =>
      order.customerName === "KHÁCH TEST MỚI"
      && order.productName === "1 pin test mới từ Sheet gốc"
      && order.debtAmount === 1_000_000
    ),
    true
  );
  assert.equal(reconciliation.ok, false);
});

test("imports new manual partner rows after the 12.720.000 debt checkpoint but blocks inconsistent running balances", async () => {
  const workbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: readFileSync(legacyWorkbookPath),
    manualWorkbookBuffer: await buildManualWorkbookWithExtraRows([
      ["2026-05-26", "Đèn NLMT bc", 3, 3_900_000, 3_900_000, ""],
      ["2026-05-26", "Đèn pha nlmt", 1, 1_250_000, "", 1_250_000],
      ["2026-06-24", "Sạc21v có quạt", 4, 440_000, 4_420_000, 11_000_000],
    ]),
  });
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed);

  assert.ok(
    parsed.partnerEntries.some((entry) =>
      entry.sourceCode === "NHAP_HANG:NH-MOI-0001"
      && entry.description === "Đèn NLMT bc"
      && entry.amount === 3_900_000
    ),
    "new manual purchase row should be normalized into partner ledger"
  );
  assert.ok(
    parsed.partnerEntries.some((entry) =>
      entry.sourceCode === "THANH_TOAN:TT-MOI-0001"
      && entry.amount === 3_900_000
    ),
    "new manual paid amount should be normalized into partner payment ledger"
  );
  assert.equal(parsed.reconciliation.long_counted_purchase, parsed.partnerTotals.longCountedPurchase);
  assert.equal(parsed.reconciliation.long_counted_payment, parsed.partnerTotals.longCountedPayment);
  assert.equal(parsed.reconciliation.long_payable, parsed.partnerTotals.longPayable);
  assert.ok(
    reconciliation.blockingIssues.some((issue) =>
      issue.includes("Đơn hàng mua từ long dòng 5") && issue.includes("11.000.000")
    ),
    "ambiguous manual running balance should block confirm instead of guessing"
  );
});

test("blocks suspicious future manual purchase dates", async () => {
  const workbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: readFileSync(legacyWorkbookPath),
    manualWorkbookBuffer: await buildManualWorkbookWithExtraRows([
      ["28/01/2029", "Đơn mua nhập nhầm năm", 1, 1_000_000, "", 13_720_000],
    ]),
  });
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed);

  assert.ok(
    reconciliation.blockingIssues.some((issue) => issue.includes("28/01/2029")),
    "future source dates should be reported for review"
  );
});
