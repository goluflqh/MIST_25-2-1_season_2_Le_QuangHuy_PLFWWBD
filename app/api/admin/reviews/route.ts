import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { PUBLIC_REVIEWS_TAG } from "@/lib/public-data";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET /api/admin/reviews — Admin: get all reviews (approved + pending)
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const reviews = await prisma.review.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, phone: true } } },
    });
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error("Admin reviews GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách đánh giá lúc này." },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/reviews — Approve/reject a review
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const approved = body.approved;
    if (!id || id.length > 64 || typeof approved !== "boolean") {
      return NextResponse.json(
        { success: false, message: "Mã đánh giá và trạng thái duyệt chưa đúng định dạng." },
        { status: 400 }
      );
    }

    const previousReview = await prisma.review.findUnique({ where: { id } });
    if (!previousReview || previousReview.deletedAt) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đánh giá cần cập nhật." },
        { status: 404 }
      );
    }

    const review = await prisma.review.update({ where: { id }, data: { approved } });
    await recordAuditLog({
      action: "REVIEW_MODERATE",
      actor: admin,
      entity: "Review",
      entityId: review.id,
      oldData: toAuditJson(previousReview),
      newData: toAuditJson(review),
      request,
    });
    revalidateTag(PUBLIC_REVIEWS_TAG, "max");
    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Admin review PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Không cập nhật được trạng thái đánh giá lúc này." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/reviews — Delete a review
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();

    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 64) {
      return NextResponse.json(
        { success: false, message: "Mã đánh giá chưa đúng định dạng." },
        { status: 400 }
      );
    }

    const previousReview = await prisma.review.findUnique({ where: { id } });
    if (!previousReview || previousReview.deletedAt) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy đánh giá cần xoá." },
        { status: 404 }
      );
    }

    const deletedReview = await prisma.review.delete({ where: { id } });
    await recordAuditLog({
      action: "REVIEW_DELETE",
      actor: admin,
      entity: "Review",
      entityId: deletedReview.id,
      oldData: toAuditJson(deletedReview),
      request,
    });
    revalidateTag(PUBLIC_REVIEWS_TAG, "max");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin review DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được đánh giá lúc này." },
      { status: 500 }
    );
  }
}
