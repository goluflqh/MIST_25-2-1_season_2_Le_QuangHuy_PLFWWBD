import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

function normalizeCouponCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// GET — Admin list all coupons
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { redemptions: true } },
        redemptions: {
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            id: true,
            createdAt: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Coupons GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}

// POST — Admin creates coupon
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const body = await request.json();
    const code = normalizeCouponCode(body.code);
    const description = String(body.description || "").trim();
    const discount = String(body.discount || "").trim();
    const pointsCost = parsePositiveInteger(body.pointsCost, 0);
    const usageLimit = parsePositiveInteger(body.usageLimit, 1);
    const expiresAt = body.expiresAt
      ? parseAdminDateInput(body.expiresAt, { endOfDay: true })
      : null;

    if (!/^[A-Z0-9-]{3,40}$/.test(code)) {
      return NextResponse.json(
        {
          success: false,
          message: "Mã giảm giá chỉ dùng chữ không dấu, số hoặc dấu gạch ngang, ví dụ MINHHONG50.",
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập mô tả để admin và khách hiểu mã này dùng cho ưu đãi nào." },
        { status: 400 }
      );
    }

    if (!discount) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập giá trị giảm, ví dụ 10% hoặc 50000." },
        { status: 400 }
      );
    }

    if (pointsCost < 0) {
      return NextResponse.json(
        { success: false, message: "Điểm cần đổi không được nhỏ hơn 0." },
        { status: 400 }
      );
    }

    if (usageLimit < 1) {
      return NextResponse.json(
        { success: false, message: "Số lượt dùng tối đa phải từ 1 trở lên." },
        { status: 400 }
      );
    }

    if (body.expiresAt && !expiresAt) {
      return NextResponse.json(
        { success: false, message: "Ngày hết hạn chưa đúng. Nhập theo dạng ngày/tháng/năm, ví dụ 30/04/2026." },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discount,
        pointsCost,
        usageLimit,
        expiresAt,
      },
    });
    await recordAuditLog({
      action: "COUPON_CREATE",
      actor: admin,
      entity: "Coupon",
      entityId: coupon.id,
      newData: toAuditJson(coupon),
      request,
    });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Coupons POST error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã này đã tồn tại. Vui lòng đổi sang mã khác." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Không tạo được mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}

// DELETE — Admin deletes coupon
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    const deletedCoupon = await prisma.coupon.delete({ where: { id } });
    await recordAuditLog({
      action: "COUPON_DELETE",
      actor: admin,
      entity: "Coupon",
      entityId: deletedCoupon.id,
      oldData: toAuditJson(deletedCoupon),
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Coupons DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được mã giảm giá lúc này." },
      { status: 500 }
    );
  }
}
