import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken } from "@/lib/auth";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizePhone, isValidPhone, sanitizeText, isStrongPassword } from "@/lib/sanitize";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const rl = checkRateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, message: "Quá nhiều lần đăng ký. Vui lòng thử lại sau." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const name = sanitizeText(body.name || "");
    const phone = normalizePhone(sanitizeText(body.phone || ""));
    const password = body.password || "";
    const referralCode = sanitizeText(body.referralCode || "");

    if (!name || !phone || !password) {
      return NextResponse.json(
        { success: false, message: "Vui lòng điền đầy đủ thông tin." },
        { status: 400 }
      );
    }

    if (name.length < 2 || name.length > 50) {
      return NextResponse.json(
        { success: false, message: "Tên phải từ 2 đến 50 ký tự." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại không hợp lệ." },
        { status: 400 }
      );
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        { success: false, message: "Mật khẩu phải có ít nhất 6 ký tự." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại này đã được đăng ký." },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);

    let referrer = null;
    if (referralCode) {
      referrer = await prisma.user.findUnique({ where: { referralCode } });
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        referredBy: referralCode || null,
        loyaltyPoints: referrer ? 20 : 0,
      },
    });

    if (referrer) {
      await prisma.user.update({
        where: { id: referrer.id },
        data: { loyaltyPoints: { increment: 20 } },
      });
    }

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: { userId: user.id, token, expiresAt },
    });

    const response = NextResponse.json(
      { success: true, message: "Đăng ký thành công!", user: { id: user.id, name: user.name } },
      { status: 201 }
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
    console.error("Register API Error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi hệ thống. Vui lòng thử lại." },
      { status: 500 }
    );
  }
}
