import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createInvalidJsonResponse,
  createRateLimitResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { generateSessionToken, hashPassword } from "@/lib/auth";
import {
  consumeRateLimitForRequest,
  formatDurationVi,
  getClientIP,
  getRateLimitStatusForRequest,
  RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { isStrongPassword, isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

function createRateLimitedResponse(message: string, result: RateLimitResult) {
  return createRateLimitResponse(message, result, {
    remainingAttempts: 0,
  });
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
    const currentLimit = await getRateLimitStatusForRequest(identifier, RATE_LIMITS.register);

    if (!currentLimit.allowed) {
      return createRateLimitedResponse(getBlockedMessage(currentLimit.retryAfterSec), currentLimit);
    }

    const body = await readJsonBody(request);
    if (!body) {
      return createInvalidJsonResponse();
    }

    const name = sanitizeText(typeof body.name === "string" ? body.name : "");
    const phone = normalizePhone(sanitizeText(typeof body.phone === "string" ? body.phone : ""));
    const password = typeof body.password === "string" ? body.password : "";
    const referralCode = sanitizeText(typeof body.referralCode === "string" ? body.referralCode : "");

    if (!name || !phone || !password) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng điền đầy đủ thông tin.",
      });
    }

    if (name.length < 2 || name.length > 50) {
      return createErrorResponse({
        status: 400,
        message: "Tên phải từ 2 đến 50 ký tự.",
      });
    }

    if (!isValidPhone(phone)) {
      return createErrorResponse({
        status: 400,
        message: "Số điện thoại không hợp lệ.",
      });
    }

    if (!isStrongPassword(password)) {
      return createErrorResponse({
        status: 400,
        message: "Mật khẩu phải có ít nhất 6 ký tự.",
      });
    }

    const attempt = await consumeRateLimitForRequest(identifier, RATE_LIMITS.register);
    if (!attempt.allowed) {
      return createRateLimitedResponse(getBlockedMessage(attempt.retryAfterSec), attempt);
    }

    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return createErrorResponse({
        status: 409,
        message:
          "Số điện thoại này đã được đăng ký. Bạn có thể đăng nhập hoặc bấm quên mật khẩu nếu cần.",
        extra: {
          warning: getRegisterWarning(attempt.remaining),
          remainingAttempts: attempt.remaining,
        },
      });
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

    await prisma.$transaction([
      prisma.customer.updateMany({
        where: { phone, userId: null, deletedAt: null },
        data: { userId: user.id },
      }),
      prisma.serviceOrder.updateMany({
        where: { customerPhone: phone, userId: null, deletedAt: null },
        data: { userId: user.id },
      }),
      prisma.warranty.updateMany({
        where: { customerPhone: phone, userId: null, deletedAt: null },
        data: { userId: user.id },
      }),
    ]);

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
    logApiError("Register API Error", error);
    return createErrorResponse({
      status: 500,
      message: "Lỗi hệ thống. Vui lòng thử lại.",
    });
  }
}
