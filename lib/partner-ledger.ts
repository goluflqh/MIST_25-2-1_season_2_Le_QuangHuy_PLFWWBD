import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { parseMoneyText } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { normalizePhone, sanitizeText } from "@/lib/sanitize";

type PrismaRunner = typeof prisma | Prisma.TransactionClient;

export const partnerEntryTypes = [
  "OPENING_BALANCE",
  "PURCHASE",
  "PAYMENT",
  "RETURN",
  "ADJUSTMENT",
] as const;

export const partnerTypes = ["SUPPLIER", "SERVICE_PARTNER", "OTHER"] as const;

type PartnerEntryType = (typeof partnerEntryTypes)[number];
type PartnerType = (typeof partnerTypes)[number];

export const partnerInclude = {
  ledgerEntries: {
    where: { deletedAt: null },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  },
} satisfies Prisma.PartnerInclude;

export class PartnerLedgerValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "PartnerLedgerValidationError";
  }
}

function compactKey(value: unknown) {
  return sanitizeText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePartnerType(value: unknown): PartnerType {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (partnerTypes.includes(raw as PartnerType)) return raw as PartnerType;
  return "SUPPLIER";
}

export function normalizePartnerEntryType(value: unknown): PartnerEntryType {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (partnerEntryTypes.includes(raw as PartnerEntryType)) return raw as PartnerEntryType;

  const aliases: Record<string, PartnerEntryType> = {
    "cong no dau ky": "OPENING_BALANCE",
    "công nợ đầu kỳ": "OPENING_BALANCE",
    "dau ky": "OPENING_BALANCE",
    "đầu kỳ": "OPENING_BALANCE",
    "mua hang": "PURCHASE",
    "mua hàng": "PURCHASE",
    "nhap hang": "PURCHASE",
    "nhập hàng": "PURCHASE",
    "thanh toan": "PAYMENT",
    "thanh toán": "PAYMENT",
    "tra tien": "PAYMENT",
    "trả tiền": "PAYMENT",
    "tra hang": "RETURN",
    "trả hàng": "RETURN",
    "dieu chinh": "ADJUSTMENT",
    "điều chỉnh": "ADJUSTMENT",
  };

  return aliases[compactKey(value)] || "PURCHASE";
}

function parseLedgerAmount(value: unknown, allowNegative = false) {
  if (value === null || value === undefined) return null;

  const raw = sanitizeText(String(value));
  if (!raw) return null;

  const sign = allowNegative && raw.trim().startsWith("-") ? -1 : 1;
  const amount = parseMoneyText(raw.replace(/^-/, "")) * sign;
  if (!Number.isFinite(amount) || amount === 0) return null;
  if (!allowNegative && amount < 0) return null;
  return amount;
}

function parseOptionalQuantity(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseFloat(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalPositiveInt(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number.parseInt(String(value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseCountsInDebt(value: unknown) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "boolean") return value;

  const normalized = compactKey(value);
  return !["0", "false", "khong", "không", "no", "n", "không tính", "khong tinh"].includes(normalized);
}

export function getPartnerEntrySignedAmount(entry: { amount: number; countsInDebt?: boolean; entryType: string }) {
  if (entry.countsInDebt === false) return 0;

  if (entry.entryType === "PAYMENT" || entry.entryType === "RETURN") {
    return -Math.abs(entry.amount);
  }

  if (entry.entryType === "ADJUSTMENT") {
    return entry.amount;
  }

  return Math.abs(entry.amount);
}

export function getPartnerBalance(entries: Array<{ amount: number; countsInDebt?: boolean; entryType: string }>) {
  return entries.reduce((sum, entry) => sum + getPartnerEntrySignedAmount(entry), 0);
}

export async function getPartnerByCode(runner: PrismaRunner, code: string) {
  return runner.partner.findUnique({
    where: { code },
    include: partnerInclude,
  });
}

export function normalizePartnerPayload(payload: Record<string, unknown>) {
  const name = sanitizeText(String(payload.name || ""));
  const code = sanitizeText(String(payload.code || name || ""))
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const phoneText = sanitizeText(String(payload.phone || ""));

  if (!name || name.length < 2) {
    throw new PartnerLedgerValidationError("Vui lòng nhập tên đối tác từ 2 ký tự trở lên.");
  }

  if (!code) {
    throw new PartnerLedgerValidationError("Vui lòng nhập mã đối tác.");
  }

  return {
    active: typeof payload.active === "boolean" ? payload.active : true,
    code,
    name,
    notes: sanitizeText(String(payload.notes || "")) || null,
    phone: phoneText ? normalizePhone(phoneText) : null,
    type: normalizePartnerType(payload.type),
  };
}

export function normalizePartnerEntryPayload(payload: Record<string, unknown>) {
  const entryType = normalizePartnerEntryType(payload.entryType);
  const amount = parseLedgerAmount(payload.amount, entryType === "ADJUSTMENT");
  const entryDate = parseAdminDateInput(payload.entryDate) || new Date();
  const description = sanitizeText(String(payload.description || ""));

  if (amount === null) {
    throw new PartnerLedgerValidationError("Vui lòng nhập số tiền giao dịch lớn hơn 0đ.");
  }

  if (entryType !== "ADJUSTMENT" && amount < 0) {
    throw new PartnerLedgerValidationError("Thanh toán, mua hàng và trả hàng cần nhập số tiền dương.");
  }

  return {
    amount,
    countsInDebt: parseCountsInDebt(payload.countsInDebt ?? payload.countsInBalance ?? payload.includeInDebt),
    description: description || getDefaultEntryDescription(entryType),
    entryDate,
    entryType,
    notes: sanitizeText(String(payload.notes || "")) || null,
    partnerId: sanitizeText(String(payload.partnerId || "")),
    paymentMethod: sanitizeText(String(payload.paymentMethod || "")) || null,
    quantity: parseOptionalQuantity(payload.quantity),
    reference: sanitizeText(String(payload.reference || "")) || null,
    sourceCode: sanitizeText(String(payload.sourceCode || "")) || null,
    sourceName: sanitizeText(String(payload.sourceName || "")) || null,
    sourceRow: parseOptionalPositiveInt(payload.sourceRow),
    unit: sanitizeText(String(payload.unit || "")) || null,
    unitPrice: parseLedgerAmount(payload.unitPrice),
  };
}

export function getDefaultEntryDescription(entryType: PartnerEntryType) {
  const labels: Record<PartnerEntryType, string> = {
    ADJUSTMENT: "Điều chỉnh công nợ",
    OPENING_BALANCE: "Công nợ đầu kỳ",
    PAYMENT: "Thanh toán cho đối tác",
    PURCHASE: "Mua hàng từ đối tác",
    RETURN: "Trả hàng cho đối tác",
  };

  return labels[entryType];
}

export function serializePartner(
  partner: Prisma.PartnerGetPayload<{ include: typeof partnerInclude }>
) {
  const entries = partner.ledgerEntries.map((entry) => ({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    entryDate: entry.entryDate.toISOString(),
    signedAmount: getPartnerEntrySignedAmount(entry),
    updatedAt: entry.updatedAt.toISOString(),
  }));
  const totals = entries.reduce(
    (summary, entry) => {
      if (entry.entryType === "OPENING_BALANCE") summary.openingBalance += entry.amount;
      if (entry.entryType === "PURCHASE") summary.purchased += entry.amount;
      if (entry.entryType === "PAYMENT") summary.paid += entry.amount;
      if (entry.entryType === "RETURN") summary.returned += entry.amount;
      if (entry.entryType === "ADJUSTMENT") summary.adjusted += entry.signedAmount;
      if (entry.countsInDebt === false) summary.referenceOnly += entry.amount;
      if (entry.signedAmount > 0) summary.increase += entry.signedAmount;
      if (entry.signedAmount < 0) summary.decrease += Math.abs(entry.signedAmount);
      return summary;
    },
    { adjusted: 0, decrease: 0, increase: 0, openingBalance: 0, paid: 0, purchased: 0, referenceOnly: 0, returned: 0 }
  );

  return {
    ...partner,
    balance: getPartnerBalance(entries),
    createdAt: partner.createdAt.toISOString(),
    ledgerEntries: entries,
    totals,
    updatedAt: partner.updatedAt.toISOString(),
  };
}
