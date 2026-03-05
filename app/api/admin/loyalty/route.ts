import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// PATCH /api/admin/loyalty — Admin adds/deducts points for a user
export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session || session.user.role !== "ADMIN") return NextResponse.json({ success: false }, { status: 403 });

    const { userId, points, reason, setExact } = await request.json();
    if (!userId || typeof points !== "number") {
      return NextResponse.json({ success: false, message: "userId và points bắt buộc." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { loyaltyPoints: setExact ? points : { increment: points } },
      select: { id: true, name: true, loyaltyPoints: true },
    });

    console.log(`[Loyalty] Admin ${session.user.name} awarded ${points} points to ${user.name}: ${reason || "N/A"}`);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Loyalty update error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
