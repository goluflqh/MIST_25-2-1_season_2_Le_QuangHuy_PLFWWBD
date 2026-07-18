import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { calculateCouponDiscount, getPayableAmount } from "@/lib/coupon-discounts";
import { prisma } from "@/lib/prisma";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";
import { addMonthsInVietnam, getVietnamDateCode } from "@/lib/vietnam-time";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranties";

export const serviceOrderStatuses = [
  "PENDING",
  "CONTACTED",
  "IN_PROGRESS",
  "COMPLETED",
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

export const serviceOrderPriceStatuses = [
  "CONFIRMED",
  "PENDING_QUOTE",
  "FREE",
  "LEGACY_MISSING",
] as const;

type ServiceOrderStatus = (typeof serviceOrderStatuses)[number];
type ServiceOrderService = (typeof serviceOrderServices)[number];
type ServiceOrderSource = (typeof serviceOrderSources)[number];
type ServiceOrderPriceStatus = (typeof serviceOrderPriceStatuses)[number];
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
      deletedAt: true,
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

const statusAliases: Record<string, string> = {
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

const normalizedStatusAliases: Record<string, ServiceOrderStatus> = {
  CHECKING: "CONTACTED",
  DELIVERED: "COMPLETED",
  QUOTED: "CONTACTED",
  RECEIVED: "PENDING",
  "bao gia": "CONTACTED",
  "chờ xử lý": "PENDING",
  "cho xu ly": "PENDING",
  "đang xử lý": "IN_PROGRESS",
  "dang kiem tra": "CONTACTED",
  "dang lam": "IN_PROGRESS",
  "dang sua": "IN_PROGRESS",
  "dang xu ly": "IN_PROGRESS",
  "da bao gia": "CONTACTED",
  "da giao": "COMPLETED",
  "da huy": "CANCELLED",
  "da huy don": "CANCELLED",
  "da lien he": "CONTACTED",
  "da xong": "COMPLETED",
  "đã hủy": "CANCELLED",
  "đã huỷ": "CANCELLED",
  "đã liên hệ": "CONTACTED",
  "hoàn thành": "COMPLETED",
  "giao khach": "COMPLETED",
  huy: "CANCELLED",
  "hủy": "CANCELLED",
  "huỷ": "CANCELLED",
  "kiem tra": "CONTACTED",
  "moi nhan": "PENDING",
  "nhan don": "PENDING",
  "xử lý": "IN_PROGRESS",
  xong: "COMPLETED",
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

export function normalizeServiceOrderStatus(value: unknown): ServiceOrderStatus {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderStatuses.includes(raw as ServiceOrderStatus)) return raw as ServiceOrderStatus;

  const compact = compactKey(value);
  const legacyAlias = statusAliases[compact] || statusAliases[raw] || "";
  const alias = normalizedStatusAliases[raw] || normalizedStatusAliases[compact] || normalizedStatusAliases[legacyAlias];
  return alias || "PENDING";
}

function normalizeSource(value: unknown, fallback: ServiceOrderSource): ServiceOrderSource {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderSources.includes(raw as ServiceOrderSource)) return raw as ServiceOrderSource;
  return fallback;
}

const priceStatusAliases: Record<string, ServiceOrderPriceStatus> = {
  "0": "FREE",
  "bao gia sau": "PENDING_QUOTE",
  "chua bao gia": "PENDING_QUOTE",
  "chưa báo giá": "PENDING_QUOTE",
  "free": "FREE",
  "mien phi": "FREE",
  "miễn phí": "FREE",
  "quen gia": "LEGACY_MISSING",
  "quên giá": "LEGACY_MISSING",
};

export function normalizeServiceOrderPriceStatus(
  value: unknown,
  quotedPrice: number | null,
  fallbackSource: ServiceOrderSource = "MANUAL"
): ServiceOrderPriceStatus {
  const raw = sanitizeText(String(value || "")).toUpperCase();
  if (serviceOrderPriceStatuses.includes(raw as ServiceOrderPriceStatus)) {
    return raw as ServiceOrderPriceStatus;
  }

  const alias = priceStatusAliases[compactKey(value)];
  if (alias) return alias;

  if (quotedPrice === null) {
    return fallbackSource === "IMPORT" ? "LEGACY_MISSING" : "PENDING_QUOTE";
  }

  if (quotedPrice === 0) return "FREE";
  return "CONFIRMED";
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
  return normalizeServiceOrderStatus(status);
}

export function mapContactStatusToOrderStatus(status: string) {
  return normalizeServiceOrderStatus(status);
}

function addMonths(date: Date, months: number) {
  return addMonthsInVietnam(date, months);
}

function buildOrderCode() {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `MH-DH-${getVietnamDateCode()}-${suffix}`;
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
  const paidAt = parseAdminDateInput(payload.paidAt);
  const status = normalizeServiceOrderStatus(payload.status);
  const source = normalizeSource(payload.source, fallbackSource);
  const customerPhoneMissing = source === "IMPORT" && payload.customerPhoneMissing === true;
  const explicitPriceStatus = sanitizeText(String(payload.priceStatus || "")).length > 0;
  let quotedPrice = parseOptionalMoney(payload.quotedPrice);
  const priceStatus = normalizeServiceOrderPriceStatus(payload.priceStatus, quotedPrice, source);
  const warrantyMonths = parseOptionalInt(payload.warrantyMonths, 120) ?? DEFAULT_WARRANTY_MONTHS;
  const explicitWarrantyEndDate = parseAdminDateInput(payload.warrantyEndDate, { endOfDay: true });
  const warrantyEndDate = status === "COMPLETED"
    ? explicitWarrantyEndDate || (warrantyMonths ? addMonths(orderDate, warrantyMonths) : null)
    : null;

  if (!customerName || customerName.length < 2) {
    throw new ServiceOrderValidationError("Vui lòng nhập tên khách hàng từ 2 ký tự trở lên.");
  }

  if (!isValidPhone(customerPhone)) {
    throw new ServiceOrderValidationError("Số điện thoại khách chưa đúng định dạng Việt Nam.");
  }

  if (!productName) {
    throw new ServiceOrderValidationError("Vui lòng nhập sản phẩm hoặc thiết bị của đơn.");
  }

  if (priceStatus === "CONFIRMED" && (!quotedPrice || quotedPrice <= 0)) {
    throw new ServiceOrderValidationError("Đơn đã xác nhận giá cần có giá bán lớn hơn 0đ.");
  }

  if (priceStatus === "FREE") {
    quotedPrice = 0;
  }

  if (
    explicitPriceStatus
    && (priceStatus === "PENDING_QUOTE" || priceStatus === "LEGACY_MISSING")
    && quotedPrice !== null
  ) {
    throw new ServiceOrderValidationError("Nếu chưa báo giá hoặc quên giá, hãy để trống giá bán.");
  }

  return {
    customerAddress: customerAddress || null,
    customerName,
    customerPhone,
    customerPhoneMissing,
    customerVisible: parseBoolean(payload.customerVisible),
    contactRequestId,
    couponRedemptionId,
    issueDescription: sanitizeText(String(payload.issueDescription || payload.issue || "")) || null,
    notes: sanitizeText(String(payload.notes || "")) || null,
    orderDate,
    paidAmount: parseOptionalMoney(payload.paidAmount) || 0,
    paidAt,
    priceStatus,
    productName,
    quotedPrice,
    service: normalizeService(payload.service),
    solution: sanitizeText(String(payload.solution || "")) || null,
    source,
    sourceName: sanitizeText(String(payload.sourceName || "")) || null,
    sourceRow: parseOptionalInt(payload.sourceRow, 1_000_000),
    status,
    warrantyEndDate,
    warrantyMonths,
  };
}

export async function createServiceOrder(
  payload: Record<string, unknown>,
  fallbackSource: ServiceOrderSource = "MANUAL",
  transaction?: Prisma.TransactionClient
) {
  const normalized = normalizeServiceOrderPayload(payload, fallbackSource);

  const createWithinTransaction = async (tx: PrismaRunner) => {
    const contactRequest = normalized.contactRequestId
      ? await tx.contactRequest.findUnique({
          where: { id: normalized.contactRequestId },
          include: {
            couponRedemption: {
              include: {
                contactRequest: { select: { id: true } },
                coupon: { select: { code: true, description: true, discount: true } },
                serviceOrder: { select: { deletedAt: true, id: true } },
              },
            },
            serviceOrder: { select: { deletedAt: true, id: true } },
            user: { select: { id: true, role: true } },
          },
        })
      : null;

    if (normalized.contactRequestId && (!contactRequest || contactRequest.deletedAt)) {
      throw new ServiceOrderValidationError("Yêu cầu tư vấn liên kết không còn tồn tại.");
    }

    if (contactRequest?.serviceOrder && !contactRequest.serviceOrder.deletedAt) {
      throw new ServiceOrderValidationError("Yêu cầu tư vấn này đã có đơn dịch vụ liên kết.");
    }

    const existingCustomer = await tx.customer.findUnique({
      where: { phone: normalized.customerPhone },
      select: { userId: true },
    });
    const contactUserId = contactRequest?.user?.role === "CUSTOMER" ? contactRequest.user.id : null;
    const effectiveUserId = contactUserId || existingCustomer?.userId || null;
    const requestedCouponRedemptionId = normalized.couponRedemptionId || contactRequest?.couponRedemptionId || null;
    const couponRedemption = contactRequest?.couponRedemption
      || (requestedCouponRedemptionId
        ? await tx.couponRedemption.findUnique({
            where: { id: requestedCouponRedemptionId },
            include: {
              contactRequest: { select: { id: true } },
              coupon: { select: { code: true, description: true, discount: true } },
              serviceOrder: { select: { deletedAt: true, id: true } },
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

      if (couponRedemption.serviceOrder && !couponRedemption.serviceOrder.deletedAt) {
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
    const discountAmount = normalized.priceStatus === "CONFIRMED"
      ? calculateCouponDiscount(couponRedemption?.coupon.discount, normalized.quotedPrice)
      : 0;
    const paidAmount = normalized.priceStatus === "CONFIRMED"
      ? Math.min(normalized.paidAmount, getPayableAmount(normalized.quotedPrice, discountAmount))
      : normalized.priceStatus === "FREE"
        ? 0
        : normalized.paidAmount;

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
        paidAmount,
        paidAt: paidAmount > 0 ? normalized.paidAt || new Date() : null,
        status: normalized.status,
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
  };

  return transaction
    ? createWithinTransaction(transaction)
    : prisma.$transaction(createWithinTransaction);
}

export function serializeServiceOrder(
  order: Prisma.ServiceOrderGetPayload<{ include: typeof serviceOrderInclude }>
) {
  const status = normalizeServiceOrderStatus(order.status);
  const priceStatus = normalizeServiceOrderPriceStatus(
    order.priceStatus,
    order.quotedPrice,
    normalizeSource(order.source, "MANUAL")
  );
  const warranty = status === "COMPLETED" && order.warranty && !order.warranty.deletedAt ? order.warranty : null;

  return {
    ...order,
    createdAt: order.createdAt.toISOString(),
    orderDate: order.orderDate.toISOString(),
    paidAt: order.paidAt?.toISOString() || null,
    priceStatus,
    status,
    updatedAt: order.updatedAt.toISOString(),
    warranty: warranty
      ? {
          id: warranty.id,
          serialNo: warranty.serialNo,
          endDate: warranty.endDate.toISOString(),
        }
      : null,
    warrantyEndDate: warranty ? order.warrantyEndDate?.toISOString() || null : null,
  };
}

type ServiceOrderReadRunner = Pick<typeof prisma, "serviceOrder">;

export async function listActiveServiceOrderViews(
  runner: ServiceOrderReadRunner = prisma
) {
  const orders = await runner.serviceOrder.findMany({
    where: { deletedAt: null },
    include: serviceOrderInclude,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
  });

  return orders.map(serializeServiceOrder);
}
