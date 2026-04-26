import { prisma } from "@/lib/prisma";
import AdminReviewsClient from "./AdminReviewsClient";

export default async function AdminReviewsPage() {
  const reviews = await prisma.review.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      service: true,
      approved: true,
      createdAt: true,
      user: { select: { name: true, phone: true } },
    },
  });

  return (
    <AdminReviewsClient
      initialReviews={reviews.map((review) => ({
        ...review,
        createdAt: review.createdAt.toISOString(),
      }))}
    />
  );
}
