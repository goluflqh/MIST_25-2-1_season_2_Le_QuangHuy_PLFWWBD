export interface ServiceOrderPhoneInput {
  customerPhone?: string | null;
  customerPhoneMissing?: boolean | null;
  source?: string | null;
  sourceRow?: number | null;
}

export function buildImportedOrderPhonePlaceholder(sourceRow: number | null | undefined) {
  return `099${String(sourceRow || 0).padStart(7, "0").slice(-7)}`;
}

export function isImportedOrderPhonePlaceholder(order: ServiceOrderPhoneInput) {
  return order.customerPhoneMissing === true;
}

export function isLegacyImportedOrderPhonePlaceholder(order: ServiceOrderPhoneInput) {
  if (String(order.source || "").toUpperCase() !== "IMPORT") return false;
  return order.customerPhone === buildImportedOrderPhonePlaceholder(order.sourceRow);
}

export function getServiceOrderDisplayPhone(order: ServiceOrderPhoneInput) {
  return isImportedOrderPhonePlaceholder(order) ? "" : order.customerPhone || "";
}
