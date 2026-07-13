import { NextResponse } from "next/server";
import { recordAuditLog, toAuditJson } from "@/lib/audit-log";
import { createInvalidJsonResponse, readJsonBody } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { forbiddenResponse, getCurrentAdminUser } from "@/lib/session";

interface BaseHistoryCounts {
  customerProfiles: number;
  contactRequests: number;
  serviceOrders: number;
  warranties: number;
}

interface HistoryCounts extends BaseHistoryCounts {
  total: number;
}

function withTotal(counts: BaseHistoryCounts): HistoryCounts {
  return {
    ...counts,
    total: counts.customerProfiles + counts.contactRequests + counts.serviceOrders + counts.warranties,
  };
}

function isForeignOwner(ownerId: string | null | undefined, targetUserId: string) {
  return Boolean(ownerId && ownerId !== targetUserId);
}

function hasForeignOwner(targetUserId: string, ownerIds: Array<string | null | undefined>) {
  return ownerIds.some((ownerId) => isForeignOwner(ownerId, targetUserId));
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdminUser();
    if (!admin) return forbiddenResponse();

    const body = await readJsonBody(request);
    if (!body) return createInvalidJsonResponse();

    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId || userId.length > 100) {
      return NextResponse.json(
        { success: false, message: "Tài khoản khách hàng không hợp lệ." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, name: true, phone: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "Không tìm thấy tài khoản khách hàng cần ghép lịch sử cũ." },
        { status: 404 }
      );
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Không thể ghép lịch sử khách hàng vào tài khoản quản trị viên." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const [customerByPhone, currentCustomerProfile, contactRequests, serviceOrders, warranties] = await Promise.all([
        tx.customer.findUnique({
          where: { phone: targetUser.phone },
          select: { id: true, phone: true, userId: true, deletedAt: true },
        }),
        tx.customer.findUnique({
          where: { userId: targetUser.id },
          select: { id: true, phone: true, userId: true },
        }),
        tx.contactRequest.findMany({
          where: { phone: targetUser.phone, deletedAt: null },
          select: {
            id: true,
            userId: true,
            serviceOrder: {
              select: {
                userId: true,
                customer: { select: { userId: true } },
                warranty: { select: { userId: true } },
              },
            },
          },
        }),
        tx.serviceOrder.findMany({
          where: { customerPhone: targetUser.phone, deletedAt: null },
          select: {
            id: true,
            userId: true,
            contactRequest: { select: { userId: true } },
            customer: { select: { userId: true } },
            warranty: { select: { userId: true } },
          },
        }),
        tx.warranty.findMany({
          where: { customerPhone: targetUser.phone, deletedAt: null },
          select: {
            id: true,
            userId: true,
            serviceOrder: {
              select: {
                userId: true,
                contactRequest: { select: { userId: true } },
                customer: { select: { userId: true } },
              },
            },
          },
        }),
      ]);

      const unlinkedBefore = withTotal({
        customerProfiles: customerByPhone?.userId === null && !customerByPhone.deletedAt ? 1 : 0,
        contactRequests: contactRequests.filter((item) => item.userId === null).length,
        serviceOrders: serviceOrders.filter((item) => item.userId === null).length,
        warranties: warranties.filter((item) => item.userId === null).length,
      });

      const customerIdentityConflict = Boolean(
        (customerByPhone && !customerByPhone.deletedAt && isForeignOwner(customerByPhone.userId, targetUser.id))
        || (currentCustomerProfile && currentCustomerProfile.phone !== targetUser.phone)
      );

      if (customerIdentityConflict) {
        return {
          blocked: true as const,
          linked: withTotal({ customerProfiles: 0, contactRequests: 0, serviceOrders: 0, warranties: 0 }),
          alreadyLinked: withTotal({ customerProfiles: 0, contactRequests: 0, serviceOrders: 0, warranties: 0 }),
          conflicts: withTotal({
            customerProfiles: 1,
            contactRequests: unlinkedBefore.contactRequests,
            serviceOrders: unlinkedBefore.serviceOrders,
            warranties: unlinkedBefore.warranties,
          }),
          remainingUnlinked: unlinkedBefore,
        };
      }

      const safeContactIds: string[] = [];
      const safeOrderIds: string[] = [];
      const safeWarrantyIds: string[] = [];
      const customerHasRelatedForeignOwner = hasForeignOwner(targetUser.id, [
        ...contactRequests.map((item) => item.userId),
        ...serviceOrders.map((item) => item.userId),
        ...warranties.map((item) => item.userId),
      ]);
      const alreadyLinked = {
        customerProfiles: customerByPhone?.userId === targetUser.id && !customerByPhone.deletedAt ? 1 : 0,
        contactRequests: 0,
        serviceOrders: 0,
        warranties: 0,
      };
      const conflicts = {
        customerProfiles: customerByPhone?.userId === null
          && !customerByPhone.deletedAt
          && customerHasRelatedForeignOwner
          ? 1
          : 0,
        contactRequests: 0,
        serviceOrders: 0,
        warranties: 0,
      };

      for (const item of contactRequests) {
        const relatedOwners = [
          item.serviceOrder?.userId,
          item.serviceOrder?.customer.userId,
          item.serviceOrder?.warranty?.userId,
        ];
        if (isForeignOwner(item.userId, targetUser.id) || hasForeignOwner(targetUser.id, relatedOwners)) {
          conflicts.contactRequests += 1;
        } else if (item.userId === targetUser.id) {
          alreadyLinked.contactRequests += 1;
        } else {
          safeContactIds.push(item.id);
        }
      }

      for (const item of serviceOrders) {
        const relatedOwners = [
          item.contactRequest?.userId,
          item.customer.userId,
          item.warranty?.userId,
        ];
        if (isForeignOwner(item.userId, targetUser.id) || hasForeignOwner(targetUser.id, relatedOwners)) {
          conflicts.serviceOrders += 1;
        } else if (item.userId === targetUser.id) {
          alreadyLinked.serviceOrders += 1;
        } else {
          safeOrderIds.push(item.id);
        }
      }

      for (const item of warranties) {
        const relatedOwners = [
          item.serviceOrder?.userId,
          item.serviceOrder?.contactRequest?.userId,
          item.serviceOrder?.customer.userId,
        ];
        if (isForeignOwner(item.userId, targetUser.id) || hasForeignOwner(targetUser.id, relatedOwners)) {
          conflicts.warranties += 1;
        } else if (item.userId === targetUser.id) {
          alreadyLinked.warranties += 1;
        } else {
          safeWarrantyIds.push(item.id);
        }
      }

      const customerUpdate = customerByPhone?.userId === null
        && !customerByPhone.deletedAt
        && !customerHasRelatedForeignOwner
        ? await tx.customer.updateMany({
          where: { id: customerByPhone.id, userId: null },
          data: { userId: targetUser.id },
        })
        : { count: 0 };
      const contactUpdate = safeContactIds.length > 0
        ? await tx.contactRequest.updateMany({
          where: { id: { in: safeContactIds }, userId: null },
          data: { userId: targetUser.id },
        })
        : { count: 0 };
      const orderUpdate = safeOrderIds.length > 0
        ? await tx.serviceOrder.updateMany({
          where: { id: { in: safeOrderIds }, userId: null },
          data: { userId: targetUser.id },
        })
        : { count: 0 };
      const warrantyUpdate = safeWarrantyIds.length > 0
        ? await tx.warranty.updateMany({
          where: { id: { in: safeWarrantyIds }, userId: null },
          data: { userId: targetUser.id },
        })
        : { count: 0 };

      const [remainingCustomers, remainingContacts, remainingOrders, remainingWarranties] = await Promise.all([
        tx.customer.count({ where: { phone: targetUser.phone, userId: null, deletedAt: null } }),
        tx.contactRequest.count({ where: { phone: targetUser.phone, userId: null, deletedAt: null } }),
        tx.serviceOrder.count({ where: { customerPhone: targetUser.phone, userId: null, deletedAt: null } }),
        tx.warranty.count({ where: { customerPhone: targetUser.phone, userId: null, deletedAt: null } }),
      ]);

      return {
        blocked: false as const,
        linked: withTotal({
          customerProfiles: customerUpdate.count,
          contactRequests: contactUpdate.count,
          serviceOrders: orderUpdate.count,
          warranties: warrantyUpdate.count,
        }),
        alreadyLinked: withTotal(alreadyLinked),
        conflicts: withTotal(conflicts),
        remainingUnlinked: withTotal({
          customerProfiles: remainingCustomers,
          contactRequests: remainingContacts,
          serviceOrders: remainingOrders,
          warranties: remainingWarranties,
        }),
      };
    });

    await recordAuditLog({
      action: result.blocked ? "USER_HISTORY_LINK_BLOCKED" : "USER_HISTORY_LINK",
      actor: admin,
      entity: "User",
      entityId: targetUser.id,
      newData: toAuditJson({
        phone: targetUser.phone,
        linked: result.linked,
        conflicts: result.conflicts,
        remainingUnlinked: result.remainingUnlinked,
      }),
      request,
    });

    if (result.blocked) {
      return NextResponse.json(
        {
          success: false,
          message: "Số điện thoại này đang được dùng trong hồ sơ của tài khoản khác. Hệ thống chưa thay đổi dữ liệu; vui lòng kiểm tra lại trước khi ghép.",
          ...result,
        },
        { status: 409 }
      );
    }

    const message = result.linked.total > 0
      ? `Đã ghép ${result.linked.total} mục lịch sử cũ vào tài khoản ${targetUser.name}.`
      : "Không có lịch sử cũ phù hợp để ghép vào tài khoản này.";

    return NextResponse.json({ success: true, message, ...result });
  } catch (error) {
    console.error("Admin user history link error:", error);
    return NextResponse.json(
      { success: false, message: "Không thể ghép lịch sử khách hàng lúc này." },
      { status: 500 }
    );
  }
}
