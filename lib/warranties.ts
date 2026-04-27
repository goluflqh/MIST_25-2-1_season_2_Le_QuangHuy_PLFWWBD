import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { prisma } from "@/lib/prisma";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

export const DEFAULT_WARRANTY_MONTHS = 6;

export const warrantyServices = [
  "DONG_PIN",
  "DEN_NLMT",
  "PIN_LUU_TRU",
  "CAMERA",
  "CUSTOM",
  "KHAC",
] as const;

type PrismaRunner = typeof prisma | Prisma.TransactionClient;

export class WarrantyValidationError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "WarrantyValidationError";
    this.status = status;
  }
}

const serviceAliases: Record<string, (typeof warrantyServices)[number]> = {
  battery: "DONG_PIN",
  camera: "CAMERA",
  contact: "KHAC",
  custom: "CUSTOM",
  "camera an ninh": "CAMERA",
  "den nang luong": "DEN_NLMT",
  "den nlmt": "DEN_NLMT",
  "dong pin": "DONG_PIN",
  "đèn năng lượng mặt trời": "DEN_NLMT",
  "đóng pin": "DONG_PIN",
  "khac": "KHAC",
  "khác": "KHAC",
  "pin luu tru": "PIN_LUU_TRU",
  "pin lưu trữ": "PIN_LUU_TRU",
  "theo yeu cau": "CUSTOM",
  "theo yêu cầu": "CUSTOM",
};

function compactKey(value: unknown) {
  return sanitizeText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function parseOptionalInt(value: unknown, max: number) {
  if (value === null || value === undefined) return null;

  const raw = sanitizeText(String(value));
  if (!raw) return null;

  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;

  return parsed;
}

export function normalizeWarrantyService(value: unknown) {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (warrantyServices.includes(raw as (typeof warrantyServices)[number])) {
    return raw;
  }

  return serviceAliases[compactKey(value)] || "KHAC";
}

export function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function getDefaultWarrantyEndDate(startDate = new Date(), months = DEFAULT_WARRANTY_MONTHS) {
  const endDate = addMonths(startDate, months);
  endDate.setHours(23, 59, 59, 999);
  return endDate;
}

function buildWarrantySerial() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `MH-BH-${datePart}-${suffix}`;
}

export async function getAvailableWarrantySerial(runner: PrismaRunner, manualSerial: unknown) {
  const normalizedManualSerial = sanitizeText(String(manualSerial || "")).toUpperCase();
  if (normalizedManualSerial) return normalizedManualSerial;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const serialNo = buildWarrantySerial();
    const existing = await runner.warranty.findUnique({ where: { serialNo } });
    if (!existing) return serialNo;
  }

  throw new Error("Unable to generate unique warranty serial");
}

export function serializeWarranty(warranty: {
  id: string;
  serialNo: string;
  productName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startDate: Date;
  endDate: Date;
  notes: string | null;
  createdAt?: Date;
  serviceOrderId?: string | null;
  userId?: string | null;
}) {
  return {
    ...warranty,
    createdAt: warranty.createdAt?.toISOString(),
    endDate: warranty.endDate.toISOString(),
    startDate: warranty.startDate.toISOString(),
  };
}

export async function createManualWarranty(
  runner: PrismaRunner,
  payload: Record<string, unknown>
) {
  const productName = sanitizeText(String(payload.productName || ""));
  const rawPhone = sanitizeText(String(payload.customerPhone || payload.phone || ""));
  const customerPhone = normalizePhone(rawPhone);
  const service = normalizeWarrantyService(payload.service);
  const typedCustomerName = sanitizeText(String(payload.customerName || payload.name || ""));
  const startDate = parseAdminDateInput(payload.startDate) || new Date();
  const endDate = parseAdminDateInput(payload.endDate, { endOfDay: true })
    || getDefaultWarrantyEndDate(startDate, DEFAULT_WARRANTY_MONTHS);
  const serialNo = await getAvailableWarrantySerial(runner, payload.serialNo);
  const notes = sanitizeText(String(payload.notes || "")) || null;

  if (!productName) {
    throw new WarrantyValidationError("Vui lòng nhập tên sản phẩm cần bảo hành.");
  }

  if (!isValidPhone(customerPhone)) {
    throw new WarrantyValidationError("Số điện thoại khách chưa đúng định dạng Việt Nam.");
  }

  const [user, customer] = await Promise.all([
    runner.user.findUnique({ where: { phone: customerPhone } }),
    runner.customer.findUnique({ where: { phone: customerPhone } }),
  ]);

  const customerName = typedCustomerName || user?.name || customer?.name || "";
  if (!customerName) {
    throw new WarrantyValidationError("Vui lòng nhập tên khách để tạo phiếu bảo hành.");
  }

  return runner.warranty.create({
    data: {
      customerName,
      customerPhone,
      endDate,
      notes,
      productName,
      serialNo,
      service,
      startDate,
      userId: user?.id || customer?.userId || null,
    },
  });
}

