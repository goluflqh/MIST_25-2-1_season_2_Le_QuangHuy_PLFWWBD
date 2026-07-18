import { Prisma } from "@prisma/client";
import { toAuditJson } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import {
  archiveWarrantyForServiceOrder,
  createWarrantyForServiceOrder,
  DEFAULT_WARRANTY_MONTHS,
} from "@/lib/warranties";

type PrismaRunner = typeof prisma | Prisma.TransactionClient;

export type OrderWarrantyAudit = {
  action:
    | "WARRANTY_AUTO_ARCHIVE_FROM_SERVICE_ORDER"
    | "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER"
    | "WARRANTY_AUTO_UPDATE_FROM_SERVICE_ORDER";
  entityId: string;
  newData?: Prisma.InputJsonValue;
  oldData?: Prisma.InputJsonValue;
};

type ReconcileOrderWarrantyOptions = {
  endDate?: Date | null;
  refreshActiveWarranty?: boolean;
  startDate?: Date;
};

export async function reconcileOrderWarrantyLifecycle(
  runner: PrismaRunner,
  serviceOrderId: string,
  options: ReconcileOrderWarrantyOptions = {}
): Promise<OrderWarrantyAudit | null> {
  const order = await runner.serviceOrder.findUnique({
    where: { id: serviceOrderId },
    select: {
      deletedAt: true,
      status: true,
      warranty: {
        select: {
          deletedAt: true,
          id: true,
        },
      },
      warrantyMonths: true,
    },
  });

  if (!order) return null;

  const activeWarranty = order.warranty && !order.warranty.deletedAt
    ? await runner.warranty.findUnique({ where: { id: order.warranty.id } })
    : null;
  const warrantyEligible = !order.deletedAt
    && order.status === "COMPLETED"
    && order.warrantyMonths !== 0
    && !order.warranty?.deletedAt;

  if (!warrantyEligible) {
    const shouldArchive = Boolean(order.deletedAt) || order.status !== "COMPLETED";
    if (!shouldArchive) return null;

    if (!activeWarranty) {
      await runner.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { warrantyEndDate: null },
      });
      return null;
    }

    const archivedWarranty = await archiveWarrantyForServiceOrder(runner, serviceOrderId);
    if (!archivedWarranty) return null;

    return {
      action: "WARRANTY_AUTO_ARCHIVE_FROM_SERVICE_ORDER",
      entityId: archivedWarranty.id,
      oldData: toAuditJson(activeWarranty),
      newData: toAuditJson(archivedWarranty),
    };
  }

  const warrantyResult = await createWarrantyForServiceOrder(runner, serviceOrderId, {
    endDate: options.endDate || undefined,
    notes: activeWarranty?.notes || undefined,
    refreshExisting: options.refreshActiveWarranty === true,
    startDate: options.startDate,
    warrantyMonths: order.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
  });

  if (warrantyResult.created) {
    return {
      action: "WARRANTY_AUTO_CREATE_FROM_SERVICE_ORDER",
      entityId: warrantyResult.warranty.id,
      newData: toAuditJson(warrantyResult.warranty),
    };
  }

  if (activeWarranty && options.refreshActiveWarranty) {
    return {
      action: "WARRANTY_AUTO_UPDATE_FROM_SERVICE_ORDER",
      entityId: warrantyResult.warranty.id,
      oldData: toAuditJson(activeWarranty),
      newData: toAuditJson(warrantyResult.warranty),
    };
  }

  return null;
}
