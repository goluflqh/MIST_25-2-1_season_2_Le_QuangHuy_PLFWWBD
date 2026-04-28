import AccountAuthRedirect from "@/components/account/AccountAuthRedirect";
import AccountPageClient from "@/components/account/AccountPageClient";
import {
  isPrismaDatabaseUnavailable,
  logPrismaAvailabilityWarning,
  prisma,
} from "@/lib/prisma";
import { normalizeServiceOrderStatus } from "@/lib/service-orders";
import { getCurrentSessionUser } from "@/lib/session";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/vietnam-time";

async function loadAccountCollections(userId: string, phone: string, referralCode: string | null, loyaltyPoints: number) {
  try {
    const [requests, warranties, serviceOrders, coupons, referralCount] = await Promise.all([
      prisma.contactRequest.findMany({
        where: {
          deletedAt: null,
          OR: [{ userId }, { phone }],
        },
        include: {
          serviceOrder: {
            select: {
              customerVisible: true,
              deletedAt: true,
              id: true,
              review: { select: { deletedAt: true, id: true } },
              status: true,
              updatedAt: true,
            },
          },
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
            select: {
              id: true,
              contactRequest: {
                select: {
                  id: true,
                  serviceOrder: { select: { id: true } },
                  status: true,
                },
              },
              serviceOrder: { select: { id: true } },
            },
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
          const redemption = coupon.redemptions[0];
          const isOwned = Boolean(redemption);
          const isUsed = Boolean(redemption?.serviceOrder || redemption?.contactRequest?.serviceOrder);
          return !isUsed && (isOwned || (!isExpired && hasUsesLeft && coupon.pointsCost <= loyaltyPoints));
        })
        .map((coupon) => {
          const redemption = coupon.redemptions[0];
          const redemptionStatus: "AVAILABLE" | "OWNED" | "PENDING" = redemption?.contactRequest
            ? "PENDING"
            : redemption
              ? "OWNED"
              : "AVAILABLE";

          return {
            redemptionId: redemption?.id ?? null,
            redemptionStatus,
            id: coupon.id,
            code: coupon.code,
            description: coupon.description,
            discount: coupon.discount,
            pointsCost: coupon.pointsCost,
            remainingUses: Math.max(0, coupon.usageLimit - coupon.usedCount),
            expiresAtLabel: coupon.expiresAt ? formatVietnamDate(coupon.expiresAt) : null,
            isOwned: coupon.redemptions.length > 0,
          };
        }),
      referralCount,
      dataWarning: null,
      requests: requests.map((request) => {
        const linkedOrder = request.serviceOrder
          && !request.serviceOrder.deletedAt
          && request.serviceOrder.customerVisible
          ? request.serviceOrder
          : null;
        const status = linkedOrder ? normalizeServiceOrderStatus(linkedOrder.status) : normalizeServiceOrderStatus(request.status);
        const updatedAt = linkedOrder?.updatedAt || request.updatedAt;

        return {
          id: request.id,
          service: request.service,
          message: request.message,
          status,
          serviceOrderId: linkedOrder?.id || null,
          reviewId: linkedOrder?.review?.id || null,
          createdAt: request.createdAt.toISOString(),
          createdAtLabel: formatVietnamDateTime(request.createdAt),
          updatedAt: updatedAt.toISOString(),
          updatedAtLabel: formatVietnamDateTime(updatedAt),
        };
      }),
      serviceOrders: serviceOrders.map((order) => {
        const status = normalizeServiceOrderStatus(order.status);

        return {
          id: order.id,
          orderCode: order.orderCode,
          service: order.service,
          productName: order.productName,
          status,
          orderDateLabel: formatVietnamDate(order.orderDate),
          quotedPrice: order.quotedPrice,
          paidAmount: order.paidAmount,
          couponCode: order.couponCode,
          couponDiscount: order.couponDiscount,
          discountAmount: order.discountAmount,
          warrantyEndDateLabel: status === "COMPLETED" && order.warrantyEndDate ? formatVietnamDate(order.warrantyEndDate) : null,
          notes: order.notes,
        };
      }),
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
    user.referralCode,
    user.loyaltyPoints
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
