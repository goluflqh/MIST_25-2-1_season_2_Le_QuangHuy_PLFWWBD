import ExcelJS from "exceljs";
import { createHash, randomUUID } from "node:crypto";
import { parseAdminDateInput } from "@/lib/admin-date";
import { formatVietnamDate } from "@/lib/vietnam-time";
import { getGoogleAccessToken, hasGoogleServiceAccountCredentials } from "../google-sheets-sync";
import {
  MINHHONG_CUSTOMER_ORDER_COLUMNS,
  MINHHONG_PARTNER_COLUMNS,
  MINHHONG_PAYMENT_COLUMNS,
  MINHHONG_PURCHASE_COLUMNS,
  MINHHONG_RECONCILIATION_KEYS,
  MINHHONG_RETURN_COLUMNS,
} from "./workbook-contract";
import type { MinhHongImportScope } from "./import-scope";

type SourceExportKind = "legacy" | "manual";

interface SourceWorkbookInput {
  legacyWorkbookBuffer: Buffer;
  manualWorkbookBuffer?: Buffer;
}

export interface SourceExport {
  buffer: Buffer;
  kind: SourceExportKind;
  spreadsheetId: string;
}

type CellValue = unknown;
type SourceIssueLevel = "warning" | "blocking";

export const MINHHONG_SOURCE_ID_PATTERN = /^MH_[0-9A-F]{32}$/;

export const MINHHONG_SOURCE_ID_TARGETS = [
  {
    id: "customer-orders" as const,
    kind: "legacy" as const,
    sheetName: "Đơn hàng đã bán",
    headerRow: 3,
    firstDataRow: 4,
    sourceIdColumn: 12,
  },
  {
    id: "legacy-purchases" as const,
    kind: "legacy" as const,
    sheetName: "Sheet1",
    headerRow: 2,
    firstDataRow: 4,
    sourceIdColumn: 11,
  },
  {
    id: "legacy-returns" as const,
    kind: "legacy" as const,
    sheetName: "Đơn trả lại",
    headerRow: 3,
    firstDataRow: 4,
    sourceIdColumn: 6,
  },
  {
    id: "current-partner-activity" as const,
    kind: "manual" as const,
    sheetName: "Đơn hàng mua từ long",
    headerRow: 1,
    firstDataRow: 3,
    sourceIdColumn: 7,
  },
] as const;

type MinhHongSourceIdTarget = (typeof MINHHONG_SOURCE_ID_TARGETS)[number];

export interface MinhHongSourceIdAssignment {
  kind: SourceExportKind;
  range: string;
  rowFingerprint: string;
  rowNumber: number;
  sheetName: string;
  spreadsheetId: string;
  value: string;
}

export interface MinhHongSourceIdTargetSummary {
  id: MinhHongSourceIdTarget["id"];
  invalidRows: number;
  missingRows: number;
  sheetName: string;
  totalRows: number;
  validRows: number;
}

export interface MinhHongSourceIdPlan {
  assignments: MinhHongSourceIdAssignment[];
  canApply: boolean;
  duplicateRows: number;
  fingerprint: string;
  headerConflicts: string[];
  headerWrites: number;
  invalidRows: number;
  issues: string[];
  missingRows: number;
  targets: MinhHongSourceIdTargetSummary[];
  totalRows: number;
  validRows: number;
}

export class MinhHongSourceIdPlanChangedError extends Error {
  constructor() {
    super("Sheet nguồn đã thay đổi sau lần đọc đầu tiên; chưa ghi source_id. Hãy kiểm tra lại rồi xác nhận lần nữa.");
    this.name = "MinhHongSourceIdPlanChangedError";
  }
}

export class MinhHongSourceIdPartialWriteError extends Error {
  constructor(public readonly updatedCells: number, message: string) {
    super(message);
    this.name = "MinhHongSourceIdPartialWriteError";
  }
}

interface SourceIssue {
  level: SourceIssueLevel;
  message: string;
}

export interface MinhHongSourceSheetDateRepair {
  correctedValue: string;
  kind: SourceExportKind;
  range: string;
  rawValue: string;
  reason: string;
  rowNumber: number;
  sheetName: string;
  spreadsheetId: string;
}

export interface MinhHongSourceSheetDateFormatTarget {
  sheetName: string;
  spreadsheetId: string;
}

interface DateRepairApplyOptions {
  formatTargets?: MinhHongSourceSheetDateFormatTarget[];
}

interface DateNormalizeContext {
  kind?: SourceExportKind;
  nextDate?: Date | null;
  previousDate?: Date | null;
  range?: string;
  repairs?: MinhHongSourceSheetDateRepair[];
  rowNumber?: number;
  sheetName?: string;
  spreadsheetId?: string;
}

export const MINHHONG_SOURCE_SHEET_EXPORTS = [
  { kind: "legacy" as const, spreadsheetId: "1O3lM52KoombirF657zMMEJhFdYEqXOCKXsIrtgIWLwA" },
  { kind: "manual" as const, spreadsheetId: "1JHIFHgbUnTcDCqqysmh6D6DN8fMqQl5tUNdI7uVsoOw" },
] as const;

export const MINHHONG_SOURCE_SHEET_LINK_TARGETS = [
  {
    id: "service-orders" as const,
    kind: "legacy" as const,
    label: "Sheet đơn khách",
    scope: "service-orders" as const,
    sheetName: "Đơn hàng đã bán",
  },
  {
    id: "partners-current" as const,
    kind: "manual" as const,
    label: "Sheet đối tác",
    scope: "partners" as const,
    sheetName: "Đơn hàng mua từ long",
  },
  {
    id: "partners-legacy-purchases" as const,
    kind: "legacy" as const,
    label: "Sheet nhập cũ",
    scope: "partners" as const,
    sheetName: "Sheet1",
  },
] as const;

export type MinhHongSourceSheetLinkTargetId = (typeof MINHHONG_SOURCE_SHEET_LINK_TARGETS)[number]["id"];
export type MinhHongSourceSheetLinkScope = "all" | "service-orders" | "partners";

export interface MinhHongSourceSheetLink {
  id: MinhHongSourceSheetLinkTargetId;
  label: string;
  sheetName: string;
  spreadsheetId: string;
  url: string;
}

