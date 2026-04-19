import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET /api/admin/users — List all users
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const users = await prisma.user.findMany({
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
    return NextResponse.json({ success: false }, { status: 500 });
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

    // Cascade delete related data
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.review.deleteMany({ where: { userId } });
    await prisma.warranty.deleteMany({ where: { userId } });
    await prisma.contactRequest.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

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

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    // Xoá tất cả session cũ → buộc đăng nhập lại
    await prisma.session.deleteMany({ where: { userId } });

    return NextResponse.json({ success: true, message: "Đã đặt lại mật khẩu." });
  } catch (error) {
    console.error("Admin reset password error:", error);
    return NextResponse.json({ success: false, message: "Lỗi đặt lại mật khẩu." }, { status: 500 });
  }
}
