import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12) {
  return Array.from(
    { length },
    () => TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)],
  ).join("");
}

// GET /api/admin/users — List all users
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, phone: true, role: true,
        loyaltyPoints: true, referralCode: true, createdAt: true,
        _count: { select: { contactRequests: true, reviews: true } },
      },
    });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Admin users GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách khách hàng lúc này." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users — Delete a user (cascade)
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { userId } = await request.json();

    // Prevent deleting yourself
    if (userId === admin.id) {
      return NextResponse.json({ success: false, message: "Không thể xoá chính mình." }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, message: "Không tìm thấy tài khoản cần xoá." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      const couponUsageByUser = await tx.couponRedemption.groupBy({
        by: ["couponId"],
        where: { userId },
        _count: { _all: true },
      });

      await tx.session.deleteMany({ where: { userId } });
      await tx.review.deleteMany({ where: { userId } });
      await tx.warranty.deleteMany({ where: { userId } });
      await tx.contactRequest.deleteMany({
        where: { userId },
      });
      await tx.couponRedemption.deleteMany({ where: { userId } });
      await tx.auditLog.deleteMany({ where: { userId } });

      for (const couponUsage of couponUsageByUser) {
        const coupon = await tx.coupon.findUnique({
          where: { id: couponUsage.couponId },
          select: { usedCount: true },
        });

        if (coupon) {
          await tx.coupon.update({
            where: { id: couponUsage.couponId },
            data: {
              usedCount: Math.max(0, coupon.usedCount - couponUsage._count._all),
            },
          });
        }
      }

      await tx.user.delete({ where: { id: userId } });
    });
    await recordAuditLog({
      action: "USER_DELETE",
      actor: admin,
      entity: "User",
      entityId: userId,
      oldData: toAuditJson(targetUser || { id: userId }),
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin users DELETE error:", error);
    return NextResponse.json({ success: false, message: "Lỗi xoá người dùng." }, { status: 500 });
  }
}

// PATCH /api/admin/users — Issue a temporary password
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { userId } = await request.json();

    if (typeof userId !== "string" || !userId.trim() || userId.length > 100) {
      return NextResponse.json({ success: false, message: "Tài khoản khách hàng không hợp lệ." }, { status: 400 });
    }

    const normalizedUserId = userId.trim();
    const targetUser = await prisma.user.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản cần cấp lại mật khẩu." },
        { status: 404 },
      );
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Kh\u00f4ng th\u1ec3 c\u1ea5p l\u1ea1i m\u1eadt kh\u1ea9u cho t\u00e0i kho\u1ea3n qu\u1ea3n tr\u1ecb." },
        { status: 403 },
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashed = await hashPassword(temporaryPassword);
    const passwordUpdate = prisma.user.update({
      where: { id: normalizedUserId },
      data: { password: hashed },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        loyaltyPoints: true,
        referralCode: true,
        referredBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Xoá tất cả session cũ → buộc đăng nhập lại
    const sessionRevocation = prisma.session.deleteMany({ where: { userId: normalizedUserId } });
    const [updatedUser, deletedSessions] = await prisma.$transaction([
      passwordUpdate,
      sessionRevocation,
    ]);
    await recordAuditLog({
      action: "USER_PASSWORD_RESET",
      actor: admin,
      entity: "User",
      entityId: normalizedUserId,
      oldData: toAuditJson(targetUser),
      newData: toAuditJson({
        ...updatedUser,
        passwordReset: true,
        revokedSessionCount: deletedSessions.count,
      }),
      request,
    });

    return NextResponse.json({
      success: true,
      message: "Đã cấp mật khẩu tạm. Mật khẩu này chỉ hiển thị một lần.",
      temporaryPassword,
    });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return NextResponse.json({ success: false, message: "Không thể cấp lại mật khẩu lúc này." }, { status: 500 });
  }
}
