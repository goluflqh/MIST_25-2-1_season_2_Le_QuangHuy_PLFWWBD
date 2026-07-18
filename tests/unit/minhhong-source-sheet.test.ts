import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { reconcileMinhHongWorkbook } from "../../lib/minhhong-import/reconciliation";
import {
  applyMinhHongSourceIdPlan,
  applyMinhHongSourceSheetSetup,
  applyMinhHongSourceSheetDateRepairs,
  buildPartnerPayableSheetFormula,
  buildMinhHongSourceIdPlanFromExports,
  buildMinhHongSourceSheetEditUrl,
  buildMinhHongSourceSheetDateRepairsFromExports,
  buildMinhHongSourceImportWorkbook,
  buildMinhHongSourceImportWorkbookFromExports,
  buildMinhHongSourceImportPreviewFromExports,
  buildSourceSheetExportUrl,
  fetchMinhHongSourceSheetExports,
  getMinhHongSourceSheetLinkTargets,
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

async function buildUnifiedPartnerSourceWorkbook() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(legacyWorkbookPath) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.addWorksheet("Đơn đối tác");
  sheet.addRow([
    "Ngày",
    "Đối tác",
    "Loại giao dịch",
    "Nội dung / mặt hàng",
    "Số lượng",
    "Đơn giá",
    "Số tiền",
    "Phương thức thanh toán",
    "Ghi chú",
    "Còn phải trả",
    "Tính công nợ",
    "source_id",
  ]);
  sheet.addRow(["", "Long", "Mua hàng", "Vỏ ss 50E", 5, "", "", "", "Tặng", "", "", `MH_${"1".repeat(32)}`]);
  sheet.addRow(["08/05/2026", "Long", "Số dư đầu kỳ", "Số dư Long đã chốt", "", "", 12_730_000, "", "", 12_730_000, "Có", `MH_${"2".repeat(32)}`]);
  sheet.addRow(["26/05/2026", "Long", "Mua hàng", "Đèn NLMT bc", 3, 1_300_000, 3_900_000, "", "", 16_630_000, "Có", `MH_${"3".repeat(32)}`]);
  sheet.addRow(["26/05/2026", "Long", "Thanh toán", "Thanh toán đèn NLMT bc", "", "", 3_900_000, "Chuyển khoản", "", 12_730_000, "Có", `MH_${"4".repeat(32)}`]);
  sheet.addRow(["26/05/2026", "Long", "Mua hàng", "Đèn pha NLMT", 1, 1_250_000, 1_250_000, "", "", 13_980_000, "Có", `MH_${"5".repeat(32)}`]);
  sheet.addRow(["24/06/2026", "Long", "Mua hàng", "Sạc 21V có quạt", 4, 110_000, 440_000, "", "", 14_420_000, "Có", `MH_${"6".repeat(32)}`]);
  sheet.addRow(["24/06/2026", "Long", "Thanh toán", "Thanh toán cho Long", "", "", 3_420_000, "Tiền mặt + chuyển khoản", "", 11_000_000, "Có", `MH_${"7".repeat(32)}`]);
  sheet.addRow(["25/06/2026", "Long", "Điều chỉnh", "Điều chỉnh tăng kiểm thử", "", "", 10_000, "", "", 11_010_000, "Có", `MH_${"8".repeat(32)}`]);
  sheet.addRow(["25/06/2026", "Long", "Điều chỉnh", "Điều chỉnh giảm kiểm thử", "", "", -10_000, "", "", 11_000_000, "Có", `MH_${"9".repeat(32)}`]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildUnifiedPartnerDiscountSourceWorkbook(discountPercent = 15, discountNumberFormat?: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  const displayedDiscountPercent = discountNumberFormat?.includes("%") ? discountPercent * 100 : discountPercent;
  const netAmount = 495_000 - Math.round(495_000 * displayedDiscountPercent / 100);
  sheet.getRow(1).getCell(13).value = "Chiết khấu (%)";
  sheet.addRow([
    "14/07/2026",
    "Long",
    "Mua hàng",
    "Hóa đơn BH260714-001",
    9,
    55_000,
    495_000,
    "",
    "",
    11_000_000 + netAmount,
    "Có",
    `MH_${"A".repeat(32)}`,
    discountPercent,
  ]);
  if (discountNumberFormat) {
    sheet.getRow(sheet.rowCount).getCell(13).numFmt = discountNumberFormat;
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function legacyPartnerPayableFormula(rowNumber: number, separator = ",") {
  const join = (...parts: string[]) => parts.join(separator);
  return `=IF(${join(`OR(${join(`$B${rowNumber}=""`, `$C${rowNumber}=""`, `$G${rowNumber}=""`)})`, `""`, `IF(${join(`$K${rowNumber}="Không"`, `""`, `SUMIFS(${join(`$G$2:$G${rowNumber}`, `$B$2:$B${rowNumber}`, `$B${rowNumber}`, `$K$2:$K${rowNumber}`, `"<>Không"`, `$C$2:$C${rowNumber}`, `"<>Thanh toán"`, `$C$2:$C${rowNumber}`, `"<>Trả hàng"`)})-SUMIFS(${join(`$G$2:$G${rowNumber}`, `$B$2:$B${rowNumber}`, `$B${rowNumber}`, `$K$2:$K${rowNumber}`, `"<>Không"`, `$C$2:$C${rowNumber}`, `"Thanh toán"`)})-SUMIFS(${join(`$G$2:$G${rowNumber}`, `$B$2:$B${rowNumber}`, `$B${rowNumber}`, `$K$2:$K${rowNumber}`, `"<>Không"`, `$C$2:$C${rowNumber}`, `"Trả hàng"`)})`)})`)})`;
}

interface PartnerPayableSetupRequest {
  repeatCell?: {
    cell?: {
      userEnteredValue?: { formulaValue?: string };
    };
    fields?: string;
    range?: Record<string, number>;
  };
  updateCells?: {
    range?: Record<string, number>;
    rows?: Array<{
      values?: Array<{
        userEnteredValue?: { formulaValue?: string };
      }>;
    }>;
  };
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
  const target = sourceIdTarget(assignment);
  return sourceIdPreflightValues(assignment.rowFingerprint, "", assignment.range, target.sourceIdColumn);
}

function sourceIdPreflightValues(rowFingerprint: string, sourceId: string, label: string, sourceIdColumn: number) {
  assert.ok(rowFingerprint, `missing row fingerprint for ${label}`);
  const cells = JSON.parse(rowFingerprint) as Array<[string, unknown?]>;
  const values = cells.map((cell) => {
    assert.ok(Array.isArray(cell), `non-canonical fingerprint cell for ${label}`);
    if (cell[0] === "empty") return "";
    if (cell[0] === "number") return Number(cell[1]);
    if (cell[0] === "boolean") return Boolean(cell[1]);
    if (cell[0] === "formula") return `=${String(cell[1] ?? "")}`;
    if (cell[0] === "text") return String(cell[1] ?? "");
    assert.fail(`unknown fingerprint type ${cell[0]} for ${label}`);
  });
  values.splice(sourceIdColumn - 1, 0, sourceId);
  return values;
}

function sourceIdTarget(candidate: Pick<SourceIdAssignment, "kind" | "sheetName">) {
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => (
    item.kind === candidate.kind && item.sheetName === candidate.sheetName
  ));
  assert.ok(target, `missing source_id target for ${candidate.sheetName}`);
  return target;
}

function sourceIdPreflightRange(assignment: Pick<SourceIdAssignment, "kind" | "rowNumber" | "sheetName">) {
  const target = sourceIdTarget(assignment);
  const endColumn = target.id === "partner-ledger" ? 13 : target.sourceIdColumn;
  const columnLetter = String.fromCharCode(64 + endColumn);
  const sheetName = `'${assignment.sheetName.replace(/'/g, "''")}'`;
  return `${sheetName}!A${assignment.rowNumber}:${columnLetter}${assignment.rowNumber}`;
}

function sourceIdDataFilterRanges(init?: RequestInit) {
  const body = JSON.parse(String(init?.body || "{}"));
  return (body.dataFilters || []).map((filter: { a1Range: string }) => filter.a1Range) as string[];
}

function sourceIdDataFilterResponse(ranges: string[], rows: unknown[][]) {
  return {
    json: async () => ({
      valueRanges: rows.map((values, index) => ({
        valueRange: { range: ranges[index], values: [values] },
      })),
    }),
    ok: true,
    status: 200,
    statusText: "OK",
  } as Response;
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

async function withGoogleServiceAccountCredentials<T>(callback: () => Promise<T>) {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "minhhong-sync@example.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = privateKey.export({ format: "pem", type: "pkcs8" }).toString();

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
    ["partners-current"]
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

test("imports the unified partner event sheet with full history and an exact 11 million payable", async () => {
  const preview = await buildMinhHongSourceImportPreviewFromExports([
    {
      buffer: await buildUnifiedPartnerSourceWorkbook(),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    },
  ], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);
  const reconciliation = reconcileMinhHongWorkbook(parsed, { scope: "partners" });
  const missingAmount = parsed.partnerEntries.find((entry) => entry.description === "Vỏ ss 50E");

  assert.deepEqual(preview.sourceIdPlan.targets.map((target) => target.id), ["partner-ledger"]);
  assert.equal(reconciliation.ok, true);
  assert.deepEqual(parsed.partners.map((partner) => partner.partnerName), ["Long"]);
  assert.equal(parsed.partnerEntries.length, 9);
  assert.equal(parsed.partnerTotals.longOpeningBalance, 12_730_000);
  assert.equal(parsed.partnerTotals.longPayable, 11_000_000);
  assert.equal(missingAmount?.amount, 0);
  assert.equal(missingAmount?.countsInDebt, false);
  assert.deepEqual(
    parsed.partnerEntries.filter((entry) => entry.entryType === "ADJUSTMENT").map((entry) => entry.amount),
    [10_000, -10_000]
  );
});

test("imports an optional partner discount as the net payable amount", async () => {
  const preview = await buildMinhHongSourceImportPreviewFromExports([
    {
      buffer: await buildUnifiedPartnerDiscountSourceWorkbook(),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    },
  ], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);
  const discounted = parsed.partnerEntries.find((entry) => entry.description === "Hóa đơn BH260714-001");

  assert.equal(discounted?.amount, 420_750);
  assert.equal(discounted?.discountAmount, 74_250);
  assert.equal(discounted?.discountPercent, 15);
  assert.equal(parsed.partnerTotals.longPayable, 11_420_750);
});

test("keeps the live row 92 payable at 12.260.750 after an undiscounted 840.000 purchase", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerDiscountSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.addRow([
    "14/07/2026",
    "Long",
    "Mua hàng",
    "Pin 35E",
    28,
    30_000,
    840_000,
    "",
    "",
    12_260_750,
    "Có",
    `MH_${"B".repeat(32)}`,
    "",
  ]);

  const preview = await buildMinhHongSourceImportPreviewFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);
  const pin35e = parsed.partnerEntries.find((entry) => entry.description === "Pin 35E");

  assert.equal(pin35e?.amount, 840_000);
  assert.equal(pin35e?.discountAmount, 0);
  assert.equal(pin35e?.discountPercent, null);
  assert.equal(parsed.partnerTotals.longPayable, 12_260_750);
});

test("keeps discounts in the balance after a later 1.260.000 partner payment", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerDiscountSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.addRow([
    "14/07/2026",
    "Long",
    "Mua hàng",
    "Pin 35E",
    28,
    30_000,
    840_000,
    "",
    "",
    12_260_750,
    "Có",
    `MH_${"B".repeat(32)}`,
    "",
  ]);
  sheet.addRow([
    "14/07/2026",
    "Long",
    "Thanh toán",
    "Thanh toán cho Long",
    "",
    "",
    1_260_000,
    "Chuyển khoản",
    "",
    11_000_750,
    "Có",
    `MH_${"C".repeat(32)}`,
    "",
  ]);

  const preview = await buildMinhHongSourceImportPreviewFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.partnerTotals.longPayable, 11_000_750);
});

test("imports a fully discounted partner purchase with zero net payable", async () => {
  const preview = await buildMinhHongSourceImportPreviewFromExports([
    {
      buffer: await buildUnifiedPartnerDiscountSourceWorkbook(100),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    },
  ], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);
  const discounted = parsed.partnerEntries.find((entry) => entry.description === "Hóa đơn BH260714-001");

  assert.deepEqual(parsed.errors, []);
  assert.equal(discounted?.amount, 0);
  assert.equal(discounted?.discountAmount, 495_000);
  assert.equal(discounted?.discountPercent, 100);
  assert.equal(parsed.partnerTotals.longPayable, 11_000_000);
});

test("imports a raw Sheet percentage-formatted discount displayed as 100%", async () => {
  const preview = await buildMinhHongSourceImportPreviewFromExports([{
    buffer: await buildUnifiedPartnerDiscountSourceWorkbook(1, "0%"),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.partnerEntries.find((entry) => entry.description === "Hóa đơn BH260714-001")?.discountPercent, 100);
});

for (const storedPercent of [1.01, 2]) {
  test(`blocks a raw Sheet percentage-formatted discount stored as ${storedPercent}`, async () => {
    const preview = await buildMinhHongSourceImportPreviewFromExports([{
      buffer: await buildUnifiedPartnerDiscountSourceWorkbook(storedPercent, "0%"),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }], "partners");
    const parsed = await parseMinhHongAdminWorkbook(preview.buffer);

    assert.equal(parsed.errors.some((error) => error.message.includes("khoảng 0 đến 100%")), true);
  });
}

test("blocks a raw Sheet discount percentage with trailing text", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildUnifiedPartnerDiscountSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getRow(sheet.rowCount).getCell(13).value = "15abc";

  const preview = await buildMinhHongSourceImportPreviewFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);

  assert.equal(parsed.errors.some((error) => error.message.includes("khoảng 0 đến 100%")), true);
});

test("excludes source_id column L but includes discount column M in plan fingerprints", async () => {
  const sourceBuffer = await buildUnifiedPartnerDiscountSourceWorkbook();
  const baselineExports: SourceExport[] = [{
    buffer: sourceBuffer,
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }];
  const baselinePlan = await buildMinhHongSourceIdPlanFromExports(baselineExports, "partners");

  const identityWorkbook = new ExcelJS.Workbook();
  await identityWorkbook.xlsx.load(sourceBuffer as unknown as Parameters<typeof identityWorkbook.xlsx.load>[0]);
  const identitySheet = identityWorkbook.getWorksheet("Đơn đối tác");
  assert.ok(identitySheet);
  identitySheet.getRow(identitySheet.rowCount).getCell(12).value = `MH_${"B".repeat(32)}`;
  const identityPlan = await buildMinhHongSourceIdPlanFromExports([{
    ...baselineExports[0],
    buffer: Buffer.from(await identityWorkbook.xlsx.writeBuffer()),
  }], "partners");

  const businessWorkbook = new ExcelJS.Workbook();
  await businessWorkbook.xlsx.load(sourceBuffer as unknown as Parameters<typeof businessWorkbook.xlsx.load>[0]);
  const businessSheet = businessWorkbook.getWorksheet("Đơn đối tác");
  assert.ok(businessSheet);
  businessSheet.getRow(businessSheet.rowCount).getCell(13).value = 10;
  const businessPlan = await buildMinhHongSourceIdPlanFromExports([{
    ...baselineExports[0],
    buffer: Buffer.from(await businessWorkbook.xlsx.writeBuffer()),
  }], "partners");

  assert.equal(identityPlan.fingerprint, baselinePlan.fingerprint);
  assert.notEqual(businessPlan.fingerprint, baselinePlan.fingerprint);
});

test("requires setup when the unified partner Sheet is missing discount column M", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.canApply, true);
  assert.equal(plan.assignments.some((assignment) => (
    assignment.range === "'Đơn đối tác'!M1"
    && assignment.value === "Chiết khấu (%)"
  )), true);
  assert.equal(plan.requiresSetup, true);
});

