import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// PATCH /api/user/password — User changes their own password
export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập đầy đủ." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ success: false, message: "Mật khẩu mới phải ≥ 6 ký tự." }, { status: 400 });
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, session.user.password);
    if (!isValid) {
      return NextResponse.json({ success: false, message: "Mật khẩu hiện tại không đúng." }, { status: 400 });
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true, message: "Đã đổi mật khẩu thành công!" });
  } catch (error) {
    console.error("Password change error:", error);
    return NextResponse.json({ success: false, message: "Lỗi đổi mật khẩu." }, { status: 500 });
  }
}
