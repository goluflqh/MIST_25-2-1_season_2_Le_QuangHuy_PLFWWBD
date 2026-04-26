import { prisma } from "@/lib/prisma";
import AdminWarrantyClient from "./AdminWarrantyClient";

export default async function AdminWarrantyPage() {
  const warranties = await prisma.warranty.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      serialNo: true,
      productName: true,
      customerName: true,
      customerPhone: true,
      service: true,
      startDate: true,
      endDate: true,
      notes: true,
    },
  });

  return (
    <AdminWarrantyClient
      initialWarranties={warranties.map((warranty) => ({
        ...warranty,
        startDate: warranty.startDate.toISOString(),
        endDate: warranty.endDate.toISOString(),
      }))}
    />
  );
}
