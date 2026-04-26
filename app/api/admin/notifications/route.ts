import { NextResponse } from "next/server";
import { getAdminNotificationCounts } from "@/lib/notifications";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET /api/admin/notifications — Counts of pending items
export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const counts = await getAdminNotificationCounts();

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error) {
    console.error("Notifications count error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
