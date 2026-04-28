import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createErrorResponse,
  createInvalidJsonResponse,
  logApiError,
  readJsonBody,
} from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getPublicApprovedReviews } from "@/lib/public-data";
import { normalizeServiceOrderStatus } from "@/lib/service-orders";
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
    const serviceOrderId = sanitizeText(typeof body.serviceOrderId === "string" ? body.serviceOrderId : "").slice(0, 64);

    if (!Number.isFinite(ratingValue) || !comment || ratingValue < 1 || ratingValue > 5) {
      return createErrorResponse({
        status: 400,
        message: "Vui lòng nhập đủ đánh giá (1-5 sao) và bình luận.",
      });
    }

    let linkedServiceOrderId: string | null = null;
    let linkedService = service || "KHAC";

    if (!serviceOrderId && session.user.role !== "ADMIN") {
      return createErrorResponse({
        status: 400,
        message: "Bạn chỉ có thể đánh giá sau khi chọn một đơn dịch vụ đã hoàn thành.",
      });
    }

    if (serviceOrderId) {
      const order = await prisma.serviceOrder.findUnique({
        where: { id: serviceOrderId },
        select: {
          customerPhone: true,
          customerVisible: true,
          deletedAt: true,
          id: true,
          review: { select: { id: true } },
          service: true,
          status: true,
          userId: true,
        },
      });

      if (!order || order.deletedAt || normalizeServiceOrderStatus(order.status) !== "COMPLETED") {
        return createErrorResponse({
          status: 400,
          message: "Đơn dịch vụ này chưa đủ điều kiện để đánh giá.",
        });
      }

      if (
        session.user.role !== "ADMIN"
        && (!order.customerVisible || (order.userId !== session.user.id && order.customerPhone !== session.user.phone))
      ) {
        return createErrorResponse({
          status: 403,
          message: "Bạn không có quyền đánh giá đơn dịch vụ này.",
        });
      }

      if (order.review) {
        return createErrorResponse({
          status: 409,
          message: "Đơn dịch vụ này đã được gửi đánh giá trước đó.",
        });
      }

      linkedServiceOrderId = order.id;
      linkedService = service || order.service || "KHAC";
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        serviceOrderId: linkedServiceOrderId,
        rating: Math.min(5, Math.max(1, Math.round(ratingValue))),
        comment,
        service: linkedService,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return createErrorResponse({
        status: 409,
        message: "Đơn dịch vụ này đã được gửi đánh giá trước đó.",
      });
    }

    return createErrorResponse({
      status: 500,
      message: "Lỗi hệ thống.",
    });
  }
}
