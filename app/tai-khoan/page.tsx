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

async function loadAccountCollections(userId: string, phone: string) {
  try {
    const [requests, warranties, coupons] = await Promise.all([
      prisma.contactRequest.findMany({
        where: {
          deletedAt: null,
          OR: [{ userId }, { phone }],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.warranty.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.coupon.findMany({
        where: {
          active: true,
          OR: [{ userId: null }, { userId }],
        },
        orderBy: [{ userId: "desc" }, { pointsCost: "asc" }, { createdAt: "desc" }],
      }),
    ]);
    const nowMs = Date.now();

    return {
      coupons: coupons
        .filter((coupon) => {
          const isExpired = coupon.expiresAt ? coupon.expiresAt.getTime() <= nowMs : false;
          const hasUsesLeft = coupon.usedCount < coupon.usageLimit;
          return coupon.userId === userId || (!isExpired && hasUsesLeft);
        })
        .map((coupon) => ({
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          discount: coupon.discount,
          pointsCost: coupon.pointsCost,
          remainingUses: Math.max(0, coupon.usageLimit - coupon.usedCount),
          expiresAtLabel: coupon.expiresAt ? formatVietnamDate(coupon.expiresAt) : null,
          isOwned: coupon.userId === userId,
        })),
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
        requests: [],
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

  const { requests, warranties, coupons, dataWarning } = await loadAccountCollections(user.id, user.phone);

  return (
    <AccountPageClient
      dataWarning={dataWarning}
      initialCoupons={coupons}
      initialUser={{
        id: user.id,
        name: user.name,
        phone: user.phone,
        referralCode: user.referralCode,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        createdAt: user.createdAt.toISOString(),
        createdAtLabel: formatVietnamDate(user.createdAt),
      }}
      initialRequests={requests}
      initialWarranties={warranties}
    />
  );
}
