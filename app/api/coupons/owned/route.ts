import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ success: true, coupons: [] });
    }

    const now = new Date();
    const redemptions = await prisma.couponRedemption.findMany({
      where: {
        userId: session.user.id,
        contactRequest: null,
        serviceOrder: null,
        coupon: {
          active: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      include: {
        coupon: {
          select: {
            code: true,
            description: true,
            discount: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      coupons: redemptions.map((redemption) => ({
        id: redemption.id,
        code: redemption.coupon.code,
        description: redemption.coupon.description,
        discount: redemption.coupon.discount,
        expiresAtLabel: redemption.coupon.expiresAt
          ? redemption.coupon.expiresAt.toLocaleDateString("vi-VN")
          : null,
      })),
    });
  } catch (error) {
    console.error("Owned coupons GET error:", error);
    return NextResponse.json({ success: false, coupons: [] }, { status: 500 });
  }
}