const PARTNER_ROWS = [
  ["LONG", "Long", "Đối tác công nợ", "", "Đối tác công nợ chính hiện tại", "Đang theo dõi"],
  ["DT_SHOPEE", "Shopee", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_TRAN_VIET_CUONG", "Trần Viết Cường", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_A_TAM", "a Tâm", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_IEN_TU_LAO_CAI", "Điện tử Lào Cai", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_DUONG_MANH_NINH", "Dương Mạnh Ninh", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_NGUYEN_THANH", "Nguyễn Thành", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_HIEU_LK", "Hiếu LK", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["DT_TUAN_MANH_AZ", "Tuấn Mạnh AZ", "Nguồn tham khảo", "", "Nguồn mua hộ qua Long trong dữ liệu cũ; chỉ tính công nợ riêng nếu Minh Hồng tự mua trực tiếp", "Nguồn tham khảo/mở rộng sau"],
  ["KHAC", "Khác", "Dự phòng", "", "Dùng tạm khi chưa biết tên đối tác", "Tùy dùng"],
];

function clean(value: CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  if (typeof value !== "object") return String(value).trim();

  const record = value as Record<string, unknown>;
  if ("result" in record) return clean(record.result);
  if ("text" in record) return clean(record.text);
  if (Array.isArray(record.richText)) {
    return record.richText.map((part) => clean((part as Record<string, unknown>).text)).join("").trim();
  }

  return "";
}

function money(value: CellValue) {
  const text = clean(value);
  if (!text) return 0;
  const negative = text.trim().startsWith("-");
  const digits = text.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return (negative ? -1 : 1) * Number.parseInt(digits, 10);
}

function lastMoneyInText(value: CellValue) {
  const matches = clean(value).match(/\d[\d\s,.]*\d/g) || [];
  const candidates = matches
    .map((match) => money(match))
    .filter((amount) => amount >= 1000);
  return candidates.at(-1) || 0;
}

function formatBusinessDate(value: Date) {
  return formatVietnamDate(value);
}

function isSuspiciousFutureDate(date: Date) {
  return date.getFullYear() > new Date().getFullYear() + 1;
}

function pushIssue(issues: SourceIssue[], level: SourceIssueLevel, message: string) {
  if (issues.some((issue) => issue.level === level && issue.message === message)) return;
  issues.push({ level, message });
}

function quoteSourceSheetName(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function sourceDateRange(sheetName: string, columnLetter: string, rowNumber: number) {
  return `${quoteSourceSheetName(sheetName)}!${columnLetter}${rowNumber}`;
}

function dateLikeText(value: string) {
  return /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(value.trim());
}

function normalizeDateTextForParsing(text: string) {
  const missingYearSlash = text.match(/^(\d{1,2})\/(\d{1,2})(\d{4})$/);
  if (missingYearSlash) {
    return Number(missingYearSlash[1]) + "/" + Number(missingYearSlash[2]) + "/" + missingYearSlash[3];
  }

  const twoDigitYear = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (twoDigitYear) {
    return Number(twoDigitYear[1]) + "/" + Number(twoDigitYear[2]) + "/20" + twoDigitYear[3];
  }

  return text;
}

function parseDateForNeighborhood(value: CellValue) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = clean(value);
  if (!text) return null;
  return parseAdminDateInput(normalizeDateTextForParsing(text));
}

function dateInNeighborWindow(date: Date, previousDate?: Date | null, nextDate?: Date | null) {
  if (!previousDate || !nextDate) return false;
  const time = date.getTime();
  const start = Math.min(previousDate.getTime(), nextDate.getTime());
  const end = Math.max(previousDate.getTime(), nextDate.getTime());
  return time >= start && time <= end;
}

function inferMistypedDayDate(text: string, previousDate?: Date | null, nextDate?: Date | null) {
  const match = text.match(/^(\d{2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  if (day < 32 || day > 39) return null;

  const candidateText = (day - 10) + "/" + Number(match[2]) + "/" + match[3];
  const parsed = parseAdminDateInput(candidateText);
  if (!parsed || !dateInNeighborWindow(parsed, previousDate, nextDate)) return null;

  return { parsed, reason: "Suy luận từ ngày trước/sau trong Sheet." };
}

function recordDateRepair(options: DateNormalizeContext | undefined, rawValue: string, correctedValue: string, reason: string) {
  if (!options?.repairs || !options.spreadsheetId || !options.sheetName || !options.rowNumber || !options.range || !options.kind) return;
  if (rawValue === correctedValue) return;
  if (options.repairs.some((repair) =>
    repair.spreadsheetId === options.spreadsheetId
    && repair.range === options.range
    && repair.rawValue === rawValue
    && repair.correctedValue === correctedValue
  )) return;
  options.repairs.push({
    correctedValue,
    kind: options.kind,
    range: options.range,
    rawValue,
    reason,
    rowNumber: options.rowNumber,
    sheetName: options.sheetName,
    spreadsheetId: options.spreadsheetId,
  });
}

function normalizeSourceDate(value: CellValue, context: string, issues: SourceIssue[], options?: DateNormalizeContext) {
  if (!value) return "";
  if (typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1000) return "";
  if (value instanceof Date) {
    const formatted = formatBusinessDate(value);
    if (isSuspiciousFutureDate(value)) {
      pushIssue(issues, "blocking", context + ": ngày \"" + formatted + "\" nằm quá xa tương lai, cần kiểm tra lại trước khi import.");
    }
    return formatted;
  }

  const text = clean(value);
  if (!text) return "";

  const candidateText = normalizeDateTextForParsing(text);
  const parsed = parseAdminDateInput(candidateText);

  if (parsed) {
    const formatted = formatBusinessDate(parsed);
    if (isSuspiciousFutureDate(parsed)) {
      pushIssue(issues, "blocking", context + ": ngày \"" + text + "\" nằm quá xa tương lai, cần kiểm tra lại trước khi import.");
      return formatted;
    }
    if (candidateText !== text || (dateLikeText(text) && formatted !== text)) {
      pushIssue(issues, "warning", context + ": ngày \"" + text + "\" được tự sửa thành \"" + formatted + "\".");
      recordDateRepair(options, text, formatted, "Chuẩn hóa định dạng ngày.");
    }
    return formatted;
  }

  const inferred = inferMistypedDayDate(text, options?.previousDate, options?.nextDate);
  if (inferred) {
    const formatted = formatBusinessDate(inferred.parsed);
    pushIssue(issues, "warning", context + ": ngày \"" + text + "\" được tự sửa thành \"" + formatted + "\" dựa trên thứ tự ngày trước/sau.");
    recordDateRepair(options, text, formatted, inferred.reason);
    return formatted;
  }

  pushIssue(issues, "blocking", context + ": ngày \"" + text + "\" không hợp lệ; hệ thống không xem đây là ô trống. Hãy sửa theo định dạng dd/mm/yyyy.");
  return text;
}

function getWorksheet(workbook: ExcelJS.Workbook, name: string) {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) throw new Error("Thiếu sheet nguồn " + name + ".");
  return worksheet;
}

function rowValues(worksheet: ExcelJS.Worksheet, rowNumber: number) {
  return worksheet.getRow(rowNumber).values as CellValue[];
}

function sourceIdColumnLetter(columnNumber: number) {
  let value = columnNumber;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function sourceIdRange(target: MinhHongSourceIdTarget, rowNumber: number) {
  return `${quoteSourceSheetName(target.sheetName)}!${sourceIdColumnLetter(target.sourceIdColumn)}${rowNumber}`;
}

function sourceIdRowRange(target: MinhHongSourceIdTarget, rowNumber: number) {
  return `${quoteSourceSheetName(target.sheetName)}!A${rowNumber}:${sourceIdColumnLetter(target.sourceIdColumn)}${rowNumber}`;
}

function isSourceIdBusinessRow(target: MinhHongSourceIdTarget, row: ExcelJS.Row) {
  const values = row.values as CellValue[];
  if (target.id === "legacy-purchases") return Boolean(clean(values[2]) && money(values[7]));
  if (target.id === "legacy-returns") return Boolean(clean(values[2]) && money(values[5]));
  if (target.id === "current-partner-activity") {
    return Array.from({ length: 6 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
  }
  return Array.from({ length: 11 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
}

function normalizedSourceIdNumber(value: number) {
  return String(Number(value.toFixed(12)));
}

function sourceIdFingerprintValue(value: CellValue): [string, unknown?] {
  if (value === null || value === undefined) return ["empty"];
  if (value instanceof Date) {
    const serial = (value.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
    return ["number", normalizedSourceIdNumber(serial)];
  }
  if (typeof value === "number") return ["number", normalizedSourceIdNumber(value)];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value !== "object") {
    const text = String(value).trim();
    return text ? ["text", text] : ["empty"];
  }

  const record = value as Record<string, unknown>;
  if ("result" in record) return sourceIdFingerprintValue(record.result);
  if ("text" in record) return sourceIdFingerprintValue(record.text);
  if (Array.isArray(record.richText)) {
    const text = record.richText.map((part) => clean((part as Record<string, unknown>).text)).join("").trim();
    return text ? ["text", text] : ["empty"];
  }
  return ["empty"];
}

function sourceIdValuesFingerprint(values: CellValue[], cellCount: number) {
  return JSON.stringify(
    Array.from({ length: cellCount }, (_, index) => sourceIdFingerprintValue(values[index]))
  );
}

function sourceIdRowFingerprint(target: MinhHongSourceIdTarget, row: ExcelJS.Row) {
  return sourceIdValuesFingerprint(
    Array.from({ length: target.sourceIdColumn - 1 }, (_, index) => row.getCell(index + 1).value),
    target.sourceIdColumn - 1
  );
}

function sourceReference(reference: string, sourceId: string) {
  return MINHHONG_SOURCE_ID_PATTERN.test(sourceId)
    ? `${reference} | source_id=${sourceId}`
    : reference;
}

function createSourceId(usedIds: Set<string>) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const sourceId = `MH_${randomUUID().replace(/-/g, "").toUpperCase()}`;
    if (!usedIds.has(sourceId)) {
      usedIds.add(sourceId);
      return sourceId;
    }
  }
  throw new Error("Không tạo được source_id duy nhất cho Sheet nguồn.");
}

function inspectMinhHongSourceIds(
  legacyWorkbook: ExcelJS.Workbook,
  manualWorkbook: ExcelJS.Workbook,
  spreadsheetIds: Record<SourceExportKind, string>,
  generateAssignments: boolean,
  scope: MinhHongImportScope = "all"
): MinhHongSourceIdPlan {
  const assignments: MinhHongSourceIdAssignment[] = [];
  const headerConflicts: string[] = [];
  const issues: string[] = [];
  const fingerprintRows: string[] = [];
  const validRowsById = new Map<string, Array<{ rowNumber: number; target: MinhHongSourceIdTarget }>>();
  const usedIds = new Set<string>();
  const summaries = new Map<MinhHongSourceIdTarget["id"], MinhHongSourceIdTargetSummary>();

  const targetsForScope = MINHHONG_SOURCE_ID_TARGETS.filter((target) => (
    scope === "all"
    || (scope === "service-orders" && target.id === "customer-orders")
    || (scope === "partners" && target.id !== "customer-orders")
  ));

  for (const target of targetsForScope) {
    const workbook = target.kind === "legacy" ? legacyWorkbook : manualWorkbook;
    const worksheet = getWorksheet(workbook, target.sheetName);
    const spreadsheetId = spreadsheetIds[target.kind];
    const summary: MinhHongSourceIdTargetSummary = {
      id: target.id,
      invalidRows: 0,
      missingRows: 0,
      sheetName: target.sheetName,
      totalRows: 0,
      validRows: 0,
    };
    summaries.set(target.id, summary);

    const headerRow = worksheet.getRow(target.headerRow);
    const headerValue = clean(headerRow.getCell(target.sourceIdColumn).value);
    const sourceIdHeaderColumns = Array.from(
      { length: Math.max(worksheet.columnCount, target.sourceIdColumn + 1) },
      (_, index) => index + 1
    ).filter((column) => clean(headerRow.getCell(column).value).toLocaleLowerCase("vi-VN") === "source_id");
    fingerprintRows.push(JSON.stringify({
      rowNumber: target.headerRow,
      target: target.id,
      values: Array.from({ length: target.sourceIdColumn }, (_, index) => clean(headerRow.getCell(index + 1).value)),
    }));

    if (!headerValue && sourceIdHeaderColumns.length > 0) {
      headerConflicts.push(
        `${target.sheetName}: cột source_id đã bị di chuyển khỏi vị trí ${sourceIdColumnLetter(target.sourceIdColumn)}; chưa thể tự động gán ID.`
      );
    } else if (!headerValue) {
      assignments.push({
        kind: target.kind,
        range: sourceIdRange(target, target.headerRow),
        rowFingerprint: sourceIdRowFingerprint(target, headerRow),
        rowNumber: target.headerRow,
        sheetName: target.sheetName,
        spreadsheetId,
        value: "source_id",
      });
    } else if (headerValue.toLocaleLowerCase("vi-VN") !== "source_id") {
      headerConflicts.push(
        `${target.sheetName}: ô tiêu đề ${sourceIdColumnLetter(target.sourceIdColumn)}${target.headerRow} đang có dữ liệu khác, không thể dùng làm cột source_id.`
      );
    } else if (sourceIdHeaderColumns.some((column) => column !== target.sourceIdColumn)) {
      headerConflicts.push(`${target.sheetName}: có nhiều hơn một cột source_id; hãy giữ đúng một cột ở vị trí đã quy định.`);
    }

    for (let rowNumber = target.firstDataRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      fingerprintRows.push(JSON.stringify({
        rowNumber,
        target: target.id,
        values: Array.from({ length: target.sourceIdColumn }, (_, index) => clean(row.getCell(index + 1).value)),
      }));
      if (!isSourceIdBusinessRow(target, row)) continue;

      summary.totalRows += 1;
      const sourceId = clean(row.getCell(target.sourceIdColumn).value);
      if (!sourceId) {
        summary.missingRows += 1;
        if (generateAssignments) {
          assignments.push({
            kind: target.kind,
            range: sourceIdRange(target, rowNumber),
            rowFingerprint: sourceIdRowFingerprint(target, row),
            rowNumber,
            sheetName: target.sheetName,
            spreadsheetId,
            value: createSourceId(usedIds),
          });
        }
        continue;
      }

      if (!MINHHONG_SOURCE_ID_PATTERN.test(sourceId)) {
        summary.invalidRows += 1;
        issues.push(`${target.sheetName} dòng ${rowNumber}: source_id "${sourceId}" không đúng định dạng MH_ + 32 ký tự HEX.`);
        continue;
      }

      usedIds.add(sourceId);
      summary.validRows += 1;
      validRowsById.set(sourceId, [
        ...(validRowsById.get(sourceId) || []),
        { rowNumber, target },
      ]);
    }
  }

  let duplicateRows = 0;
  for (const [sourceId, rows] of validRowsById.entries()) {
    if (rows.length < 2) continue;
    duplicateRows += rows.length;
    for (const row of rows) {
      const summary = summaries.get(row.target.id);
      if (summary) summary.validRows = Math.max(0, summary.validRows - 1);
    }
    issues.push(
      `source_id ${sourceId} bị trùng tại ${rows.map((row) => `${row.target.sheetName} dòng ${row.rowNumber}`).join(", ")}.`
    );
  }

  issues.push(...headerConflicts);
  const targets = [...summaries.values()];
  const totalRows = targets.reduce((sum, target) => sum + target.totalRows, 0);
  const missingRows = targets.reduce((sum, target) => sum + target.missingRows, 0);
  const invalidRows = targets.reduce((sum, target) => sum + target.invalidRows, 0);
  const validRows = targets.reduce((sum, target) => sum + target.validRows, 0);
  const headerWrites = assignments.filter((assignment) => assignment.value === "source_id").length;
  const fingerprint = createHash("sha256").update(fingerprintRows.join("\n")).digest("hex");

  return {
    assignments,
    canApply: invalidRows === 0 && duplicateRows === 0 && headerConflicts.length === 0,
    duplicateRows,
    fingerprint,
    headerConflicts,
    headerWrites,
    invalidRows,
    issues,
    missingRows,
    targets,
    totalRows,
    validRows,
  };
}

function stableSourceId(row: ExcelJS.Row, targetId: MinhHongSourceIdTarget["id"], fallback: string) {
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === targetId);
  if (!target) return fallback;
  const sourceId = clean(row.getCell(target.sourceIdColumn).value);
  if (MINHHONG_SOURCE_ID_PATTERN.test(sourceId)) return sourceId;

  const fingerprint = sourceIdRowFingerprint(target, row);
  return `MH_${createHash("sha256")
    .update(`${targetId}:${fingerprint}`)
    .digest("hex")
    .slice(0, 32)
    .toUpperCase()}`;
}

function pushSourceIdImportIssues(
  plan: MinhHongSourceIdPlan,
  issues: SourceIssue[],
  options: { requireSheetSourceIds?: boolean } = {}
) {
  for (const target of plan.targets) {
    if (options.requireSheetSourceIds && target.missingRows > 0) {
      pushIssue(
        issues,
        "blocking",
        `${target.sheetName}: ${target.missingRows} dòng nghiệp vụ chưa có source_id. Hãy chạy “Kiểm tra source_id” và gán ID trước khi import.`
      );
    }
    if (target.invalidRows > 0) {
      pushIssue(issues, "blocking", `${target.sheetName}: ${target.invalidRows} dòng có source_id sai định dạng.`);
    }
  }
  if (plan.duplicateRows > 0) {
    pushIssue(issues, "blocking", `${plan.duplicateRows} dòng đang dùng source_id bị trùng; không thể import an toàn.`);
  }
  for (const message of plan.headerConflicts) pushIssue(issues, "blocking", message);
}

function normalizePhone(...values: CellValue[]) {
  for (const value of values) {
    const digits = clean(value).replace(/\D/g, "");
    if (!digits) continue;
    if (digits.length === 9) return "0" + digits;
    if (digits.length >= 10) return digits;
  }
  return "";
}

function inferSeller(note: string, seller: string) {
  const explicitSeller = clean(seller);
  if (explicitSeller) return explicitSeller;
  const upperNote = note.toLocaleUpperCase("vi-VN");
  if (upperNote.includes("SHOPEE")) return "Shopee";
  return "";
}

function appendRows(worksheet: ExcelJS.Worksheet, headers: readonly string[], rows: CellValue[][]) {
  worksheet.addRow([...headers]);
  for (const row of rows) worksheet.addRow(row);
}

function buildManualSummary(manualWorkbook: ExcelJS.Workbook, issues: SourceIssue[]) {
  const openingSheet = getWorksheet(manualWorkbook, "Đơn hàng nhập từ long");
  const summarySheet = getWorksheet(manualWorkbook, "Đơn hàng mua từ long");
  const openingText = clean(openingSheet.getRow(1).getCell(1).value);
  const openingBalance = lastMoneyInText(openingText);
  const extraName = clean(openingSheet.getRow(2).getCell(1).value) || "Phát sinh sau chốt";
  const sheetExtraAmount = money(openingSheet.getRow(2).getCell(2).value);
  const summaryRow = summarySheet.getRow(2);
  const summaryDate = normalizeSourceDate(summaryRow.getCell(1).value, "Đơn hàng mua từ long dòng 2", issues);
  const summaryTotal = money(summaryRow.getCell(4).value);
  const paid = money(summaryRow.getCell(5).value);
  const remaining = money(summaryRow.getCell(6).value);
  const countedPurchase = summaryTotal && openingBalance ? summaryTotal - openingBalance : sheetExtraAmount;

  return {
    countedPurchase,
    extraName,
    openingBalance,
    paid,
    remaining,
    summaryDate,
    summaryTotal,
    sheetExtraAmount,
  };
}

function parseQuantity(value: CellValue) {
  const text = clean(value);
  if (!text) return "";
  const numeric = Number.parseFloat(text.replace(",", "."));
  return Number.isFinite(numeric) ? numeric : text;
}

function buildManualActivityRows(manualWorkbook: ExcelJS.Workbook, issues: SourceIssue[]) {
  const summarySheet = getWorksheet(manualWorkbook, "Đơn hàng mua từ long");
  const purchaseRows: CellValue[][] = [];
  const paymentRows: CellValue[][] = [];
  let purchaseIndex = 1;
  let paymentIndex = 1;

  for (let rowNumber = 3; rowNumber <= summarySheet.rowCount; rowNumber += 1) {
    const row = summarySheet.getRow(rowNumber);
    const itemName = clean(row.getCell(2).value);
    const amount = money(row.getCell(4).value);
    const paid = money(row.getCell(5).value);
    const remaining = money(row.getCell(6).value);
    const hasContent = Boolean(
      clean(row.getCell(1).value)
      || itemName
      || clean(row.getCell(3).value)
      || amount
      || paid
      || remaining
    );
    if (!hasContent) continue;

    const dateText = normalizeSourceDate(row.getCell(1).value, "Đơn hàng mua từ long dòng " + rowNumber, issues);
    const quantity = parseQuantity(row.getCell(3).value);
    const rowRemaining = Math.max(amount - paid, 0);
    if (remaining && remaining !== rowRemaining) {
      pushIssue(
        issues,
        "blocking",
        "Đơn hàng mua từ long dòng " + rowNumber
          + ": cột Còn " + remaining.toLocaleString("vi-VN")
          + " không khớp với Giá " + amount.toLocaleString("vi-VN")
          + " và Trả " + paid.toLocaleString("vi-VN")
          + "; chưa đoán đây là số dư tổng hay số còn của dòng."
      );
    }

    if (itemName && amount) {
      const sourceId = stableSourceId(
        row,
        "current-partner-activity",
        String(purchaseIndex).padStart(4, "0")
      );
      purchaseRows.push([
        "NH-MOI-" + String(purchaseIndex).padStart(4, "0"),
        dateText,
        "LONG",
        "Long",
        "Long",
        itemName,
        "Phát sinh sau chốt",
        quantity,
        "",
        "",
        amount,
        "Có",
        "Có",
        [
          "Dòng phát sinh trong sheet Minh Hồng tự tạo sau mốc nợ 12.720.000.",
          remaining ? "Cột Còn ghi " + remaining.toLocaleString("vi-VN") + "." : "",
        ].filter(Boolean).join(" "),
        sourceReference("Đơn hàng mua từ long!A" + rowNumber + ":F" + rowNumber, sourceId),
      ]);
      purchaseIndex += 1;
    }

    if (paid) {
      const sourceId = stableSourceId(
        row,
        "current-partner-activity",
        String(paymentIndex).padStart(4, "0")
      );
      paymentRows.push([
        "TT-MOI-" + String(paymentIndex).padStart(4, "0"),
        dateText,
        "LONG",
        "Long",
        paid,
        "Trả theo sheet mới",
        "Có",
        "Khoản trả ở dòng " + rowNumber + " của sheet Minh Hồng tự tạo sau mốc nợ 12.720.000.",
        sourceReference("Thanh toán!A" + rowNumber + ":F" + rowNumber, sourceId),
      ]);
      paymentIndex += 1;
    }
  }

  return { paymentRows, purchaseRows };
}

function buildPurchaseRows(legacyWorkbook: ExcelJS.Workbook, manualWorkbook: ExcelJS.Workbook, issues: SourceIssue[]) {
  const manual = buildManualSummary(manualWorkbook, issues);
  const manualActivity = buildManualActivityRows(manualWorkbook, issues);
  const rows: CellValue[][] = [
    [
      "NH-0001",
      "07/05/2026",
      "LONG",
      "Long",
      "Chốt công nợ",
      "Nợ tạm tính đến 07/05/2026",
      "Số dư chốt",
      1,
      "lần",
      manual.openingBalance,
      manual.openingBalance,
      "Có",
      "Có",
      "Số dư do Minh Hồng chốt; các dòng mua cũ bên dưới giữ để đối chiếu nhưng không cộng đôi.",
      "Đơn hàng nhập từ long!A1",
    ],
    [
      "NH-0002",
      manual.summaryDate,
      "LONG",
      "Long",
      "Long",
      manual.extraName,
      "Pin/cell",
      300,
      "cell",
      manual.countedPurchase ? Math.round(manual.countedPurchase / 300) : "",
      manual.countedPurchase,
      "Có",
      "Có",
      "Phát sinh sau số dư chốt 07/05/2026. Sheet đang ghi " + manual.sheetExtraAmount.toLocaleString("vi-VN") + " nhưng tổng chốt cho thấy phát sinh thực tế là " + manual.countedPurchase.toLocaleString("vi-VN") + ".",
      "Đơn hàng nhập từ long!A2:B2",
    ],
    ...manualActivity.purchaseRows,
  ];
  const worksheet = getWorksheet(legacyWorkbook, "Sheet1");
  let index = 3;

  for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = rowValues(worksheet, rowNumber);
    const itemName = clean(row[2]);
    const amount = money(row[7]);
    if (!itemName || !amount) continue;

    const note = clean(row[8]);
    const seller = inferSeller(note, clean(row[9]));
    const sourceId = stableSourceId(worksheet.getRow(rowNumber), "legacy-purchases", String(index).padStart(4, "0"));
    rows.push([
      "NH-" + String(index).padStart(4, "0"),
      normalizeSourceDate(row[1], "Sheet1 dòng " + rowNumber, issues),
      "LONG",
      "Long",
      seller,
      itemName,
      "Vật tư/đồ nghề",
      clean(row[3]) || "",
      "",
      money(row[4]) || "",
      amount,
      "Có",
      "Không",
      [note, "Đã gộp trong số dư chốt 07/05/2026"].filter(Boolean).join(" | "),
      sourceReference("Sheet1!A" + rowNumber + ":J" + rowNumber, sourceId),
    ]);
    index += 1;
  }

  return rows;
}

function buildPaymentRows(legacyWorkbook: ExcelJS.Workbook, manualWorkbook: ExcelJS.Workbook, issues: SourceIssue[]) {
  const transferSheet = getWorksheet(legacyWorkbook, "Tiền chuyển cho long");
  const manual = buildManualSummary(manualWorkbook, issues);
  const historicalAmount = money(transferSheet.getRow(1).getCell(3).value);
  const manualActivity = buildManualActivityRows(manualWorkbook, issues);

  return [
    [
      "TT-0001",
      "02/03/2026",
      "LONG",
      "Long",
      historicalAmount,
      "Chuyển khoản",
      "Không",
      clean(transferSheet.getRow(1).getCell(1).value) + " | Đã xác nhận số đúng là 45.000.000; đã gộp trong số dư chốt 07/05/2026",
      "Thanh toán!A2:G2",
    ],
    [
      "TT-0002",
      manual.summaryDate,
      "LONG",
      "Long",
      manual.paid,
      "Trả trước",
      "Có",
      "Khoản trả trước theo sheet mới sau khi chốt nợ 07/05/2026.",
      "Thanh toán!A3:G3",
    ],
    ...manualActivity.paymentRows,
  ];
}

function buildReturnRows(legacyWorkbook: ExcelJS.Workbook) {
  const worksheet = getWorksheet(legacyWorkbook, "Đơn trả lại");
  const rows: CellValue[][] = [];
  let index = 1;

  for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = rowValues(worksheet, rowNumber);
    const itemName = clean(row[2]);
    const amount = money(row[5]);
    if (!itemName || !amount) continue;

    const sourceId = stableSourceId(worksheet.getRow(rowNumber), "legacy-returns", String(index).padStart(4, "0"));
    rows.push([
      "TR-" + String(index).padStart(4, "0"),
      "",
      "LONG",
      "Long",
      itemName,
      clean(row[3]),
      clean(row[4]) || "",
      "",
      amount,
      "Không",
      "Đã gộp trong số dư chốt 07/05/2026; giữ lại để đối chiếu.",
      sourceReference("Đơn trả lại!A" + rowNumber + ":E" + rowNumber, sourceId),
    ]);
    index += 1;
  }

  return rows;
}

function findNeighborDate(
  worksheet: ExcelJS.Worksheet,
  fromRow: number,
  direction: -1 | 1
) {
  for (let rowNumber = fromRow + direction; rowNumber >= 4 && rowNumber <= worksheet.rowCount; rowNumber += direction) {
    const parsed = parseDateForNeighborhood(rowValues(worksheet, rowNumber)[8]);
    if (parsed) return parsed;
  }
  return null;
}

function buildCustomerRows(
  legacyWorkbook: ExcelJS.Workbook,
  issues: SourceIssue[],
  repairs: MinhHongSourceSheetDateRepair[] = [],
  spreadsheetId = MINHHONG_SOURCE_SHEET_EXPORTS.find((source) => source.kind === "legacy")?.spreadsheetId || ""
) {
  const worksheet = getWorksheet(legacyWorkbook, "Đơn hàng đã bán");
  const rows: CellValue[][] = [];
  let index = 1;

  for (let rowNumber = 4; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = rowValues(worksheet, rowNumber);
    const customerName = clean(row[1]);
    const product = clean(row[2]);
    const phone = normalizePhone(row[3], row[9], row[7], row[1]);
    const total = money(row[4]);
    const paid = money(row[5]);
    const sourceRemaining = money(row[6]);
    const note = clean(row[7]);
    const dateText = normalizeSourceDate(row[8], "Đơn hàng đã bán dòng " + rowNumber, issues, {
      kind: "legacy",
      nextDate: findNeighborDate(worksheet, rowNumber, 1),
      previousDate: findNeighborDate(worksheet, rowNumber, -1),
      range: sourceDateRange("Đơn hàng đã bán", "H", rowNumber),
      repairs,
      rowNumber,
      sheetName: "Đơn hàng đã bán",
      spreadsheetId,
    });
    const hasBusinessContent = Boolean(customerName || product || phone || total || paid || note || dateText);
    if (!hasBusinessContent) continue;

    const priceStatus = !total && (customerName || product) ? "Quên giá" : "";
    const remaining = total || paid ? Math.max(total - paid, 0) : sourceRemaining;
    const sourceId = stableSourceId(worksheet.getRow(rowNumber), "customer-orders", String(index).padStart(4, "0"));
    rows.push([
      "DH-" + String(index).padStart(4, "0"),
      dateText,
      customerName,
      phone,
      product,
      total || "",
      paid || "",
      remaining,
      priceStatus,
      note,
      sourceReference("Đơn hàng đã bán!A" + rowNumber + ":K" + rowNumber, sourceId),
    ]);
    index += 1;
  }

  return rows;
}

function isDebtCounted(value: CellValue) {
  const normalized = clean(value).toLocaleLowerCase("vi-VN");
  if (!normalized) return true;
  return ["có", "co", "yes", "true", "1"].includes(normalized);
}

function isLongRow(row: CellValue[], partnerCodeIndex: number, partnerNameIndex: number) {
  return clean(row[partnerCodeIndex]) === "LONG" || clean(row[partnerNameIndex]).toLocaleLowerCase("vi-VN") === "long";
}

function isOpeningPurchaseRow(row: CellValue[]) {
  const text = `${clean(row[0])} ${clean(row[4])} ${clean(row[5])} ${clean(row[6])}`.toLocaleLowerCase("vi-VN");
  return clean(row[0]) === "NH-0001"
    || text.includes("số dư chốt")
    || text.includes("nợ tạm tính")
    || text.includes("chốt công nợ");
}

function buildPartnerReconciliationTotals(purchaseRows: CellValue[][], paymentRows: CellValue[][], returnRows: CellValue[][]) {
  const longPurchaseRows = purchaseRows.filter((row) => isLongRow(row, 2, 3));
  const longPaymentRows = paymentRows.filter((row) => isLongRow(row, 2, 3));
  const longReturnRows = returnRows.filter((row) => isLongRow(row, 2, 3));
  const openingBalance = longPurchaseRows
    .filter((row) => isDebtCounted(row[12]) && isOpeningPurchaseRow(row))
    .reduce((sum, row) => sum + money(row[10]), 0);
  const countedPurchase = longPurchaseRows
    .filter((row) => isDebtCounted(row[12]) && !isOpeningPurchaseRow(row))
    .reduce((sum, row) => sum + money(row[10]), 0);
  const countedPayment = longPaymentRows
    .filter((row) => isDebtCounted(row[6]))
    .reduce((sum, row) => sum + money(row[4]), 0);
  const countedReturn = longReturnRows
    .filter((row) => isDebtCounted(row[9]))
    .reduce((sum, row) => sum + money(row[8]), 0);
  const historicalPaid = longPaymentRows.reduce((sum, row) => sum + money(row[4]), 0);

  return {
    countedPayment,
    countedPurchase,
    historicalPaid,
    openingBalance,
    payable: openingBalance + countedPurchase - countedPayment - countedReturn,
  };
}

function buildReconciliationRows(
  purchaseRows: CellValue[][],
  paymentRows: CellValue[][],
  returnRows: CellValue[][],
  customerRows: CellValue[][],
  issues: SourceIssue[]
) {
  const partnerTotals = buildPartnerReconciliationTotals(purchaseRows, paymentRows, returnRows);
  const customerOrderTotal = customerRows.reduce((sum, row) => sum + money(row[5]), 0);
  const customerOrderPaid = customerRows.reduce((sum, row) => sum + money(row[6]), 0);
  const missingPriceRows = customerRows.filter((row) => clean(row[8]) === "Quên giá").length;

  return [
    [MINHHONG_RECONCILIATION_KEYS[0], "Long - số dư chốt 07/05/2026", partnerTotals.openingBalance, "Tính vào công nợ hiện tại"],
    [MINHHONG_RECONCILIATION_KEYS[1], "Long - phát sinh mua sau chốt", partnerTotals.countedPurchase, "Tính từ các dòng nhập hàng có cờ tính công nợ"],
    [MINHHONG_RECONCILIATION_KEYS[2], "Long - đã thanh toán sau chốt", partnerTotals.countedPayment, "Tính từ các dòng thanh toán có cờ tính công nợ"],
    [MINHHONG_RECONCILIATION_KEYS[3], "Long - Minh Hồng cần trả", partnerTotals.payable, "Số dư chốt + mua tính nợ - thanh toán tính nợ - trả hàng tính nợ"],
    [MINHHONG_RECONCILIATION_KEYS[4], "Long - đã thanh toán lịch sử", partnerTotals.historicalPaid, "Gồm các dòng tham khảo và các khoản thanh toán tính công nợ"],
    [MINHHONG_RECONCILIATION_KEYS[5], "Đơn khách - số dòng nghiệp vụ", customerRows.length, "Không gồm các dòng DH-* rỗng"],
    [MINHHONG_RECONCILIATION_KEYS[6], "Đơn khách - tổng tiền", customerOrderTotal, "37 dòng có giá"],
    [MINHHONG_RECONCILIATION_KEYS[7], "Đơn khách - đã thu", customerOrderPaid, "Tổng tiền đã thu từ khách"],
    [MINHHONG_RECONCILIATION_KEYS[8], "Đơn khách - dòng cũ quên giá", missingPriceRows, "Giữ để theo dõi, không tự đoán giá"],
    ...issues.map((issue, index) => [
      issue.level === "blocking" ? "blocking_issue" : "warning",
      issue.level === "blocking" ? "Dữ liệu nguồn cần sửa" : "Cảnh báo dữ liệu nguồn",
      index + 1,
      issue.message,
    ]),
  ];
}

export function buildSourceSheetExportUrl(spreadsheetId: string) {
  return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(spreadsheetId) + "/export?format=xlsx";
}

export function buildMinhHongSourceSheetEditUrl(spreadsheetId: string, sheetId: number) {
  return "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(spreadsheetId) + "/edit#gid=" + sheetId;
}

export function getMinhHongSourceSheetLinkTargets(scope: MinhHongSourceSheetLinkScope) {
  if (scope === "all") return [...MINHHONG_SOURCE_SHEET_LINK_TARGETS];
  return MINHHONG_SOURCE_SHEET_LINK_TARGETS.filter((target) => target.scope === scope);
}

export function getDefaultMinhHongSourceSheetLinkTargetId(scope: MinhHongSourceSheetLinkScope) {
  return getMinhHongSourceSheetLinkTargets(scope)[0]?.id || null;
}

function getSourceSheetExportByKind(kind: SourceExportKind) {
  const source = MINHHONG_SOURCE_SHEET_EXPORTS.find((item) => item.kind === kind);
  if (!source) throw new Error("Chưa cấu hình Google Sheet nguồn " + kind + ".");
  return source;
}

export async function buildMinhHongSourceSheetLink(
  targetId: MinhHongSourceSheetLinkTargetId,
  fetchImpl: typeof fetch = fetch
): Promise<MinhHongSourceSheetLink> {
  const target = MINHHONG_SOURCE_SHEET_LINK_TARGETS.find((item) => item.id === targetId);
  if (!target) throw new Error("Không tìm thấy link Sheet gốc cần mở.");
  if (!hasGoogleServiceAccountCredentials()) {
    throw new Error("Chưa cấu hình Google service account để lấy đúng tab Sheet gốc.");
  }

  const source = getSourceSheetExportByKind(target.kind);
  const accessToken = await getGoogleAccessToken(fetchImpl);
  const sheetId = await fetchSheetId(accessToken, source.spreadsheetId, target.sheetName, fetchImpl);
  return {
    id: target.id,
    label: target.label,
    sheetName: target.sheetName,
    spreadsheetId: source.spreadsheetId,
    url: buildMinhHongSourceSheetEditUrl(source.spreadsheetId, sheetId),
  };
}

export async function fetchMinhHongSourceSheetExports(
  fetchImpl: typeof fetch = fetch,
  scope: MinhHongImportScope = "all"
): Promise<SourceExport[]> {
  const exports: SourceExport[] = [];
  const accessToken = hasGoogleServiceAccountCredentials()
    ? await getGoogleAccessToken(fetchImpl)
    : "";

  for (const source of MINHHONG_SOURCE_SHEET_EXPORTS) {
    if (scope === "service-orders" && source.kind !== "legacy") continue;
    const response = await fetchImpl(
      buildSourceSheetExportUrl(source.spreadsheetId),
      accessToken ? { headers: { Authorization: "Bearer " + accessToken } } : undefined
    );
    if (!response.ok) {
      throw new Error("Không tải được Google Sheet nguồn " + source.spreadsheetId + " (" + response.status + " " + response.statusText + ").");
    }
    exports.push({
      buffer: Buffer.from(await response.arrayBuffer()),
      kind: source.kind,
      spreadsheetId: source.spreadsheetId,
    });
  }

  return exports;
}

export async function buildMinhHongSourceSheetDateRepairsFromExports(exports: SourceExport[]) {
  const legacy = exports.find((item) => item.kind === "legacy");
  if (!legacy) return [] as MinhHongSourceSheetDateRepair[];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(legacy.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

  const repairs: MinhHongSourceSheetDateRepair[] = [];
  buildCustomerRows(workbook, [], repairs, legacy.spreadsheetId);
  return repairs;
}

export function buildMinhHongSourceSheetDateFormatTargetsFromExports(exports: SourceExport[]) {
  return exports
    .filter((item) => item.kind === "legacy")
    .map((item) => ({
      sheetName: "Đơn hàng đã bán",
      spreadsheetId: item.spreadsheetId,
    }));
}

async function fetchSheetId(accessToken: string, spreadsheetId: string, sheetName: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Không đọc được metadata Google Sheet nguồn.");
  const sheet = (data.sheets || []).find((item: { properties?: { title?: string } }) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (!Number.isFinite(sheetId)) throw new Error("Không tìm thấy sheet nguồn " + sheetName + " để chuẩn hóa định dạng ngày.");
  return sheetId as number;
}

async function applySourceSheetDateFormat(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  fetchImpl: typeof fetch
) {
  const sheetId = await fetchSheetId(accessToken, spreadsheetId, sheetName, fetchImpl);
  const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startColumnIndex: 7,
              startRowIndex: 3,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: "DATE",
                  pattern: "dd/mm/yyyy",
                },
              },
            },
            fields: "userEnteredFormat.numberFormat",
          },
        },
      ],
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Không chuẩn hóa được định dạng ngày trên Sheet nguồn.");
}

