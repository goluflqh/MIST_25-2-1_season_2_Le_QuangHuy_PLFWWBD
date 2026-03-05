import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// POST — User redeems coupon with loyalty points
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false, message: "Vui lòng đăng nhập." }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

    const { couponId } = await request.json();
    const coupon = await prisma.coupon.findUnique({ where: { id: couponId } });
    if (!coupon || !coupon.active) return NextResponse.json({ success: false, message: "Mã không hợp lệ." }, { status: 400 });
    if (coupon.usedCount >= coupon.usageLimit) return NextResponse.json({ success: false, message: "Mã đã hết lượt." }, { status: 400 });
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return NextResponse.json({ success: false, message: "Mã đã hết hạn." }, { status: 400 });
    if (session.user.loyaltyPoints < coupon.pointsCost) return NextResponse.json({ success: false, message: `Cần ${coupon.pointsCost} điểm, bạn có ${session.user.loyaltyPoints} điểm.` }, { status: 400 });

    // Deduct points + assign coupon + increment usage
    await prisma.$transaction([
      prisma.user.update({ where: { id: session.user.id }, data: { loyaltyPoints: { decrement: coupon.pointsCost } } }),
      prisma.coupon.update({ where: { id: couponId }, data: { usedCount: { increment: 1 }, userId: session.user.id } }),
    ]);

    return NextResponse.json({ success: true, message: `Đổi thành công! Mã giảm giá: ${coupon.code}` });
  } catch (error) {
    console.error("Coupon redeem error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
