import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

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
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
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
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
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
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    await prisma.pricingItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pricing DELETE error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