test("refuses to overwrite an occupied partner discount header cell", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getRow(1).getCell(13).value = "Dữ liệu khác";

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.canApply, false);
  assert.equal(plan.headerConflicts.some((issue) => issue.includes("M1")), true);
  assert.equal(plan.assignments.some((assignment) => assignment.range === "'Đơn đối tác'!M1"), false);
});

test("requires setup when the partner discount column exists but is hidden", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerDiscountSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getColumn(13).hidden = true;

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.requiresSetup, true);
});

test("requires setup when the visible partner discount column lacks format or validation", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerDiscountSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getColumn(13).hidden = false;

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.requiresSetup, true);
});

test("requires setup when only the first future partner discount cell is prepared", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getColumn(13).hidden = false;
  sheet.getRow(1).getCell(13).value = "Chiết khấu (%)";
  const setupCell = sheet.getRow(2).getCell(13);
  setupCell.numFmt = 'General"%"';
  setupCell.dataValidation = {
    allowBlank: true,
    formulae: ["AND(ISNUMBER(M2),M2>=0,M2<=100)"],
    showErrorMessage: true,
    type: "custom",
  };

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.requiresSetup, true);
});

test("treats the fully prepared future partner discount range as ready", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getColumn(13).hidden = false;
  sheet.getRow(1).getCell(13).value = "Chiết khấu (%)";
  const lastPreparedRow = sheet.rowCount;
  for (let rowNumber = 2; rowNumber <= lastPreparedRow; rowNumber += 1) {
    const setupCell = sheet.getRow(rowNumber).getCell(13);
    setupCell.numFmt = 'General"%"';
    setupCell.dataValidation = {
      allowBlank: true,
      formulae: [`AND(ISNUMBER(M${rowNumber}),M${rowNumber}>=0,M${rowNumber}<=100)`],
      showErrorMessage: true,
      type: "custom",
    };
  }

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.requiresSetup, false);
});

