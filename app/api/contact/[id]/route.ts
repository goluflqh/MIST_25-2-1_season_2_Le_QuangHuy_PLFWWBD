import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { mapContactStatusToOrderStatus } from "@/lib/service-orders";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

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
      include: { serviceOrder: { select: { id: true, status: true } } },
    });
    const updated = await prisma.contactRequest.update({
      where: { id },
      data: updateData,
    });

    if (status && previousContact?.serviceOrder) {
      await prisma.serviceOrder.update({
        where: { id: previousContact.serviceOrder.id },
        data: { status: mapContactStatusToOrderStatus(status) },
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
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}

// DELETE /api/contact/[id] — Admin deletes a contact request
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const { id } = await params;
    const deletedContact = await prisma.contactRequest.delete({ where: { id } });
    await recordAuditLog({
      action: "CONTACT_DELETE",
      actor: admin,
      entity: "ContactRequest",
      entityId: deletedContact.id,
      oldData: toAuditJson(deletedContact),
      request,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact delete error:", error);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}
