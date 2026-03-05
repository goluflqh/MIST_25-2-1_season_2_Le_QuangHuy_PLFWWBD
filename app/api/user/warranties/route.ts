import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/user/warranties — Get logged-in user's warranties
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

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