test("accepts Google-exported discount validation anchored to the first prepared row", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.getColumn(12).hidden = true;
  sheet.getColumn(13).hidden = false;
  sheet.getRow(1).getCell(13).value = "Chiết khấu (%)";
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const setupCell = sheet.getRow(rowNumber).getCell(13);
    setupCell.numFmt = 'General"%"';
    setupCell.dataValidation = {
      allowBlank: true,
      formulae: ["AND(ISNUMBER(M2),M2>=0,M2<=100)"],
      showErrorMessage: true,
      type: "custom",
    };
  }

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.assignments.length, 0);
  assert.equal(plan.requiresSetup, false);
});

test("treats partner discount column M as business data during source_id preflight", async () => {
  const sourceExports: SourceExport[] = [{
    buffer: await buildUnifiedPartnerDiscountSourceWorkbook(),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }];
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
  const discountCheck = plan.rowChecks.find((rowCheck) => rowCheck.sourceId === `MH_${"A".repeat(32)}`);
  assert.ok(discountCheck);
  const target = sourceIdTarget(discountCheck);
  const canonicalRow = sourceIdPreflightValues(
    discountCheck.rowFingerprint,
    discountCheck.sourceId,
    "discount row",
    target.sourceIdColumn
  );

  assert.equal(canonicalRow.length, 13);
  assert.equal(canonicalRow[11], discountCheck.sourceId);
  assert.equal(canonicalRow[12], 15);

  let attemptedWrite = false;
  await withGoogleServiceAccountCredentials(async () => {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (href.endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        const rows = ranges.map((range) => {
          const rowCheck = plan.rowChecks.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(rowCheck, `unexpected preflight range ${range}`);
          const rowTarget = sourceIdTarget(rowCheck);
          const values = sourceIdPreflightValues(
            rowCheck.rowFingerprint,
            rowCheck.sourceId,
            range,
            rowTarget.sourceIdColumn
          );
          if (rowCheck === discountCheck) values[12] = 10;
          return values;
        });
        return sourceIdDataFilterResponse(ranges, rows);
      }

      attemptedWrite = true;
      throw new Error("unexpected source_id write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(plan, plan.fingerprint, sourceExports, fetchImpl as typeof fetch, "partners"),
      MinhHongSourceIdPlanChangedError
    );
  });
  assert.equal(attemptedWrite, false);
});

test("accepts Google preflight ranges trimmed before an empty partner discount column", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const sourceExports: SourceExport[] = [{
      buffer: await buildUnifiedPartnerSourceWorkbook(),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const appendBodies: Array<{ requests?: unknown[] }> = [];
    const writeBodies: Array<{ data?: Array<{ range?: string; values?: unknown[][] }> }> = [];
    let preflightReads = 0;

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).endsWith(":batchGetByDataFilter")) {
        preflightReads += 1;
        const ranges = sourceIdDataFilterRanges(init);
        return {
          json: async () => ({
            valueRanges: ranges.toReversed().map((range) => {
              const rowCheck = plan.rowChecks.find((candidate) => sourceIdPreflightRange(candidate) === range);
              assert.ok(rowCheck, `unexpected preflight range ${range}`);
              const target = sourceIdTarget(rowCheck);
              const values = sourceIdPreflightValues(
                rowCheck.rowFingerprint,
                rowCheck.sourceId,
                range,
                target.sourceIdColumn
              );
              if (values.at(-1) === "") values.pop();
              return {
                dataFilters: [{ a1Range: range }],
                valueRange: {
                  range: range.replace(/:M(\d+)$/, ":L$1"),
                  values: [values],
                },
              };
            }),
          }),
          ok: true,
        } as Response;
      }

      if (String(url).endsWith("?fields=sheets.properties(sheetId,title,gridProperties(columnCount))")) {
        return {
          json: async () => ({
            sheets: [{
              properties: {
                gridProperties: { columnCount: 12 },
                sheetId: 42,
                title: "Đơn đối tác",
              },
            }],
          }),
          ok: true,
        } as Response;
      }

      if (String(url) === "https://sheets.googleapis.com/v4/spreadsheets/unified-sheet-id:batchUpdate") {
        appendBodies.push(JSON.parse(String(init?.body || "{}")));
        return { json: async () => ({}), ok: true } as Response;
      }

      const writeBody = JSON.parse(String(init?.body || "{}"));
      writeBodies.push(writeBody);
      return { json: async () => ({ totalUpdatedCells: writeBody.data?.length || 0 }), ok: true } as Response;
    };

    const result = await applyMinhHongSourceIdPlan(
      plan,
      plan.fingerprint,
      sourceExports,
      fetchImpl as typeof fetch,
      "partners"
    );

    assert.equal(result.updatedCells, 1);
    assert.equal(preflightReads, 2);
    assert.deepEqual(appendBodies[0]?.requests, [{
      appendDimension: { dimension: "COLUMNS", length: 1, sheetId: 42 },
    }]);
    assert.deepEqual(writeBodies[0]?.data, [{ range: "'Đơn đối tác'!M1", values: [["Chiết khấu (%)"]] }]);
  });
});

