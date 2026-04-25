import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// PATCH /api/admin/loyalty — Admin adds/deducts points for a user
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const { userId, points, reason, setExact } = await request.json();
    if (!userId || typeof points !== "number") {
      return NextResponse.json({ success: false, message: "userId và points bắt buộc." }, { status: 400 });
    }

    const previousUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, loyaltyPoints: true },
    });

    const user = await prisma.user.update({
      where: { id: userId },
      data: { loyaltyPoints: setExact ? points : { increment: points } },
      select: { id: true, name: true, loyaltyPoints: true },
    });
    await recordAuditLog({
      action: setExact ? "LOYALTY_SET" : "LOYALTY_ADJUST",
      actor: admin,
      entity: "User",
      entityId: user.id,
      oldData: toAuditJson(previousUser || { id: userId }),
      newData: toAuditJson({
        ...user,
        points,
        reason: reason || null,
        setExact: Boolean(setExact),
      }),
      request,
    });

    console.log(`[Loyalty] Admin ${admin.name} awarded ${points} points to ${user.name}: ${reason || "N/A"}`);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Loyalty update error:", error);
    return NextResponse.json(
      { success: false, message: "Không cập nhật được điểm khách hàng lúc này." },
      { status: 500 }
    );
  }
}