export async function createWarrantyForServiceOrder(
  runner: PrismaRunner,
  serviceOrderId: string,
  payload: Record<string, unknown> = {}
) {
  const existingWarranty = await runner.warranty.findUnique({
    where: { serviceOrderId },
  });
  if (existingWarranty && !existingWarranty.deletedAt) {
    return { created: false, warranty: existingWarranty };
  }

  const order = await runner.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    include: { customer: true, user: true },
  });
  if (!order || order.deletedAt) {
    throw new WarrantyValidationError("Không tìm thấy đơn dịch vụ để tạo bảo hành.", 404);
  }

  if (!["COMPLETED", "DELIVERED"].includes(order.status)) {
    throw new WarrantyValidationError("Chỉ tạo bảo hành tự động khi đơn đã hoàn thành hoặc đã giao.");
  }

  const months = parseOptionalInt(payload.warrantyMonths, 120) ?? order.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS;
  const startDate = parseAdminDateInput(payload.startDate) || new Date();
  const endDate = parseAdminDateInput(payload.endDate, { endOfDay: true }) || getDefaultWarrantyEndDate(startDate, months);
  const serialNo = await getAvailableWarrantySerial(runner, payload.serialNo);
  const notes = sanitizeText(String(payload.notes || "")) || `Tự tạo từ đơn ${order.orderCode}`;
  const productName = sanitizeText(String(payload.productName || "")) || order.productName;
  const customerName = sanitizeText(String(payload.customerName || "")) || order.customerName;
  const service = normalizeWarrantyService(payload.service || order.service);

  const warranty = await runner.warranty.create({
    data: {
      customerName,
      customerPhone: order.customerPhone,
      endDate,
      notes,
      productName,
      serialNo,
      service,
      serviceOrderId: order.id,
      startDate,
      userId: order.userId || order.customer.userId || null,
    },
  });

  await runner.serviceOrder.update({
    where: { id: order.id },
    data: {
      warrantyEndDate: endDate,
      warrantyMonths: months,
    },
  });

  return { created: true, warranty };
}

export function normalizeWarrantyUpdatePayload(payload: Record<string, unknown>) {
  const updateData: Prisma.WarrantyUpdateInput = {};

  if (typeof payload.productName === "string") {
    const productName = sanitizeText(payload.productName);
    if (!productName) throw new WarrantyValidationError("Vui lòng nhập tên sản phẩm cần bảo hành.");
    updateData.productName = productName;
  }

  if (typeof payload.customerName === "string") {
    const customerName = sanitizeText(payload.customerName);
    if (!customerName) throw new WarrantyValidationError("Vui lòng nhập tên khách.");
    updateData.customerName = customerName;
  }

  if (typeof payload.customerPhone === "string") {
    const customerPhone = normalizePhone(sanitizeText(payload.customerPhone));
    if (!isValidPhone(customerPhone)) {
      throw new WarrantyValidationError("Số điện thoại khách chưa đúng định dạng Việt Nam.");
    }
    updateData.customerPhone = customerPhone;
  }

  if (typeof payload.service === "string") {
    updateData.service = normalizeWarrantyService(payload.service);
  }

  if (typeof payload.endDate === "string") {
    const endDate = parseAdminDateInput(payload.endDate, { endOfDay: true });
    if (!endDate) throw new WarrantyValidationError("Ngày hết hạn bảo hành chưa đúng định dạng.");
    updateData.endDate = endDate;
  }

  if (typeof payload.notes === "string") {
    updateData.notes = sanitizeText(payload.notes) || null;
  }

  return updateData;
}