test("refuses the header write when the Sheet changes after appending column M", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const sourceExports: SourceExport[] = [{
      buffer: await buildUnifiedPartnerSourceWorkbook(),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    let preflightReads = 0;
    let attemptedValueWrite = false;

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).endsWith(":batchGetByDataFilter")) {
        preflightReads += 1;
        const ranges = sourceIdDataFilterRanges(init);
        return {
          json: async () => ({
            valueRanges: ranges.map((range) => {
              const rowCheck = plan.rowChecks.find((candidate) => sourceIdPreflightRange(candidate) === range);
              assert.ok(rowCheck, `unexpected preflight range ${range}`);
              const target = sourceIdTarget(rowCheck);
              const values = sourceIdPreflightValues(
                rowCheck.rowFingerprint,
                rowCheck.sourceId,
                range,
                target.sourceIdColumn
              );
              if (preflightReads === 2 && rowCheck.rowNumber === 1) values[12] = "Tiêu đề từ người khác";
              if (values.at(-1) === "") values.pop();
              return {
                dataFilters: [{ a1Range: range }],
                valueRange: {
                  range: preflightReads === 2 && rowCheck.rowNumber === 1
                    ? range
                    : range.replace(/:M(\d+)$/, ":L$1"),
                  values: [values],
                },
              };
            }),
          }),
          ok: true,
        } as Response;
      }
      if (String(url).endsWith("?fields=sheets.properties(sheetId,title,gridProperties(columnCount))")) {
        return {
          json: async () => ({
            sheets: [{
              properties: {
                gridProperties: { columnCount: 12 },
                sheetId: 42,
                title: "Đơn đối tác",
              },
            }],
          }),
          ok: true,
        } as Response;
      }
      if (String(url).endsWith(":batchUpdate")) {
        return { json: async () => ({}), ok: true } as Response;
      }
      attemptedValueWrite = true;
      throw new Error("unexpected value write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(
        plan,
        plan.fingerprint,
        sourceExports,
        fetchImpl as typeof fetch,
        "partners"
      ),
      MinhHongSourceIdPlanChangedError
    );
    assert.equal(preflightReads, 2);
    assert.equal(attemptedValueWrite, false);
  });
});

test("fails before requesting a private source Sheet when Google credentials are missing", async () => {
  let requests = 0;
  const fetchImpl: typeof fetch = async () => {
    requests += 1;
    return new Response();
  };

  await assert.rejects(
    withoutGoogleServiceAccountCredentials(() => fetchMinhHongSourceSheetExports(fetchImpl)),
    /Kết nối Google Sheet chưa được cấu hình trên máy chủ/
  );
  assert.equal(requests, 0);
});

