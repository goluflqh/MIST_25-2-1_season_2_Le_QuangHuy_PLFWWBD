import { NextResponse } from "next/server";
import {
  buildPublicUser,
  getCurrentSession,
  getCurrentSessionToken,
  unauthorizedResponse,
} from "@/lib/session";

export async function GET() {
  try {
    const token = await getCurrentSessionToken();
    if (!token) {
      return unauthorizedResponse("Chưa đăng nhập.");
    }

    const session = await getCurrentSession();
    if (!session) {
      return unauthorizedResponse("Phiên đăng nhập hết hạn.");
    }

    return NextResponse.json({
      success: true,
      user: buildPublicUser(session.user),
    });
  } catch (error) {
    console.error("Auth/me Error:", error);
    return NextResponse.json(
      { success: false, message: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}
