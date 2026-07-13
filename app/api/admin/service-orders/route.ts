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

    const transactionResult = await prisma.$transaction(async (tx) => {
      let transactionalOrder = await createServiceOrder(body, "MANUAL", tx);
      let createdWarranty: Awaited<ReturnType<typeof createWarrantyForServiceOrder>>["warranty"] | null = null;

      if (warrantyAutoStatuses.has(transactionalOrder.status) && transactionalOrder.warrantyMonths !== 0) {
        const warrantyResult = await createWarrantyForServiceOrder(tx, transactionalOrder.id, {
          warrantyMonths: transactionalOrder.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
        });
        if (warrantyResult.created) createdWarranty = warrantyResult.warranty;

        const refreshedOrder = await tx.serviceOrder.findUnique({
          where: { id: transactionalOrder.id },
          include: serviceOrderInclude,
        });
        if (refreshedOrder) transactionalOrder = refreshedOrder;
      }

      return { createdWarranty, order: transactionalOrder };
    });
    const order = transactionResult.order;

    await recordAuditLog({
      action: "SERVICE_ORDER_CREATE",
      actor: admin,
      entity: "ServiceOrder",
      entityId: order.id,
      newData: toAuditJson(order),
      request,
    });

    if (transactionResult.createdWarranty) {
      await recordAuditLog({
        action: "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER",
        actor: admin,
        entity: "Warranty",
        entityId: transactionResult.createdWarranty.id,
        newData: toAuditJson(transactionResult.createdWarranty),
        request,
      });
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
      paidAt: previousOrder.paidAt || "",
      priceStatus: previousOrder.priceStatus,
      productName: previousOrder.productName,
      quotedPrice: previousOrder.quotedPrice ?? "",
      service: previousOrder.service,
      solution: previousOrder.solution || "",
      source: previousOrder.source,
      sourceName: previousOrder.sourceName || "",
      sourceRow: previousOrder.sourceRow || "",
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
    const paymentChanged = paidAmount !== previousOrder.paidAmount;
    const paidAt = paidAmount <= 0
      ? null
      : paymentChanged
        ? (body.paidAt === undefined ? new Date() : normalized.paidAt || new Date())
        : normalized.paidAt || previousOrder.paidAt;

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
      paidAt,
      priceStatus: normalized.priceStatus,
      productName: normalized.productName,
      quotedPrice: normalized.quotedPrice,
      service: normalized.service,
      solution: normalized.solution,
      source: normalized.source,
      sourceName: normalized.sourceName,
      sourceRow: normalized.sourceRow,
      status: normalized.status,
      warrantyEndDate: warrantyAutoStatuses.has(normalized.status) ? normalized.warrantyEndDate : null,
      warrantyMonths: normalized.warrantyMonths,
    };

    const transactionResult = await prisma.$transaction(async (tx) => {
      const existingCustomer = await tx.customer.findUnique({
        where: { phone: normalized.customerPhone },
        select: { id: true, phone: true, userId: true },
      });
      const contactUserId = !phoneChanged && previousOrder.contactRequest?.userId
        ? previousOrder.contactRequest.userId
        : null;
      const effectiveUserId = contactUserId || existingCustomer?.userId || null;
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

      let transactionalOrder = await tx.serviceOrder.update({
        where: { id },
        data: {
          ...updateData,
          customer: { connect: { id: customer.id } },
          user: safeUserId ? { connect: { id: safeUserId } } : { disconnect: true },
        },
        include: serviceOrderInclude,
      });
      let warrantyAudit: {
        action: string;
        entityId: string;
        newData?: Prisma.InputJsonValue;
        oldData?: Prisma.InputJsonValue;
      } | null = null;

      if (
        typeof updateData.status === "string"
        && warrantyAutoStatuses.has(updateData.status)
        && transactionalOrder.warrantyMonths !== 0
      ) {
        const previousWarranty = transactionalOrder.warranty && !transactionalOrder.warranty.deletedAt
          ? await tx.warranty.findUnique({ where: { id: transactionalOrder.warranty.id } })
          : null;
        const warrantyResult = await createWarrantyForServiceOrder(tx, transactionalOrder.id, {
          notes: previousWarranty?.notes || undefined,
          refreshExisting: true,
          warrantyMonths: transactionalOrder.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
        });
        if (warrantyResult.created) {
          warrantyAudit = {
            action: "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER",
            entityId: warrantyResult.warranty.id,
            newData: toAuditJson(warrantyResult.warranty),
          };
        } else if (previousWarranty) {
          warrantyAudit = {
            action: "WARRANTY_AUTO_UPDATE_FROM_SERVICE_ORDER",
            entityId: warrantyResult.warranty.id,
            oldData: toAuditJson(previousWarranty),
            newData: toAuditJson(warrantyResult.warranty),
          };
        }
      } else if (
        typeof updateData.status === "string"
        && !warrantyAutoStatuses.has(updateData.status)
        && transactionalOrder.warranty
      ) {
        const previousWarranty = transactionalOrder.warranty;
        const archivedWarranty = await archiveWarrantyForServiceOrder(tx, transactionalOrder.id);
        if (archivedWarranty) {
          warrantyAudit = {
            action: "WARRANTY_AUTO_ARCHIVE_FROM_SERVICE_ORDER",
            entityId: archivedWarranty.id,
            oldData: toAuditJson(previousWarranty),
            newData: toAuditJson(archivedWarranty),
          };
        }
      }

      if (typeof updateData.status === "string" && transactionalOrder.contactRequestId) {
        await tx.contactRequest.update({
          where: { id: transactionalOrder.contactRequestId },
          data: { status: mapOrderStatusToContactStatus(transactionalOrder.status) },
        });
      }

      const refreshedOrder = await tx.serviceOrder.findUnique({
        where: { id: transactionalOrder.id },
        include: serviceOrderInclude,
      });
      if (refreshedOrder) transactionalOrder = refreshedOrder;

      return { order: transactionalOrder, warrantyAudit };
    });
    const order = transactionResult.order;

    if (transactionResult.warrantyAudit) {
      await recordAuditLog({
        action: transactionResult.warrantyAudit.action,
        actor: admin,
        entity: "Warranty",
        entityId: transactionResult.warrantyAudit.entityId,
        oldData: transactionResult.warrantyAudit.oldData,
        newData: transactionResult.warrantyAudit.newData,
        request,
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
        data: { couponRedemptionId: null, deletedAt: new Date(), warrantyEndDate: null, warrantyMonths: null },
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
