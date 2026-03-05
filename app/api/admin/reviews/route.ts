import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/admin/reviews — Admin: get all reviews (approved + pending)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ success: false }, { status: 403 });

    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, phone: true } } },
    });
    return NextResponse.json({ success: true, reviews });
  } catch (error) {
    console.error("Admin reviews GET error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH /api/admin/reviews — Approve/reject a review
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ success: false }, { status: 403 });

    const { id, approved } = await request.json();
    const review = await prisma.review.update({ where: { id }, data: { approved } });
    return NextResponse.json({ success: true, review });
  } catch (error) {
    console.error("Admin review PATCH error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE /api/admin/reviews — Delete a review
export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ success: false }, { status: 403 });

    const { id } = await request.json();
    await prisma.review.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin review DELETE error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
