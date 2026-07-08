export interface PartnerLegacyInput {
  id?: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  notes?: string | null;
  balance?: number | null;
  ledgerEntries?: unknown[] | null;
}

function normalize(value: string | null | undefined) {
  return String(value || "")
    .toLocaleLowerCase("vi-VN")
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isLongPartner(partner: PartnerLegacyInput) {
  return normalize(partner.code) === "long" || normalize(partner.name) === "long";
}

export function isLegacyLongSourcePartner(partner: PartnerLegacyInput) {
  if (isLongPartner(partner)) return false;

  const notes = normalize(partner.notes);
  const code = normalize(partner.code);
  const type = normalize(partner.type);
  const hasDebt = Number(partner.balance || 0) !== 0;

  if (hasDebt) return false;
  if (notes.includes("nguon mua ho qua long")) return true;
  if (code === "khac" && type === "other") return true;
  return type === "other" && code.startsWith("dt_");
}

export function getVisibleDebtPartners<T extends PartnerLegacyInput>(partners: T[]) {
  return partners.filter((partner) => !isLegacyLongSourcePartner(partner));
}

export function summarizeLegacyLongRule() {
  return {
    openingBalance: 20_230_000,
    countedPurchase: 7_490_000,
    countedPayment: 15_000_000,
    payable: 12_720_000,
  };
}
