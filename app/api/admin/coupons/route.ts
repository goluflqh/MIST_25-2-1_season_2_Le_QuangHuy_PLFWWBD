import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!session || session.user.role !== "ADMIN") return null;
  return session.user;
}

// GET — Admin list all coupons
export async function GET() {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, coupons });
  } catch (error) {
    console.error("Coupons GET error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — Admin creates coupon
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const body = await request.json();
    const coupon = await prisma.coupon.create({ data: body });
    return NextResponse.json({ success: true, coupon });
  } catch (error) {
    console.error("Coupons POST error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE — Admin deletes coupon
export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const { id } = await request.json();
    await prisma.coupon.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Coupons DELETE error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
