import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import { createManualWarranty, createWarrantyForServiceOrder, normalizeWarrantyUpdatePayload, serializeWarranty, WarrantyValidationError } from "@/lib/warranties";

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

// POST — Admin creates warranty manually, or from a confirmed service order.
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await request.json();
    const warrantyResult = body.serviceOrderId
      ? await createWarrantyForServiceOrder(prisma, String(body.serviceOrderId), body)
      : { created: true, warranty: await createManualWarranty(prisma, body) };
    const warranty = warrantyResult.warranty;
    await recordAuditLog({
      action: body.serviceOrderId ? "WARRANTY_CREATE_FROM_SERVICE_ORDER" : "WARRANTY_CREATE",
      actor: admin,
      entity: "Warranty",
      entityId: warranty.id,
      newData: toAuditJson(warranty),
      request,
    });

    return NextResponse.json({
      success: true,
      created: warrantyResult.created,
      warranty: serializeWarranty(warranty),
    });
  } catch (error) {
    console.error("Warranty POST error:", error);
    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã bảo hành này đã tồn tại. Hãy để trống mã để hệ thống tự tạo mã mới." },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: false, message: "Không tạo được phiếu bảo hành lúc này." }, { status: 500 });
  }
}

// PATCH — Admin edits warranty details after an auto/manual creation.
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await request.json();
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ success: false, message: "Thiếu mã phiếu bảo hành cần sửa." }, { status: 400 });
    }

    const previousWarranty = await prisma.warranty.findUnique({ where: { id } });
    if (!previousWarranty || previousWarranty.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy phiếu bảo hành." }, { status: 404 });
    }

    const updateData = normalizeWarrantyUpdatePayload(body);
    const warranty = await prisma.warranty.update({
      where: { id },
      data: updateData,
    });
    await recordAuditLog({
      action: "WARRANTY_UPDATE",
      actor: admin,
      entity: "Warranty",
      entityId: warranty.id,
      oldData: toAuditJson(previousWarranty),
      newData: toAuditJson(warranty),
      request,
    });

    return NextResponse.json({ success: true, warranty: serializeWarranty(warranty) });
  } catch (error) {
    console.error("Warranty PATCH error:", error);
    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json({ success: false, message: "Không sửa được phiếu bảo hành lúc này." }, { status: 500 });
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
