import { partnerInclude, serializePartner } from "@/lib/partner-ledger";
import { isMinhHongImportScopeEnabled } from "@/lib/minhhong-import/import-policy";
import { prisma } from "@/lib/prisma";
import AdminPartnerLedgerClient from "./AdminPartnerLedgerClient";

export default async function AdminPartnerLedgerPage() {
  const partners = await prisma.partner.findMany({
    where: { deletedAt: null },
    include: partnerInclude,
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <AdminPartnerLedgerClient
      initialPartners={partners.map(serializePartner)}
      partnerImportEnabled={isMinhHongImportScopeEnabled("partners")}
    />
  );
}
