import { prisma } from "@/lib/prisma";
import { serializeServiceOrder, serviceOrderInclude } from "@/lib/service-orders";
import AdminServiceOrdersClient from "./AdminServiceOrdersClient";

export default async function AdminServiceOrdersPage() {
  const orders = await prisma.serviceOrder.findMany({
    where: { deletedAt: null },
    include: serviceOrderInclude,
    orderBy: [{ orderDate: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  return <AdminServiceOrdersClient initialOrders={orders.map(serializeServiceOrder)} />;
}
