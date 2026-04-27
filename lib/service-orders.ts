import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { calculateCouponDiscount, getPayableAmount } from "@/lib/coupon-discounts";
import { prisma } from "@/lib/prisma";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranties";

export const serviceOrderStatuses = [
  "RECEIVED",
  "CHECKING",
  "QUOTED",
  "IN_PROGRESS",
  "COMPLETED",
  "DELIVERED",
  "CANCELLED",
] as const;

export const serviceOrderServices = [
  "DONG_PIN",
  "DEN_NLMT",
  "PIN_LUU_TRU",
  "CAMERA",
  "CUSTOM",
  "KHAC",
] as const;

export const serviceOrderSources = [
  "MANUAL",
  "IMPORT",
  "PHONE",
  "ZALO",
  "FACEBOOK",
  "WALK_IN",
  "CONTACT",
  "OTHER",
] as const;

type ServiceOrderStatus = (typeof serviceOrderStatuses)[number];
type ServiceOrderService = (typeof serviceOrderServices)[number];
type ServiceOrderSource = (typeof serviceOrderSources)[number];
type PrismaRunner = typeof prisma | Prisma.TransactionClient;

export const serviceOrderInclude = {
  contactRequest: {
    select: {
      id: true,
      status: true,
      userId: true,
      couponRedemptionId: true,
    },
  },
  couponRedemption: {
    select: {
      id: true,
      coupon: {
        select: {
          code: true,
          description: true,
          discount: true,
        },
      },
    },
  },
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      userId: true,
    },
  },
  user: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
  warranty: {
    select: {
      id: true,
      serialNo: true,
      endDate: true,
    },
  },
} satisfies Prisma.ServiceOrderInclude;

export class ServiceOrderValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = "ServiceOrderValidationError";
  }
}

const serviceAliases: Record<string, ServiceOrderService> = {
  camera: "CAMERA",
  "camera an ninh": "CAMERA",
  "den nang luong": "DEN_NLMT",
  "den nlmt": "DEN_NLMT",
  "dien mat troi": "DEN_NLMT",
  "dong pin": "DONG_PIN",
  "dong pin lithium": "DONG_PIN",
  "dong pin xe dien": "DONG_PIN",
  "đèn năng lượng mặt trời": "DEN_NLMT",
  "đèn nlmt": "DEN_NLMT",
  "đóng pin": "DONG_PIN",
  "đóng pin lithium": "DONG_PIN",
  "đóng pin xe điện": "DONG_PIN",
  "khac": "KHAC",
  "khác": "KHAC",
  "lap camera": "CAMERA",
  "lắp camera": "CAMERA",
  "pin luu tru": "PIN_LUU_TRU",
  "pin lưu trữ": "PIN_LUU_TRU",
  "theo yeu cau": "CUSTOM",
  "theo yêu cầu": "CUSTOM",
};

const statusAliases: Record<string, ServiceOrderStatus> = {
  "bao gia": "QUOTED",
  "chờ kiểm tra": "RECEIVED",
  "dang kiem tra": "CHECKING",
  "dang lam": "IN_PROGRESS",
  "dang sua": "IN_PROGRESS",
  "da bao gia": "QUOTED",
  "da giao": "DELIVERED",
  "da huy": "CANCELLED",
  "da huy don": "CANCELLED",
  "da xong": "COMPLETED",
  "đang kiểm tra": "CHECKING",
  "đang làm": "IN_PROGRESS",
  "đang sửa": "IN_PROGRESS",
  "đã báo giá": "QUOTED",
  "đã giao": "DELIVERED",
  "đã hủy": "CANCELLED",
  "đã huỷ": "CANCELLED",
  "đã xong": "COMPLETED",
  "giao khach": "DELIVERED",
  "giao khách": "DELIVERED",
  "huy": "CANCELLED",
  "hủy": "CANCELLED",
  "huỷ": "CANCELLED",
  "kiem tra": "CHECKING",
  "kiểm tra": "CHECKING",
  "moi nhan": "RECEIVED",
  "mới nhận": "RECEIVED",
  "nhan don": "RECEIVED",
  "nhận đơn": "RECEIVED",
  "xong": "COMPLETED",
};

function compactKey(value: unknown) {
  return sanitizeText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeService(value: unknown): ServiceOrderService {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderServices.includes(raw as ServiceOrderService)) return raw as ServiceOrderService;

  const alias = serviceAliases[compactKey(value)];
  return alias || "KHAC";
}

function normalizeStatus(value: unknown): ServiceOrderStatus {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderStatuses.includes(raw as ServiceOrderStatus)) return raw as ServiceOrderStatus;

  const alias = statusAliases[compactKey(value)];
  return alias || "RECEIVED";
}