export async function applyMinhHongSourceSheetDateRepairs(
  repairs: MinhHongSourceSheetDateRepair[],
  fetchImpl: typeof fetch = fetch,
  options: DateRepairApplyOptions = {}
) {
  const formatTargets = new Map<string, MinhHongSourceSheetDateFormatTarget>();
  const addFormatTarget = (target: MinhHongSourceSheetDateFormatTarget) => {
    formatTargets.set(`${target.spreadsheetId}:${target.sheetName}`, target);
  };

  for (const target of options.formatTargets || []) addFormatTarget(target);
  for (const repair of repairs) addFormatTarget({ sheetName: repair.sheetName, spreadsheetId: repair.spreadsheetId });

  if (repairs.length === 0 && formatTargets.size === 0) return { updatedCells: 0 };

  const accessToken = await getGoogleAccessToken(fetchImpl);
  let updatedCells = 0;
  const repairsBySpreadsheet = new Map<string, MinhHongSourceSheetDateRepair[]>();
  for (const repair of repairs) {
    repairsBySpreadsheet.set(repair.spreadsheetId, [
      ...(repairsBySpreadsheet.get(repair.spreadsheetId) || []),
      repair,
    ]);
  }

  for (const [spreadsheetId, spreadsheetRepairs] of repairsBySpreadsheet.entries()) {
    const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: spreadsheetRepairs.map((repair) => ({
          range: repair.range,
          values: [[repair.correctedValue]],
        })),
        valueInputOption: "USER_ENTERED",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || "Không sửa được ngày trên Google Sheet nguồn.");
    }
    updatedCells += Number(data.totalUpdatedCells || spreadsheetRepairs.length);
  }

  for (const target of formatTargets.values()) {
    await applySourceSheetDateFormat(accessToken, target.spreadsheetId, target.sheetName, fetchImpl);
  }

  return { updatedCells };
}

