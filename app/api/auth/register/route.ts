import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, generateSessionToken } from "@/lib/auth";
import {
  consumeRateLimit,
  formatDurationVi,
  getClientIP,
  getRateLimitStatus,
  RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { normalizePhone, isValidPhone, sanitizeText, isStrongPassword } from "@/lib/sanitize";

function createRateLimitedResponse(message: string, result: RateLimitResult) {
  const retryAfterSec = Math.max(result.retryAfterSec, 1);
  const response = NextResponse.json(
    {
      success: false,
      message,
      retryAfterSec,
      remainingAttempts: 0,
    },
    { status: 429 }
  );

  response.headers.set("Retry-After", retryAfterSec.toString());
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", "0");
  response.headers.set("X-RateLimit-Reset", Math.ceil(result.resetAt / 1000).toString());

  return response;
}

function getBlockedMessage(retryAfterSec: number) {
  return `Bạn vừa gửi đăng ký hơi nhiều lần liên tiếp. Vui lòng chờ khoảng ${formatDurationVi(retryAfterSec)} rồi thử lại nhé.`;
}

function getRegisterWarning(remaining: number) {
  if (remaining <= 0) {
    return `Bạn đã dùng hết lượt đăng ký nhanh trong đợt này. Nếu cần thử thêm, vui lòng chờ khoảng ${formatDurationVi(RATE_LIMITS.register.windowSec)} rồi gửi lại.`;
  }

  if (remaining === 1) {
    return `Còn 1 lượt đăng ký nhanh trong đợt ${formatDurationVi(RATE_LIMITS.register.windowSec)} này.`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const identifier = `register:${ip}`;
    const currentLimit = getRateLimitStatus(identifier, RATE_LIMITS.register);

    if (!currentLimit.allowed) {
      return createRateLimitedResponse(getBlockedMessage(currentLimit.retryAfterSec), currentLimit);
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

    const attempt = consumeRateLimit(identifier, RATE_LIMITS.register);
    if (!attempt.allowed) {
      return createRateLimitedResponse(getBlockedMessage(attempt.retryAfterSec), attempt);
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "Số điện thoại này đã được đăng ký. Bạn có thể đăng nhập hoặc bấm quên mật khẩu nếu cần.",
          warning: getRegisterWarning(attempt.remaining),
          remainingAttempts: attempt.remaining,
        },
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
      {
        success: true,
        message: "Đăng ký thành công!",
        user: { id: user.id, name: user.name, role: user.role },
      },
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
