import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createServiceOrder,
  mapOrderStatusToContactStatus,
  parseOptionalMoney,
  serializeServiceOrder,
  serviceOrderInclude,
  ServiceOrderValidationError,
  serviceOrderStatuses,
} from "@/lib/service-orders";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { calculateCouponDiscount, getPayableAmount } from "@/lib/coupon-discounts";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import { sanitizeText } from "@/lib/sanitize";
import { createWarrantyForServiceOrder, DEFAULT_WARRANTY_MONTHS, WarrantyValidationError } from "@/lib/warranties";

const warrantyAutoStatuses = new Set(["COMPLETED", "DELIVERED"]);

export async function GET() {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const orders = await prisma.serviceOrder.findMany({
      where: { deletedAt: null },
      include: serviceOrderInclude,
      orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
      take: 500,
    });

    return NextResponse.json({
      success: true,
      orders: orders.map(serializeServiceOrder),
    });
  } catch (error) {
    console.error("Service orders GET error:", error);
    return NextResponse.json(
      { success: false, message: "Không tải được danh sách đơn dịch vụ lúc này." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu đơn gửi lên chưa đúng định dạng.");

    let order = await createServiceOrder(body, "MANUAL");
    await recordAuditLog({
      action: "SERVICE_ORDER_CREATE",
      actor: admin,
      entity: "ServiceOrder",
      entityId: order.id,
      newData: toAuditJson(order),
      request,
    });

    if (warrantyAutoStatuses.has(order.status) && order.warrantyMonths !== 0) {
      const result = await createWarrantyForServiceOrder(prisma, order.id, {
        warrantyMonths: order.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
      });
      if (result.created) {
        await recordAuditLog({
          action: "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER",
          actor: admin,
          entity: "Warranty",
          entityId: result.warranty.id,
          newData: toAuditJson(result.warranty),
          request,
        });
      }
      const refreshedOrder = await prisma.serviceOrder.findUnique({
        where: { id: order.id },
        include: serviceOrderInclude,
      });
      if (refreshedOrder) order = refreshedOrder;
    }

    return NextResponse.json({ success: true, order: serializeServiceOrder(order) }, { status: 201 });
  } catch (error) {
    console.error("Service orders POST error:", error);

    if (error instanceof ServiceOrderValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { success: false, message: "Mã đơn đã tồn tại. Hãy để trống mã để hệ thống tự tạo." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Không tạo được đơn dịch vụ lúc này." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu cập nhật chưa đúng định dạng.");

    const id = sanitizeText(String(body.id || ""));
    if (!id) {
      return NextResponse.json({ success: false, message: "Thiếu mã đơn cần cập nhật." }, { status: 400 });
    }

    const updateData: Prisma.ServiceOrderUpdateInput = {};

    if (typeof body.status === "string") {
      const status = sanitizeText(body.status).toUpperCase();
      if (!serviceOrderStatuses.includes(status as (typeof serviceOrderStatuses)[number])) {
        return NextResponse.json({ success: false, message: "Trạng thái đơn không hợp lệ." }, { status: 400 });
      }
      updateData.status = status;
    }

    if (typeof body.notes === "string") {
      updateData.notes = sanitizeText(body.notes) || null;
    }

    if (typeof body.customerVisible === "boolean") {
      updateData.customerVisible = body.customerVisible;
    }

    const previousOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: serviceOrderInclude,
    });
    if (!previousOrder || previousOrder.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đơn dịch vụ." }, { status: 404 });
    }

    if ("quotedPrice" in body) {
      const quotedPrice = parseOptionalMoney(body.quotedPrice);
      updateData.quotedPrice = quotedPrice;
      updateData.discountAmount = calculateCouponDiscount(previousOrder.couponDiscount, quotedPrice);
    }

    if ("paidAmount" in body) {
      const paidAmount = parseOptionalMoney(body.paidAmount) || 0;
      const quotedPrice = typeof updateData.quotedPrice === "number"
        ? updateData.quotedPrice
        : previousOrder.quotedPrice;
      const discountAmount = typeof updateData.discountAmount === "number"
        ? updateData.discountAmount
        : previousOrder.discountAmount;
      updateData.paidAmount = Math.min(paidAmount, getPayableAmount(quotedPrice, discountAmount));
    }

    let order = await prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: serviceOrderInclude,
    });

    if (typeof updateData.status === "string" && warrantyAutoStatuses.has(updateData.status) && order.warrantyMonths !== 0) {
      const result = await createWarrantyForServiceOrder(prisma, order.id, {
        warrantyMonths: order.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
      });
      if (result.created) {
        await recordAuditLog({
          action: "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER",
          actor: admin,
          entity: "Warranty",
          entityId: result.warranty.id,
          newData: toAuditJson(result.warranty),
          request,
        });
      }
      const refreshedOrder = await prisma.serviceOrder.findUnique({
        where: { id: order.id },
        include: serviceOrderInclude,
      });
      if (refreshedOrder) order = refreshedOrder;
    }

    if (typeof updateData.status === "string" && order.contactRequestId) {
      await prisma.contactRequest.update({
        where: { id: order.contactRequestId },
        data: { status: mapOrderStatusToContactStatus(order.status) },
      });
    }

    await recordAuditLog({
      action: "SERVICE_ORDER_UPDATE",
      actor: admin,
      entity: "ServiceOrder",
      entityId: order.id,
      oldData: toAuditJson(previousOrder),
      newData: toAuditJson(order),
      request,
    });

    return NextResponse.json({ success: true, order: serializeServiceOrder(order) });
  } catch (error) {
    console.error("Service orders PATCH error:", error);
    if (error instanceof WarrantyValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { success: false, message: "Không cập nhật được đơn dịch vụ lúc này." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse("Không có quyền.");

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse("Dữ liệu xoá đơn chưa đúng định dạng.");

    const id = sanitizeText(String(body.id || ""));
    if (!id) {
      return NextResponse.json({ success: false, message: "Thiếu mã đơn cần xoá." }, { status: 400 });
    }

    const previousOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: serviceOrderInclude,
    });
    if (!previousOrder || previousOrder.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đơn dịch vụ." }, { status: 404 });
    }

    const order = await prisma.serviceOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: serviceOrderInclude,
    });
    await recordAuditLog({
      action: "SERVICE_ORDER_DELETE",
      actor: admin,
      entity: "ServiceOrder",
      entityId: order.id,
      oldData: toAuditJson(previousOrder),
      newData: toAuditJson(order),
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Service orders DELETE error:", error);
    return NextResponse.json(
      { success: false, message: "Không xoá được đơn dịch vụ lúc này." },
      { status: 500 }
    );
  }
}
