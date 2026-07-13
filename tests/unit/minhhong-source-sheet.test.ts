import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import {
  applyMinhHongSourceIdPlan,
  applyMinhHongSourceSheetDateRepairs,
  buildMinhHongSourceIdPlanFromExports,
  buildMinhHongSourceSheetEditUrl,
  buildMinhHongSourceSheetDateRepairsFromExports,
  buildMinhHongSourceImportWorkbook,
  buildMinhHongSourceImportWorkbookFromExports,
  buildSourceSheetExportUrl,
  fetchMinhHongSourceSheetExports,
  getMinhHongSourceSheetLinkTargets,
  hideMinhHongSourceIdColumns,
  MinhHongSourceIdPlanChangedError,
  MINHHONG_SOURCE_ID_PATTERN,
  MINHHONG_SOURCE_ID_TARGETS,
  MINHHONG_SOURCE_SHEET_EXPORTS,
  type SourceExport,
} from "../../lib/minhhong-import/source-sheet";
import { parseMinhHongAdminWorkbook } from "../../lib/minhhong-import/workbook-parser";

const legacyWorkbookPath = resolve("operations/minhhong-sheet-goc-export-2026-05-26.xlsx");
const manualWorkbookPath = resolve("operations/minhhong-sheet-moi-export-2026-05-26.xlsx");

function buildSourceExports(
  legacyBuffer = readFileSync(legacyWorkbookPath),
  manualBuffer = readFileSync(manualWorkbookPath)
): SourceExport[] {
  return [
    { buffer: legacyBuffer, kind: "legacy", spreadsheetId: "legacy-sheet-id" },
    { buffer: manualBuffer, kind: "manual", spreadsheetId: "manual-sheet-id" },
  ];
}

async function buildSourceWorkbooksWithAssignedIds() {
  const exports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(exports);
  const workbooks = {
    legacy: new ExcelJS.Workbook(),
    manual: new ExcelJS.Workbook(),
  };
  await workbooks.legacy.xlsx.load(exports[0].buffer as unknown as Parameters<typeof workbooks.legacy.xlsx.load>[0]);
  await workbooks.manual.xlsx.load(exports[1].buffer as unknown as Parameters<typeof workbooks.manual.xlsx.load>[0]);

  for (const assignment of plan.assignments) {
    const target = MINHHONG_SOURCE_ID_TARGETS.find((item) =>
      item.kind === assignment.kind && item.sheetName === assignment.sheetName
    );
    assert.ok(target, `missing source_id target for ${assignment.sheetName}`);
    const worksheet = workbooks[assignment.kind].getWorksheet(assignment.sheetName);
    assert.ok(worksheet, `missing source worksheet ${assignment.sheetName}`);
    worksheet.getRow(assignment.rowNumber).getCell(target.sourceIdColumn).value = assignment.value;
  }

  return {
    legacyBuffer: Buffer.from(await workbooks.legacy.xlsx.writeBuffer()),
    manualBuffer: Buffer.from(await workbooks.manual.xlsx.writeBuffer()),
    plan,
  };
}

type SourceIdAssignment = Awaited<ReturnType<typeof buildMinhHongSourceIdPlanFromExports>>["assignments"][number];

function sourceIdPreflightRow(assignment: SourceIdAssignment) {
  assert.ok(assignment.rowFingerprint, `missing row fingerprint for ${assignment.range}`);
  const cells = JSON.parse(assignment.rowFingerprint) as Array<[string, unknown?]>;
  const values = cells.map((cell) => {
    assert.ok(Array.isArray(cell), `non-canonical fingerprint cell for ${assignment.range}`);
    if (cell[0] === "empty") return "";
    if (cell[0] === "number") return Number(cell[1]);
    if (cell[0] === "boolean") return Boolean(cell[1]);
    if (cell[0] === "text") return String(cell[1] ?? "");
    assert.fail(`unknown fingerprint type ${cell[0]} for ${assignment.range}`);
  });
  return [...values, ""];
}

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

