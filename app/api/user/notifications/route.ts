import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// GET /api/user/notifications?lastSeen=ISO_DATE — Count of new notifications since lastSeen
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

    const userId = session.user.id;
    const role = session.user.role;

    const url = new URL(request.url);
    const lastSeen = url.searchParams.get("lastSeen");
    const lastSeenDate = lastSeen ? new Date(lastSeen) : new Date(0); // epoch = show all

    if (role === "ADMIN") {
      // Admin: count pending contacts + pending reviews (created after lastSeen)
      const [pendingContacts, pendingReviews] = await Promise.all([
        prisma.contactRequest.count({ where: { status: "PENDING", createdAt: { gt: lastSeenDate } } }),
        prisma.review.count({ where: { approved: false, createdAt: { gt: lastSeenDate } } }),
      ]);
      return NextResponse.json({ success: true, total: pendingContacts + pendingReviews, role });
    } else {
      // User: count own requests with status changes (not PENDING = admin acted on them)
      // Only count requests that were created before lastSeen but status changed,
      // OR any request with non-PENDING status created after registration
      const updatedRequests = await prisma.contactRequest.count({
        where: {
          userId,
          status: { not: "PENDING" },
          createdAt: { gt: lastSeenDate },
        },
      });
      return NextResponse.json({ success: true, total: updatedRequests, role });
    }
  } catch (error) {
    console.error("User notifications error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
