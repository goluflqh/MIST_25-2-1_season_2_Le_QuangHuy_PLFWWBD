import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createServiceOrder,
  mapOrderStatusToContactStatus,
  normalizeServiceOrderPayload,
  serializeServiceOrder,
  serviceOrderInclude,
  serviceOrderSources,
  ServiceOrderValidationError,
} from "@/lib/service-orders";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { calculateCouponDiscount, getPayableAmount } from "@/lib/coupon-discounts";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";
import { sanitizeText } from "@/lib/sanitize";
import {
  archiveWarrantyForServiceOrder,
  createWarrantyForServiceOrder,
  DEFAULT_WARRANTY_MONTHS,
  WarrantyValidationError,
} from "@/lib/warranties";

const warrantyAutoStatuses = new Set(["COMPLETED"]);

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

    const previousOrder = await prisma.serviceOrder.findUnique({
      where: { id },
      include: serviceOrderInclude,
    });
    if (!previousOrder || previousOrder.deletedAt) {
      return NextResponse.json({ success: false, message: "Không tìm thấy đơn dịch vụ." }, { status: 404 });
    }

    const previousSource = serviceOrderSources.includes(previousOrder.source as (typeof serviceOrderSources)[number])
      ? previousOrder.source as (typeof serviceOrderSources)[number]
      : "MANUAL";
    const normalized = normalizeServiceOrderPayload({
      contactRequestId: previousOrder.contactRequestId || "",
      couponRedemptionId: previousOrder.couponRedemptionId || "",
      customerAddress: previousOrder.customerAddress || "",
      customerName: previousOrder.customerName,
      customerPhone: previousOrder.customerPhone,
      customerVisible: previousOrder.customerVisible,
      issueDescription: previousOrder.issueDescription || "",
      notes: previousOrder.notes || "",
      orderDate: previousOrder.orderDate,
      paidAmount: previousOrder.paidAmount,
      priceStatus: previousOrder.priceStatus,
      productName: previousOrder.productName,
      quotedPrice: previousOrder.quotedPrice ?? "",
      service: previousOrder.service,
      solution: previousOrder.solution || "",
      source: previousOrder.source,
      status: previousOrder.status,
      warrantyEndDate: previousOrder.warrantyEndDate || "",
      warrantyMonths: previousOrder.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
      ...body,
    }, previousSource);
    const discountAmount = normalized.priceStatus === "CONFIRMED"
      ? calculateCouponDiscount(previousOrder.couponDiscount, normalized.quotedPrice)
      : 0;
    const paidAmount = normalized.priceStatus === "CONFIRMED"
      ? Math.min(normalized.paidAmount, getPayableAmount(normalized.quotedPrice, discountAmount))
      : normalized.priceStatus === "FREE"
        ? 0
        : normalized.paidAmount;
    const phoneChanged = normalized.customerPhone !== previousOrder.customerPhone;

    const updateData: Prisma.ServiceOrderUpdateInput = {
      customerAddress: normalized.customerAddress,
      customerName: normalized.customerName,
      customerPhone: normalized.customerPhone,
      customerVisible: normalized.customerVisible,
      discountAmount,
      issueDescription: normalized.issueDescription,
      notes: normalized.notes,
      orderDate: normalized.orderDate,
      paidAmount,
      priceStatus: normalized.priceStatus,
      productName: normalized.productName,
      quotedPrice: normalized.quotedPrice,
      service: normalized.service,
      solution: normalized.solution,
      source: normalized.source,
      status: normalized.status,
      warrantyEndDate: warrantyAutoStatuses.has(normalized.status) ? normalized.warrantyEndDate : null,
      warrantyMonths: normalized.warrantyMonths,
    };

    let order = await prisma.$transaction(async (tx) => {
      const linkedUser = await tx.user.findUnique({
        where: { phone: normalized.customerPhone },
        select: { id: true, role: true },
      });
      const existingCustomer = await tx.customer.findUnique({
        where: { phone: normalized.customerPhone },
        select: { id: true, phone: true, userId: true },
      });
      const contactUserId = !phoneChanged && previousOrder.contactRequest?.userId
        ? previousOrder.contactRequest.userId
        : null;
      const linkedCustomerUserId = linkedUser?.role === "CUSTOMER" ? linkedUser.id : null;
      const effectiveUserId = linkedCustomerUserId || existingCustomer?.userId || contactUserId || null;
      const userCustomer = effectiveUserId
        ? await tx.customer.findUnique({
            where: { userId: effectiveUserId },
            select: { id: true, phone: true },
          })
        : null;
      const safeUserId = !userCustomer
        || userCustomer.id === existingCustomer?.id
        || userCustomer.phone === normalized.customerPhone
        ? effectiveUserId
        : null;
      const customer = await tx.customer.upsert({
        where: { phone: normalized.customerPhone },
        update: {
          address: normalized.customerAddress,
          deletedAt: null,
          name: normalized.customerName,
          ...(safeUserId ? { userId: safeUserId } : {}),
        },
        create: {
          address: normalized.customerAddress,
          name: normalized.customerName,
          phone: normalized.customerPhone,
          userId: safeUserId,
        },
      });

      return tx.serviceOrder.update({
        where: { id },
        data: {
          ...updateData,
          customer: { connect: { id: customer.id } },
          user: safeUserId ? { connect: { id: safeUserId } } : { disconnect: true },
        },
        include: serviceOrderInclude,
      });
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
    } else if (
      typeof updateData.status === "string"
      && !warrantyAutoStatuses.has(updateData.status)
      && order.warranty
    ) {
      const archivedWarranty = await archiveWarrantyForServiceOrder(prisma, order.id);
      if (archivedWarranty) {
        await recordAuditLog({
          action: "WARRANTY_AUTO_ARCHIVE_FROM_SERVICE_ORDER",
          actor: admin,
          entity: "Warranty",
          entityId: archivedWarranty.id,
          oldData: toAuditJson(order.warranty),
          newData: toAuditJson(archivedWarranty),
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
    if (error instanceof ServiceOrderValidationError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }

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

    const order = await prisma.$transaction(async (tx) => {
      const deletedOrder = await tx.serviceOrder.update({
        where: { id },
        data: { couponRedemptionId: null, deletedAt: new Date(), warrantyEndDate: null },
        include: serviceOrderInclude,
      });

      await archiveWarrantyForServiceOrder(tx, id);

      if (previousOrder.contactRequestId) {
        await tx.contactRequest.update({
          where: { id: previousOrder.contactRequestId },
          data: { couponRedemptionId: null, deletedAt: new Date() },
        });
      }

      return deletedOrder;
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
