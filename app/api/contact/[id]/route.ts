import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { reconcileOrderWarrantyLifecycle } from "@/lib/order-warranty-lifecycle";
import { mapContactStatusToOrderStatus } from "@/lib/service-orders";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import {
  WarrantyValidationError,
} from "@/lib/warranties";

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
      include: {
        serviceOrder: {
          select: {
            deletedAt: true,
            id: true,
            status: true,
          },
        },
      },
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

    const transactionResult = await prisma.$transaction(async (tx) => {
      const transactionalContact = await tx.contactRequest.update({
        where: { id },
        data: updateData,
      });

      if (status && previousContact.serviceOrder && !previousContact.serviceOrder.deletedAt) {
        const nextOrderStatus = mapContactStatusToOrderStatus(status);
        await tx.serviceOrder.update({
          where: { id: previousContact.serviceOrder.id },
          data: { status: nextOrderStatus },
        });
        const warrantyAudit = await reconcileOrderWarrantyLifecycle(tx, previousContact.serviceOrder.id);
        return { contact: transactionalContact, warrantyAudit };
      }

      return { contact: transactionalContact, warrantyAudit: null };
    });
    const updated = transactionResult.contact;
    if (transactionResult.warrantyAudit) {
      await recordAuditLog({
        action: transactionResult.warrantyAudit.action,
        actor: admin,
        entity: "Warranty",
        entityId: transactionResult.warrantyAudit.entityId,
        oldData: transactionResult.warrantyAudit.oldData,
        newData: transactionResult.warrantyAudit.newData,
        request,
      });
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
    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
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

    const transactionResult = await prisma.$transaction(async (tx) => {
      const contact = await tx.contactRequest.update({
        where: { id },
        data: { couponRedemptionId: null, deletedAt: new Date() },
      });

      if (previousContact.serviceOrder && !previousContact.serviceOrder.deletedAt) {
        await tx.serviceOrder.update({
          where: { id: previousContact.serviceOrder.id },
          data: { couponRedemptionId: null, deletedAt: new Date(), warrantyEndDate: null, warrantyMonths: null },
        });
        const warrantyAudit = await reconcileOrderWarrantyLifecycle(tx, previousContact.serviceOrder.id);
        return { contact, warrantyAudit };
      }

      return { contact, warrantyAudit: null };
    });
    const deletedContact = transactionResult.contact;
    if (transactionResult.warrantyAudit) {
      await recordAuditLog({
        action: transactionResult.warrantyAudit.action,
        actor: admin,
        entity: "Warranty",
        entityId: transactionResult.warrantyAudit.entityId,
        oldData: transactionResult.warrantyAudit.oldData,
        newData: transactionResult.warrantyAudit.newData,
        request,
      });
    }
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
