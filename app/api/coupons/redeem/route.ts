import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";
import { formatVietnamDate } from "@/lib/vietnam-time";

function redeemError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

// POST — User redeems coupon with loyalty points
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse("Vui lòng đăng nhập.");

    const body = await request.json().catch(() => null);
    const couponId = typeof body?.couponId === "string" ? body.couponId : "";
    if (!couponId) {
      return NextResponse.json({ success: false, message: "Thiếu mã ưu đãi cần đổi." }, { status: 400 });
    }

    const now = new Date();
    const { redemptionId, updatedUser, redeemedCoupon } = await prisma.$transaction(async (tx) => {
      const coupon = await tx.coupon.findUnique({
        where: { id: couponId },
        include: {
          redemptions: {
            where: { userId: session.user.id },
            select: { id: true },
            take: 1,
          },
        },
      });

      if (!coupon || !coupon.active) throw redeemError("Mã không hợp lệ.");
      if (coupon.redemptions.length > 0) throw redeemError("Bạn đã nhận mã này rồi.", 409);
      if (coupon.usedCount >= coupon.usageLimit) throw redeemError("Mã đã hết lượt.");
      if (coupon.expiresAt && coupon.expiresAt < now) throw redeemError("Mã đã hết hạn.");

      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { loyaltyPoints: true },
      });
      if (!user) throw redeemError("Tài khoản không hợp lệ.", 401);
      if (user.loyaltyPoints < coupon.pointsCost) {
        throw redeemError(`Cần ${coupon.pointsCost} điểm, bạn có ${user.loyaltyPoints} điểm.`);
      }

      const usageUpdate = await tx.coupon.updateMany({
        where: { id: coupon.id, usedCount: coupon.usedCount },
        data: { usedCount: { increment: 1 } },
      });
      if (usageUpdate.count !== 1) {
        throw redeemError("Mã vừa được người khác nhận. Vui lòng tải lại và thử lại.", 409);
      }

      const redemption = await tx.couponRedemption.create({
        data: { couponId: coupon.id, userId: session.user.id },
      });

      const [updatedUser, redeemedCoupon] = await Promise.all([
        tx.user.update({
          where: { id: session.user.id },
          data: { loyaltyPoints: { decrement: coupon.pointsCost } },
          select: { loyaltyPoints: true },
        }),
        tx.coupon.findUniqueOrThrow({
          where: { id: coupon.id },
          select: {
            id: true,
            code: true,
            description: true,
            discount: true,
            expiresAt: true,
            pointsCost: true,
            usageLimit: true,
            usedCount: true,
          },
        }),
      ]);

      return { redemptionId: redemption.id, updatedUser, redeemedCoupon };
    });

    return NextResponse.json({
      success: true,
      message: `Đổi thành công! Mã giảm giá: ${redeemedCoupon.code}`,
      coupon: {
        id: redeemedCoupon.id,
        redemptionId,
        code: redeemedCoupon.code,
        description: redeemedCoupon.description,
        discount: redeemedCoupon.discount,
        expiresAtLabel: redeemedCoupon.expiresAt ? formatVietnamDate(redeemedCoupon.expiresAt) : null,
        isOwned: true,
        redemptionStatus: "OWNED",
        pointsCost: redeemedCoupon.pointsCost,
        remainingUses: Math.max(0, redeemedCoupon.usageLimit - redeemedCoupon.usedCount),
      },
      loyaltyPoints: updatedUser.loyaltyPoints,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ success: false, message: "Bạn đã nhận mã này rồi." }, { status: 409 });
    }

    if (error instanceof Error && "status" in error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: (error as Error & { status: number }).status }
      );
    }

    console.error("Coupon redeem error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
