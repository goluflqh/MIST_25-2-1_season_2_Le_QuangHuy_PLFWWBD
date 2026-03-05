import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/admin/notifications — Counts of pending items
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ success: false }, { status: 403 });

    const [pendingContacts, pendingReviews] = await Promise.all([
      prisma.contactRequest.count({ where: { status: "PENDING" } }),
      prisma.review.count({ where: { approved: false } }),
    ]);

    return NextResponse.json({
      success: true,
      counts: { contacts: pendingContacts, reviews: pendingReviews },
    });
  } catch (error) {
    console.error("Notifications count error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
