import {
  createErrorResponse,
  createInvalidJsonResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

export async function PATCH(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    const body = await readJsonBody(request);
    if (!body) {
      return createInvalidJsonResponse();
    }

    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng nhập đầy đủ.",
      });
    }

    if (newPassword.length < 6) {
      return createErrorResponse({
        status: 400,
        message: "Mật khẩu mới phải >= 6 ký tự.",
      });
    }

    const isValid = await verifyPassword(currentPassword, session.user.password);
    if (!isValid) {
      return createErrorResponse({
        status: 400,
        message: "Mật khẩu hiện tại không đúng.",
      });
    }

    const hashed = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashed },
    });

    return Response.json({ success: true, message: "Đã đổi mật khẩu thành công!" });
  } catch (error) {
    logApiError("Password change error", error);
    return createErrorResponse({
      status: 500,
      message: "Lỗi đổi mật khẩu.",
    });
  }
}
