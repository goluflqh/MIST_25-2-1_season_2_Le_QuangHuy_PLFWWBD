import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizePhone, isValidPhone, sanitizeText } from "@/lib/sanitize";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const rl = checkRateLimit(`login:${ip}`, RATE_LIMITS.login);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Quá nhiều lần thử. Vui lòng đợi 15 phút." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const phone = normalizePhone(sanitizeText(body.phone || ""));
    const password = body.password || "";

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập SĐT và mật khẩu." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại không hợp lệ." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { phone } });

    // Generic error message to prevent user enumeration
    const INVALID_MSG = "Số điện thoại hoặc mật khẩu không đúng.";

    if (!user) {
      return NextResponse.json(
        { success: false, message: INVALID_MSG },
        { status: 401 }
      );
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: INVALID_MSG },
        { status: 401 }
      );
    }

    // Clean up old sessions for this user (keep max 5)
    const oldSessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: 4,
    });
    if (oldSessions.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: oldSessions.map((s) => s.id) } },
      });
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Đăng nhập thành công!",
        user: { id: user.id, name: user.name, role: user.role },
      },
      { status: 200 }
    );

    response.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