test("fetches only the legacy source Sheet for service-order imports", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    requests.push({ init, url });
    if (url.includes("oauth2.googleapis.com/token")) {
      return Response.json({ access_token: "service-order-token" });
    }
    return {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      ok: true,
      status: 200,
      statusText: "OK",
    } as Response;
  };

  const exports = await withGoogleServiceAccountCredentials(() => (
    fetchMinhHongSourceSheetExports(fetchImpl, "service-orders")
  ));
  const exportRequests = requests.filter((request) => request.url.includes("docs.google.com/spreadsheets"));

  assert.deepEqual(exports.map((item) => item.kind), ["legacy"]);
  assert.deepEqual(exportRequests.map((request) => request.url), [buildSourceSheetExportUrl(MINHHONG_SOURCE_SHEET_EXPORTS[0].spreadsheetId)]);
  assert.equal(exportRequests.some((request) => request.url.includes("batchUpdate") || request.init?.method === "POST"), false);
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

    assert.equal(exports.length, 1);
    assert.equal(requested.some((request) => request.url.includes("oauth2.googleapis.com/token")), true);
    assert.equal(exportRequests.length, 1);
    assert.deepEqual(
      exportRequests.map((request) => (request.init?.headers as Record<string, string>)?.Authorization),
      ["Bearer private-sheet-token"]
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
  assert.equal(plan.headerWrites, plan.targets.length);
  assert.equal(headerAssignments.length, plan.targets.length);
  assert.equal(rowAssignments.length, plan.missingRows);
  assert.equal(plan.assignments.length, plan.headerWrites + plan.missingRows);
  assert.ok(plan.missingRows > 0, "fixture should contain source business rows without source_id");
  assert.equal(new Set(rowAssignments.map((assignment) => assignment.value)).size, rowAssignments.length);
  assert.ok(rowAssignments.every((assignment) => MINHHONG_SOURCE_ID_PATTERN.test(assignment.value)));

  for (const target of MINHHONG_SOURCE_ID_TARGETS.filter((candidate) =>
    plan.targets.some((summary) => summary.id === candidate.id)
  )) {
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

test("applies source_id assignments when preflight formulas use localized separators and lack cached results", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);
  const sourceWorkbooks = {
    legacy: new ExcelJS.Workbook(),
    manual: new ExcelJS.Workbook(),
  };
  await sourceWorkbooks.legacy.xlsx.load(
    sourceExports[0].buffer as unknown as Parameters<typeof sourceWorkbooks.legacy.xlsx.load>[0]
  );
  await sourceWorkbooks.manual.xlsx.load(
    sourceExports[1].buffer as unknown as Parameters<typeof sourceWorkbooks.manual.xlsx.load>[0]
  );

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

      if (String(url).endsWith(":batchGetByDataFilter")) {
        const body = JSON.parse(String(init?.body || "{}"));
        const ranges = (body.dataFilters as Array<{ a1Range: string }>).map((filter) => filter.a1Range);
        const assignments = ranges.map((range) => {
          const assignment = plan.assignments.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(assignment, `unexpected preflight range ${range}`);
          return assignment;
        });
        return {
          json: async () => ({
            valueRanges: assignments.toReversed().map((assignment) => {
              const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => (
                item.kind === assignment.kind && item.sheetName === assignment.sheetName
              ));
              assert.ok(target);
              const worksheet = sourceWorkbooks[assignment.kind].getWorksheet(assignment.sheetName);
              assert.ok(worksheet);
              const values = sourceIdPreflightRow(assignment);
              for (let column = 1; column < target.sourceIdColumn; column += 1) {
                const formula = worksheet.getRow(assignment.rowNumber).getCell(column).formula;
                if (formula) values[column - 1] = `=${formula.replace(/,/g, ";")}`;
              }
              return {
                dataFilters: [{ a1Range: sourceIdPreflightRange(assignment) }],
                valueRange: {
                  range: sourceIdPreflightRange(assignment),
                  values: [values],
                },
              };
            }),
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

    const result = await applyMinhHongSourceIdPlan(plan, plan.fingerprint, sourceExports, fetchImpl as typeof fetch);
    const batchRequests = requests.filter((request) => request.url.endsWith("/values:batchUpdate"));
    const preflightRequests = requests.filter((request) => request.url.endsWith(":batchGetByDataFilter"));
    const sheetRequests = requests.filter((request) => request.url.includes("sheets.googleapis.com"));

    assert.equal(result.updatedCells, plan.assignments.length);
    assert.equal(preflightRequests.length, 2);
    assert.equal(batchRequests.length, 2);
    assert.equal(sheetRequests.length, preflightRequests.length + batchRequests.length);
    assert.equal(
      preflightRequests.reduce((count, request) => {
        const body = JSON.parse(String(request.init?.body || "{}"));
        assert.equal(request.init?.method, "POST");
        assert.equal(body.majorDimension, "ROWS");
        assert.equal(body.valueRenderOption, "FORMULA");
        assert.equal(body.dateTimeRenderOption, "SERIAL_NUMBER");
        return count + body.dataFilters.length;
      }, 0),
      plan.rowChecks.length
    );
    assert.ok(sheetRequests.slice(0, preflightRequests.length).every((request) => request.url.endsWith(":batchGetByDataFilter")));
    assert.ok(sheetRequests.slice(preflightRequests.length).every((request) => request.url.endsWith("/values:batchUpdate")));
    assert.deepEqual(
      new Set(sheetRequests.slice(0, preflightRequests.length).map((request) => request.url.match(/\/spreadsheets\/([^/]+)/)?.[1])),
      new Set(sheetRequests.slice(preflightRequests.length).map((request) => request.url.match(/\/spreadsheets\/([^/]+)/)?.[1]))
    );
    for (const request of preflightRequests) {
      const body = JSON.parse(String(request.init?.body || "{}"));
      assert.ok(body.dataFilters.every((filter: { a1Range: string }) => /!A\d+:[A-Z]+\d+$/.test(filter.a1Range)));
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

test("accepts localized formula separators during partner row preflight", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    sheet.getRow(1).getCell(13).value = "Chiết khấu (%)";
    sheet.fillFormula(
      `G2:G${sheet.rowCount}`,
      '=IF(OR($C2<>"Mua hàng",$E2="",$F2=""),"",ROUND($E2*$F2,0))'
    );
    sheet.fillFormula(`J2:J${sheet.rowCount}`, legacyPartnerPayableFormula(2));

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    assert.equal(plan.assignments.length, 0);

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        return {
          json: async () => ({
            valueRanges: ranges.map((range) => {
              const rowCheck = plan.rowChecks.find((candidate) => sourceIdPreflightRange(candidate) === range);
              assert.ok(rowCheck, `unexpected preflight range ${range}`);
              const target = sourceIdTarget(rowCheck);
              const values = sourceIdPreflightValues(
                rowCheck.rowFingerprint,
                rowCheck.sourceId,
                range,
                target.sourceIdColumn
              );
              for (let column = 0; column < values.length; column += 1) {
                const value = values[column];
                if (typeof value === "string" && value.startsWith("=")) {
                  values[column] = value.replace(/,/g, ";");
                }
              }
              return {
                dataFilters: [{ a1Range: range }],
                valueRange: { range, values: [values] },
              };
            }),
          }),
          ok: true,
        } as Response;
      }
      throw new Error(`unexpected request ${url}`);
    };

    const result = await applyMinhHongSourceIdPlan(
      plan,
      plan.fingerprint,
      sourceExports,
      fetchImpl as typeof fetch,
      "partners"
    );
    assert.equal(result.updatedCells, 0);
  });
});

test("refuses every source_id write when an already-stamped row changes during final preflight", async () => {
  const originalExports = buildSourceExports();
  const originalPlan = await buildMinhHongSourceIdPlanFromExports(originalExports, "service-orders");
  const stampedAssignment = originalPlan.assignments.find((assignment) => (
    assignment.value !== "source_id" && assignment.rowNumber === 4
  ));
  assert.ok(stampedAssignment);

  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(
    originalExports[0].buffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]
  );
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === "customer-orders");
  assert.ok(target);
  const worksheet = legacyWorkbook.getWorksheet(target.sheetName);
  assert.ok(worksheet);
  worksheet.getRow(stampedAssignment.rowNumber).getCell(target.sourceIdColumn).value = stampedAssignment.value;

  const sourceExports = buildSourceExports(
    Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    Buffer.from(originalExports[1].buffer)
  ).filter((source) => source.kind === "legacy");
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "service-orders");
  const stampedRange = sourceIdPreflightRange(stampedAssignment);
  let attemptedWrite = false;

  await withGoogleServiceAccountCredentials(async () => {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (href.endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        const rows = ranges.map((range) => {
          if (range === stampedRange) {
            const changedRow = sourceIdPreflightRow(stampedAssignment);
            changedRow[0] = "Khach da thay doi sau preview";
            changedRow[changedRow.length - 1] = stampedAssignment.value;
            return changedRow;
          }
          const assignment = plan.assignments.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(assignment, `unexpected preflight range ${range}`);
          return sourceIdPreflightRow(assignment);
        });
        return sourceIdDataFilterResponse(ranges, rows);
      }

      attemptedWrite = true;
      const body = JSON.parse(String(init?.body || "{}"));
      return { json: async () => ({ totalUpdatedCells: body.data?.length || 0 }), ok: true } as Response;
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(
        plan,
        plan.fingerprint,
        sourceExports,
        fetchImpl as typeof fetch,
        "service-orders"
      ),
      MinhHongSourceIdPlanChangedError
    );
  });

  assert.equal(attemptedWrite, false);
});

test("keeps first-time setup retryable until the technical source_id column is hidden", async () => {
  const stamped = await buildSourceWorkbooksWithAssignedIds();
  const visibleExports = buildSourceExports(stamped.legacyBuffer, stamped.manualBuffer)
    .filter((source) => source.kind === "legacy");
  const visiblePlan = await buildMinhHongSourceIdPlanFromExports(visibleExports, "service-orders");

  assert.equal(visiblePlan.assignments.length, 0);
  assert.equal(visiblePlan.requiresSetup, true);

  const legacyWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(
    stamped.legacyBuffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]
  );
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === "customer-orders");
  assert.ok(target);
  const worksheet = legacyWorkbook.getWorksheet(target.sheetName);
  assert.ok(worksheet);
  worksheet.getColumn(target.sourceIdColumn).hidden = true;

  const hiddenExports = buildSourceExports(
    Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    stamped.manualBuffer
  ).filter((source) => source.kind === "legacy");
  const hiddenPlan = await buildMinhHongSourceIdPlanFromExports(hiddenExports, "service-orders");

  assert.equal(hiddenPlan.assignments.length, 0);
  assert.equal(hiddenPlan.requiresSetup, false);
});

