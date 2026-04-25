import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getClientIP } from "@/lib/rate-limit";

type AuditActor = Pick<User, "id">;

interface AuditLogInput {
  action: string;
  actor: AuditActor;
  entity: string;
  entityId?: string | null;
  newData?: Prisma.InputJsonValue;
  oldData?: Prisma.InputJsonValue;
  request?: Request;
}

export function toAuditJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;

  const serialized = JSON.stringify(value);
  if (!serialized) return undefined;

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export async function recordAuditLog({
  action,
  actor,
  entity,
  entityId,
  newData,
  oldData,
  request,
}: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId: entityId || null,
        ip: request ? getClientIP(request) : null,
        newData,
        oldData,
        userId: actor.id,
      },
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
