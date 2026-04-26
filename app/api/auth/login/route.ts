import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createInvalidJsonResponse,
  createRateLimitResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { generateSessionToken, verifyPassword } from "@/lib/auth";
import {
  consumeRateLimitForRequest,
  formatDurationVi,
  getClientIP,
  getRateLimitStatusForRequest,
  RATE_LIMITS,
  resetRateLimitForRequest,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

const INVALID_MSG = "Số điện thoại hoặc mật khẩu chưa đúng.";

function createRateLimitedResponse(message: string, result: RateLimitResult) {
  return createRateLimitResponse(message, result, {
    remainingAttempts: 0,
  });
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
    const currentLimit = await getRateLimitStatusForRequest(identifier, RATE_LIMITS.login);

    if (!currentLimit.allowed) {
      return createRateLimitedResponse(getBlockedMessage(currentLimit.retryAfterSec), currentLimit);
    }

    const body = await readJsonBody(request);
    if (!body) {
      return createInvalidJsonResponse();
    }

    const phone = normalizePhone(sanitizeText(typeof body.phone === "string" ? body.phone : ""));
    const password = typeof body.password === "string" ? body.password : "";

    if (!phone || !password) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng nhập đầy đủ số điện thoại và mật khẩu.",
      });
    }

    if (!isValidPhone(phone)) {
      return createErrorResponse({
        status: 400,
        message: "Số điện thoại không hợp lệ.",
      });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    const isValid = user ? await verifyPassword(password, user.password) : false;

    if (!user || !isValid) {
      const failedAttempt = await consumeRateLimitForRequest(identifier, RATE_LIMITS.login);

      if (!failedAttempt.allowed) {
        return createRateLimitedResponse(getBlockedMessage(failedAttempt.retryAfterSec), failedAttempt);
      }

      return createErrorResponse({
        status: 401,
        message: INVALID_MSG,
        extra: {
          warning: getLoginWarning(failedAttempt.remaining),
          remainingAttempts: failedAttempt.remaining,
        },
      });
    }

    await resetRateLimitForRequest(identifier);

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
    logApiError("Login API Error", error);
    return createErrorResponse({
      status: 500,
      message: "Lỗi hệ thống. Vui lòng thử lại.",
    });
  }
}
