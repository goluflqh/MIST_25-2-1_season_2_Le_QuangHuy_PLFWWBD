import { NextResponse } from "next/server";
import { getNotificationCountForUser } from "@/lib/notifications";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// GET /api/user/notifications?lastSeen=ISO — new notifications since lastSeen
export async function GET(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    const user = session.user;
    const url = new URL(request.url);
    const total = await getNotificationCountForUser(user, {
      lastSeen: url.searchParams.get("lastSeen"),
    });

    return NextResponse.json({ success: true, total, role: user.role });
  } catch (error) {
    console.error("User notifications error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
