import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// POST — User redeems coupon with loyalty points
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse("Vui lòng đăng nhập.");

    const { couponId } = await request.json();
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || !coupon.active) return NextResponse.json({ success: false, message: "Mã không hợp lệ." }, { status: 400 });
    if (coupon.userId && coupon.userId !== session.user.id) return NextResponse.json({ success: false, message: "Mã này đã được đổi bởi tài khoản khác." }, { status: 400 });
    if (coupon.usedCount >= coupon.usageLimit) return NextResponse.json({ success: false, message: "Mã đã hết lượt." }, { status: 400 });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return NextResponse.json({ success: false, message: "Mã đã hết hạn." }, { status: 400 });
    if (session.user.loyaltyPoints < coupon.pointsCost) return NextResponse.json({ success: false, message: `Cần ${coupon.pointsCost} điểm, bạn có ${session.user.loyaltyPoints} điểm.` }, { status: 400 });

    // Deduct points + assign coupon + increment usage
    const [updatedUser, redeemedCoupon] = await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { loyaltyPoints: { decrement: coupon.pointsCost } },
        select: { loyaltyPoints: true },
      }),
      prisma.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 }, userId: session.user.id },
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

    return NextResponse.json({
      success: true,
      message: `Đổi thành công! Mã giảm giá: ${redeemedCoupon.code}`,
      coupon: {
        id: redeemedCoupon.id,
        code: redeemedCoupon.code,
        description: redeemedCoupon.description,
        discount: redeemedCoupon.discount,
        expiresAtLabel: redeemedCoupon.expiresAt
          ? redeemedCoupon.expiresAt.toLocaleDateString("vi-VN")
          : null,
        isOwned: true,
        pointsCost: redeemedCoupon.pointsCost,
        remainingUses: Math.max(0, redeemedCoupon.usageLimit - redeemedCoupon.usedCount),
      },
      loyaltyPoints: updatedUser.loyaltyPoints,
    });
  } catch (error) {
    console.error("Coupon redeem error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
