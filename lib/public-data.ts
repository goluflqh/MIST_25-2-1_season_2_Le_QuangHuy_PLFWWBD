import { unstable_cache } from "next/cache";
import {
  isPrismaDatabaseUnavailable,
  logPrismaAvailabilityWarning,
  prisma,
} from "@/lib/prisma";

export const PUBLIC_PRICING_TAG = "public-pricing";
export const PUBLIC_REVIEWS_TAG = "public-reviews";

const PUBLIC_CONTENT_REVALIDATE_SECONDS = 300;

const readActivePricingItems = unstable_cache(
  async () =>
    prisma.pricingItem.findMany({
      where: { active: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    }),
  ["public-active-pricing-items"],
  {
    revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
    tags: [PUBLIC_PRICING_TAG],
  }
);

const readApprovedReviews = unstable_cache(
  async () =>
    prisma.review.findMany({
      where: { approved: true, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ["public-approved-reviews"],
  {
    revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
    tags: [PUBLIC_REVIEWS_TAG],
  }
);

export async function getPublicActivePricingItems() {
  try {
    return await readActivePricingItems();
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Public pricing fallback", error);
      return [];
    }

    console.error("Public pricing query error:", error);
    return [];
  }
}

export async function getPublicApprovedReviews() {
  try {
    return await readApprovedReviews();
  } catch (error) {
    if (isPrismaDatabaseUnavailable(error)) {
      logPrismaAvailabilityWarning("Public reviews fallback", error);
      return [];
    }

    console.error("Public reviews query error:", error);
    return [];
  }
}
