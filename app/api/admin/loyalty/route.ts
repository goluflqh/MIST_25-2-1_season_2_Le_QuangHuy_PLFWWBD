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
    const parsedPoints = typeof points === "number" ? points : Number.parseInt(String(points ?? ""), 10);
    if (!userId || !Number.isFinite(parsedPoints)) {
      return NextResponse.json({ success: false, message: "userId và points bắt buộc." }, { status: 400 });
    }

    const previousUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, loyaltyPoints: true },
    });

    if (!previousUser) {
      return NextResponse.json({ success: false, message: "Không tìm thấy khách hàng." }, { status: 404 });
    }

    const nextLoyaltyPoints = setExact
      ? Math.max(0, parsedPoints)
      : Math.max(0, previousUser.loyaltyPoints + parsedPoints);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { loyaltyPoints: nextLoyaltyPoints },
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
        points: parsedPoints,
        reason: reason || null,
        setExact: Boolean(setExact),
      }),
      request,
    });

    console.log(`[Loyalty] Admin ${admin.name} changed ${parsedPoints} points for ${user.name}: ${reason || "N/A"}`);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Loyalty update error:", error);
    return NextResponse.json(
      { success: false, message: "Không cập nhật được điểm khách hàng lúc này." },
      { status: 500 }
    );
  }
}