test("builds page-specific source Sheet link targets for admins", () => {
  assert.deepEqual(
    getMinhHongSourceSheetLinkTargets("service-orders").map((target) => target.id),
    ["service-orders"]
  );
  assert.deepEqual(
    getMinhHongSourceSheetLinkTargets("partners").map((target) => target.id),
    ["partners-current", "partners-legacy-purchases"]
  );
  assert.equal(
    buildMinhHongSourceSheetEditUrl("sheet-id", 123),
    "https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=123"
  );
});

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
  const fetchImpl: typeof fetch = async (input) => {
    const url = input instanceof Request ? input.url : input.toString();
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

test("fetches only the legacy source Sheet for service-order imports", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    requests.push({ init, url });
    return {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      ok: true,
      status: 200,
      statusText: "OK",
    } as Response;
  };

  const exports = await withoutGoogleServiceAccountCredentials(() => (
    fetchMinhHongSourceSheetExports(fetchImpl, "service-orders")
  ));

  assert.deepEqual(exports.map((item) => item.kind), ["legacy"]);
  assert.deepEqual(requests.map((request) => request.url), [buildSourceSheetExportUrl(MINHHONG_SOURCE_SHEET_EXPORTS[0].spreadsheetId)]);
  assert.equal(requests.some((request) => request.url.includes("batchUpdate") || request.init?.method === "POST"), false);
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

test("plans source_id headers and missing business-row IDs with the stable format", async () => {
  const plan = await buildMinhHongSourceIdPlanFromExports(buildSourceExports());
  const headerAssignments = plan.assignments.filter((assignment) => assignment.value === "source_id");
  const rowAssignments = plan.assignments.filter((assignment) => assignment.value !== "source_id");

  assert.equal(plan.canApply, true);
  assert.equal(plan.headerWrites, MINHHONG_SOURCE_ID_TARGETS.length);
  assert.equal(headerAssignments.length, MINHHONG_SOURCE_ID_TARGETS.length);
  assert.equal(rowAssignments.length, plan.missingRows);
  assert.equal(plan.assignments.length, plan.headerWrites + plan.missingRows);
  assert.ok(plan.missingRows > 0, "fixture should contain source business rows without source_id");
  assert.equal(new Set(rowAssignments.map((assignment) => assignment.value)).size, rowAssignments.length);
  assert.ok(rowAssignments.every((assignment) => MINHHONG_SOURCE_ID_PATTERN.test(assignment.value)));

  for (const target of MINHHONG_SOURCE_ID_TARGETS) {
    assert.ok(
      headerAssignments.some((assignment) =>
        assignment.kind === target.kind
        && assignment.sheetName === target.sheetName
        && assignment.rowNumber === target.headerRow
      ),
      `missing source_id header assignment for ${target.sheetName}`
    );
    const summary = plan.targets.find((item) => item.id === target.id);
    assert.ok(summary, `missing source_id summary for ${target.id}`);
    assert.equal(summary.totalRows, summary.missingRows);
  }
});

test("scopes source identity preparation to the current admin workflow", async () => {
  const exports = buildSourceExports();
  const orderPlan = await buildMinhHongSourceIdPlanFromExports(exports, "service-orders");
  const partnerPlan = await buildMinhHongSourceIdPlanFromExports(exports, "partners");

  assert.deepEqual(orderPlan.targets.map((target) => target.id), ["customer-orders"]);
  assert.deepEqual(
    partnerPlan.targets.map((target) => target.id),
    ["legacy-purchases", "legacy-returns", "current-partner-activity"]
  );
  assert.ok(orderPlan.assignments.every((assignment) => assignment.sheetName === "Đơn hàng đã bán"));
  assert.ok(partnerPlan.assignments.every((assignment) => assignment.sheetName !== "Đơn hàng đã bán"));
});

test("blocks source_id assignment when existing IDs are invalid or duplicated", async () => {
  const stamped = await buildSourceWorkbooksWithAssignedIds();
  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(
    stamped.legacyBuffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]
  );
  const customerTarget = MINHHONG_SOURCE_ID_TARGETS.find((target) => target.id === "customer-orders");
  const purchaseTarget = MINHHONG_SOURCE_ID_TARGETS.find((target) => target.id === "legacy-purchases");
  assert.ok(customerTarget);
  assert.ok(purchaseTarget);
  const customerSheet = legacyWorkbook.getWorksheet(customerTarget.sheetName);
  const purchaseSheet = legacyWorkbook.getWorksheet(purchaseTarget.sheetName);
  assert.ok(customerSheet);
  assert.ok(purchaseSheet);

  const duplicateId = `MH_${"A".repeat(32)}`;
  customerSheet.getRow(4).getCell(customerTarget.sourceIdColumn).value = duplicateId;
  customerSheet.getRow(5).getCell(customerTarget.sourceIdColumn).value = duplicateId;
  purchaseSheet.getRow(4).getCell(purchaseTarget.sourceIdColumn).value = "source-row-4";

  const plan = await buildMinhHongSourceIdPlanFromExports(buildSourceExports(
    Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    stamped.manualBuffer
  ));

  assert.equal(plan.canApply, false);
  assert.equal(plan.duplicateRows, 2);
  assert.equal(plan.invalidRows, 1);
  assert.ok(plan.issues.some((issue) => issue.includes(duplicateId) && issue.includes("dòng 4") && issue.includes("dòng 5")));
  assert.ok(plan.issues.some((issue) => issue.includes("source-row-4") && issue.includes("không đúng định dạng")));
});