test("revalidates source rows before retrying a failed technical-column hide", async () => {
  const stamped = await buildSourceWorkbooksWithAssignedIds();
  const sourceExports = buildSourceExports(stamped.legacyBuffer, stamped.manualBuffer)
    .filter((source) => source.kind === "legacy");
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "service-orders");
  const changedCheck = plan.rowChecks.find((rowCheck) => rowCheck.rowNumber === 4);
  assert.ok(changedCheck);
  let attemptedMetadataWrite = false;

  await withGoogleServiceAccountCredentials(async () => {
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (href.endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        const rows = ranges.map((range) => {
          const rowCheck = plan.rowChecks.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(rowCheck, `unexpected preflight range ${range}`);
          const target = sourceIdTarget(rowCheck);
          const values = sourceIdPreflightValues(rowCheck.rowFingerprint, rowCheck.sourceId, range, target.sourceIdColumn);
          if (rowCheck === changedCheck) values[0] = "Khach da thay doi truoc khi an cot";
          return values;
        });
        return sourceIdDataFilterResponse(ranges, rows);
      }

      attemptedMetadataWrite = true;
      throw new Error("unexpected Google Sheet metadata write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(
        plan,
        plan.fingerprint,
        sourceExports,
        fetchImpl as typeof fetch,
        "service-orders"
      ),
      MinhHongSourceIdPlanChangedError
    );
  });

  assert.equal(attemptedMetadataWrite, false);
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
      if (String(url).endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        const rows = ranges.map((range) => {
          const assignment = plan.assignments.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(assignment, `unexpected preflight range ${range}`);
          return sourceIdPreflightRow(assignment);
        });
        return sourceIdDataFilterResponse(ranges, rows);
      }
      const body = JSON.parse(String(init?.body || "{}"));
      return { json: async () => ({ totalUpdatedCells: body.data.length }), ok: true } as Response;
    };

    const result = await applyMinhHongSourceIdPlan(
      plan,
      plan.fingerprint,
      sourceExports,
      fetchImpl as typeof fetch,
      "service-orders"
    );

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

    await applyMinhHongSourceSheetSetup(plan, buildSourceExports(), fetchImpl as typeof fetch);

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

test("prepares the unified partner discount column as visible validated percentages", async () => {
  const originalEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const originalKey = process.env.GOOGLE_PRIVATE_KEY;
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const sourceExports: SourceExport[] = [{
    buffer: await buildUnifiedPartnerSourceWorkbook(),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }];
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");

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
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const batchRequest = requests.find((request) => request.url.endsWith(":batchUpdate"));
    assert.ok(batchRequest);
    const body = JSON.parse(String(batchRequest.init?.body || "{}"));
    assert.deepEqual(body.requests, [
      {
        updateDimensionProperties: {
          range: { dimension: "COLUMNS", endIndex: 12, sheetId: 42, startIndex: 11 },
          properties: { hiddenByUser: true },
          fields: "hiddenByUser",
        },
      },
      {
        updateDimensionProperties: {
          range: { dimension: "COLUMNS", endIndex: 13, sheetId: 42, startIndex: 12 },
          properties: { hiddenByUser: false },
          fields: "hiddenByUser",
        },
      },
      {
        repeatCell: {
          range: { sheetId: 42, startColumnIndex: 12, startRowIndex: 1, endColumnIndex: 13 },
          cell: {
            dataValidation: {
              condition: {
                type: "CUSTOM_FORMULA",
                values: [{ userEnteredValue: "=AND(ISNUMBER(M2);M2>=0;M2<=100)" }],
              },
              inputMessage: "Nhập số từ 0 đến 100, ví dụ 15 hoặc 15,5.",
              strict: true,
            },
            userEnteredFormat: {
              numberFormat: { type: "NUMBER", pattern: 'General"%"' },
            },
          },
          fields: "dataValidation,userEnteredFormat.numberFormat",
        },
      },
    ]);
  } finally {
    if (originalEmail === undefined) delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    else process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = originalEmail;
    if (originalKey === undefined) delete process.env.GOOGLE_PRIVATE_KEY;
    else process.env.GOOGLE_PRIVATE_KEY = originalKey;
  }
});

test("repairs future partner payable formulas to subtract purchase discounts", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    sheet.fillFormula("J2:J100", legacyPartnerPayableFormula(2));

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const batchBodies: Array<{ requests?: PartnerPayableSetupRequest[] }> = [];

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        const formulaRange = decodeURIComponent(String(url)).match(/J(\d+):J(\d+)/);
        assert.ok(formulaRange);
        const startRow = Number(formulaRange[1]);
        const endRow = Number(formulaRange[2]);
        return {
          json: async () => ({
            values: Array.from(
              { length: endRow - startRow + 1 },
              (_, index) => [legacyPartnerPayableFormula(startRow + index, ";")]
            ),
          }),
          ok: true,
        } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const formulaFill = batchBodies[0]?.requests?.find((request) => (
      request.repeatCell?.range?.startColumnIndex === 9
      && Boolean(request.repeatCell?.cell?.userEnteredValue?.formulaValue)
    ))?.repeatCell;
    assert.deepEqual(formulaFill, {
      range: {
        endColumnIndex: 10,
        endRowIndex: 100,
        sheetId: 42,
        startColumnIndex: 9,
        startRowIndex: 88,
      },
      cell: {
        userEnteredValue: {
          formulaValue: buildPartnerPayableSheetFormula(89),
        },
      },
      fields: "userEnteredValue",
    });
    assert.doesNotMatch(formulaFill?.cell?.userEnteredValue?.formulaValue || "", /MAKEARRAY/);
    assert.equal(batchBodies[0]?.requests?.some((request) => (
      request.updateCells?.range?.startColumnIndex === 9
    )), false);
  });
});

test("repairs one reverted payable formula among otherwise current rows", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    sheet.fillFormula("J2:J88", legacyPartnerPayableFormula(2));
    sheet.fillFormula("J89:J100", buildPartnerPayableSheetFormula(89, ",").slice(1));
    sheet.getRow(92).getCell(10).value = {
      formula: legacyPartnerPayableFormula(92).replace(/^=/, ""),
      result: 12_335_000,
    };

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const partnerTarget = plan.targets.find((target) => target.id === "partner-ledger");
    assert.equal(partnerTarget?.payableFormulaReady, false);
    assert.equal(partnerTarget?.payableFormulaStartRow, 89);
    assert.equal(partnerTarget?.payableFormulaEndRow, 100);
    const batchBodies: Array<{ requests?: PartnerPayableSetupRequest[] }> = [];

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{
            properties: { sheetId: 42, title: "Đơn đối tác" },
            protectedRanges: [{
              protectedRangeId: 17,
              range: {
                endColumnIndex: 10,
                endRowIndex: 100,
                sheetId: 42,
                startColumnIndex: 9,
                startRowIndex: 88,
              },
              warningOnly: true,
            }],
          }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        const formulaRange = decodeURIComponent(String(url)).match(/J(\d+):J(\d+)/);
        assert.ok(formulaRange);
        const startRow = Number(formulaRange[1]);
        const endRow = Number(formulaRange[2]);
        return {
          json: async () => ({
            values: Array.from({ length: endRow - startRow + 1 }, (_, index) => {
              const formula = sheet.getRow(startRow + index).getCell(10).formula;
              return [formula ? (formula.startsWith("=") ? formula : `=${formula}`) : ""];
            }),
          }),
          ok: true,
        } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const formulaFill = batchBodies[0]?.requests?.find((request) => (
      request.repeatCell?.range?.startColumnIndex === 9
      && Boolean(request.repeatCell?.cell?.userEnteredValue?.formulaValue)
    ))?.repeatCell;
    assert.equal(formulaFill?.range?.startRowIndex, 88);
    assert.equal(formulaFill?.range?.endRowIndex, 100);
    assert.equal(
      formulaFill?.cell?.userEnteredValue?.formulaValue,
      buildPartnerPayableSheetFormula(89)
    );
    assert.equal(batchBodies[0]?.requests?.some((request) => (
      request.updateCells?.range?.startColumnIndex === 9
    )), false);
  });
});

