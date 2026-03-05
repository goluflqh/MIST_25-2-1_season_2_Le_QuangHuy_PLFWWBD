import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// PATCH /api/contact/[id] — Admin updates contact status + notes
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Không có quyền." }, { status: 403 });
    }

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

    const updated = await prisma.contactRequest.update({
      where: { id },
      data: updateData,
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
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Không có quyền." }, { status: 403 });
    }

    const { id } = await params;
    await prisma.contactRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact delete error:", error);
    return NextResponse.json({ success: false, message: "Lỗi hệ thống." }, { status: 500 });
  }
}
