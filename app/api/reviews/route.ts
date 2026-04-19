import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// GET /api/reviews — Public: get approved reviews
export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error("Reviews GET error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST /api/reviews — User submits a review (requires login)
export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse("Phiên hết hạn.");

    const body = await request.json();
    const { rating, comment, service } = body;

    if (!rating || !comment || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: "Vui lòng nhập đủ đánh giá (1-5 sao) và bình luận." }, { status: 400 });
    }

    const review = await prisma.review.create({
      data: {
        userId: session.user.id,
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        comment: comment.trim().slice(0, 500),
        service: service || "KHAC",
        approved: false, // Admin duyệt trước khi hiển thị
      },
    });

    return NextResponse.json({ success: true, message: "Đánh giá đã gửi! Sẽ hiển thị sau khi được duyệt.", review });
  } catch (error) {
    console.error("Review POST error:", error);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}
