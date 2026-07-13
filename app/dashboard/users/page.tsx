import { prisma } from "@/lib/prisma";
import AdminUsersClient from "./AdminUsersClient";

const RECENT_ORDER_WINDOW_DAYS = 90;

export default async function AdminUsersPage() {
  const recentOrderCutoff = new Date();
  recentOrderCutoff.setDate(recentOrderCutoff.getDate() - RECENT_ORDER_WINDOW_DAYS);

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
      customerProfile: { select: { createdAt: true } },
      serviceOrders: {
        where: { deletedAt: null },
        orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
        select: {
          createdAt: true,
          discountAmount: true,
          orderDate: true,
          paidAmount: true,
          quotedPrice: true,
          warranty: { select: { deletedAt: true, id: true } },
        },
      },
      warranties: {
        where: { deletedAt: null },
        select: { id: true },
      },
      _count: { select: { contactRequests: true, reviews: true } },
    },
  });

  const customerPhones = users
    .filter((user) => user.role !== "ADMIN")
    .map((user) => user.phone);
  const [unlinkedCustomers, unlinkedContacts, unlinkedOrders, unlinkedWarranties] = await Promise.all([
    prisma.customer.groupBy({
      by: ["phone"],
      where: { phone: { in: customerPhones }, userId: null, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.contactRequest.groupBy({
      by: ["phone"],
      where: { phone: { in: customerPhones }, userId: null, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.serviceOrder.groupBy({
      by: ["customerPhone"],
      where: { customerPhone: { in: customerPhones }, userId: null, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.warranty.groupBy({
      by: ["customerPhone"],
      where: { customerPhone: { in: customerPhones }, userId: null, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const unlinkedCustomerCounts = new Map(unlinkedCustomers.map((row) => [row.phone, row._count._all]));
  const unlinkedContactCounts = new Map(unlinkedContacts.map((row) => [row.phone, row._count._all]));
  const unlinkedOrderCounts = new Map(unlinkedOrders.map((row) => [row.customerPhone, row._count._all]));
  const unlinkedWarrantyCounts = new Map(unlinkedWarranties.map((row) => [row.customerPhone, row._count._all]));

  return (
    <AdminUsersClient
      initialUsers={users.map((user) => {
        const totalDebt = user.serviceOrders.reduce((sum, order) => {
          const payable = Math.max((order.quotedPrice || 0) - (order.discountAmount || 0), 0);
          return sum + Math.max(payable - (order.paidAmount || 0), 0);
        }, 0);
        const hasRecentOrder = user.serviceOrders.some((order) => order.orderDate >= recentOrderCutoff);
        const hasLinkedOldCustomer = Boolean(
          user.customerProfile && user.customerProfile.createdAt < user.createdAt
        ) || user.serviceOrders.some((order) => order.createdAt < user.createdAt);
        const hasWarranty = user.warranties.length > 0
          || user.serviceOrders.some((order) => order.warranty && !order.warranty.deletedAt);
        const unlinkedHistory = {
          customerProfiles: unlinkedCustomerCounts.get(user.phone) ?? 0,
          contactRequests: unlinkedContactCounts.get(user.phone) ?? 0,
          serviceOrders: unlinkedOrderCounts.get(user.phone) ?? 0,
          warranties: unlinkedWarrantyCounts.get(user.phone) ?? 0,
        };

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          loyaltyPoints: user.loyaltyPoints,
          referralCode: user.referralCode ?? "",
          createdAt: user.createdAt.toISOString(),
          customerOrigin: hasLinkedOldCustomer ? "LINKED_OLD_CUSTOMER" : "WEB_REGISTERED",
          hasRecentOrder,
          hasWarranty,
          recentOrderDate: user.serviceOrders[0]?.orderDate.toISOString() ?? null,
          serviceOrderCount: user.serviceOrders.length,
          totalDebt,
          warrantyCount: user.warranties.length,
          unlinkedHistory: {
            ...unlinkedHistory,
            total: unlinkedHistory.customerProfiles
              + unlinkedHistory.contactRequests
              + unlinkedHistory.serviceOrders
              + unlinkedHistory.warranties,
          },
          _count: user._count,
        };
      })}
    />
  );
}
