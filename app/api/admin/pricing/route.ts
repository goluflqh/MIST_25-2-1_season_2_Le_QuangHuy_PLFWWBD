import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getPublicActivePricingItems, PUBLIC_PRICING_TAG } from "@/lib/public-data";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

// GET — List all pricing items (public)
export async function GET() {
  try {
    const items = await getPublicActivePricingItems();
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error("Pricing GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được bảng giá lúc này." },
      { status: 500 }
    );
  }
}

// POST — Admin creates pricing item
export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const body = await request.json();
    const item = await prisma.pricingItem.create({ data: body });
    await recordAuditLog({
      action: "PRICING_CREATE",
      actor: admin,
      entity: "PricingItem",
      entityId: item.id,
      newData: toAuditJson(item),
      request,
    });
    revalidateTag(PUBLIC_PRICING_TAG, "max");
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Pricing POST error:", error);
    return NextResponse.json(
      { success: false, message: "Không tạo được mục giá lúc này." },
      { status: 500 }
    );
  }
}

// PATCH — Admin updates pricing item
export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id, ...data } = await request.json();
    const previousItem = await prisma.pricingItem.findUnique({ where: { id } });
    const item = await prisma.pricingItem.update({ where: { id }, data });
    await recordAuditLog({
      action: "PRICING_UPDATE",
      actor: admin,
      entity: "PricingItem",
      entityId: item.id,
      newData: toAuditJson(item),
      oldData: toAuditJson(previousItem),
      request,
    });
    revalidateTag(PUBLIC_PRICING_TAG, "max");
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("Pricing PATCH error:", error);
    return NextResponse.json(
      { success: false, message: "Không cập nhật được mục giá lúc này." },
      { status: 500 }
    );
  }
}

// DELETE — Admin deletes pricing item
export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();
    const { id } = await request.json();
    const deletedItem = await prisma.pricingItem.delete({ where: { id } });
    await recordAuditLog({
      action: "PRICING_DELETE",
      actor: admin,
      entity: "PricingItem",
      entityId: deletedItem.id,
      oldData: toAuditJson(deletedItem),
      request,
    });
    revalidateTag(PUBLIC_PRICING_TAG, "max");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Pricing DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được mục giá lúc này." },
      { status: 500 }
    );
  }
}
