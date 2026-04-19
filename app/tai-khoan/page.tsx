import { redirect } from "next/navigation";
import AccountPageClient from "@/components/account/AccountPageClient";
import { prisma } from "@/lib/prisma";
import { getCurrentSessionUser } from "@/lib/session";

export default async function AccountPage() {
  const user = await getCurrentSessionUser();

  if (!user) {
    redirect("/dang-nhap");
  }

  const [requests, warranties] = await Promise.all([
    prisma.contactRequest.findMany({
      where: { phone: user.phone },
      orderBy: { createdAt: "desc" },
    }),
    prisma.warranty.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AccountPageClient
      initialUser={{
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
        createdAt: user.createdAt.toISOString(),
      }}
      initialRequests={requests.map((request) => ({
        id: request.id,
        service: request.service,
        message: request.message,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
      }))}
      initialWarranties={warranties.map((warranty) => ({
        id: warranty.id,
        serialNo: warranty.serialNo,
        productName: warranty.productName,
        service: warranty.service,
        endDate: warranty.endDate.toISOString(),
        notes: warranty.notes,
      }))}
    />
  );
}