test("blocks normalization when an existing source_id column was moved", async () => {
  const stamped = await buildSourceWorkbooksWithAssignedIds();
  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(
    stamped.legacyBuffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]
  );
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === "customer-orders");
  assert.ok(target);
  const worksheet = legacyWorkbook.getWorksheet(target.sheetName);
  assert.ok(worksheet);

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const value = worksheet.getRow(rowNumber).getCell(target.sourceIdColumn).value;
    worksheet.getRow(rowNumber).getCell(target.sourceIdColumn).value = null;
    worksheet.getRow(rowNumber).getCell(target.sourceIdColumn + 1).value = value;
  }

  const plan = await buildMinhHongSourceIdPlanFromExports(buildSourceExports(
    Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    stamped.manualBuffer
  ));

  assert.equal(plan.canApply, false);
  assert.ok(plan.headerConflicts.some((issue) => issue.includes("đã bị di chuyển")));
});

test("applies source_id assignments in RAW batch updates grouped by spreadsheet", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "source-id-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      if (String(url).includes("/values:batchGet")) {
        const ranges = new URL(String(url)).searchParams.getAll("ranges");
        const spreadsheetId = String(url).match(/\/spreadsheets\/([^/]+)\/values:batchGet/)?.[1];
        const assignments = plan.assignments.filter((assignment) => assignment.spreadsheetId === spreadsheetId);
        return {
          json: async () => ({
            valueRanges: assignments.map((assignment, index) => ({
              range: ranges[index],
              values: [sourceIdPreflightRow(assignment)],
            })),
          }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      const body = JSON.parse(String(init?.body || "{}"));
      return {
        json: async () => ({ totalUpdatedCells: body.data.length }),
        ok: true,
        status: 200,
        statusText: "OK",
      } as Response;
    };

    const result = await applyMinhHongSourceIdPlan(plan, sourceExports, fetchImpl as typeof fetch);
    const batchRequests = requests.filter((request) => request.url.endsWith("/values:batchUpdate"));
    const preflightRequests = requests.filter((request) => request.url.includes("/values:batchGet"));
    const sheetRequests = requests.filter((request) => request.url.includes("sheets.googleapis.com"));

    assert.equal(result.updatedCells, plan.assignments.length);
    assert.equal(preflightRequests.length, 2);
    assert.equal(batchRequests.length, 2);
    assert.equal(sheetRequests.length, 4);
    for (let index = 0; index < sheetRequests.length; index += 2) {
      assert.match(sheetRequests[index].url, /\/values:batchGet/);
      assert.match(sheetRequests[index + 1].url, /\/values:batchUpdate$/);
      const preflightSpreadsheet = sheetRequests[index].url.match(/\/spreadsheets\/([^/]+)/)?.[1];
      const updateSpreadsheet = sheetRequests[index + 1].url.match(/\/spreadsheets\/([^/]+)/)?.[1];
      assert.equal(preflightSpreadsheet, updateSpreadsheet);
    }
    for (const request of preflightRequests) {
      const url = new URL(request.url);
      assert.equal(url.searchParams.get("valueRenderOption"), "UNFORMATTED_VALUE");
      assert.equal(url.searchParams.get("dateTimeRenderOption"), "SERIAL_NUMBER");
      assert.ok(url.searchParams.getAll("ranges").every((range) => /!A\d+:[A-Z]+\d+$/.test(range)));
    }
    assert.deepEqual(
      new Set(batchRequests.map((request) => request.url)),
      new Set([
        "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id/values:batchUpdate",
        "https://sheets.googleapis.com/v4/spreadsheets/manual-sheet-id/values:batchUpdate",
      ])
    );
    assert.equal(
      batchRequests.reduce((count, request) => {
        const body = JSON.parse(String(request.init?.body || "{}"));
        assert.equal(body.valueInputOption, "RAW");
        assert.equal((request.init?.headers as Record<string, string>)?.Authorization, "Bearer source-id-token");
        assert.ok(body.data.every((item: { range?: string }) => plan.assignments.some((assignment) => assignment.range === item.range)));
        return count + body.data.length;
      }, 0),
      plan.assignments.length
    );
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("service-order preparation never reads or writes partner source tabs", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "service-orders");

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("/values:batchGet")) {
        return {
          json: async () => ({ valueRanges: plan.assignments.map((assignment) => ({ values: [sourceIdPreflightRow(assignment)] })) }),
          ok: true,
        } as Response;
      }
      const body = JSON.parse(String(init?.body || "{}"));
      return { json: async () => ({ totalUpdatedCells: body.data.length }), ok: true } as Response;
    };

    const result = await applyMinhHongSourceIdPlan(plan, sourceExports, fetchImpl as typeof fetch, "service-orders");

    assert.equal(result.updatedCells, plan.assignments.length);
    assert.ok(plan.assignments.every((assignment) => assignment.sheetName === "Đơn hàng đã bán"));
    assert.ok(requests.every((request) => !request.url.includes("manual-sheet-id")));
    const writes = requests.filter((request) => request.url.endsWith("/values:batchUpdate"));
    assert.equal(writes.length, 1);
    const writeBody = JSON.parse(String(writes[0].init?.body || "{}"));
    assert.deepEqual(writeBody.data.map((item: { range: string }) => item.range), plan.assignments.map((assignment) => assignment.range));
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("hides only the service-order identity column after verified preparation", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const plan = await buildMinhHongSourceIdPlanFromExports(buildSourceExports(), "service-orders");
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === "customer-orders");
  assert.ok(target);

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKeyPem;

  try {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: target.sheetName } }] }),
          ok: true,
        } as Response;
      }
      return { json: async () => ({}), ok: true } as Response;
    };

    await hideMinhHongSourceIdColumns(plan, buildSourceExports(), fetchImpl as typeof fetch);

    const batchRequests = requests.filter((request) => request.url.endsWith(":batchUpdate"));
    assert.equal(batchRequests.length, 1);
    assert.equal(batchRequests[0].url, "https://sheets.googleapis.com/v4/spreadsheets/legacy-sheet-id:batchUpdate");
    const body = JSON.parse(String(batchRequests[0].init?.body || "{}"));
    assert.deepEqual(body.requests, [{
      updateDimensionProperties: {
        range: {
          dimension: "COLUMNS",
          endIndex: target.sourceIdColumn,
          sheetId: 42,
          startIndex: target.sourceIdColumn - 1,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    }]);
    assert.equal(requests.some((request) => request.url.includes("values:batchUpdate")), false);
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("refuses source_id writes when business rows swap after the final export read", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);
  let attemptedWrite = false;

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

  try {
    const fetchImpl = async (url: string | URL) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "source-id-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      if (href.includes("/values:batchGet")) {
        const spreadsheetId = href.match(/\/spreadsheets\/([^/]+)\/values:batchGet/)?.[1];
        const assignments = plan.assignments.filter((assignment) => assignment.spreadsheetId === spreadsheetId);
        const rows = assignments.map(sourceIdPreflightRow);
        const businessIndexes = assignments
          .map((assignment, index) => assignment.value === "source_id" ? -1 : index)
          .filter((index) => index >= 0);
        assert.ok(businessIndexes.length >= 2);
        [rows[businessIndexes[0]], rows[businessIndexes[1]]] = [rows[businessIndexes[1]], rows[businessIndexes[0]]];
        return {
          json: async () => ({ valueRanges: rows.map((values) => ({ values: [values] })) }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      attemptedWrite = true;
      throw new Error("unexpected source_id write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(plan, sourceExports, fetchImpl as typeof fetch),
      MinhHongSourceIdPlanChangedError
    );
    assert.equal(attemptedWrite, false);
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("refuses source_id writes when the final batch read is incomplete", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);
  let attemptedWrite = false;

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

  try {
    const fetchImpl = async (url: string | URL) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "source-id-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      if (href.includes("/values:batchGet")) {
        const spreadsheetId = href.match(/\/spreadsheets\/([^/]+)\/values:batchGet/)?.[1];
        const assignments = plan.assignments.filter((assignment) => assignment.spreadsheetId === spreadsheetId);
        return {
          json: async () => ({
            valueRanges: assignments.slice(0, -1).map((assignment) => ({
              values: [sourceIdPreflightRow(assignment)],
            })),
          }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      attemptedWrite = true;
      throw new Error("unexpected source_id write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(plan, sourceExports, fetchImpl as typeof fetch),
      MinhHongSourceIdPlanChangedError
    );
    assert.equal(attemptedWrite, false);
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("refuses source_id writes when the source Sheet changed after planning", async () => {
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);
  const assignment = plan.assignments.find((item) => item.value !== "source_id");
  assert.ok(assignment);
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) =>
    item.kind === assignment.kind && item.sheetName === assignment.sheetName
  );
  assert.ok(target);

  const workbook = new ExcelJS.Workbook();
  const sourceExport = sourceExports.find((item) => item.kind === assignment.kind);
  assert.ok(sourceExport);
  await workbook.xlsx.load(sourceExport.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.getWorksheet(assignment.sheetName);
  assert.ok(worksheet);
  worksheet.getRow(assignment.rowNumber).getCell(target.sourceIdColumn).value = `MH_${"A".repeat(32)}`;

  const changedBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const changedExports = sourceExports.map((item) => item.kind === assignment.kind
    ? { ...item, buffer: changedBuffer }
    : item
  );
  let attemptedRequest = false;

  await assert.rejects(
    () => applyMinhHongSourceIdPlan(plan, changedExports, (async () => {
      attemptedRequest = true;
      throw new Error("unexpected Google request");
    }) as typeof fetch),
    MinhHongSourceIdPlanChangedError
  );
  assert.equal(attemptedRequest, false);
});

test("imports assigned source IDs without exposing them as order codes and keeps identity stable after row reordering", async () => {
  const stamped = await buildSourceWorkbooksWithAssignedIds();
  const normalizedBefore = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: stamped.legacyBuffer,
    manualWorkbookBuffer: stamped.manualBuffer,
  });
  const parsedBefore = await parseMinhHongAdminWorkbook(normalizedBefore);
  const reconciliationBefore = reconcileMinhHongWorkbook(parsedBefore);
  const stableOrders = parsedBefore.customerOrders.filter((order) =>
    MINHHONG_SOURCE_ID_PATTERN.test(order.sourceCode.replace(/^DON_KHACH:/, ""))
  );

  assert.deepEqual(
    reconciliationBefore.blockingIssues.filter((issue) => issue.toLowerCase().includes("source_id")),
    []
  );
  assert.ok(stableOrders.length >= 2);
  assert.doesNotMatch(stableOrders[0].orderCode, /MH_[0-9A-F]{32}/);

  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(
    stamped.legacyBuffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]
  );
  const customerTarget = MINHHONG_SOURCE_ID_TARGETS.find((target) => target.id === "customer-orders");
  assert.ok(customerTarget);
  const customerSheet = legacyWorkbook.getWorksheet(customerTarget.sheetName);
  assert.ok(customerSheet);
  const firstRow = customerSheet.getRow(4);
  const secondRow = customerSheet.getRow(5);
  for (const column of [1, 2, 3, 4, 5, 8, 9, 10, 11, customerTarget.sourceIdColumn]) {
    const firstValue = firstRow.getCell(column).value;
    firstRow.getCell(column).value = secondRow.getCell(column).value;
    secondRow.getCell(column).value = firstValue;
  }

  const normalizedAfter = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    manualWorkbookBuffer: stamped.manualBuffer,
  });
  const parsedAfter = await parseMinhHongAdminWorkbook(normalizedAfter);

  for (const before of stableOrders.slice(0, 2)) {
    const after = parsedAfter.customerOrders.find((order) => order.sourceCode === before.sourceCode);
    assert.ok(after, `stable order ${before.orderCode} should survive row reordering`);
    assert.equal(after.sourceCode, before.sourceCode);
    assert.equal(after.customerName, before.customerName);
    assert.equal(after.productName, before.productName);
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

test("builds a service-order preview from the legacy Sheet without partner source data", async () => {
  const serviceExports = buildSourceExports().filter((source) => source.kind === "legacy");
  const workbook = await buildMinhHongSourceImportWorkbookFromExports(serviceExports, "service-orders");
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: "service-orders" });

  assert.equal(parsed.partners.length, 0);
  assert.equal(parsed.partnerEntries.length, 0);
  assert.equal(parsed.customerOrders.length, 41);
  assert.equal(parsed.partnerTotals.longPayable, 0);
  assert.equal(
    reconciliation.blockingIssues.some((issue) => issue.includes("28/01/2029")),
    false,
    "partner-only source issues must not block the service-order preview"
  );
});

test("derives stable service-order identities without changing the raw Sheet", async () => {
  const rawRows = [
    ["Khách A", "Máy A", "0901000001", 1_500_000, 500_000, 1_000_000, "Đã sửa", "2026-07-01"],
    ["Khách B", "Máy B", "0901000002", 2_000_000, 2_000_000, 0, "Đã trả", "2026-07-02"],
  ];
  const buildLegacySource = async (rows: typeof rawRows) => {
    const legacyWorkbook = new ExcelJS.Workbook();
    const customerSheet = legacyWorkbook.addWorksheet("Đơn hàng đã bán");
    customerSheet.getRow(3).getCell(1).value = "Tên khách";
    rows.forEach((row, index) => {
      const target = customerSheet.getRow(index + 4);
      row.forEach((value, cellIndex) => {
        target.getCell(cellIndex + 1).value = value;
      });
    });
    return Buffer.from(await legacyWorkbook.xlsx.writeBuffer());
  };

  const beforeWorkbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: await buildLegacySource(rawRows),
  }, "service-orders");
  const before = await parseMinhHongAdminWorkbook(beforeWorkbook);
  assert.equal(reconcileMinhHongWorkbook(before, { scope: "service-orders" }).ok, true);
  assert.ok(before.customerOrders.every((order) => /^DON_KHACH:MH_[0-9A-F]{32}$/.test(order.sourceCode)));

  const afterWorkbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: await buildLegacySource([rawRows[1], rawRows[0]]),
  }, "service-orders");
  const after = await parseMinhHongAdminWorkbook(afterWorkbook);

  for (const order of before.customerOrders.slice(0, 2)) {
    const reordered = after.customerOrders.find((candidate) => candidate.sourceCode === order.sourceCode);
    assert.ok(reordered, `identity for ${order.customerName} should survive row reordering`);
    assert.equal(reordered.customerName, order.customerName);
    assert.equal(reordered.productName, order.productName);
  }
});

test("blocks service-order import when identical raw rows cannot be distinguished safely", async () => {
  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(readFileSync(legacyWorkbookPath) as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]);
  const customerSheet = legacyWorkbook.getWorksheet("Đơn hàng đã bán");
  assert.ok(customerSheet);
  const firstRow = customerSheet.getRow(4);
  const secondRow = customerSheet.getRow(5);
  for (let column = 1; column <= 11; column += 1) {
    secondRow.getCell(column).value = firstRow.getCell(column).value;
  }

  const workbook = await buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
  }, "service-orders");
  const parsed = await parseMinhHongAdminWorkbook(workbook);
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: "service-orders" });

  assert.equal(reconciliation.ok, false);
  assert.ok(reconciliation.blockingIssues.some((issue) => issue.includes("trùng hoàn toàn")));
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
      /^NHAP_HANG:MH_[0-9A-F]{32}$/.test(entry.sourceCode)
      && entry.description === "Đèn NLMT bc"
      && entry.amount === 3_900_000
    ),
    "new manual purchase row should be normalized into partner ledger"
  );
  assert.ok(
    parsed.partnerEntries.some((entry) =>
      /^THANH_TOAN:MH_[0-9A-F]{32}$/.test(entry.sourceCode)
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