test("treats canonical independent payable formulas as ready", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  sheet.fillFormula("J2:J88", legacyPartnerPayableFormula(2));
  sheet.getRow(100).getCell(13).numFmt = 'General"%"';
  sheet.fillFormula("J89:J100", buildPartnerPayableSheetFormula(89, ",").slice(1));

  const sourceExports: SourceExport[] = [{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }];
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
  const partnerTarget = plan.targets.find((target) => target.id === "partner-ledger");

  assert.equal(partnerTarget?.payableFormulaReady, true);
  assert.equal(partnerTarget?.payableFormulaStartRow, 89);
  assert.equal(partnerTarget?.payableFormulaEndRow, 100);
});

test("restricts edits to future partner payable formulas", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    sheet.fillFormula("J2:J100", legacyPartnerPayableFormula(2));

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const batchBodies: Array<{ requests?: Array<Record<string, unknown>> }> = [];
    let metadataReads = 0;

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        metadataReads += 1;
        return {
          json: async () => ({ sheets: [{
            properties: { sheetId: 42, title: "Đơn đối tác" },
            ...(metadataReads >= 2 ? {
              protectedRanges: [{
                description: "Minh Hồng: công thức công nợ tự động",
                protectedRangeId: 17,
                range: {
                  endColumnIndex: 10,
                  endRowIndex: 100,
                  sheetId: 42,
                  startColumnIndex: 9,
                  startRowIndex: 88,
                },
                ...(metadataReads === 2 ? { warningOnly: true } : {}),
              }],
            } : {}),
          }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        const formulaRange = decodeURIComponent(String(url)).match(/J(\d+):J(\d+)/);
        assert.ok(formulaRange);
        const startRow = Number(formulaRange[1]);
        const endRow = Number(formulaRange[2]);
        return {
          json: async () => ({
            values: Array.from(
              { length: endRow - startRow + 1 },
              (_, index) => [legacyPartnerPayableFormula(startRow + index, ";")]
            ),
          }),
          ok: true,
        } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);
    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);
    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const protection = batchBodies[0]?.requests?.find((request) => "addProtectedRange" in request);
    assert.deepEqual(protection, {
      addProtectedRange: {
        protectedRange: {
          description: "Minh Hồng: công thức công nợ tự động",
          range: {
            endColumnIndex: 10,
            endRowIndex: 100,
            sheetId: 42,
            startColumnIndex: 9,
            startRowIndex: 88,
          },
          warningOnly: false,
        },
      },
    });
    const protectionUpdate = batchBodies[1]?.requests?.find((request) => "updateProtectedRange" in request);
    assert.deepEqual(protectionUpdate, {
      updateProtectedRange: {
        fields: "description,range,warningOnly",
        protectedRange: {
          description: "Minh Hồng: công thức công nợ tự động",
          protectedRangeId: 17,
          range: {
            endColumnIndex: 10,
            endRowIndex: 100,
            sheetId: 42,
            startColumnIndex: 9,
            startRowIndex: 88,
          },
          warningOnly: false,
        },
      },
    });
    assert.equal(batchBodies[2]?.requests?.some((request) => (
      "addProtectedRange" in request || "updateProtectedRange" in request
    )), false);
  });
});

test("formats existing raw discount values without rescaling them", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    sheet.getRow(4).getCell(13).value = 15;
    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const batchBodies: Array<{ requests?: Array<{ repeatCell?: { range?: { startRowIndex?: number } } }> }> = [];

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        return { json: async () => ({ values: [[], [], [15]] }), ok: true } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const repeatCell = batchBodies[0]?.requests?.find((request) => request.repeatCell)?.repeatCell;
    assert.equal(repeatCell?.range?.startRowIndex, 1);
  });
});

test("migrates legacy scaling discount values before applying the literal-percent format", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    const discountCell = sheet.getRow(4).getCell(13);
    discountCell.value = 0.15;
    discountCell.numFmt = "0%";

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const batchBodies: Array<{ requests?: Array<Record<string, unknown>> }> = [];

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("includeGridData=true")) {
        return {
          json: async () => ({
            sheets: [{ data: [{ rowData: [{ values: [{
              userEnteredFormat: { numberFormat: { pattern: "0%" } },
              userEnteredValue: { numberValue: 0.15 },
            }] }] }] }],
          }),
          ok: true,
        } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const valueRepair = batchBodies[0]?.requests?.find((request) => "updateCells" in request);
    assert.deepEqual(valueRepair, {
      updateCells: {
        range: {
          endColumnIndex: 13,
          endRowIndex: 4,
          sheetId: 42,
          startColumnIndex: 12,
          startRowIndex: 3,
        },
        rows: [{ values: [{ userEnteredValue: { numberValue: 15 } }] }],
        fields: "userEnteredValue",
      },
    });
  });
});

test("blocks automatic setup for a formula-valued legacy scaling discount", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
  );
  const sheet = workbook.getWorksheet("Đơn đối tác");
  assert.ok(sheet);
  const discountCell = sheet.getRow(4).getCell(13);
  discountCell.value = { formula: "15/100", result: 0.15 };
  discountCell.numFmt = "0%";

  const plan = await buildMinhHongSourceIdPlanFromExports([{
    buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
    kind: "legacy",
    spreadsheetId: "unified-sheet-id",
  }], "partners");

  assert.equal(plan.canApply, false);
  assert.equal(plan.headerConflicts.some((issue) => issue.includes("M4") && issue.includes("công thức")), true);
});

test("refuses a legacy discount migration when the live number format changed", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      await buildUnifiedPartnerSourceWorkbook() as unknown as Parameters<typeof workbook.xlsx.load>[0]
    );
    const sheet = workbook.getWorksheet("Đơn đối tác");
    assert.ok(sheet);
    const discountCell = sheet.getRow(4).getCell(13);
    discountCell.value = 0.15;
    discountCell.numFmt = "0%";

    const sourceExports: SourceExport[] = [{
      buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    let attemptedWrite = false;

    const fetchImpl = async (url: string | URL) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("includeGridData=true")) {
        return {
          json: async () => ({
            sheets: [{ data: [{ rowData: [{ values: [{
              userEnteredFormat: { numberFormat: { pattern: '0"%"' } },
              userEnteredValue: { numberValue: 0.15 },
            }] }] }] }],
          }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        return { json: async () => ({ values: [[0.15]] }), ok: true } as Response;
      }
      attemptedWrite = true;
      return { json: async () => ({}), ok: true } as Response;
    };

    await assert.rejects(
      () => applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch),
      MinhHongSourceIdPlanChangedError
    );
    assert.equal(attemptedWrite, false);
  });
});

