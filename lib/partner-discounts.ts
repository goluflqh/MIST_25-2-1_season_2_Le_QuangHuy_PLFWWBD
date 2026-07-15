export interface PartnerPurchaseAmounts {
  discountAmount: number;
  discountPercent: number | null;
  grossAmount: number;
  netAmount: number;
}

export const PARTNER_DISCOUNT_SHEET_INPUT_MESSAGE = "Nhập số từ 0 đến 100, ví dụ 15 hoặc 15,5.";
export const PARTNER_DISCOUNT_SHEET_NUMBER_FORMAT = '0.##"%"';

export function buildPartnerDiscountSheetValidationFormula(rowNumber: number, separator = ";") {
  return `=AND(ISNUMBER(M${rowNumber})${separator}M${rowNumber}>=0${separator}M${rowNumber}<=100)`;
}

export function parsePartnerDiscountPercent(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const numericText = text.endsWith("%") ? text.slice(0, -1).trim() : text;
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(numericText)) {
    return Number.NaN;
  }
  const parsed = Number(numericText.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return Number.NaN;
  return parsed > 0 ? parsed : null;
}

function hasScalingPercentToken(numberFormat?: string) {
  if (!numberFormat) return false;
  let escaped = false;
  let quoted = false;
  for (const character of numberFormat) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') {
      quoted = !quoted;
      continue;
    }
    if (character === "%" && !quoted) return true;
  }
  return false;
}

export function parseExcelPartnerDiscountPercent(value: unknown, numberFormat?: string) {
  const resolvedValue = value && typeof value === "object" && "result" in value
    ? (value as { result?: unknown }).result
    : value;
  const normalizedValue = hasScalingPercentToken(numberFormat) && typeof resolvedValue === "number"
    ? resolvedValue * 100
    : resolvedValue;
  return parsePartnerDiscountPercent(normalizedValue);
}

export function calculatePartnerPurchaseAmounts(
  quantity: number,
  unitPrice: number,
  discountPercent: number | null | undefined
): PartnerPurchaseAmounts {
  const percent = discountPercent ?? 0;
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new RangeError("Chiết khấu phải nằm trong khoảng 0 đến 100%.");
  }

  const grossAmount = Math.round(quantity * unitPrice);
  const discountAmount = Math.round(grossAmount * percent / 100);

  return {
    discountAmount,
    discountPercent: percent > 0 ? percent : null,
    grossAmount,
    netAmount: Math.max(grossAmount - discountAmount, 0),
  };
}