async function loadMinhHongSourceIdWorkbooks(exports: SourceExport[], scope: MinhHongImportScope) {
  const legacy = exports.find((item) => item.kind === "legacy");
  const manual = exports.find((item) => item.kind === "manual");
  if (!legacy || (scope !== "service-orders" && !manual)) {
    throw new Error("Thiếu raw source Sheet export để kiểm tra source_id.");
  }

  const legacyWorkbook = new ExcelJS.Workbook();
  const manualWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(legacy.buffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]);
  if (manual) {
    await manualWorkbook.xlsx.load(manual.buffer as unknown as Parameters<typeof manualWorkbook.xlsx.load>[0]);
  }
  return {
    legacyWorkbook,
    manualWorkbook,
    spreadsheetIds: {
      legacy: legacy.spreadsheetId,
      manual: manual?.spreadsheetId || getSourceSheetExportByKind("manual").spreadsheetId,
    },
  };
}

export async function buildMinhHongSourceIdPlanFromExports(
  exports: SourceExport[],
  scope: MinhHongImportScope = "all"
) {
  const { legacyWorkbook, manualWorkbook, spreadsheetIds } = await loadMinhHongSourceIdWorkbooks(exports, scope);
  return inspectMinhHongSourceIds(legacyWorkbook, manualWorkbook, spreadsheetIds, true, scope);
}

