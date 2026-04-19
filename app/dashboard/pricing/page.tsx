import { prisma } from "@/lib/prisma";
import AdminPricingClient from "./AdminPricingClient";

export default async function AdminPricingPage() {
  const items = await prisma.pricingItem.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      category: true,
      name: true,
      price: true,
      unit: true,
      description: true,
      note: true,
      sortOrder: true,
      active: true,
    },
  });

  return <AdminPricingClient initialItems={items} />;
}
