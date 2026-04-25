import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET — Admin list all coupons
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Coupons GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}

// POST — Admin creates coupon
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const body = await request.json();
    const coupon = await prisma.coupon.create({ data: body });
    await recordAuditLog({
      action: "COUPON_CREATE",
      actor: admin,
      entity: "Coupon",
      entityId: coupon.id,
      newData: toAuditJson(coupon),
      request,
    });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Coupons POST error:", error);
    return NextResponse.json(
      { success: false, message: "Không tạo được mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}

// DELETE — Admin deletes coupon
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    const deletedCoupon = await prisma.coupon.delete({ where: { id } });
    await recordAuditLog({
      action: "COUPON_DELETE",
      actor: admin,
      entity: "Coupon",
      entityId: deletedCoupon.id,
      oldData: toAuditJson(deletedCoupon),
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Coupons DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}
