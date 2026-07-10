import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

const MAX_LOYALTY_POINTS = 2_147_483_647;
const LOYALTY_UPDATE_MAX_ATTEMPTS = 5;

function parseIntegerInput(value: unknown) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null;
  }

  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function updateLoyaltyPoints(userId: string, points: number, setExact: boolean) {
  for (let attempt = 0; attempt < LOYALTY_UPDATE_MAX_ATTEMPTS; attempt += 1) {
    const previousUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, loyaltyPoints: true },
    });
    if (!previousUser) return { status: "not-found" as const };

    const nextLoyaltyPoints = setExact
      ? Math.max(0, points)
      : Math.max(0, previousUser.loyaltyPoints + points);
    if (nextLoyaltyPoints > MAX_LOYALTY_POINTS) return { status: "limit" as const };

    const update = await prisma.user.updateMany({
      where: { id: userId, loyaltyPoints: previousUser.loyaltyPoints },
      data: { loyaltyPoints: nextLoyaltyPoints },
    });
    if (update.count === 1) {
      return {
        status: "updated" as const,
        previousUser,
        user: { ...previousUser, loyaltyPoints: nextLoyaltyPoints },
      };
    }
  }

  throw new Error("Loyalty points changed too frequently; retry the request.");
}

// PATCH /api/admin/loyalty — Admin adds/deducts points for a user
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const parsedPoints = parseIntegerInput(body.points);
    const setExact = body.setExact ?? false;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) : "";
    if (
      !userId
      || userId.length > 64
      || parsedPoints === null
      || Math.abs(parsedPoints) > MAX_LOYALTY_POINTS
      || typeof setExact !== "boolean"
      || (body.reason !== undefined && typeof body.reason !== "string")
    ) {
      return NextResponse.json(
        { success: false, message: "Mã khách, điểm và chế độ cập nhật chưa đúng định dạng." },
        { status: 400 }
      );
    }

    const updateResult = await updateLoyaltyPoints(userId, parsedPoints, setExact);
    if (updateResult.status === "not-found") {
      return NextResponse.json({ success: false, message: "Không tìm thấy khách hàng." }, { status: 404 });
    }
    if (updateResult.status === "limit") {
      return NextResponse.json(
        { success: false, message: "Tổng điểm vượt quá giới hạn hệ thống." },
        { status: 400 }
      );
    }
    const { previousUser, user } = updateResult;
    await recordAuditLog({
      action: setExact ? "LOYALTY_SET" : "LOYALTY_ADJUST",
      actor: admin,
      entity: "User",
      entityId: user.id,
      oldData: toAuditJson(previousUser),
      newData: toAuditJson({
        ...user,
        points: parsedPoints,
        reason: reason || null,
        setExact,
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
