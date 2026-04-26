import type { User } from "@prisma/client";
import {
  isPrismaDatabaseUnavailable,
  logPrismaAvailabilityWarning,
  prisma,
} from "@/lib/prisma";

export interface AdminNotificationCounts {
  contacts: number;
  reviews: number;
}

export async function getAdminNotificationCounts(options?: {
  lastSeen?: Date;
}): Promise<AdminNotificationCounts> {
  const createdAtFilter = options?.lastSeen ? { gt: options.lastSeen } : undefined;
  const [pendingContacts, pendingReviews] = await Promise.all([
    prisma.contactRequest.count({
      where: {
        deletedAt: null,
        status: "PENDING",
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
    }),
    prisma.review.count({
      where: {
        deletedAt: null,
        approved: false,
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
    }),
  ]);

  return {
    contacts: pendingContacts,
    reviews: pendingReviews,
  };
}

function getSafeLastSeenDate(lastSeen: string | null) {
  if (!lastSeen) {
    return new Date(0);
  }

  const parsed = new Date(lastSeen);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

export async function getNotificationCountForUser(
  user: Pick<User, "id" | "phone" | "role">,
  options?: { lastSeen?: string | null }
) {
  try {
    const lastSeenDate = getSafeLastSeenDate(options?.lastSeen ?? null);

    if (user.role === "ADMIN") {
      const counts = await getAdminNotificationCounts({ lastSeen: lastSeenDate });
      return counts.contacts + counts.reviews;
    }

    return prisma.contactRequest.count({
      where: {
        deletedAt: null,
        OR: [{ userId: user.id }, { phone: user.phone }],
        status: { not: "PENDING" },
        updatedAt: { gt: lastSeenDate },
      },
    });
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Notification count fallback", error);
      return 0;
    }

    throw error;
  }
}