test("formats the full discount column when a raw value appears after planning", async () => {
  await withGoogleServiceAccountCredentials(async () => {
    const sourceExports: SourceExport[] = [{
      buffer: await buildUnifiedPartnerSourceWorkbook(),
      kind: "legacy",
      spreadsheetId: "unified-sheet-id",
    }];
    const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports, "partners");
    const batchBodies: Array<{ requests?: Array<{ repeatCell?: { range?: { startRowIndex?: number } } }> }> = [];

    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return { json: async () => ({ access_token: "source-id-token" }), ok: true } as Response;
      }
      if (String(url).includes("?fields=sheets.properties")) {
        return {
          json: async () => ({ sheets: [{ properties: { sheetId: 42, title: "Đơn đối tác" } }] }),
          ok: true,
        } as Response;
      }
      if (String(url).includes("/values/")) {
        return { json: async () => ({ values: [[], [], [15]] }), ok: true } as Response;
      }
      batchBodies.push(JSON.parse(String(init?.body || "{}")));
      return { json: async () => ({}), ok: true } as Response;
    };

    await applyMinhHongSourceSheetSetup(plan, sourceExports, fetchImpl as typeof fetch);

    const repeatCell = batchBodies[0]?.requests?.find((request) => request.repeatCell)?.repeatCell;
    assert.equal(repeatCell?.range?.startRowIndex, 1);
  });
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
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "source-id-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      if (href.endsWith(":batchGetByDataFilter")) {
        const ranges = sourceIdDataFilterRanges(init);
        const assignments = ranges.map((range) => {
          const assignment = plan.assignments.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(assignment, `unexpected preflight range ${range}`);
          return assignment;
        });
        const rows = assignments.map(sourceIdPreflightRow);
        const businessIndexes = assignments
          .map((assignment, index) => assignment.value === "source_id" ? -1 : index)
          .filter((index) => index >= 0);
        assert.ok(businessIndexes.length >= 2);
        [rows[businessIndexes[0]], rows[businessIndexes[1]]] = [rows[businessIndexes[1]], rows[businessIndexes[0]]];
        return sourceIdDataFilterResponse(ranges, rows);
      }

      attemptedWrite = true;
      throw new Error("unexpected source_id write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(plan, plan.fingerprint, sourceExports, fetchImpl as typeof fetch),
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
    const fetchImpl = async (url: string | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return {
          json: async () => ({ access_token: "source-id-token" }),
          ok: true,
          status: 200,
          statusText: "OK",
        } as Response;
      }

      if (href.endsWith(":batchGetByDataFilter")) {
        const assignments = sourceIdDataFilterRanges(init).map((range) => {
          const assignment = plan.assignments.find((candidate) => sourceIdPreflightRange(candidate) === range);
          assert.ok(assignment, `unexpected preflight range ${range}`);
          return assignment;
        });
        const returnedAssignments = assignments.slice(0, -1);
        return sourceIdDataFilterResponse(
          returnedAssignments.map(sourceIdPreflightRange),
          returnedAssignments.map(sourceIdPreflightRow)
        );
      }

      attemptedWrite = true;
      throw new Error("unexpected source_id write");
    };

    await assert.rejects(
      () => applyMinhHongSourceIdPlan(plan, plan.fingerprint, sourceExports, fetchImpl as typeof fetch),
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

test("refuses source_id writes when the Sheet no longer matches the reviewed preview", async () => {
  const sourceExports = buildSourceExports();
  const plan = await buildMinhHongSourceIdPlanFromExports(sourceExports);
  let attemptedRequest = false;

  await assert.rejects(
    () => applyMinhHongSourceIdPlan(
      plan,
      "f".repeat(64),
      sourceExports,
      (async () => {
        attemptedRequest = true;
        throw new Error("unexpected Google request");
      }) as typeof fetch
    ),
    MinhHongSourceIdPlanChangedError
  );
  assert.equal(attemptedRequest, false);
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
    () => applyMinhHongSourceIdPlan(plan, plan.fingerprint, changedExports, (async () => {
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

test("reads service-order phones from C first and keeps G/I as historical fallbacks", async () => {
  const buildOrder = async (phoneC: string, phoneG: string, phoneI: string, sourceId: string) => {
    const legacyWorkbook = new ExcelJS.Workbook();
    const sheet = legacyWorkbook.addWorksheet("Đơn hàng đã bán");
    const row = sheet.getRow(4);
    row.getCell(1).value = "Khách kiểm tra SĐT";
    row.getCell(2).value = "Pin kiểm tra";
    row.getCell(3).value = phoneC;
    row.getCell(4).value = 500_000;
    row.getCell(5).value = 500_000;
    row.getCell(7).value = phoneG;
    row.getCell(8).value = "18/07/2026";
    row.getCell(9).value = phoneI;
    row.getCell(12).value = sourceId;

    const workbook = await buildMinhHongSourceImportWorkbook({
      legacyWorkbookBuffer: Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    }, "service-orders");
    const parsed = await parseMinhHongAdminWorkbook(workbook);
    assert.equal(parsed.customerOrders.length, 1);
    return parsed.customerOrders[0];
  };

  const cPreferred = await buildOrder("0901000001", "0902000002", "0903000003", `MH_${"1".repeat(32)}`);
  const gFallback = await buildOrder("", "0902000002", "", `MH_${"2".repeat(32)}`);
  const iFallback = await buildOrder("", "", "0903000003", `MH_${"3".repeat(32)}`);

  assert.equal(cPreferred.customerPhone, "0901000001");
  assert.equal(gFallback.customerPhone, "0902000002");
  assert.equal(iFallback.customerPhone, "0903000003");
});

test("moving the same phone from G into C does not change the imported order", async () => {
  const sourceId = `MH_${"4".repeat(32)}`;
  const buildOrder = async (phoneC: string, phoneG: string) => {
    const legacyWorkbook = new ExcelJS.Workbook();
    const sheet = legacyWorkbook.addWorksheet("Đơn hàng đã bán");
    const row = sheet.getRow(4);
    row.getCell(1).value = "Khách chuyển cột";
    row.getCell(2).value = "Pin chuyển cột";
    row.getCell(3).value = phoneC;
    row.getCell(4).value = 600_000;
    row.getCell(5).value = 600_000;
    row.getCell(7).value = phoneG;
    row.getCell(8).value = "18/07/2026";
    row.getCell(12).value = sourceId;
    const workbook = await buildMinhHongSourceImportWorkbook({
      legacyWorkbookBuffer: Buffer.from(await legacyWorkbook.xlsx.writeBuffer()),
    }, "service-orders");
    return (await parseMinhHongAdminWorkbook(workbook)).customerOrders[0];
  };

  const before = await buildOrder("", "0904000004");
  const after = await buildOrder("0904000004", "");

  assert.equal(after.sourceCode, before.sourceCode);
  assert.equal(after.customerPhone, before.customerPhone);
});

test("builds the service-order preview and first-time setup plan together", async () => {
  const serviceExports = buildSourceExports().filter((source) => source.kind === "legacy");
  const preview = await buildMinhHongSourceImportPreviewFromExports(serviceExports, "service-orders");
  const parsed = await parseMinhHongAdminWorkbook(preview.buffer);

  assert.equal(parsed.customerOrders.length, 41);
  assert.deepEqual(preview.sourceIdPlan.targets.map((target) => target.id), ["customer-orders"]);
  assert.equal(preview.sourceIdPlan.targets[0].totalRows, parsed.customerOrders.length);
  assert.equal(preview.sourceIdPlan.canApply, true);
  assert.ok(preview.sourceIdPlan.assignments.length > 0);
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