function normalizeSource(value: unknown, fallback: ServiceOrderSource): ServiceOrderSource {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderSources.includes(raw as ServiceOrderSource)) return raw as ServiceOrderSource;
  return fallback;
}

export function parseOptionalMoney(value: unknown) {
  if (value === null || value === undefined) return null;

  const raw = sanitizeText(String(value));
  if (!raw) return null;

  const normalized = raw.replace(/[^\d]/g, "");
  if (!normalized) return null;

  const amount = Number.parseInt(normalized, 10);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return amount;
}

function parseOptionalInt(value: unknown, max: number) {
  if (value === null || value === undefined) return null;

  const raw = sanitizeText(String(value));
  if (!raw) return null;

  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;

  return parsed;
}

function parseBoolean(value: unknown) {
  if (typeof value === "boolean") return value;

  const key = compactKey(value);
  return ["1", "true", "yes", "y", "co", "có", "hien", "hiện", "x"].includes(key);
}

export function mapOrderStatusToContactStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED" || status === "DELIVERED") return "COMPLETED";
  if (status === "RECEIVED") return "CONTACTED";
  return "IN_PROGRESS";
}

export function mapContactStatusToOrderStatus(status: string) {
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "PENDING" || status === "CONTACTED") return "CHECKING";
  return "IN_PROGRESS";
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildOrderCode() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `MH-DH-${datePart}-${suffix}`;
}

async function getAvailableOrderCode(runner: PrismaRunner, manualCode: unknown) {
  const normalizedManualCode = sanitizeText(String(manualCode || "")).toUpperCase();
  if (normalizedManualCode) return normalizedManualCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const orderCode = buildOrderCode();
    const existing = await runner.serviceOrder.findUnique({ where: { orderCode } });
    if (!existing) return orderCode;
  }

  throw new Error("Unable to generate unique service order code");
}

export function normalizeServiceOrderPayload(
  payload: Record<string, unknown>,
  fallbackSource: ServiceOrderSource = "MANUAL"
) {
  const customerName = sanitizeText(String(payload.customerName || payload.name || ""));
  const customerPhone = normalizePhone(sanitizeText(String(payload.customerPhone || payload.phone || "")));
  const customerAddress = sanitizeText(String(payload.customerAddress || payload.address || ""));
  const contactRequestId = sanitizeText(String(payload.contactRequestId || "")) || null;
  const couponRedemptionId = sanitizeText(String(payload.couponRedemptionId || "")) || null;
  const productName = sanitizeText(String(payload.productName || payload.product || ""));
  const orderDate = parseAdminDateInput(payload.orderDate) || new Date();
  const warrantyMonths = parseOptionalInt(payload.warrantyMonths, 120) ?? DEFAULT_WARRANTY_MONTHS;
  const explicitWarrantyEndDate = parseAdminDateInput(payload.warrantyEndDate, { endOfDay: true });
  const warrantyEndDate = explicitWarrantyEndDate || (warrantyMonths ? addMonths(orderDate, warrantyMonths) : null);

  if (!customerName || customerName.length < 2) {
    throw new ServiceOrderValidationError("Vui lòng nhập tên khách hàng từ 2 ký tự trở lên.");
  }

  if (!isValidPhone(customerPhone)) {
    throw new ServiceOrderValidationError("Số điện thoại khách chưa đúng định dạng Việt Nam.");
  }

  if (!productName) {
    throw new ServiceOrderValidationError("Vui lòng nhập sản phẩm hoặc thiết bị của đơn.");
  }

  return {
    customerAddress: customerAddress || null,
    customerName,
    customerPhone,
    customerVisible: parseBoolean(payload.customerVisible),
    contactRequestId,
    couponRedemptionId,
    issueDescription: sanitizeText(String(payload.issueDescription || payload.issue || "")) || null,
    notes: sanitizeText(String(payload.notes || "")) || null,
    orderDate,
    paidAmount: parseOptionalMoney(payload.paidAmount) || 0,
    productName,
    quotedPrice: parseOptionalMoney(payload.quotedPrice),
    service: normalizeService(payload.service),
    solution: sanitizeText(String(payload.solution || "")) || null,
    source: normalizeSource(payload.source, fallbackSource),
    status: normalizeStatus(payload.status),
    warrantyEndDate,
    warrantyMonths,
  };
}

