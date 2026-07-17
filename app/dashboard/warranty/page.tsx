import { prisma } from "@/lib/prisma";
import { DEFAULT_WARRANTY_MONTHS } from "@/lib/warranties";
import AdminWarrantyClient from "./AdminWarrantyClient";

export default async function AdminWarrantyPage() {
  const warranties = await prisma.warranty.findMany({
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
      serviceOrderId: true,
      deletedAt: true,
      serviceOrder: {
        select: {
          orderCode: true,
          warrantyMonths: true,
        },
      },
    },
  });

  return (
    <AdminWarrantyClient
      initialWarranties={warranties.map((warranty) => ({
        ...warranty,
        orderCode: warranty.serviceOrder?.orderCode || null,
        warrantyMonths: warranty.serviceOrder?.warrantyMonths ?? DEFAULT_WARRANTY_MONTHS,
        deletedAt: warranty.deletedAt?.toISOString() || null,
        startDate: warranty.startDate.toISOString(),
        endDate: warranty.endDate.toISOString(),
        serviceOrder: undefined,
      }))}
    />
  );
}
