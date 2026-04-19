import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, formatDurationVi, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
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
    const rateLimit = checkRateLimit(`contact:${ip}`, RATE_LIMITS.contact);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          message: `Bạn gửi hơi nhanh. Vui lòng thử lại sau ${formatDurationVi(rateLimit.retryAfterSec)}.`,
          retryAfterSec: rateLimit.retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSec),
          },
        }
      );
    }

    const body = await request.json();
    const name = optionalText(body?.name, 80);
    const phone = normalizePhone(typeof body?.phone === "string" ? body.phone : "");
    const service = optionalText(body?.service, 40);
    const message = optionalText(body?.message, 500);
    const source = optionalText(body?.source, 64) || "homepage";
    const sourcePath = optionalText(body?.sourcePath, 255);
    const referrer = optionalText(body?.referrer, 255);
    const utmSource = optionalText(body?.utmSource, 100);
    const utmMedium = optionalText(body?.utmMedium, 100);
    const utmCampaign = optionalText(body?.utmCampaign, 120);
    const utmTerm = optionalText(body?.utmTerm, 120);
    const utmContent = optionalText(body?.utmContent, 120);

    if (!name || !phone || !service) {
      return NextResponse.json(
        { success: false, message: "Thiếu thông tin bắt buộc (tên, SĐT, dịch vụ)." },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập họ tên đầy đủ hơn một chút." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { success: false, message: "Số điện thoại không hợp lệ. Vui lòng kiểm tra lại." },
        { status: 400 }
      );
    }

    const serviceType = VALID_SERVICES.includes(service) ? service : "KHAC";

    let userId: string | undefined;
    try {
      const session = await getCurrentSession();
      if (session) userId = session.userId;
    } catch {
      // Ignore guest session lookup failures.
    }

    const contactRequest = await prisma.contactRequest.create({
      data: {
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
    console.error("Contact API Error:", error);
    return NextResponse.json(
      { success: false, message: "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const contacts = await prisma.contactRequest.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, contacts });
  } catch (error) {
    console.error("Contact GET Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
