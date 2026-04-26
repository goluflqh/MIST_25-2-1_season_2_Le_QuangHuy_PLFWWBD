import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

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
        where: { OR: [{ userId }, { phone: targetUser.phone }] },
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

// PATCH /api/admin/users — Reset user password
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { userId, newPassword } = await request.json();

    if (!userId || !newPassword) {
      return NextResponse.json({ success: false, message: "userId và newPassword bắt buộc." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, message: "Mật khẩu mới phải ≥ 6 ký tự." }, { status: 400 });
    }

    const hashed = await hashPassword(newPassword);
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
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
    const deletedSessions = await prisma.session.deleteMany({ where: { userId } });
    await recordAuditLog({
      action: "USER_PASSWORD_RESET",
      actor: admin,
      entity: "User",
      entityId: userId,
      oldData: toAuditJson(targetUser || { id: userId }),
      newData: toAuditJson({
        ...updatedUser,
        passwordReset: true,
        revokedSessionCount: deletedSessions.count,
      }),
      request,
    });

    return NextResponse.json({ success: true, message: "Đã đặt lại mật khẩu." });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return NextResponse.json({ success: false, message: "Lỗi đặt lại mật khẩu." }, { status: 500 });
  }
}
