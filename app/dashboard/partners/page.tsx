import { partnerInclude, serializePartner } from "@/lib/partner-ledger";
import { prisma } from "@/lib/prisma";
import AdminPartnerLedgerClient from "./AdminPartnerLedgerClient";

export default async function AdminPartnerLedgerPage() {
  const partners = await prisma.partner.findMany({
    where: { deletedAt: null },
    include: partnerInclude,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return <AdminPartnerLedgerClient initialPartners={partners.map(serializePartner)} />;
}
