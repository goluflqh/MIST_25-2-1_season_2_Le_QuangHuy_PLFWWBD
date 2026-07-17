import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import {
  DEFAULT_WARRANTY_MONTHS,
  createManualWarranty,
  createWarrantyForServiceOrder,
  getDefaultWarrantyEndDate,
  normalizeWarrantyUpdatePayload,
  serializeWarranty,
  WarrantyValidationError,
} from "@/lib/warranties";

// GET — Admin list all warranties
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const warranties = await prisma.warranty.findMany({
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
    if (body.serviceOrderId && body.startDate !== undefined) {
      throw new WarrantyValidationError("Ngày bắt đầu của phiếu liên kết phải theo ngày đơn. Hãy sửa ngày trên đơn dịch vụ.");
    }
    const warrantyResult = body.serviceOrderId
      ? await prisma.$transaction(async (tx) => {
          const serviceOrderId = String(body.serviceOrderId);
          const existing = await tx.warranty.findUnique({ where: { serviceOrderId } });
          if (existing?.deletedAt) {
            throw new WarrantyValidationError("Đơn này có phiếu đã lưu trữ. Hãy khôi phục phiếu thay vì tạo lại.", 409);
          }
          return createWarrantyForServiceOrder(tx, serviceOrderId, body);
        })
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

    const restore = body.restore === true;
    const { previousWarranty, warranty } = await prisma.$transaction(async (tx) => {
      const previous = await tx.warranty.findUnique({
        where: { id },
        include: {
          serviceOrder: {
            select: { deletedAt: true, id: true, orderDate: true, status: true, warrantyMonths: true },
          },
        },
      });
      if (!previous) {
        throw new WarrantyValidationError("Không tìm thấy phiếu bảo hành.", 404);
      }

      if (restore) {
        if (!previous.deletedAt) {
          throw new WarrantyValidationError("Phiếu bảo hành này đang được sử dụng, không cần khôi phục.", 409);
        }

        if (!previous.serviceOrderId) {
          const restored = await tx.warranty.update({
            where: { id },
            data: { deletedAt: null },
          });
          return { previousWarranty: previous, warranty: restored };
        }

        if (!previous.serviceOrder || previous.serviceOrder.deletedAt) {
          throw new WarrantyValidationError("Không thể khôi phục phiếu vì đơn liên kết đã bị xóa.", 409);
        }
        if (previous.serviceOrder.status !== "COMPLETED") {
          throw new WarrantyValidationError("Chỉ có thể khôi phục phiếu khi đơn liên kết đã hoàn thành.", 409);
        }
        const warrantyMonths = previous.serviceOrder.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS;
        const startDate = previous.serviceOrder.orderDate;
        const endDate = getDefaultWarrantyEndDate(startDate, warrantyMonths);
        const restored = await tx.warranty.update({
          where: { id },
          data: { deletedAt: null, endDate, startDate },
        });
        const missingDate = restored.endDate.getUTCFullYear() <= 1900;
        await tx.serviceOrder.update({
          where: { id: previous.serviceOrderId },
          data: {
            warrantyEndDate: missingDate ? null : restored.endDate,
            warrantyMonths,
          },
        });
        return { previousWarranty: previous, warranty: restored };
      }

      if (previous.deletedAt) {
        throw new WarrantyValidationError("Phiếu này đang ở mục Đã lưu trữ. Hãy khôi phục trước khi sửa.", 409);
      }

      const updateData = normalizeWarrantyUpdatePayload(body);
      if (updateData.startDate instanceof Date && body.endDate === undefined) {
        updateData.endDate = getDefaultWarrantyEndDate(
          updateData.startDate,
          previous.serviceOrder?.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS
        );
      }
      const nextStartDate = updateData.startDate instanceof Date ? updateData.startDate : previous.startDate;
      const nextEndDate = updateData.endDate instanceof Date ? updateData.endDate : previous.endDate;
      if (nextEndDate.getTime() < nextStartDate.getTime()) {
        throw new WarrantyValidationError("Ngày hết hạn phải bằng hoặc sau ngày bắt đầu.");
      }
      if (
        typeof updateData.customerPhone === "string"
        && updateData.customerPhone !== previous.customerPhone
      ) {
        const customer = await tx.customer.findUnique({
          where: { phone: updateData.customerPhone },
          select: { userId: true },
        });
        updateData.user = customer?.userId
          ? { connect: { id: customer.userId } }
          : { disconnect: true };
      }

      const updated = await tx.warranty.update({
        where: { id },
        data: updateData,
      });

      if (previous.serviceOrderId && (updateData.startDate instanceof Date || updateData.endDate instanceof Date)) {
        await tx.serviceOrder.update({
          where: { id: previous.serviceOrderId },
          data: {
            ...(updateData.startDate instanceof Date ? { orderDate: updated.startDate } : {}),
            warrantyEndDate: updated.endDate.getUTCFullYear() <= 1900 ? null : updated.endDate,
          },
        });
      }

      return { previousWarranty: previous, warranty: updated };
    });
    await recordAuditLog({
      action: restore ? "WARRANTY_RESTORE" : "WARRANTY_UPDATE",
      actor: admin,
      entity: "Warranty",
      entityId: warranty.id,
      oldData: toAuditJson(previousWarranty),
      newData: toAuditJson(warranty),
      request,
    });

    return NextResponse.json({
      success: true,
      warranty: {
        ...serializeWarranty(warranty),
        deletedAt: warranty.deletedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error("Warranty PATCH error:", error);
    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json({ success: false, message: "Không sửa được phiếu bảo hành lúc này." }, { status: 500 });
  }
}

// DELETE — Admin archives warranty
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    const previousWarranty = await prisma.warranty.findUnique({ where: { id } });
    if (!previousWarranty || previousWarranty.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy phiếu bảo hành." }, { status: 404 });
    }

    const deletedWarranty = await prisma.$transaction(async (tx) => {
      const warranty = await tx.warranty.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      if (previousWarranty.serviceOrderId) {
        await tx.serviceOrder.update({
          where: { id: previousWarranty.serviceOrderId },
          data: {
            warrantyEndDate: null,
          },
        });
      }

      return warranty;
    });
    await recordAuditLog({
      action: "WARRANTY_DELETE",
      actor: admin,
      entity: "Warranty",
      entityId: deletedWarranty.id,
      oldData: toAuditJson(previousWarranty),
      newData: toAuditJson(deletedWarranty),
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
