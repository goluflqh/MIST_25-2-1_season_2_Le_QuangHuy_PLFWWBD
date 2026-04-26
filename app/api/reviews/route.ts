import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createInvalidJsonResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getPublicApprovedReviews } from "@/lib/public-data";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";
import { sanitizeText } from "@/lib/sanitize";

export async function GET() {
  try {
    const reviews = await getPublicApprovedReviews();
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    logApiError("Reviews GET error", error);
    return createErrorResponse({
      status: 500,
      message: "Không tải được đánh giá lúc này.",
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse("Phiên hết hạn.");

    const body = await readJsonBody(request);
    if (!body) {
      return createInvalidJsonResponse();
    }

    const ratingValue =
      typeof body.rating === "number" ? body.rating : Number(body.rating ?? 0);
    const comment = sanitizeText(typeof body.comment === "string" ? body.comment : "").slice(0, 500);
    const service = sanitizeText(typeof body.service === "string" ? body.service : "").slice(0, 40);

    if (!Number.isFinite(ratingValue) || !comment || ratingValue < 1 || ratingValue > 5) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng nhập đủ đánh giá (1-5 sao) và bình luận.",
      });
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        rating: Math.min(5, Math.max(1, Math.round(ratingValue))),
        comment,
        service: service || "KHAC",
        approved: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Đánh giá đã gửi! Sẽ hiển thị sau khi được duyệt.",
      review,
    });
  } catch (error) {
    logApiError("Review POST error", error);
    return createErrorResponse({
      status: 500,
      message: "Lỗi hệ thống.",
    });
  }
}
