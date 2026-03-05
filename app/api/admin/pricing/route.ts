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

// GET — List all pricing items (public)
export async function GET() {
  try {
    const items = await prisma.pricingItem.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Pricing GET error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// POST — Admin creates pricing item
export async function POST(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const body = await request.json();
    const item = await prisma.pricingItem.create({ data: body });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Pricing POST error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// PATCH — Admin updates pricing item
export async function PATCH(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const { id, ...data } = await request.json();
    const item = await prisma.pricingItem.update({ where: { id }, data });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Pricing PATCH error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// DELETE — Admin deletes pricing item
export async function DELETE(request: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) return NextResponse.json({ success: false }, { status: 403 });
    const { id } = await request.json();
    await prisma.pricingItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pricing DELETE error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
