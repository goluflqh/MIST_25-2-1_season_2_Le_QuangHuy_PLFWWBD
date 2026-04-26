import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { parseAdminDateInput } from "@/lib/admin-date";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

function buildWarrantySerial() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

  return `MH-BH-${datePart}-${suffix}`;
}

async function getAvailableWarrantySerial(manualSerial: unknown) {
  const normalizedManualSerial = String(manualSerial || "").trim().toUpperCase();
  if (normalizedManualSerial) return normalizedManualSerial;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const serialNo = buildWarrantySerial();
    const existing = await prisma.warranty.findUnique({ where: { serialNo } });
    if (!existing) return serialNo;
  }

  throw new Error("Unable to generate unique warranty serial");
}

// GET — Admin list all warranties
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const warranties = await prisma.warranty.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, phone: true } } },
    });
    return NextResponse.json({ success: true, warranties });
  } catch (error) {
    console.error("Warranty GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách bảo hành lúc này." },
      { status: 500 }
    );
  }
}

// POST — Admin creates warranty (must verify customer phone exists)
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await request.json();
    const { service, notes } = body;
    const productName = String(body.productName || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const endDate = parseAdminDateInput(body.endDate, { endOfDay: true });
    const serialNo = await getAvailableWarrantySerial(body.serialNo);

    if (!productName) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập tên sản phẩm cần bảo hành." },
        { status: 400 }
      );
    }

    if (!customerPhone) {
      return NextResponse.json(
        { success: false, message: "Vui lòng nhập số điện thoại khách đã đăng ký tài khoản." },
        { status: 400 }
      );
    }

    if (!endDate) {
      return NextResponse.json(
        { success: false, message: "Ngày hết hạn bảo hành chưa đúng. Nhập theo dạng ngày/tháng/năm, ví dụ 30/04/2026." },
        { status: 400 }
      );
    }

    // Verify customer phone exists in User table
    const customer = await prisma.user.findFirst({
      where: { phone: customerPhone, deletedAt: null },
    });
    if (!customer) {
      return NextResponse.json({
        success: false,
        message: `SĐT ${customerPhone} chưa đăng ký tài khoản. Khách hàng cần tạo tài khoản trước khi tạo phiếu bảo hành.`,
      }, { status: 400 });
    }

    const warranty = await prisma.warranty.create({
      data: {
        serialNo,
        productName,
        customerName: customer.name,
        customerPhone,
        service: service || "KHAC",
        endDate,
        notes: String(notes || "").trim() || null,
        userId: customer.id,
      },
    });
    await recordAuditLog({
      action: "WARRANTY_CREATE",
      actor: admin,
      entity: "Warranty",
      entityId: warranty.id,
      newData: toAuditJson(warranty),
      request,
    });

    return NextResponse.json({ success: true, warranty });
  } catch (error) {
    console.error("Warranty POST error:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã bảo hành này đã tồn tại. Hãy để trống mã để hệ thống tự tạo mã mới." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: false, message: "Không tạo được phiếu bảo hành lúc này." }, { status: 500 });
  }
}

// DELETE — Admin deletes warranty
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    const deletedWarranty = await prisma.warranty.delete({ where: { id } });
    await recordAuditLog({
      action: "WARRANTY_DELETE",
      actor: admin,
      entity: "Warranty",
      entityId: deletedWarranty.id,
      oldData: toAuditJson(deletedWarranty),
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Warranty DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được phiếu bảo hành lúc này." },
      { status: 500 }
    );
  }
}
