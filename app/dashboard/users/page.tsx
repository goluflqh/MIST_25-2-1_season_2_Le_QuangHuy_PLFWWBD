import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      role: true,
      loyaltyPoints: true,
      referralCode: true,
      createdAt: true,
      _count: { select: { contactRequests: true, reviews: true } },
    },
  });

  return (
    <AdminUsersClient
      initialUsers={users.map((user) => ({
        ...user,
        referralCode: user.referralCode ?? "",
        createdAt: user.createdAt.toISOString(),
      }))}
    />
  );
}
