import { prisma } from "@/lib/prisma";
import AdminCouponsClient from "./AdminCouponsClient";

export default async function AdminCouponsPage() {
  const coupons = await prisma.coupon.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      code: true,
      description: true,
      discount: true,
      pointsCost: true,
      usageLimit: true,
      usedCount: true,
      active: true,
      expiresAt: true,
      _count: { select: { redemptions: true } },
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          createdAt: true,
          user: { select: { name: true, phone: true } },
        },
      },
    },
  });

  return (
    <AdminCouponsClient
      initialCoupons={coupons.map((coupon) => ({
        ...coupon,
        expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
        redemptions: coupon.redemptions.map((redemption) => ({
          ...redemption,
          createdAt: redemption.createdAt.toISOString(),
        })),
      }))}
    />
  );
}
