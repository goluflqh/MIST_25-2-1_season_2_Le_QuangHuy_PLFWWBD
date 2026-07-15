import ExcelJS from "exceljs";
import { createHash, randomUUID } from "node:crypto";
import { parseAdminDateInput } from "@/lib/admin-date";
import { formatVietnamDate } from "@/lib/vietnam-time";
import {
  buildPartnerDiscountSheetValidationFormula,
  calculatePartnerPurchaseAmounts,
  parseExcelPartnerDiscountPercent,
  PARTNER_DISCOUNT_SHEET_INPUT_MESSAGE,
  PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT,
} from "@/lib/partner-discounts";
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
import { MinhHongSourceSheetFetchError } from "./source-fetch-guard";

type SourceExportKind = "legacy" | "manual";
const UNIFIED_PARTNER_SHEET_NAME = "Đơn đối tác";
const PARTNER_DISCOUNT_COLUMN = 13;
const PARTNER_DISCOUNT_HEADER = "Chiết khấu (%)";
const PARTNER_PAYABLE_COLUMN = 10;
const PARTNER_PAYABLE_FORMULA_REPAIR_START_ROW = 89;
const PARTNER_PAYABLE_PROTECTION_DESCRIPTION = "Minh Hồng: công thức công nợ tự động";
export const MINHHONG_PARTNER_SHEET_COLUMNS = [
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
  "Chiết khấu (%)",
] as const;

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
  {
    id: "partner-ledger" as const,
    kind: "legacy" as const,
    sheetName: UNIFIED_PARTNER_SHEET_NAME,
    headerRow: 1,
    firstDataRow: 2,
    sourceIdColumn: 12,
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

export interface MinhHongSourceIdRowCheck {
  kind: SourceExportKind;
  rowFingerprint: string;
  rowNumber: number;
  sheetName: string;
  sourceId: string;
  spreadsheetId: string;
}

export interface MinhHongSourceIdTargetSummary {
  discountValueRepairs?: Array<{
    correctedValue: number;
    currentNumberFormat: string;
    currentValue: number;
    rowNumber: number;
  }>;
  discountFormatStartRow?: number;
  hidden: boolean;
  id: MinhHongSourceIdTarget["id"];
  invalidRows: number;
  missingRows: number;
  payableFormulaEndRow?: number;
  payableFormulaFingerprint?: string;
  payableFormulaReady?: boolean;
  payableFormulaStartRow?: number;
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
  requiresSetup: boolean;
  rowChecks: MinhHongSourceIdRowCheck[];
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
    kind: "legacy" as const,
    label: "Sheet đối tác",
    scope: "partners" as const,
    sheetName: UNIFIED_PARTNER_SHEET_NAME,
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
  const endColumn = target.id === "partner-ledger" ? 13 : target.sourceIdColumn;
  return `${quoteSourceSheetName(target.sheetName)}!A${rowNumber}:${sourceIdColumnLetter(endColumn)}${rowNumber}`;
}

function isSourceIdBusinessRow(target: MinhHongSourceIdTarget, row: ExcelJS.Row) {
  const values = row.values as CellValue[];
  if (target.id === "legacy-purchases") return Boolean(clean(values[2]) && money(values[7]));
  if (target.id === "legacy-returns") return Boolean(clean(values[2]) && money(values[5]));
  if (target.id === "current-partner-activity") {
    return Array.from({ length: 6 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
  }
  if (target.id === "partner-ledger") {
    return Array.from({ length: 11 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
  }
  return Array.from({ length: 11 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
}

function percentage(cell: ExcelJS.Cell) {
  return parseExcelPartnerDiscountPercent(cell.value, cell.numFmt);
}

function isPreparedPartnerDiscountCell(cell: ExcelJS.Cell, validationStartRow: number) {
  const validation = cell.dataValidation;
  if (!validation) return false;
  const formulae = validation.formulae || [];
  const formula = String(formulae[0] || "")
    .replace(/^=/, "")
    .replace(/;/g, ",")
    .replace(/\s+/g, "")
    .toUpperCase();
  const expectedFormulas = new Set([
    buildPartnerDiscountSheetValidationFormula(Number(cell.row), ",").slice(1),
    buildPartnerDiscountSheetValidationFormula(validationStartRow, ",").slice(1),
  ]);
  return cell.numFmt === PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT
    && validation.type === "custom"
    && expectedFormulas.has(formula)
    && validation.allowBlank === true
    && validation.showErrorMessage === true;
}

function isPreparedPartnerDiscountRange(worksheet: ExcelJS.Worksheet, startRow: number) {
  const endRow = Math.max(startRow, worksheet.rowCount);
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    if (!isPreparedPartnerDiscountCell(
      worksheet.getRow(rowNumber).getCell(PARTNER_DISCOUNT_COLUMN),
      startRow
    )) {
      return false;
    }
  }
  return true;
}

function inspectPartnerDiscountValueRepairs(worksheet: ExcelJS.Worksheet, startRow: number) {
  const conflicts: string[] = [];
  const repairs: NonNullable<MinhHongSourceIdTargetSummary["discountValueRepairs"]> = [];
  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const cell = worksheet.getRow(rowNumber).getCell(PARTNER_DISCOUNT_COLUMN);
    const currentValue = typeof cell.value === "number"
      ? cell.value
      : typeof cell.result === "number"
        ? cell.result
        : undefined;
    if (currentValue === undefined) continue;
    const parsed = parseExcelPartnerDiscountPercent(cell.value, cell.numFmt);
    if (parsed === null || Number.isNaN(parsed) || parsed === currentValue) continue;
    if (cell.formula) {
      conflicts.push(
        `${UNIFIED_PARTNER_SHEET_NAME}: ô M${rowNumber} dùng công thức phần trăm kiểu cũ; chưa thể tự động chuyển đổi an toàn.`
      );
      continue;
    }
    repairs.push({
      correctedValue: parsed,
      currentNumberFormat: cell.numFmt,
      currentValue,
      rowNumber,
    });
  }
  return { conflicts, repairs };
}

export function buildPartnerPayableSheetFormula(rowNumber: number, separator = ";") {
  const currentRowCounts = `OR($K${rowNumber}="",$K${rowNumber}="Có",$K${rowNumber}="Co",$K${rowNumber}="Yes",$K${rowNumber}="True",$K${rowNumber}="1")`;
  const countedRows = `((($K$2:$K${rowNumber}="")+($K$2:$K${rowNumber}="Có")+($K$2:$K${rowNumber}="Co")+($K$2:$K${rowNumber}="Yes")+($K$2:$K${rowNumber}="True")+($K$2:$K${rowNumber}="1"))>0)`;
  const negativeTypes = `((($C$2:$C${rowNumber}="Thanh toán")+($C$2:$C${rowNumber}="Thanh toan")+($C$2:$C${rowNumber}="Trả hàng")+($C$2:$C${rowNumber}="Tra hang"))>0)`;
  const purchaseTypes = `((($C$2:$C${rowNumber}="Mua hàng")+($C$2:$C${rowNumber}="Mua hang"))>0)`;
  const formula = `=IF(OR($B${rowNumber}="",$C${rowNumber}="",$G${rowNumber}=""),"",IF(NOT(${currentRowCounts}),"",SUMPRODUCT(($B$2:$B${rowNumber}=$B${rowNumber})*${countedRows}*$G$2:$G${rowNumber}*(1-2*${negativeTypes}))-SUMPRODUCT(($B$2:$B${rowNumber}=$B${rowNumber})*${countedRows}*${purchaseTypes}*$G$2:$G${rowNumber}*IFERROR($M$2:$M${rowNumber}/100,0))))`;
  return separator === "," ? formula : formula.replace(/,/g, separator);
}

function normalizedPartnerPayableFormula(formula: string) {
  return formula.trim().replace(/^=/, "").replace(/;/g, ",").replace(/\s+/g, "");
}

function partnerPayableFormulaCellFingerprint(value: CellValue, formula?: string) {
  return formula
    ? ["formula", normalizedPartnerPayableFormula(formula)]
    : sourceIdFingerprintValue(value);
}

function partnerPayableFormulaRangeFingerprint(
  startRow: number,
  endRow: number,
  valueAt: (rowNumber: number) => { formula?: string; value: CellValue }
) {
  const values = [];
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const cell = valueAt(rowNumber);
    values.push(partnerPayableFormulaCellFingerprint(cell.value, cell.formula));
  }
  return createHash("sha256").update(JSON.stringify(values)).digest("hex");
}

function inspectPartnerPayableFormulaRange(worksheet: ExcelJS.Worksheet, firstDataRow: number) {
  if (worksheet.rowCount < PARTNER_PAYABLE_FORMULA_REPAIR_START_ROW) return null;
  const startRow = Math.max(firstDataRow, PARTNER_PAYABLE_FORMULA_REPAIR_START_ROW);
  const endRow = Math.max(startRow, worksheet.rowCount);
  let ready = true;
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const formula = worksheet.getRow(rowNumber).getCell(PARTNER_PAYABLE_COLUMN).formula;
    if (
      !formula
      || normalizedPartnerPayableFormula(formula)
        !== normalizedPartnerPayableFormula(buildPartnerPayableSheetFormula(rowNumber, ","))
    ) {
      ready = false;
      break;
    }
  }

  return {
    endRow,
    fingerprint: partnerPayableFormulaRangeFingerprint(startRow, endRow, (rowNumber) => {
      const cell = worksheet.getRow(rowNumber).getCell(PARTNER_PAYABLE_COLUMN);
      return { formula: cell.formula, value: cell.value };
    }),
    ready,
    startRow,
  };
}

function normalizedSourceIdNumber(value: number) {
  return String(Number(value.toFixed(12)));
}

function normalizedSourceIdFormula(formula: string) {
  const source = formula.trim().replace(/^=/, "");
  let normalized = "";
  let inString = false;
  let arrayDepth = 0;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      normalized += character;
      if (inString && source[index + 1] === '"') {
        normalized += source[index + 1];
        index += 1;
      } else {
        inString = !inString;
      }
      continue;
    }
    if (!inString) {
      if (character === "{") arrayDepth += 1;
      if (character === "}") arrayDepth = Math.max(0, arrayDepth - 1);
      if (arrayDepth === 0 && (character === "," || character === ";")) {
        normalized += ",";
        continue;
      }
    }
    normalized += character;
  }
  return normalized;
}

function sourceIdFormulaFingerprint(formula: string): [string, string] {
  return ["formula", normalizedSourceIdFormula(formula)];
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
    if (text.startsWith("=")) return sourceIdFormulaFingerprint(text);
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

function sourceIdFingerprintColumns(target: MinhHongSourceIdTarget) {
  if (target.id === "partner-ledger") return [...Array.from({ length: 11 }, (_, index) => index), 12];
  return Array.from({ length: target.sourceIdColumn - 1 }, (_, index) => index);
}

function sourceIdValuesFingerprint(target: MinhHongSourceIdTarget, values: CellValue[]) {
  return JSON.stringify(
    sourceIdFingerprintColumns(target).map((index) => sourceIdFingerprintValue(values[index]))
  );
}

function sourceIdRowFingerprint(target: MinhHongSourceIdTarget, row: ExcelJS.Row) {
  return JSON.stringify(
    sourceIdFingerprintColumns(target).map((index) => {
      const cell = row.getCell(index + 1);
      return cell.formula
        ? sourceIdFormulaFingerprint(cell.formula)
        : sourceIdFingerprintValue(cell.value);
    })
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
  const rowChecks: MinhHongSourceIdRowCheck[] = [];
  const validRowsById = new Map<string, Array<{ rowNumber: number; target: MinhHongSourceIdTarget }>>();
  const usedIds = new Set<string>();
  const summaries = new Map<MinhHongSourceIdTarget["id"], MinhHongSourceIdTargetSummary>();
  let requiresPartnerDiscountSetup = false;
  let requiresPartnerPayableFormulaSetup = false;

  const hasUnifiedPartnerSheet = Boolean(legacyWorkbook.getWorksheet(UNIFIED_PARTNER_SHEET_NAME));
  const targetsForScope = MINHHONG_SOURCE_ID_TARGETS.filter((target) => {
    if (target.id === "customer-orders") return scope !== "partners";
    if (scope === "service-orders") return false;
    if (hasUnifiedPartnerSheet) return target.id === "partner-ledger";
    return target.id !== "partner-ledger";
  });

  for (const target of targetsForScope) {
    const workbook = target.kind === "legacy" ? legacyWorkbook : manualWorkbook;
    const worksheet = getWorksheet(workbook, target.sheetName);
    const spreadsheetId = spreadsheetIds[target.kind];
    const summary: MinhHongSourceIdTargetSummary = {
      hidden: Boolean(worksheet.getColumn(target.sourceIdColumn).hidden),
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
      values: sourceIdFingerprintColumns(target).map((index) => clean(headerRow.getCell(index + 1).value)),
    }));
    rowChecks.push({
      kind: target.kind,
      rowFingerprint: sourceIdRowFingerprint(target, headerRow),
      rowNumber: target.headerRow,
      sheetName: target.sheetName,
      sourceId: headerValue,
      spreadsheetId,
    });

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

    if (target.id === "partner-ledger") {
      const discountHeaderValue = clean(headerRow.getCell(PARTNER_DISCOUNT_COLUMN).value);
      const discountMigration = inspectPartnerDiscountValueRepairs(worksheet, target.firstDataRow);
      const payableFormulaRange = inspectPartnerPayableFormulaRange(worksheet, target.firstDataRow);
      summary.discountFormatStartRow = target.firstDataRow;
      if (discountMigration.repairs.length > 0) summary.discountValueRepairs = discountMigration.repairs;
      headerConflicts.push(...discountMigration.conflicts);
      if (payableFormulaRange) {
        summary.payableFormulaEndRow = payableFormulaRange.endRow;
        summary.payableFormulaFingerprint = payableFormulaRange.fingerprint;
        summary.payableFormulaReady = payableFormulaRange.ready;
        summary.payableFormulaStartRow = payableFormulaRange.startRow;
        requiresPartnerPayableFormulaSetup = requiresPartnerPayableFormulaSetup || !payableFormulaRange.ready;
      }
      requiresPartnerDiscountSetup = Boolean(worksheet.getColumn(PARTNER_DISCOUNT_COLUMN).hidden)
        || !isPreparedPartnerDiscountRange(worksheet, summary.discountFormatStartRow);
      if (!discountHeaderValue) {
        assignments.push({
          kind: target.kind,
          range: `${quoteSourceSheetName(target.sheetName)}!${sourceIdColumnLetter(PARTNER_DISCOUNT_COLUMN)}${target.headerRow}`,
          rowFingerprint: sourceIdRowFingerprint(target, headerRow),
          rowNumber: target.headerRow,
          sheetName: target.sheetName,
          spreadsheetId,
          value: PARTNER_DISCOUNT_HEADER,
        });
      } else if (discountHeaderValue.toLocaleLowerCase("vi-VN") !== PARTNER_DISCOUNT_HEADER.toLocaleLowerCase("vi-VN")) {
        headerConflicts.push(
          `${target.sheetName}: ô tiêu đề ${sourceIdColumnLetter(PARTNER_DISCOUNT_COLUMN)}${target.headerRow} đang có dữ liệu khác, không thể dùng làm cột chiết khấu.`
        );
      }
    }

    for (let rowNumber = target.firstDataRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      fingerprintRows.push(JSON.stringify({
        rowNumber,
        target: target.id,
        values: sourceIdFingerprintColumns(target).map((index) => clean(row.getCell(index + 1).value)),
      }));
      if (!isSourceIdBusinessRow(target, row)) continue;

      summary.totalRows += 1;
      const sourceId = clean(row.getCell(target.sourceIdColumn).value);
      rowChecks.push({
        kind: target.kind,
        rowFingerprint: sourceIdRowFingerprint(target, row),
        rowNumber,
        sheetName: target.sheetName,
        sourceId,
        spreadsheetId,
      });
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
  const canApply = invalidRows === 0 && duplicateRows === 0 && headerConflicts.length === 0;

  return {
    assignments,
    canApply,
    duplicateRows,
    fingerprint,
    headerConflicts,
    headerWrites,
    invalidRows,
    issues,
    missingRows,
    requiresSetup: canApply && (
      assignments.length > 0
      || targets.some((target) => !target.hidden)
      || requiresPartnerDiscountSetup
      || requiresPartnerPayableFormulaSetup
    ),
    rowChecks,
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

function partnerCodeFromName(name: string) {
  const normalizedName = clean(name).toLocaleLowerCase("vi-VN");
  const known = PARTNER_ROWS.find((row) => clean(row[1]).toLocaleLowerCase("vi-VN") === normalizedName);
  if (known) return clean(known[0]);

  const generated = clean(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return generated ? `DT_${generated}` : "KHAC";
}

function buildUnifiedPartnerActivityRows(legacyWorkbook: ExcelJS.Workbook, issues: SourceIssue[]) {
  const worksheet = getWorksheet(legacyWorkbook, UNIFIED_PARTNER_SHEET_NAME);
  const purchaseRows: CellValue[][] = [];
  const paymentRows: CellValue[][] = [];
  const returnRows: CellValue[][] = [];
  const runningBalances = new Map<string, number>();
  const partners = new Map<string, CellValue[]>();

  MINHHONG_PARTNER_SHEET_COLUMNS.slice(0, 11).forEach((expected, index) => {
    const actual = clean(worksheet.getRow(1).getCell(index + 1).value);
    if (actual !== expected) {
      pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME}: cột ${index + 1} phải là "${expected}".`);
    }
  });
  const discountHeader = clean(worksheet.getRow(1).getCell(13).value);
  if (discountHeader && discountHeader !== MINHHONG_PARTNER_SHEET_COLUMNS[12]) {
    pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME}: cột 13 phải là "${MINHHONG_PARTNER_SHEET_COLUMNS[12]}".`);
  }

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const partnerName = clean(row.getCell(2).value);
    const typeText = clean(row.getCell(3).value).toLocaleLowerCase("vi-VN");
    const description = clean(row.getCell(4).value);
    const hasContent = Array.from({ length: 11 }, (_, index) => clean(row.getCell(index + 1).value)).some(Boolean);
    if (!hasContent) continue;

    const partnerCode = partnerCodeFromName(partnerName);
    if (partnerName && !partners.has(partnerCode)) {
      partners.set(partnerCode, [
        partnerCode,
        partnerName,
        "Đối tác công nợ",
        "",
        `Nhập từ tab ${UNIFIED_PARTNER_SHEET_NAME}`,
        "Đang theo dõi",
      ]);
    }
    const dateText = normalizeSourceDate(row.getCell(1).value, `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}`, issues);
    const quantity = parseQuantity(row.getCell(5).value);
    const unitPrice = money(row.getCell(6).value);
    const grossAmount = money(row.getCell(7).value);
    const discountPercent = percentage(row.getCell(13));
    let amount = grossAmount;
    let discountAmount = 0;
    const paymentMethod = clean(row.getCell(8).value);
    const notes = clean(row.getCell(9).value);
    const statedBalanceText = clean(row.getCell(10).value);
    const statedBalance = money(row.getCell(10).value);
    const countsInDebt = isDebtCounted(row.getCell(11).value);
    const isPurchase = typeText === "mua hàng" || typeText === "mua hang";
    const isAdjustment = typeText === "điều chỉnh" || typeText === "dieu chinh";
    const sourceId = stableSourceId(row, "partner-ledger", String(rowNumber).padStart(4, "0"));
    const source = sourceReference(`${UNIFIED_PARTNER_SHEET_NAME}!A${rowNumber}:M${rowNumber}`, sourceId);

    if (!partnerName || !description) {
      pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: thiếu đối tác hoặc nội dung giao dịch.`);
      continue;
    }
    if (Number.isNaN(discountPercent)) {
      pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: chiết khấu phải nằm trong khoảng 0 đến 100%.`);
    } else if (discountPercent !== null) {
      if (!isPurchase) {
        pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: chiết khấu chỉ áp dụng cho giao dịch mua hàng.`);
      } else if (typeof quantity !== "number" || unitPrice <= 0) {
        pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: cần số lượng và đơn giá để tính chiết khấu.`);
      } else {
        const purchaseAmounts = calculatePartnerPurchaseAmounts(quantity, unitPrice, discountPercent);
        amount = purchaseAmounts.netAmount;
        discountAmount = purchaseAmounts.discountAmount;
      }
    }
    const isFullyDiscountedPurchase = isPurchase && discountPercent === 100 && grossAmount > 0;
    if (countsInDebt && (isAdjustment ? amount === 0 : amount <= 0 && !isFullyDiscountedPurchase)) {
      pushIssue(
        issues,
        "blocking",
        `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: giao dịch tính công nợ phải có số tiền ${isAdjustment ? "khác 0" : "lớn hơn 0"}.`
      );
    }
    if (!isAdjustment && grossAmount > 0 && typeof quantity === "number" && unitPrice > 0 && Math.round(quantity * unitPrice) !== grossAmount) {
      pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: số lượng × đơn giá không khớp số tiền.`);
    }

    let signedAmount = 0;
    if (typeText === "số dư đầu kỳ" || typeText === "so du dau ky" || typeText === "mua hàng" || typeText === "mua hang" || isAdjustment) {
      signedAmount = amount;
      const openingBalance = typeText.includes("đầu kỳ") || typeText.includes("dau ky");
      purchaseRows.push([
        `DP-NH-${String(rowNumber).padStart(4, "0")}`,
        dateText,
        partnerCode,
        partnerName,
        openingBalance ? "Chốt công nợ" : isAdjustment ? "Điều chỉnh" : partnerName,
        description,
        openingBalance ? "Số dư chốt" : isAdjustment ? "Điều chỉnh" : "Mua hàng",
        quantity,
        "",
        unitPrice || "",
        discountPercent ?? "",
        discountAmount,
        amount,
        "",
        countsInDebt ? "Có" : "Không",
        notes,
        source,
      ]);
    } else if (typeText === "thanh toán" || typeText === "thanh toan") {
      signedAmount = -amount;
      paymentRows.push([
        `DP-TT-${String(rowNumber).padStart(4, "0")}`,
        dateText,
        partnerCode,
        partnerName,
        amount,
        paymentMethod,
        countsInDebt ? "Có" : "Không",
        notes || description,
        source,
      ]);
    } else if (typeText === "trả hàng" || typeText === "tra hang") {
      signedAmount = -amount;
      returnRows.push([
        `DP-TR-${String(rowNumber).padStart(4, "0")}`,
        dateText,
        partnerCode,
        partnerName,
        description,
        "Trả hàng",
        quantity,
        unitPrice || "",
        amount,
        countsInDebt ? "Có" : "Không",
        notes,
        source,
      ]);
    } else {
      pushIssue(issues, "blocking", `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: loại giao dịch chưa hợp lệ.`);
      continue;
    }

    const previousBalance = runningBalances.get(partnerCode) || 0;
    const nextBalance = previousBalance + (countsInDebt ? signedAmount : 0);
    runningBalances.set(partnerCode, nextBalance);
    if (statedBalanceText && statedBalance !== nextBalance) {
      pushIssue(
        issues,
        "blocking",
        `${UNIFIED_PARTNER_SHEET_NAME} dòng ${rowNumber}: còn phải trả ${statedBalance.toLocaleString("vi-VN")} không khớp số tính được ${nextBalance.toLocaleString("vi-VN")}.`
      );
    }
  }

  return { partnerRows: [...partners.values()], paymentRows, purchaseRows, returnRows };
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
        "",
        0,
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
      "",
      0,
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
      "",
      0,
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
      "",
      0,
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

function isAdjustmentPurchaseRow(row: CellValue[]) {
  const text = `${clean(row[4])} ${clean(row[6])}`.toLocaleLowerCase("vi-VN");
  return text.includes("điều chỉnh") || text.includes("dieu chinh");
}

function buildPartnerReconciliationTotals(purchaseRows: CellValue[][], paymentRows: CellValue[][], returnRows: CellValue[][]) {
  const longPurchaseRows = purchaseRows.filter((row) => isLongRow(row, 2, 3));
  const longPaymentRows = paymentRows.filter((row) => isLongRow(row, 2, 3));
  const longReturnRows = returnRows.filter((row) => isLongRow(row, 2, 3));
  const openingBalance = longPurchaseRows
    .filter((row) => isDebtCounted(row[14]) && isOpeningPurchaseRow(row))
    .reduce((sum, row) => sum + money(row[12]), 0);
  const countedPurchase = longPurchaseRows
    .filter((row) => isDebtCounted(row[14]) && !isOpeningPurchaseRow(row) && !isAdjustmentPurchaseRow(row))
    .reduce((sum, row) => sum + money(row[12]), 0);
  const countedAdjustment = longPurchaseRows
    .filter((row) => isDebtCounted(row[14]) && isAdjustmentPurchaseRow(row))
    .reduce((sum, row) => sum + money(row[12]), 0);
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
    payable: openingBalance + countedPurchase + countedAdjustment - countedPayment - countedReturn,
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
  void scope; // Retain the public call shape while every scope uses the unified source workbook.
  const exports: SourceExport[] = [];
  if (!hasGoogleServiceAccountCredentials()) {
    throw new MinhHongSourceSheetFetchError(
      "Kết nối Google Sheet chưa được cấu hình trên máy chủ. Hãy liên hệ người quản trị rồi thử lại.",
      503
    );
  }
  const accessToken = await getGoogleAccessToken(fetchImpl);

  for (const source of MINHHONG_SOURCE_SHEET_EXPORTS) {
    if (source.kind !== "legacy") continue;
    const response = await fetchImpl(
      buildSourceSheetExportUrl(source.spreadsheetId),
      { headers: { Authorization: "Bearer " + accessToken } }
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

interface GoogleSheetProtectedRange {
  description?: string;
  protectedRangeId?: number;
  range?: {
    endColumnIndex?: number;
    endRowIndex?: number;
    sheetId?: number;
    startColumnIndex?: number;
    startRowIndex?: number;
  };
  warningOnly?: boolean;
}

async function fetchPartnerSheetSetupMetadata(
  accessToken: string,
  spreadsheetId: string,
  fetchImpl: typeof fetch
) {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title),sheets.protectedRanges(protectedRangeId,description,warningOnly,range)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json() as {
    error?: { message?: string };
    sheets?: Array<{
      properties?: { sheetId?: number; title?: string };
      protectedRanges?: GoogleSheetProtectedRange[];
    }>;
  };
  if (!response.ok) throw new Error(data.error?.message || "Không đọc được metadata Google Sheet đối tác.");
  const sheet = (data.sheets || []).find((item) => item.properties?.title === UNIFIED_PARTNER_SHEET_NAME);
  const sheetId = sheet?.properties?.sheetId;
  if (!Number.isFinite(sheetId)) throw new Error("Không tìm thấy sheet nguồn Đơn đối tác để bảo vệ công thức công nợ.");
  return {
    protectedRanges: sheet?.protectedRanges || [],
    sheetId: sheetId as number,
  };
}

function buildPartnerPayableProtectionRequest(
  sheetId: number,
  startRow: number | undefined,
  endRow: number | undefined,
  protectedRanges: GoogleSheetProtectedRange[]
) {
  if (!startRow || !endRow) return null;
  const range = {
    endColumnIndex: PARTNER_PAYABLE_COLUMN,
    endRowIndex: endRow,
    sheetId,
    startColumnIndex: PARTNER_PAYABLE_COLUMN - 1,
    startRowIndex: startRow - 1,
  };
  const exactProtection = protectedRanges.find((item) => (
    item.range?.sheetId === range.sheetId
    && item.range?.startRowIndex === range.startRowIndex
    && item.range?.endRowIndex === range.endRowIndex
    && item.range?.startColumnIndex === range.startColumnIndex
    && item.range?.endColumnIndex === range.endColumnIndex
  ));
  if (
    exactProtection?.description === PARTNER_PAYABLE_PROTECTION_DESCRIPTION
    && exactProtection.warningOnly !== true
  ) return null;

  const managedProtection = protectedRanges.find((item) => (
    item.description === PARTNER_PAYABLE_PROTECTION_DESCRIPTION
    && Number.isFinite(item.protectedRangeId)
  ));
  if (managedProtection) {
    return {
      updateProtectedRange: {
        fields: "description,range,warningOnly",
        protectedRange: {
          description: PARTNER_PAYABLE_PROTECTION_DESCRIPTION,
          protectedRangeId: managedProtection.protectedRangeId,
          range,
          warningOnly: false,
        },
      },
    };
  }

  return {
    addProtectedRange: {
      protectedRange: {
        description: PARTNER_PAYABLE_PROTECTION_DESCRIPTION,
        range,
        warningOnly: false,
      },
    },
  };
}

async function fetchSheetGridProperties(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  fetchImpl: typeof fetch
) {
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties(columnCount))`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Không đọc được kích thước Google Sheet nguồn.");
  const sheet = (data.sheets || []).find((item: {
    properties?: { title?: string };
  }) => item.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  const columnCount = sheet?.properties?.gridProperties?.columnCount;
  if (!Number.isFinite(sheetId) || !Number.isFinite(columnCount)) {
    throw new Error(`Không đọc được kích thước sheet nguồn ${sheetName}.`);
  }
  return { columnCount: columnCount as number, sheetId: sheetId as number };
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
  if (!legacy) throw new Error("Thiếu raw source Sheet export để kiểm tra source_id.");

  const legacyWorkbook = new ExcelJS.Workbook();
  const manualWorkbook = new ExcelJS.Workbook();
  await legacyWorkbook.xlsx.load(legacy.buffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]);
  if (scope !== "service-orders" && !manual && !legacyWorkbook.getWorksheet(UNIFIED_PARTNER_SHEET_NAME)) {
    throw new Error("Thiếu raw source Sheet export để kiểm tra source_id.");
  }
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

function sourceIdRowTarget(row: Pick<MinhHongSourceIdAssignment, "kind" | "sheetName">) {
  const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => (
    item.kind === row.kind && item.sheetName === row.sheetName
  ));
  if (!target) throw new Error(`Khong tim thay cau hinh Sheet nguon ${row.sheetName}.`);
  return target;
}

async function assertSourceIdRowsStillCurrent(
  accessToken: string,
  spreadsheetId: string,
  rowChecks: MinhHongSourceIdRowCheck[],
  fetchImpl: typeof fetch
) {
  const ranges = rowChecks.map((rowCheck) => (
    sourceIdRowRange(sourceIdRowTarget(rowCheck), rowCheck.rowNumber)
  ));

  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGetByDataFilter`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataFilters: ranges.map((a1Range) => ({ a1Range })),
        dateTimeRenderOption: "SERIAL_NUMBER",
        majorDimension: "ROWS",
        valueRenderOption: "FORMULA",
      }),
    }
  );
  const data = await response.json() as {
    error?: { message?: string };
    valueRanges?: Array<{
      dataFilters?: Array<{ a1Range?: string }>;
      valueRange?: { range?: string; values?: CellValue[][] };
    }>;
  };
  if (!response.ok) {
    throw new Error(data.error?.message || "Không đọc lại được các ô source_id ngay trước khi ghi.");
  }

  const valueRanges = data.valueRanges || [];
  if (valueRanges.length !== rowChecks.length) {
    throw new MinhHongSourceIdPlanChangedError();
  }

  const valuesByRange = new Map<string, CellValue[][]>();
  const requestedRanges = new Set(ranges);
  for (const matchedRange of valueRanges) {
    const matchingRanges = new Set([
      ...(matchedRange.dataFilters || []).map((filter) => filter.a1Range),
      matchedRange.valueRange?.range,
    ].filter((range): range is string => Boolean(range && requestedRanges.has(range))));
    if (matchingRanges.size !== 1) {
      throw new MinhHongSourceIdPlanChangedError();
    }
    const [range] = matchingRanges;
    if (valuesByRange.has(range)) throw new MinhHongSourceIdPlanChangedError();
    valuesByRange.set(range, matchedRange.valueRange?.values || []);
  }

  for (const rowCheck of rowChecks) {
    const target = sourceIdRowTarget(rowCheck);
    const rows = valuesByRange.get(sourceIdRowRange(target, rowCheck.rowNumber));
    if (!rows) throw new MinhHongSourceIdPlanChangedError();
    if (rows.length > 1) throw new MinhHongSourceIdPlanChangedError();
    const values = rows[0] || [];
    const currentFingerprint = sourceIdValuesFingerprint(target, values);
    if (
      clean(values[target.sourceIdColumn - 1]) !== rowCheck.sourceId
      || currentFingerprint !== rowCheck.rowFingerprint
    ) {
      throw new MinhHongSourceIdPlanChangedError();
    }
  }
}

async function ensurePartnerDiscountColumnCapacity(
  accessToken: string,
  plan: MinhHongSourceIdPlan,
  fetchImpl: typeof fetch
) {
  let changed = false;
  const headerAssignments = plan.assignments.filter((assignment) => (
    assignment.value === PARTNER_DISCOUNT_HEADER
    && assignment.range === `${quoteSourceSheetName(UNIFIED_PARTNER_SHEET_NAME)}!M1`
  ));

  for (const assignment of headerAssignments) {
    const { columnCount, sheetId } = await fetchSheetGridProperties(
      accessToken,
      assignment.spreadsheetId,
      assignment.sheetName,
      fetchImpl
    );
    if (columnCount >= PARTNER_DISCOUNT_COLUMN) continue;

    const response = await fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${assignment.spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            appendDimension: {
              dimension: "COLUMNS",
              length: PARTNER_DISCOUNT_COLUMN - columnCount,
              sheetId,
            },
          }],
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Không tạo được cột chiết khấu trên Google Sheet nguồn.");
    changed = true;
  }
  return changed;
}

export async function applyMinhHongSourceIdPlan(
  plan: MinhHongSourceIdPlan,
  reviewedFingerprint: string,
  currentExports: SourceExport[],
  fetchImpl: typeof fetch = fetch,
  scope: MinhHongImportScope = "all"
) {
  if (!plan.canApply) {
    throw new Error("Sheet nguồn có source_id sai hoặc trùng; chưa ghi bất kỳ ô nào.");
  }

  if (plan.fingerprint !== reviewedFingerprint) {
    throw new MinhHongSourceIdPlanChangedError();
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
  const accessToken = await getGoogleAccessToken(fetchImpl);
  const assignmentsBySpreadsheet = new Map<string, MinhHongSourceIdAssignment[]>();
  for (const assignment of currentPlan.assignments) {
    assignmentsBySpreadsheet.set(assignment.spreadsheetId, [
      ...(assignmentsBySpreadsheet.get(assignment.spreadsheetId) || []),
      assignment,
    ]);
  }
  const rowChecksBySpreadsheet = new Map<string, MinhHongSourceIdRowCheck[]>();
  for (const rowCheck of currentPlan.rowChecks) {
    rowChecksBySpreadsheet.set(rowCheck.spreadsheetId, [
      ...(rowChecksBySpreadsheet.get(rowCheck.spreadsheetId) || []),
      rowCheck,
    ]);
  }

  for (const [spreadsheetId, rowChecks] of rowChecksBySpreadsheet.entries()) {
    await assertSourceIdRowsStillCurrent(accessToken, spreadsheetId, rowChecks, fetchImpl);
  }
  const capacityChanged = await ensurePartnerDiscountColumnCapacity(accessToken, currentPlan, fetchImpl);
  if (capacityChanged) {
    for (const [spreadsheetId, rowChecks] of rowChecksBySpreadsheet.entries()) {
      await assertSourceIdRowsStillCurrent(accessToken, spreadsheetId, rowChecks, fetchImpl);
    }
  }
  if (currentPlan.assignments.length === 0) return { updatedCells: 0 };

  let updatedCells = 0;
  for (const [spreadsheetId, assignments] of assignmentsBySpreadsheet.entries()) {
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

async function assertPartnerDiscountValueRepairsStillCurrent(
  accessToken: string,
  spreadsheetId: string,
  summary: MinhHongSourceIdTargetSummary,
  fetchImpl: typeof fetch
) {
  for (const repair of summary.discountValueRepairs || []) {
    const range = `${quoteSourceSheetName(UNIFIED_PARTNER_SHEET_NAME)}!M${repair.rowNumber}`;
    const response = await fetchImpl(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=true&ranges=${encodeURIComponent(range)}&fields=sheets.data.rowData.values(userEnteredValue,userEnteredFormat.numberFormat.pattern)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await response.json() as {
      error?: { message?: string };
      sheets?: Array<{
        data?: Array<{
          rowData?: Array<{
            values?: Array<{
              userEnteredFormat?: { numberFormat?: { pattern?: string } };
              userEnteredValue?: { numberValue?: number };
            }>;
          }>;
        }>;
      }>;
    };
    if (!response.ok) {
      throw new Error(data.error?.message || "Không đọc lại được giá trị chiết khấu cũ trước khi chuyển đổi.");
    }
    const currentCell = data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
    const currentValue = currentCell?.userEnteredValue?.numberValue;
    const currentNumberFormat = currentCell?.userEnteredFormat?.numberFormat?.pattern || "";
    if (
      typeof currentValue !== "number"
      || normalizedSourceIdNumber(currentValue) !== normalizedSourceIdNumber(repair.currentValue)
      || currentNumberFormat !== repair.currentNumberFormat
    ) {
      throw new MinhHongSourceIdPlanChangedError();
    }
  }
}

async function assertPartnerPayableFormulaRangeStillCurrent(
  accessToken: string,
  spreadsheetId: string,
  summary: MinhHongSourceIdTargetSummary,
  fetchImpl: typeof fetch
) {
  const startRow = summary.payableFormulaStartRow;
  const endRow = summary.payableFormulaEndRow;
  const expectedFingerprint = summary.payableFormulaFingerprint;
  if (!startRow || !endRow || !expectedFingerprint) return;

  const range = `${quoteSourceSheetName(UNIFIED_PARTNER_SHEET_NAME)}!J${startRow}:J${endRow}`;
  const response = await fetchImpl(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const data = await response.json() as { error?: { message?: string }; values?: CellValue[][] };
  if (!response.ok) {
    throw new Error(data.error?.message || "Không đọc lại được công thức công nợ đối tác trước khi sửa.");
  }

  const values = data.values || [];
  const currentFingerprint = partnerPayableFormulaRangeFingerprint(startRow, endRow, (rowNumber) => {
    const value = values[rowNumber - startRow]?.[0];
    return {
      formula: typeof value === "string" && value.startsWith("=") ? value : undefined,
      value,
    };
  });
  if (currentFingerprint !== expectedFingerprint) throw new MinhHongSourceIdPlanChangedError();
}

export async function applyMinhHongSourceSheetSetup(
  plan: MinhHongSourceIdPlan,
  sourceExports: SourceExport[],
  fetchImpl: typeof fetch = fetch
) {
  if (!plan.canApply) {
    throw new Error("Sheet nguồn chưa đủ điều kiện để hoàn tất thiết lập.");
  }

  const accessToken = await getGoogleAccessToken(fetchImpl);
  const requestsBySpreadsheet = new Map<string, Array<Record<string, unknown>>>();

  for (const summary of plan.targets) {
    const target = MINHHONG_SOURCE_ID_TARGETS.find((item) => item.id === summary.id);
    if (!target) continue;
    const source = sourceExports.find((item) => item.kind === target.kind);
    if (!source) throw new Error(`Không tìm thấy Sheet nguồn cho ${target.sheetName}.`);

    const partnerSheetMetadata = target.id === "partner-ledger"
      ? await fetchPartnerSheetSetupMetadata(accessToken, source.spreadsheetId, fetchImpl)
      : null;
    const sheetId = partnerSheetMetadata?.sheetId
      ?? await fetchSheetId(accessToken, source.spreadsheetId, target.sheetName, fetchImpl);
    const discountFormatStartRow = target.id === "partner-ledger"
      ? summary.discountFormatStartRow || target.firstDataRow
      : undefined;
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
    if (target.id === "partner-ledger") {
      if (summary.discountValueRepairs?.length) {
        await assertPartnerDiscountValueRepairsStillCurrent(
          accessToken,
          source.spreadsheetId,
          summary,
          fetchImpl
        );
      }
      if (summary.payableFormulaReady === false) {
        await assertPartnerPayableFormulaRangeStillCurrent(
          accessToken,
          source.spreadsheetId,
          summary,
          fetchImpl
        );
      }
      requests.push(
        {
          updateDimensionProperties: {
            range: {
              dimension: "COLUMNS",
              endIndex: PARTNER_DISCOUNT_COLUMN,
              sheetId,
              startIndex: PARTNER_DISCOUNT_COLUMN - 1,
            },
            properties: { hiddenByUser: false },
            fields: "hiddenByUser",
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startColumnIndex: PARTNER_DISCOUNT_COLUMN - 1,
              startRowIndex: (discountFormatStartRow || target.firstDataRow) - 1,
              endColumnIndex: PARTNER_DISCOUNT_COLUMN,
            },
            cell: {
              dataValidation: {
                condition: {
                  type: "CUSTOM_FORMULA",
                  values: [{
                    userEnteredValue: buildPartnerDiscountSheetValidationFormula(target.firstDataRow),
                  }],
                },
                inputMessage: PARTNER_DISCOUNT_SHEET_INPUT_MESSAGE,
                strict: true,
              },
              userEnteredFormat: {
                numberFormat: { type: "NUMBER", pattern: PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT },
              },
            },
            fields: "dataValidation,userEnteredFormat.numberFormat",
          },
        }
      );
      const payableProtectionRequest = buildPartnerPayableProtectionRequest(
        sheetId,
        summary.payableFormulaStartRow,
        summary.payableFormulaEndRow,
        partnerSheetMetadata?.protectedRanges || []
      );
      if (payableProtectionRequest) requests.push(payableProtectionRequest);
      for (const repair of summary.discountValueRepairs || []) {
        requests.push({
          updateCells: {
            range: {
              endColumnIndex: PARTNER_DISCOUNT_COLUMN,
              endRowIndex: repair.rowNumber,
              sheetId,
              startColumnIndex: PARTNER_DISCOUNT_COLUMN - 1,
              startRowIndex: repair.rowNumber - 1,
            },
            rows: [{
              values: [{ userEnteredValue: { numberValue: repair.correctedValue } }],
            }],
            fields: "userEnteredValue",
          },
        });
      }
      if (
        summary.payableFormulaReady === false
        && summary.payableFormulaStartRow
        && summary.payableFormulaEndRow
      ) {
        requests.push(
          {
            repeatCell: {
              range: {
                endColumnIndex: PARTNER_PAYABLE_COLUMN,
                endRowIndex: summary.payableFormulaEndRow,
                sheetId,
                startColumnIndex: PARTNER_PAYABLE_COLUMN - 1,
                startRowIndex: summary.payableFormulaStartRow - 1,
              },
              cell: {},
              fields: "userEnteredValue",
            },
          },
          {
            repeatCell: {
              range: {
                endColumnIndex: PARTNER_PAYABLE_COLUMN,
                endRowIndex: summary.payableFormulaEndRow,
                sheetId,
                startColumnIndex: PARTNER_PAYABLE_COLUMN - 1,
                startRowIndex: summary.payableFormulaStartRow - 1,
              },
              cell: {
                userEnteredValue: {
                  formulaValue: buildPartnerPayableSheetFormula(summary.payableFormulaStartRow),
                },
              },
              fields: "userEnteredValue",
            },
          }
        );
      }
    }
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
    if (!response.ok) throw new Error(data.error?.message || "Không hoàn tất được thiết lập Google Sheet.");
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
  } else if (scope !== "service-orders" && !legacyWorkbook.getWorksheet(UNIFIED_PARTNER_SHEET_NAME)) {
    throw new Error("Thiếu raw source Sheet đối tác để tạo preview import.");
  }

  const result = await buildMinhHongSourceImportPreview(
    legacyWorkbook,
    manualWorkbook,
    {
      legacy: getSourceSheetExportByKind("legacy").spreadsheetId,
      manual: getSourceSheetExportByKind("manual").spreadsheetId,
    },
    false,
    scope
  );
  return result.buffer;
}

async function buildMinhHongSourceImportPreview(
  legacyWorkbook: ExcelJS.Workbook,
  manualWorkbook: ExcelJS.Workbook,
  spreadsheetIds: Record<SourceExportKind, string>,
  generateAssignments: boolean,
  scope: MinhHongImportScope
) {
  const outputWorkbook = new ExcelJS.Workbook();
  const issues: SourceIssue[] = [];
  const sourceIdPlan = inspectMinhHongSourceIds(
    legacyWorkbook,
    manualWorkbook,
    spreadsheetIds,
    generateAssignments,
    scope
  );
  pushSourceIdImportIssues(sourceIdPlan, issues);
  const includePartnerLedger = scope !== "service-orders";
  const unifiedPartnerRows = includePartnerLedger && legacyWorkbook.getWorksheet(UNIFIED_PARTNER_SHEET_NAME)
    ? buildUnifiedPartnerActivityRows(legacyWorkbook, issues)
    : null;
  const purchaseRows = includePartnerLedger
    ? unifiedPartnerRows?.purchaseRows || buildPurchaseRows(legacyWorkbook, manualWorkbook, issues)
    : [];
  const paymentRows = includePartnerLedger
    ? unifiedPartnerRows?.paymentRows || buildPaymentRows(legacyWorkbook, manualWorkbook, issues)
    : [];
  const returnRows = includePartnerLedger
    ? unifiedPartnerRows?.returnRows || buildReturnRows(legacyWorkbook)
    : [];
  const customerRows = buildCustomerRows(legacyWorkbook, issues);
  const reconciliationRows = buildReconciliationRows(purchaseRows, paymentRows, returnRows, customerRows, issues);

  appendRows(
    outputWorkbook.addWorksheet("Đối tác"),
    MINHHONG_PARTNER_COLUMNS,
    includePartnerLedger ? unifiedPartnerRows?.partnerRows || PARTNER_ROWS : []
  );
  appendRows(outputWorkbook.addWorksheet("Nhập hàng"), MINHHONG_PURCHASE_COLUMNS, purchaseRows);
  appendRows(outputWorkbook.addWorksheet("Thanh toán"), MINHHONG_PAYMENT_COLUMNS, paymentRows);
  appendRows(outputWorkbook.addWorksheet("Trả hàng"), MINHHONG_RETURN_COLUMNS, returnRows);
  appendRows(outputWorkbook.addWorksheet("Đơn khách"), MINHHONG_CUSTOMER_ORDER_COLUMNS, customerRows);
  appendRows(outputWorkbook.addWorksheet("Đối soát"), ["Khoá", "Nhãn", "Giá trị kỳ vọng", "Ghi chú"], reconciliationRows);

  return {
    buffer: Buffer.from(await outputWorkbook.xlsx.writeBuffer()),
    sourceIdPlan,
  };
}

export async function buildMinhHongSourceImportWorkbookFromExports(
  exports: SourceExport[],
  scope: MinhHongImportScope = "all"
) {
  const legacy = exports.find((item) => item.kind === "legacy");
  const manual = exports.find((item) => item.kind === "manual");
  if (!legacy) {
    throw new Error("Thiếu raw source Sheet export để tạo preview import.");
  }
  if (scope !== "service-orders" && !manual) {
    const legacyWorkbook = new ExcelJS.Workbook();
    await legacyWorkbook.xlsx.load(legacy.buffer as unknown as Parameters<typeof legacyWorkbook.xlsx.load>[0]);
    if (!legacyWorkbook.getWorksheet(UNIFIED_PARTNER_SHEET_NAME)) {
      throw new Error("Thiếu raw source Sheet export để tạo preview import.");
    }
  }
  return buildMinhHongSourceImportWorkbook({
    legacyWorkbookBuffer: legacy.buffer,
    manualWorkbookBuffer: manual?.buffer,
  }, scope);
}

export async function buildMinhHongSourceImportPreviewFromExports(
  exports: SourceExport[],
  scope: MinhHongImportScope = "all"
) {
  const { legacyWorkbook, manualWorkbook, spreadsheetIds } = await loadMinhHongSourceIdWorkbooks(exports, scope);
  return buildMinhHongSourceImportPreview(
    legacyWorkbook,
    manualWorkbook,
    spreadsheetIds,
    true,
    scope
  );
}
