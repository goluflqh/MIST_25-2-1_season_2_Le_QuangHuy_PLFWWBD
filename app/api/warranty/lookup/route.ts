import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimitForRequest, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import {
  buildWarrantyLookupPhoneKey,
  serializePublicWarranty,
} from "@/lib/public-warranty";
import { isValidPhone, normalizePhone, sanitizeText } from "@/lib/sanitize";

const MAX_PUBLIC_RESULTS = 10;
const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};
const lookupSchema = z
  .object({
    phone: z.string().min(1).max(32),
  })
  .strict();

function jsonResponse(
  body: Record<string, unknown>,
  options: { status?: number; headers?: Record<string, string> } = {}
) {
  return NextResponse.json(body, {
    status: options.status,
    headers: { ...NO_STORE_HEADERS, ...options.headers },
  });
}

// POST keeps the phone number out of URLs, browser history, and common access logs.
export async function POST(request: Request) {
  try {
    const ipRateLimit = await consumeRateLimitForRequest(
      `warranty-lookup:ip:${getClientIP(request)}`,
      RATE_LIMITS.warrantyLookup
    );
    if (!ipRateLimit.allowed) {
      return jsonResponse(
        { success: false, message: "Bạn đã tra cứu quá nhiều lần. Vui lòng chờ rồi thử lại." },
        {
          status: 429,
          headers: { "Retry-After": String(ipRateLimit.retryAfterSec) },
        }
      );
    }

    const parsedBody = lookupSchema.safeParse(await request.json().catch(() => null));

    if (!parsedBody.success) {
      return jsonResponse(
        { success: false, message: "Vui lòng nhập số điện thoại đã dùng khi đăng ký dịch vụ." },
        { status: 400 }
      );
    }

    const phone = normalizePhone(sanitizeText(parsedBody.data.phone));

    if (!isValidPhone(phone)) {
      return jsonResponse(
        { success: false, message: "Số điện thoại chưa đúng định dạng. Vui lòng kiểm tra lại." },
        { status: 400 }
      );
    }

    const phoneRateLimit = await consumeRateLimitForRequest(
      `warranty-lookup:phone:${buildWarrantyLookupPhoneKey(phone)}`,
      RATE_LIMITS.warrantyLookupPhone
    );
    if (!phoneRateLimit.allowed) {
      return jsonResponse(
        { success: false, message: "Số điện thoại này đã được tra cứu nhiều lần. Vui lòng thử lại sau." },
        {
          status: 429,
          headers: { "Retry-After": String(phoneRateLimit.retryAfterSec) },
        }
      );
    }

    const warranties = await prisma.warranty.findMany({
      where: {
        customerPhone: phone,
        deletedAt: null,
      },
      select: {
        endDate: true,
        productName: true,
        serialNo: true,
        service: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_PUBLIC_RESULTS + 1,
    });

    const hasMore = warranties.length > MAX_PUBLIC_RESULTS;
    const summaries = warranties
      .slice(0, MAX_PUBLIC_RESULTS)
      .map((warranty) => serializePublicWarranty(warranty));

    return jsonResponse({
      success: true,
      lookupType: "phone",
      warranties: summaries,
      total: summaries.length,
      hasMore,
    });
  } catch (error) {
    console.error(
      "Warranty lookup error:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return jsonResponse(
      { success: false, message: "Chưa tra cứu được bảo hành lúc này." },
      { status: 500 }
    );
  }
}
