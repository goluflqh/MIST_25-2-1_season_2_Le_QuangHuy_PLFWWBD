import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { mapContactStatusToOrderStatus } from "@/lib/service-orders";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import { archiveWarrantyForServiceOrder, createWarrantyForServiceOrder, DEFAULT_WARRANTY_MONTHS } from "@/lib/warranties";

// PATCH /api/contact/[id] — Admin updates contact status + notes
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const { id } = await params;
    const body = await request.json();
    const { status, notes } = body;

    const updateData: Record<string, string> = {};
    if (status) {
      const validStatuses = ["PENDING", "CONTACTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
      }
      updateData.status = status;
    }
    if (notes !== undefined) updateData.notes = notes;

    const previousContact = await prisma.contactRequest.findUnique({
      where: { id },
      include: { serviceOrder: { select: { deletedAt: true, id: true, status: true, warrantyMonths: true } } },
    });
    if (!previousContact || previousContact.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu tư vấn." }, { status: 404 });
    }

    if (
      status
      && status !== "PENDING"
      && (!previousContact.serviceOrder || previousContact.serviceOrder.deletedAt)
    ) {
      return NextResponse.json(
        {
          success: false,
          code: "SERVICE_ORDER_REQUIRED",
          message: "Can tao don dich vu truoc khi chuyen yeu cau sang trang thai xu ly, hoan thanh hoac huy.",
        },
        { status: 409 }
      );
    }

    const updated = await prisma.contactRequest.update({
      where: { id },
      data: updateData,
    });

    if (status && previousContact.serviceOrder && !previousContact.serviceOrder.deletedAt) {
      const nextOrderStatus = mapContactStatusToOrderStatus(status);
      await prisma.serviceOrder.update({
        where: { id: previousContact.serviceOrder.id },
        data: {
          status: nextOrderStatus,
          ...(nextOrderStatus === "COMPLETED" ? {} : { warrantyEndDate: null }),
        },
      });
      if (nextOrderStatus === "COMPLETED") {
        await createWarrantyForServiceOrder(prisma, previousContact.serviceOrder.id, {
          warrantyMonths: previousContact.serviceOrder.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
        });
      } else {
        await archiveWarrantyForServiceOrder(prisma, previousContact.serviceOrder.id);
      }
    }
    await recordAuditLog({
      action: "CONTACT_UPDATE",
      actor: admin,
      entity: "ContactRequest",
      entityId: updated.id,
      oldData: toAuditJson(previousContact),
      newData: toAuditJson(updated),
      request,
    });

    return NextResponse.json({ success: true, contact: updated });
  } catch (error) {
    console.error("Contact update error:", error);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}

// DELETE /api/contact/[id] — Admin deletes a contact request
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const { id } = await params;
    const previousContact = await prisma.contactRequest.findUnique({
      where: { id },
      include: { serviceOrder: { select: { deletedAt: true, id: true } } },
    });
    if (!previousContact || previousContact.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy yêu cầu tư vấn." }, { status: 404 });
    }

    const deletedContact = await prisma.$transaction(async (tx) => {
      const contact = await tx.contactRequest.update({
        where: { id },
        data: { couponRedemptionId: null, deletedAt: new Date() },
      });

      if (previousContact.serviceOrder && !previousContact.serviceOrder.deletedAt) {
        await tx.serviceOrder.update({
          where: { id: previousContact.serviceOrder.id },
          data: { couponRedemptionId: null, deletedAt: new Date(), warrantyEndDate: null },
        });
        await archiveWarrantyForServiceOrder(tx, previousContact.serviceOrder.id);
      }

      return contact;
    });
    await recordAuditLog({
      action: "CONTACT_DELETE",
      actor: admin,
      entity: "ContactRequest",
      entityId: deletedContact.id,
      oldData: toAuditJson(previousContact),
      newData: toAuditJson(deletedContact),
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact delete error:", error);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}
