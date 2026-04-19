import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cleanup expired sessions.
 * Can be called by Vercel Cron or manually by admin.
 * Protected by a secret key in the Authorization header.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expectedSecret = `Bearer ${process.env.AUTH_SECRET}`;

  if (!authHeader || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} expired sessions.`,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("Cleanup Error:", error);
    return NextResponse.json(
      { success: false, message: "Cleanup failed." },
      { status: 500 }
    );
  }
}