function sourceIdAssignmentSnapshot(plan: MinhHongSourceIdPlan) {
  return plan.assignments
    .map((assignment) => JSON.stringify({
      kind: assignment.kind,
      range: assignment.range,
      rowFingerprint: assignment.rowFingerprint,
      rowNumber: assignment.rowNumber,
      sheetName: assignment.sheetName,
      spreadsheetId: assignment.spreadsheetId,
    }))
    .sort();
}

function sourceIdAssignmentTarget(assignment: MinhHongSourceIdAssignment) {
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => (
    item.kind === assignment.kind && item.sheetName === assignment.sheetName
  ));
  if (!target) throw new Error(`Khong tim thay cau hinh Sheet nguon ${assignment.sheetName}.`);
  return target;
}

async function assertSourceIdAssignmentsStillCurrent(
  accessToken: string,
  spreadsheetId: string,
  assignments: MinhHongSourceIdAssignment[],
  fetchImpl: typeof fetch
) {
  const url = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`);
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  for (const assignment of assignments) {
    url.searchParams.append("ranges", sourceIdRowRange(sourceIdAssignmentTarget(assignment), assignment.rowNumber));
  }

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json() as {
    error?: { message?: string };
    valueRanges?: Array<{ values?: CellValue[][] }>;
  };
  if (!response.ok) {
    throw new Error(data.error?.message || "Không đọc lại được các ô source_id ngay trước khi ghi.");
  }

  const valueRanges = data.valueRanges || [];
  if (valueRanges.length !== assignments.length) {
    throw new MinhHongSourceIdPlanChangedError();
  }

  for (const [index, assignment] of assignments.entries()) {
    const target = sourceIdAssignmentTarget(assignment);
    const rows = valueRanges[index].values || [];
    if (rows.length > 1) throw new MinhHongSourceIdPlanChangedError();
    const values = rows[0] || [];
    const currentFingerprint = sourceIdValuesFingerprint(values, target.sourceIdColumn - 1);
    if (
      clean(values[target.sourceIdColumn - 1])
      || currentFingerprint !== assignment.rowFingerprint
    ) {
      throw new MinhHongSourceIdPlanChangedError();
    }
  }
}

export async function applyMinhHongSourceIdPlan(
  plan: MinhHongSourceIdPlan,
  currentExports: SourceExport[],
  fetchImpl: typeof fetch = fetch,
  scope: MinhHongImportScope = "all"
) {
  if (!plan.canApply) {
    throw new Error("Sheet nguồn có source_id sai hoặc trùng; chưa ghi bất kỳ ô nào.");
  }

  const currentPlan = await buildMinhHongSourceIdPlanFromExports(currentExports, scope);
  const plannedAssignments = sourceIdAssignmentSnapshot(plan);
  const currentAssignments = sourceIdAssignmentSnapshot(currentPlan);
  if (
    !currentPlan.canApply
    || plan.fingerprint !== currentPlan.fingerprint
    || plannedAssignments.length !== currentAssignments.length
    || plannedAssignments.some((assignment, index) => assignment !== currentAssignments[index])
  ) {
    throw new MinhHongSourceIdPlanChangedError();
  }
  if (currentPlan.assignments.length === 0) return { updatedCells: 0 };

  const accessToken = await getGoogleAccessToken(fetchImpl);
  const assignmentsBySpreadsheet = new Map<string, MinhHongSourceIdAssignment[]>();
  for (const assignment of currentPlan.assignments) {
    assignmentsBySpreadsheet.set(assignment.spreadsheetId, [
      ...(assignmentsBySpreadsheet.get(assignment.spreadsheetId) || []),
      assignment,
    ]);
  }

  let updatedCells = 0;
  for (const [spreadsheetId, assignments] of assignmentsBySpreadsheet.entries()) {
    try {
      await assertSourceIdAssignmentsStillCurrent(accessToken, spreadsheetId, assignments, fetchImpl);
    } catch (error) {
      if (updatedCells > 0) {
        throw new MinhHongSourceIdPartialWriteError(
          updatedCells,
          error instanceof Error ? error.message : "Khong the xac minh Sheet nguon truoc khi ghi."
        );
      }
      throw error;
    }

    const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: assignments.map((assignment) => ({
          range: assignment.range,
          values: [[assignment.value]],
        })),
        valueInputOption: "RAW",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      const message = data.error?.message || "Không ghi được source_id vào Google Sheet nguồn.";
      if (updatedCells > 0) throw new MinhHongSourceIdPartialWriteError(updatedCells, message);
      throw new Error(message);
    }

    const spreadsheetUpdatedCells = Number(data.totalUpdatedCells ?? assignments.length);
    if (spreadsheetUpdatedCells < assignments.length) {
      const confirmedCells = updatedCells + spreadsheetUpdatedCells;
      throw new MinhHongSourceIdPartialWriteError(
        confirmedCells,
        `Google Sheet chỉ xác nhận ${spreadsheetUpdatedCells}/${assignments.length} ô source_id trong một bảng; hãy chạy kiểm tra lại trước khi import.`
      );
    }
    updatedCells += spreadsheetUpdatedCells;
  }

  return { updatedCells };
}

export async function hideMinhHongSourceIdColumns(
  plan: MinhHongSourceIdPlan,
  sourceExports: SourceExport[],
  fetchImpl: typeof fetch = fetch
) {
  if (!plan.canApply) {
    throw new Error("Sheet nguồn chưa đủ điều kiện để ẩn cột định danh.");
  }

  const accessToken = await getGoogleAccessToken(fetchImpl);
  const requestsBySpreadsheet = new Map<string, Array<Record<string, unknown>>>();

  for (const summary of plan.targets) {
    const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === summary.id);
    if (!target) continue;
    const source = sourceExports.find((item) => item.kind === target.kind);
    if (!source) throw new Error(`Không tìm thấy Sheet nguồn cho ${target.sheetName}.`);

    const sheetId = await fetchSheetId(accessToken, source.spreadsheetId, target.sheetName, fetchImpl);
    const requests = requestsBySpreadsheet.get(source.spreadsheetId) || [];
    requests.push({
      updateDimensionProperties: {
        range: {
          dimension: "COLUMNS",
          endIndex: target.sourceIdColumn,
          sheetId,
          startIndex: target.sourceIdColumn - 1,
        },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
    requestsBySpreadsheet.set(source.spreadsheetId, requests);
  }

  for (const [spreadsheetId, requests] of requestsBySpreadsheet.entries()) {
    const response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Không ẩn được cột định danh kỹ thuật trên Google Sheet.");
  }
}

export async function buildMinhHongSourceImportWorkbook(
  input: SourceWorkbookInput,
  scope: MinhHongImportScope = "all"
): Promise<Buffer> {
  const legacyWorkbook = new ExcelJS.Workbook();
  const manualWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(input.legacyWorkbookBuffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]);
  if (input.manualWorkbookBuffer) {
    await manualWorkbook.xlsx.load(input.manualWorkbookBuffer as unknown as Parameters<typeof manualWorkbook.xlsx.load>[0]);
  } else if (scope !== "service-orders") {
    throw new Error("Thiếu raw source Sheet đối tác để tạo preview import.");
  }

  const outputWorkbook = new ExcelJS.Workbook();
  const issues: SourceIssue[] = [];
  const sourceIdPlan = inspectMinhHongSourceIds(
    legacyWorkbook,
    manualWorkbook,
    {
      legacy: getSourceSheetExportByKind("legacy").spreadsheetId,
      manual: getSourceSheetExportByKind("manual").spreadsheetId,
    },
    false,
    scope
  );
  pushSourceIdImportIssues(sourceIdPlan, issues);
  const includePartnerLedger = scope !== "service-orders";
  const purchaseRows = includePartnerLedger ? buildPurchaseRows(legacyWorkbook, manualWorkbook, issues) : [];
  const paymentRows = includePartnerLedger ? buildPaymentRows(legacyWorkbook, manualWorkbook, issues) : [];
  const returnRows = includePartnerLedger ? buildReturnRows(legacyWorkbook) : [];
  const customerRows = buildCustomerRows(legacyWorkbook, issues);
  const reconciliationRows = buildReconciliationRows(purchaseRows, paymentRows, returnRows, customerRows, issues);

  appendRows(outputWorkbook.addWorksheet("Đối tác"), MINHHONG_PARTNER_COLUMNS, includePartnerLedger ? PARTNER_ROWS : []);
  appendRows(outputWorkbook.addWorksheet("Nhập hàng"), MINHHONG_PURCHASE_COLUMNS, purchaseRows);
  appendRows(outputWorkbook.addWorksheet("Thanh toán"), MINHHONG_PAYMENT_COLUMNS, paymentRows);
  appendRows(outputWorkbook.addWorksheet("Trả hàng"), MINHHONG_RETURN_COLUMNS, returnRows);
  appendRows(outputWorkbook.addWorksheet("Đơn khách"), MINHHONG_CUSTOMER_ORDER_COLUMNS, customerRows);
  appendRows(outputWorkbook.addWorksheet("Đối soát"), ["Khoá", "Nhãn", "Giá trị kỳ vọng", "Ghi chú"], reconciliationRows);

  return Buffer.from(await outputWorkbook.xlsx.writeBuffer());
}

export async function buildMinhHongSourceImportWorkbookFromExports(
  exports: SourceExport[],
  scope: MinhHongImportScope = "all"
) {
  const legacy = exports.find((item) => item.kind === "legacy");
  const manual = exports.find((item) => item.kind === "manual");
  if (!legacy || (scope !== "service-orders" && !manual)) {
    throw new Error("Thiếu raw source Sheet export để tạo preview import.");
  }
  return buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: legacy.buffer,
    manualWorkbookBuffer: manual?.buffer,
  }, scope);
}
