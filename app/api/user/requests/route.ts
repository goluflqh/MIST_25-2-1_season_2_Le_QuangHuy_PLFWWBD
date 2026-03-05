import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/user/requests — Get logged-in user's contact requests
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    // Find requests by phone number
    const requests = await prisma.contactRequest.findMany({
      where: { phone: session.user.phone },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    console.error("User requests error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
