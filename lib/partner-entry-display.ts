interface PartnerEntryDisplayInput {
  discountAmount?: number | null;
  discountPercent?: number | null;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  paymentMethod: string | null;
  sourceName?: string | null;
  sourceCode?: string | null;
  sourceRow?: number | null;
}

function formatMoney(value: number) {
  return `${value.toLocaleString("vi-VN")}đ`;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function getPartnerEntryDisplayDetails(entry: PartnerEntryDisplayInput) {
  const quantity = entry.quantity && entry.quantity > 0
    ? `${formatQuantity(entry.quantity)}${entry.unit ? ` ${entry.unit}` : ""}`
    : "";
  const unitPrice = entry.unitPrice && entry.unitPrice > 0 ? formatMoney(entry.unitPrice) : "";
  const linePrice = quantity && unitPrice ? `${quantity} × ${unitPrice}` : quantity || unitPrice;
  const hasDiscount = typeof entry.discountPercent === "number"
    && entry.discountPercent > 0
    && typeof entry.discountAmount === "number"
    && entry.discountAmount >= 0;
  const discount = hasDiscount
    ? `CK ${entry.discountPercent!.toLocaleString("vi-VN", { maximumFractionDigits: 2 })}% (${entry.discountAmount! > 0 ? "-" : ""}${formatMoney(entry.discountAmount!)})`
    : "";

  return [linePrice, discount, entry.paymentMethod].filter(Boolean).join(" · ");
}

export function getPartnerEntryAmountLabel(entryType: string) {
  if (entryType === "PURCHASE") return "Tiền mua hàng";
  if (entryType === "PAYMENT") return "Số tiền đã trả";
  if (entryType === "RETURN") return "Giá trị hàng trả";
  if (entryType === "OPENING_BALANCE") return "Số dư đầu kỳ";
  return "Giá trị điều chỉnh";
}

export function getPartnerEntryHistoryNote(countsInDebt: boolean) {
  return countsInDebt ? "" : "Bản ghi cũ, đã tính trong số dư đầu kỳ.";
}
