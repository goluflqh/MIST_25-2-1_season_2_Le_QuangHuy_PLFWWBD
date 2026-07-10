import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// GET /api/user/requests — Get logged-in user's contact requests
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    const requests = await prisma.contactRequest.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("User requests error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
