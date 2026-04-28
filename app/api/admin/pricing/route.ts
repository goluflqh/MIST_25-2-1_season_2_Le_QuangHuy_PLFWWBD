import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getPublicActivePricingItems, PUBLIC_PRICING_TAG } from "@/lib/public-data";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

function parseInteger(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePricingData(body: Record<string, unknown>) {
  const active = typeof body.active === "boolean" ? body.active : undefined;

  return {
    category: String(body.category || "PIN"),
    name: String(body.name || "").trim(),
    price: String(body.price || "").trim(),
    unit: String(body.unit || "VNĐ").trim(),
    description: typeof body.description === "string" && body.description.trim()
      ? body.description.trim()
      : null,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
    sortOrder: parseInteger(body.sortOrder, 0),
    ...(active === undefined ? {} : { active }),
  };
}

function normalizePricingName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

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
    const pricingData = normalizePricingData(body);
    const existingItems = await prisma.pricingItem.findMany({
      where: { category: pricingData.category },
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
    });
    const existingItem = existingItems.find((item) => (
      normalizePricingName(item.name) === normalizePricingName(pricingData.name)
    ));

    if (existingItem) {
      return NextResponse.json({
        success: true,
        item: existingItem,
        existed: true,
        message: "Mục giá này đã có sẵn trong dashboard.",
      });
    }

    const item = await prisma.pricingItem.create({ data: pricingData });
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
    const pricingData = normalizePricingData(data);
    const previousItem = await prisma.pricingItem.findUnique({ where: { id } });

    if (!previousItem) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy mục giá cần cập nhật." },
        { status: 404 }
      );
    }

    const sameCategoryItems = await prisma.pricingItem.findMany({
      where: { category: pricingData.category, NOT: { id } },
      select: { id: true, name: true },
    });
    const duplicateItem = sameCategoryItems.find((item) => (
      normalizePricingName(item.name) === normalizePricingName(pricingData.name)
    ));

    if (duplicateItem) {
      return NextResponse.json(
        { success: false, message: "Nhóm này đã có mục giá cùng tên. Vui lòng sửa mục hiện có hoặc đổi tên." },
        { status: 409 }
      );
    }

    const item = await prisma.pricingItem.update({ where: { id }, data: pricingData });
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
