const priceNumberFormatter = new Intl.NumberFormat("vi-VN");
const ungroupedPriceToken = /(^|[^\d.])(\d{4,})(?=$|[^\d.])/g;

function formatStandalonePriceNumber(value: string) {
  const numericValue = Number(value);

  return Number.isSafeInteger(numericValue) ? priceNumberFormatter.format(numericValue) : value;
}

export function normalizePriceRange(price: string) {
  return price
    .trim()
    .replace(ungroupedPriceToken, (_, prefix: string, value: string) => `${prefix}${formatStandalonePriceNumber(value)}`)
    .replace(/\s*-\s*/g, "–");
}

export function hasPriceUnit(price: string) {
  return /(?:vnd|vnđ|đ)(?:\s*\/\s*[a-z0-9]+)?\s*$/iu.test(price.trim());
}

export function toValidPricingDate(value: unknown) {
  const date = value instanceof Date
    ? value
    : typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : null;

  return date && !Number.isNaN(date.getTime()) ? date : null;
}
