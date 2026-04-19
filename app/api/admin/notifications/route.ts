import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET /api/admin/notifications — Counts of pending items
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

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
