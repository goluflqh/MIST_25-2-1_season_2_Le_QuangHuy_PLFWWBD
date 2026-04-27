import AccountAuthRedirect from "@/components/account/AccountAuthRedirect";
import AccountPageClient from "@/components/account/AccountPageClient";
import {
  isPrismaDatabaseUnavailable,
  logPrismaAvailabilityWarning,
  prisma,
} from "@/lib/prisma";
import { getCurrentSessionUser } from "@/lib/session";

const vietnamDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
});

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
});

function formatVietnamDate(date: Date) {
  return vietnamDateFormatter.format(date);
}

function formatVietnamDateTime(date: Date) {
  return vietnamDateTimeFormatter.format(date);
}

async function loadAccountCollections(userId: string, phone: string, referralCode: string | null) {
  try {
    const [requests, warranties, serviceOrders, coupons, referralCount] = await Promise.all([
      prisma.contactRequest.findMany({
        where: {
          deletedAt: null,
          OR: [{ userId }, { phone }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.warranty.findMany({
        where: {
          deletedAt: null,
          OR: [{ userId }, { customerPhone: phone }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.serviceOrder.findMany({
        where: {
          deletedAt: null,
          customerVisible: true,
          OR: [{ userId }, { customerPhone: phone }],
        },
        orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.coupon.findMany({
        where: {
          active: true,
        },
        include: {
          redemptions: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
        orderBy: [{ pointsCost: "asc" }, { createdAt: "desc" }],
      }),
      referralCode
        ? prisma.user.count({ where: { referredBy: referralCode, deletedAt: null } })
        : Promise.resolve(0),
    ]);
    const nowMs = Date.now();

    return {
      coupons: coupons
        .filter((coupon) => {
          const isExpired = coupon.expiresAt ? coupon.expiresAt.getTime() <= nowMs : false;
          const hasUsesLeft = coupon.usedCount < coupon.usageLimit;
          const isOwned = coupon.redemptions.length > 0;
          return isOwned || (!isExpired && hasUsesLeft);
        })
        .map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discount: coupon.discount,
          pointsCost: coupon.pointsCost,
          remainingUses: Math.max(0, coupon.usageLimit - coupon.usedCount),
          expiresAtLabel: coupon.expiresAt ? formatVietnamDate(coupon.expiresAt) : null,
          isOwned: coupon.redemptions.length > 0,
        })),
      referralCount,
      dataWarning: null,
      requests: requests.map((request) => ({
        id: request.id,
        service: request.service,
        message: request.message,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        createdAtLabel: formatVietnamDateTime(request.createdAt),
        updatedAtLabel: formatVietnamDateTime(request.updatedAt),
      })),
      serviceOrders: serviceOrders.map((order) => ({
        id: order.id,
        orderCode: order.orderCode,
        service: order.service,
        productName: order.productName,
        status: order.status,
        orderDateLabel: formatVietnamDate(order.orderDate),
        quotedPrice: order.quotedPrice,
        paidAmount: order.paidAmount,
        warrantyEndDateLabel: order.warrantyEndDate ? formatVietnamDate(order.warrantyEndDate) : null,
        notes: order.notes,
      })),
      warranties: warranties.map((warranty) => ({
        id: warranty.id,
        serialNo: warranty.serialNo,
        productName: warranty.productName,
        service: warranty.service,
        startDateLabel: formatVietnamDate(warranty.startDate),
        endDate: warranty.endDate.toISOString(),
        endDateLabel: formatVietnamDate(warranty.endDate),
        isActive: warranty.endDate.getTime() > nowMs,
        notes: warranty.notes,
      })),
    };
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Account page data fallback", error);
      return {
        dataWarning:
          "Dữ liệu tài khoản tạm thời chưa đồng bộ đầy đủ. Bạn vẫn có thể xem thông tin cơ bản và thử tải lại sau ít phút.",
        coupons: [],
        referralCount: 0,
        requests: [],
        serviceOrders: [],
        warranties: [],
      };
    }

    throw error;
  }
}

export default async function AccountPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return <AccountAuthRedirect />;
  }

  const { requests, warranties, serviceOrders, coupons, referralCount, dataWarning } = await loadAccountCollections(
    user.id,
    user.phone,
    user.referralCode
  );

  return (
    <AccountPageClient
      dataWarning={dataWarning}
      initialCoupons={coupons}
      initialUser={{
        id: user.id,
        name: user.name,
        phone: user.phone,
        referralCode: user.referralCode,
        referralCount,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        createdAt: user.createdAt.toISOString(),
        createdAtLabel: formatVietnamDate(user.createdAt),
      }}
      initialRequests={requests}
      initialServiceOrders={serviceOrders}
      initialWarranties={warranties}
    />
  );
}
