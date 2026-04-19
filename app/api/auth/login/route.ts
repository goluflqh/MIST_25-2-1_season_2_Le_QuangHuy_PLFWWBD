import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, generateSessionToken } from "@/lib/auth";
import {
  consumeRateLimit,
  formatDurationVi,
  getClientIP,
  getRateLimitStatus,
  RATE_LIMITS,
  resetRateLimit,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { normalizePhone, isValidPhone, sanitizeText } from "@/lib/sanitize";

const INVALID_MSG = "Số điện thoại hoặc mật khẩu chưa đúng.";

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
  const waitText = formatDurationVi(retryAfterSec);
  return `Bạn đã thử đăng nhập hơi nhiều lần liên tiếp. Vui lòng chờ khoảng ${waitText} rồi thử lại, hoặc bấm "Quên mật khẩu" để được hỗ trợ nhanh hơn.`;
}

function getLoginWarning(remaining: number) {
  if (remaining <= 0) {
    return `Bạn đã dùng hết lượt thử nhanh trong đợt này. Nếu nhập sai thêm 1 lần, hệ thống sẽ tạm nghỉ ${formatDurationVi(RATE_LIMITS.login.windowSec)}.`;
  }

  if (remaining <= 2) {
    return `Còn ${remaining} lần thử nhanh trước khi hệ thống tạm nghỉ ${formatDurationVi(RATE_LIMITS.login.windowSec)}.`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const identifier = `login:${ip}`;
    const currentLimit = getRateLimitStatus(identifier, RATE_LIMITS.login);

    if (!currentLimit.allowed) {
      return createRateLimitedResponse(getBlockedMessage(currentLimit.retryAfterSec), currentLimit);
    }

    const body = await request.json();
    const phone = normalizePhone(sanitizeText(body.phone || ""));
    const password = body.password || "";

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập đầy đủ số điện thoại và mật khẩu." },
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
    const isValid = user ? await verifyPassword(password, user.password) : false;

    if (!user || !isValid) {
      const failedAttempt = consumeRateLimit(identifier, RATE_LIMITS.login);

      if (!failedAttempt.allowed) {
        return createRateLimitedResponse(getBlockedMessage(failedAttempt.retryAfterSec), failedAttempt);
      }

      return NextResponse.json(
        {
          success: false,
          message: INVALID_MSG,
          warning: getLoginWarning(failedAttempt.remaining),
          remainingAttempts: failedAttempt.remaining,
        },
        { status: 401 }
      );
    }

    resetRateLimit(identifier);

    // Clean up old sessions for this user (keep max 5).
    const oldSessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: 4,
    });
    if (oldSessions.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: oldSessions.map((session) => session.id) } },
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
