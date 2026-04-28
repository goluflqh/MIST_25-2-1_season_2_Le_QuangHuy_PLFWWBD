import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { formatVietnamDate } from "@/lib/vietnam-time";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ success: true, coupons: [] });
    }

    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { loyaltyPoints: true },
    });
    const coupons = await prisma.coupon.findMany({
      where: {
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        redemptions: {
          where: { userId: session.user.id },
          select: {
            id: true,
            contactRequest: { select: { id: true, serviceOrder: { select: { id: true } } } },
            serviceOrder: { select: { id: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ pointsCost: "asc" }, { createdAt: "desc" }],
    });
    const points = user?.loyaltyPoints ?? 0;

    return NextResponse.json({
      success: true,
      coupons: coupons
        .filter((coupon) => {
          const redemption = coupon.redemptions[0];
          const isUsed = Boolean(redemption?.serviceOrder || redemption?.contactRequest?.serviceOrder);
          const isPending = Boolean(redemption?.contactRequest);
          const isOwned = Boolean(redemption);
          const canRedeemNow = coupon.usedCount < coupon.usageLimit && coupon.pointsCost <= points;

          return !isUsed && !isPending && (isOwned || canRedeemNow);
        })
        .map((coupon) => {
          const redemption = coupon.redemptions[0];
          const redemptionStatus = redemption?.contactRequest ? "PENDING" : redemption ? "OWNED" : "AVAILABLE";

          return {
            id: coupon.id,
            redemptionId: redemption?.id ?? null,
            redemptionStatus,
            code: coupon.code,
            description: coupon.description,
            discount: coupon.discount,
            pointsCost: coupon.pointsCost,
            remainingUses: Math.max(0, coupon.usageLimit - coupon.usedCount),
            expiresAtLabel: coupon.expiresAt ? formatVietnamDate(coupon.expiresAt) : null,
          };
        }),
    });
  } catch (error) {
    console.error("Owned coupons GET error:", error);
    return NextResponse.json({ success: false, coupons: [] }, { status: 500 });
  }
}
