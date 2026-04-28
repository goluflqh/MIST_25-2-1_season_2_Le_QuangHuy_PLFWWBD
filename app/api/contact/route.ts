import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createInvalidJsonResponse,
  createRateLimitResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { checkRateLimitForRequest, formatDurationVi, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { forbiddenResponse, getCurrentAdminUser, getCurrentSession } from "@/lib/session";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

const VALID_SERVICES = ["DONG_PIN", "DEN_NLMT", "PIN_LUU_TRU", "CAMERA", "CUSTOM", "KHAC"];

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;

  const sanitized = sanitizeText(value).slice(0, maxLength).trim();
  return sanitized || null;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const rateLimit = await checkRateLimitForRequest(`contact:${ip}`, RATE_LIMITS.contact);

    if (!rateLimit.allowed) {
      return createRateLimitResponse(
        `Bạn gửi hơi nhanh. Vui lòng thử lại sau ${formatDurationVi(rateLimit.retryAfterSec)}.`,
        rateLimit
      );
    }

    const body = await readJsonBody(request);
    if (!body) {
      return createInvalidJsonResponse();
    }

    const name = optionalText(body.name, 80);
    const phone = normalizePhone(typeof body.phone === "string" ? body.phone : "");
    const service = optionalText(body.service, 40);
    const message = optionalText(body.message, 500);
    const source = optionalText(body.source, 64) || "homepage";
    const sourcePath = optionalText(body.sourcePath, 255);
    const referrer = optionalText(body.referrer, 255);
    const utmSource = optionalText(body.utmSource, 100);
    const utmMedium = optionalText(body.utmMedium, 100);
    const utmCampaign = optionalText(body.utmCampaign, 120);
    const utmTerm = optionalText(body.utmTerm, 120);
    const utmContent = optionalText(body.utmContent, 120);
    const couponRedemptionId = optionalText(body.couponRedemptionId, 64);

    if (!name || !phone || !service) {
      return createErrorResponse({
        status: 400,
        message: "Thiếu thông tin bắt buộc (tên, SĐT, dịch vụ).",
      });
    }

    if (name.length < 2) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng nhập họ tên đầy đủ hơn một chút.",
      });
    }

    if (!isValidPhone(phone)) {
      return createErrorResponse({
        status: 400,
        message: "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại.",
      });
    }

    const serviceType = VALID_SERVICES.includes(service) ? service : "KHAC";

    let userId: string | undefined;
    try {
      const session = await getCurrentSession();
      if (session?.user.role === "CUSTOMER") userId = session.userId;
    } catch {
      // Ignore guest session lookup failures.
    }

    if (couponRedemptionId && !userId) {
      return createErrorResponse({
        status: 401,
        message: "Vui lòng đăng nhập để áp dụng mã giảm giá đã nhận.",
      });
    }

    let couponRedemptionToApply: string | null = null;
    if (couponRedemptionId && userId) {
      const now = new Date();
      const redemption = await prisma.couponRedemption.findUnique({
        where: { id: couponRedemptionId },
        include: {
          contactRequest: { select: { id: true } },
          coupon: { select: { active: true, expiresAt: true } },
          serviceOrder: { select: { id: true } },
        },
      });

      if (
        !redemption
        || redemption.userId !== userId
        || !redemption.coupon.active
        || (redemption.coupon.expiresAt && redemption.coupon.expiresAt < now)
        || redemption.contactRequest
        || redemption.serviceOrder
      ) {
        return createErrorResponse({
          status: 400,
          message: "Mã giảm giá này không còn dùng được cho yêu cầu mới.",
        });
      }

      couponRedemptionToApply = redemption.id;
    }

    const contactRequest = await prisma.contactRequest.create({
      data: {
        couponRedemptionId: couponRedemptionToApply,
        name,
        phone,
        service: serviceType,
        message,
        source,
        sourcePath,
        referrer,
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        userId: userId || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Yêu cầu đã được gửi thành công. Đội ngũ kỹ thuật sẽ liên hệ với bạn trong vòng 15 phút.",
        id: contactRequest.id,
      },
      { status: 201 }
    );
  } catch (error) {
    logApiError("Contact API Error", error);
    return createErrorResponse({
      status: 500,
      message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.",
    });
  }
}

export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const contacts = await prisma.contactRequest.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    logApiError("Contact GET Error", error);
    return createErrorResponse({
      status: 500,
      message: "Không tải được danh sách yêu cầu lúc này.",
    });
  }
}
