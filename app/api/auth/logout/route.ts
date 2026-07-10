import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  let sessionRevoked = true;

  try {
    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }
  } catch (error) {
    sessionRevoked = false;
    console.error("Logout session revocation failed:", error);
  } finally {
    cookieStore.delete("session_token");
  }

  return NextResponse.json({
    success: true,
    sessionRevoked,
    message: sessionRevoked ? "Đã đăng xuất." : "Đã đăng xuất khỏi trình duyệt này.",
  });
}
