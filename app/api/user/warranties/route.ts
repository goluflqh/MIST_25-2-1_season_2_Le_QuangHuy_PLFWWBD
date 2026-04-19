import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// GET /api/user/warranties — Get logged-in user's warranties
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    const warranties = await prisma.warranty.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, warranties });
  } catch (error) {
    console.error("User warranties error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
