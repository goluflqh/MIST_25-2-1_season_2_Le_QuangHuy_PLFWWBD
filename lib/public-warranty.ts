import { createHash, createHmac } from "node:crypto";

const SERVICE_LABELS: Record<string, string> = {
  DONG_PIN: "Đóng pin",
  DEN_NLMT: "Đèn năng lượng mặt trời",
  PIN_LUU_TRU: "Pin lưu trữ",
  CAMERA: "Camera",
  KHAC: "Dịch vụ khác",
};

export type PublicWarrantyStatus = "active" | "expired" | "unknown";

export interface PublicWarrantySource {
  serialNo: string;
  productName: string;
  service: string;
  endDate: Date;
}

export interface PublicWarrantySummary {
  maskedSerial: string;
  productName: string;
  service: string;
  status: PublicWarrantyStatus;
  expiryMonth: number | null;
  expiryYear: number | null;
}

export function maskWarrantySerial(serialNo: string) {
  const normalized = serialNo.trim();
  const visibleLength = normalized.length >= 6 ? 4 : normalized.length >= 4 ? 2 : 1;
  const suffix = normalized.slice(-visibleLength);

  return `${"•".repeat(Math.max(4, normalized.length - visibleLength))}${suffix}`;
}

export function getPublicWarrantyStatus(endDate: Date, now = new Date()): PublicWarrantyStatus {
  const endTime = endDate.getTime();

  if (!Number.isFinite(endTime) || endDate.getUTCFullYear() <= 1900) {
    return "unknown";
  }

  return endTime >= now.getTime() ? "active" : "expired";
}

export function serializePublicWarranty(
  warranty: PublicWarrantySource,
  now = new Date()
): PublicWarrantySummary {
  const status = getPublicWarrantyStatus(warranty.endDate, now);

  return {
    maskedSerial: maskWarrantySerial(warranty.serialNo),
    productName: warranty.productName,
    service: SERVICE_LABELS[warranty.service] ?? "Dịch vụ khác",
    status,
    expiryMonth: status === "unknown" ? null : warranty.endDate.getUTCMonth() + 1,
    expiryYear: status === "unknown" ? null : warranty.endDate.getUTCFullYear(),
  };
}

export function buildWarrantyLookupPhoneKey(phone: string) {
  const value = `warranty-lookup:${phone}`;
  const secret = process.env.AUTH_SECRET?.trim();

  if (secret) {
    return createHmac("sha256", secret).update(value).digest("hex");
  }

  // Local development fallback. Production already requires AUTH_SECRET.
  return createHash("sha256").update(value).digest("hex");
}
