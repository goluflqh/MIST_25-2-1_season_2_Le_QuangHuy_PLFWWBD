export function calculateCouponDiscount(discount: string | null | undefined, quotedPrice: number | null | undefined) {
  const price = Math.max(Number(quotedPrice || 0), 0);
  const raw = String(discount || "").trim();

  if (!raw || price <= 0) return 0;

  const percentMatch = raw.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percentMatch) {
    const percent = Number.parseFloat(percentMatch[1].replace(",", "."));
    if (!Number.isFinite(percent) || percent <= 0) return 0;
    return Math.min(Math.floor((price * percent) / 100), price);
  }

  const amount = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  return Math.min(amount, price);
}

export function getPayableAmount(quotedPrice: number | null | undefined, discountAmount: number | null | undefined) {
  return Math.max(Number(quotedPrice || 0) - Number(discountAmount || 0), 0);
}

export function getRemainingAmount(
  quotedPrice: number | null | undefined,
  discountAmount: number | null | undefined,
  paidAmount: number | null | undefined
) {
  return Math.max(getPayableAmount(quotedPrice, discountAmount) - Number(paidAmount || 0), 0);
}
