import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

// POST /api/referral — Apply referral code during registration bonus
export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
    if (!session) return NextResponse.json({ success: false }, { status: 401 });

    // Generate referral code if user doesn't have one
    if (!session.user.referralCode) {
      const code = `MH${session.user.phone.slice(-4)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
      await prisma.user.update({ where: { id: session.user.id }, data: { referralCode: code } });
      return NextResponse.json({ success: true, code, message: "Mã giới thiệu đã được tạo!" });
    }

    return NextResponse.json({ success: true, code: session.user.referralCode });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// GET /api/referral?code=XXX — Apply referral code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    if (!code) return NextResponse.json({ success: false }, { status: 400 });

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) return NextResponse.json({ success: false, message: "Mã giới thiệu không hợp lệ." }, { status: 404 });

    return NextResponse.json({ success: true, referrerName: referrer.name });
  } catch (error) {
    console.error("Referral lookup error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