export async function createServiceOrder(
  payload: Record<string, unknown>,
  fallbackSource: ServiceOrderSource = "MANUAL"
) {
  const normalized = normalizeServiceOrderPayload(payload, fallbackSource);

  return prisma.$transaction(async (tx) => {
    const contactRequest = normalized.contactRequestId
      ? await tx.contactRequest.findUnique({
          where: { id: normalized.contactRequestId },
          include: {
            couponRedemption: {
              include: {
                contactRequest: { select: { id: true } },
                coupon: { select: { code: true, description: true, discount: true } },
                serviceOrder: { select: { id: true } },
              },
            },
            serviceOrder: { select: { id: true } },
          },
        })
      : null;

    if (normalized.contactRequestId && (!contactRequest || contactRequest.deletedAt)) {
      throw new ServiceOrderValidationError("Yêu cầu tư vấn liên kết không còn tồn tại.");
    }

    if (contactRequest?.serviceOrder) {
      throw new ServiceOrderValidationError("Yêu cầu tư vấn này đã có đơn dịch vụ liên kết.");
    }

    const linkedUser = await tx.user.findUnique({
      where: { phone: normalized.customerPhone },
      select: { id: true },
    });
    const existingCustomer = await tx.customer.findUnique({
      where: { phone: normalized.customerPhone },
      select: { userId: true },
    });
    const effectiveUserId = linkedUser?.id || contactRequest?.userId || existingCustomer?.userId || null;
    const requestedCouponRedemptionId = normalized.couponRedemptionId || contactRequest?.couponRedemptionId || null;
    const couponRedemption = contactRequest?.couponRedemption
      || (requestedCouponRedemptionId
        ? await tx.couponRedemption.findUnique({
            where: { id: requestedCouponRedemptionId },
            include: {
              contactRequest: { select: { id: true } },
              coupon: { select: { code: true, description: true, discount: true } },
              serviceOrder: { select: { id: true } },
            },
          })
        : null);

    if (requestedCouponRedemptionId && !couponRedemption) {
      throw new ServiceOrderValidationError("Mã giảm giá khách chọn không còn hợp lệ.");
    }

    if (couponRedemption) {
      if (!effectiveUserId || couponRedemption.userId !== effectiveUserId) {
        throw new ServiceOrderValidationError("Mã giảm giá không khớp với tài khoản khách.");
      }

      if (couponRedemption.serviceOrder) {
        throw new ServiceOrderValidationError("Mã giảm giá này đã được dùng cho một đơn khác.");
      }

      if (
        couponRedemption.contactRequest
        && contactRequest
        && couponRedemption.contactRequest.id !== contactRequest.id
      ) {
        throw new ServiceOrderValidationError("Mã giảm giá này đang gắn với yêu cầu tư vấn khác.");
      }
    }

    const customer = await tx.customer.upsert({
      where: { phone: normalized.customerPhone },
      update: {
        address: normalized.customerAddress,
        deletedAt: null,
        name: normalized.customerName,
        ...(effectiveUserId ? { userId: effectiveUserId } : {}),
      },
      create: {
        address: normalized.customerAddress,
        name: normalized.customerName,
        phone: normalized.customerPhone,
        userId: effectiveUserId,
      },
    });
    const orderCode = await getAvailableOrderCode(tx, payload.orderCode);
    const discountAmount = calculateCouponDiscount(couponRedemption?.coupon.discount, normalized.quotedPrice);

    const order = await tx.serviceOrder.create({
      data: {
        ...normalized,
        contactRequestId: contactRequest?.id || null,
        couponCode: couponRedemption?.coupon.code || null,
        couponDiscount: couponRedemption?.coupon.discount || null,
        couponRedemptionId: couponRedemption?.id || null,
        customerId: customer.id,
        customerVisible: normalized.customerVisible || Boolean(effectiveUserId && normalized.source === "CONTACT"),
        discountAmount,
        orderCode,
        paidAmount: Math.min(normalized.paidAmount, getPayableAmount(normalized.quotedPrice, discountAmount)),
        userId: effectiveUserId,
      },
      include: serviceOrderInclude,
    });

    if (contactRequest && contactRequest.status !== "COMPLETED" && contactRequest.status !== "CANCELLED") {
      await tx.contactRequest.update({
        where: { id: contactRequest.id },
        data: { status: mapOrderStatusToContactStatus(order.status) },
      });
    }

    return order;
  });
}

export function serializeServiceOrder(
  order: Prisma.ServiceOrderGetPayload<{ include: typeof serviceOrderInclude }>
) {
  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    orderDate: order.orderDate.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    warranty: order.warranty
      ? {
          ...order.warranty,
          endDate: order.warranty.endDate.toISOString(),
        }
      : null,
    warrantyEndDate: order.warrantyEndDate?.toISOString() || null,
  };
}
