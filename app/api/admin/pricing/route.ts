import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { getPublicActivePricingItems, PUBLIC_PRICING_TAG } from "@/lib/public-data";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

function parseInteger(value: unknown, fallback: number) {
  if (value === undefined || value === null || value === "") return fallback;

  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^-?\d+$/.test(value.trim())
      ? Number(value.trim())
      : Number.NaN;

  if (!Number.isSafeInteger(parsed) || Math.abs(parsed) > 10_000) {
    throw new PricingValidationError("Thứ tự hiển thị phải là số nguyên từ -10.000 đến 10.000.");
  }

  return parsed;
}

function parseText(value: unknown, fallback: string, maxLength: number, fieldName: string) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") {
    throw new PricingValidationError(`${fieldName} chưa đúng định dạng.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new PricingValidationError(`${fieldName} không được dài quá ${maxLength} ký tự.`);
  }

  return normalized;
}

class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

function normalizePricingData(body: Record<string, unknown>) {
  if (body.active !== undefined && typeof body.active !== "boolean") {
    throw new PricingValidationError("Trạng thái hiển thị phải là true hoặc false.");
  }

  const active = typeof body.active === "boolean" ? body.active : undefined;
  const category = parseText(body.category, "PIN", 40, "Nhóm dịch vụ");
  const name = parseText(body.name, "", 120, "Tên dịch vụ");
  const price = parseText(body.price, "", 80, "Giá hiển thị");

  if (!category || !name || !price) {
    throw new PricingValidationError("Nhóm, tên dịch vụ và giá hiển thị là bắt buộc.");
  }

  return {
    category,
    name,
    price,
    unit: parseText(body.unit, "VNĐ", 20, "Đơn vị") || "VNĐ",
    description: parseText(body.description, "", 1_000, "Mô tả") || null,
    note: parseText(body.note, "", 500, "Ghi chú") || null,
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
    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();
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
    if (error instanceof PricingValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

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
    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();
    const { id: rawId, ...data } = body;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!id || id.length > 64) {
      return NextResponse.json({ success: false, message: "Mã mục giá chưa đúng định dạng." }, { status: 400 });
    }
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
    if (error instanceof PricingValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

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
    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || id.length > 64) {
      return NextResponse.json({ success: false, message: "Mã mục giá chưa đúng định dạng." }, { status: 400 });
    }
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
