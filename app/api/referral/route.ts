import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, unauthorizedResponse } from "@/lib/session";

// POST /api/referral — Apply referral code during registration bonus
export async function POST() {
  try {
    const session = await getCurrentSession();
    if (!session) return unauthorizedResponse();

    // Generate referral code if user doesn't have one
    if (!session.user.referralCode) {
      const code = `MH${session.user.phone.slice(-4)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      await prisma.user.update({ where: { id: session.user.id }, data: { referralCode: code } });
      return NextResponse.json({ success: true, code, message: "Mã giới thiệu đã được tạo!" });
    }

    return NextResponse.json({ success: true, code: session.user.referralCode });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json(
      { success: false, message: "Chưa tạo được mã giới thiệu lúc này." },
      { status: 500 }
    );
  }
}

// GET /api/referral?code=XXX — Apply referral code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) {
      return NextResponse.json(
        { success: false, message: "Thiếu mã giới thiệu." },
        { status: 400 }
      );
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) return NextResponse.json({ success: false, message: "Mã giới thiệu không hợp lệ." }, { status: 404 });

    return NextResponse.json({ success: true, referrerName: referrer.name });
  } catch (error) {
    console.error("Referral lookup error:", error);
    return NextResponse.json(
      { success: false, message: "Chưa kiểm tra được mã giới thiệu lúc này." },
      { status: 500 }
    );
  }
}
