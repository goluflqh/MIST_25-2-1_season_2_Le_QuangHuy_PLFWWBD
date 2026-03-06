import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/user/notifications?lastSeen=ISO — new notifications since lastSeen
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

    const user = session.user;
    const url = new URL(request.url);
    const lastSeen = url.searchParams.get("lastSeen");
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0);

    if (user.role === "ADMIN") {
      const [pendingContacts, pendingReviews] = await Promise.all([
        prisma.contactRequest.count({ where: { status: "PENDING", createdAt: { gt: lastSeenDate } } }),
        prisma.review.count({ where: { approved: false, createdAt: { gt: lastSeenDate } } }),
      ]);
      return NextResponse.json({ success: true, total: pendingContacts + pendingReviews, role: user.role });
    } else {
      // User: count requests where admin changed status
      // Match by userId OR phone number (backwards compat for old records with NULL userId)
      const updatedRequests = await prisma.contactRequest.count({
        where: {
          OR: [
            { userId: user.id },
            { phone: user.phone },
          ],
          status: { not: "PENDING" },
          updatedAt: { gt: lastSeenDate },
        },
      });
      return NextResponse.json({ success: true, total: updatedRequests, role: user.role });
    }
  } catch (error) {
    console.error("User notifications error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
