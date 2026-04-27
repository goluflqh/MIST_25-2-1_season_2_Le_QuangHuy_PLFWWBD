import { prisma } from "@/lib/prisma";
import ContactsManagementClient from "./ContactsManagementClient";

export default async function ContactsManagementPage() {
  const contacts = await prisma.contactRequest.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      phone: true,
      service: true,
      message: true,
      status: true,
      notes: true,
      source: true,
      sourcePath: true,
      referrer: true,
      utmSource: true,
      utmMedium: true,
      utmCampaign: true,
      utmTerm: true,
      utmContent: true,
      couponRedemption: {
        select: {
          id: true,
          coupon: {
            select: {
              code: true,
              description: true,
              discount: true,
            },
          },
        },
      },
      serviceOrder: {
        select: {
          id: true,
          orderCode: true,
          status: true,
        },
      },
      createdAt: true,
    },
  });

  return (
    <ContactsManagementClient
      initialContacts={contacts.map((contact) => ({
        ...contact,
        createdAt: contact.createdAt.toISOString(),
      }))}
    />
  );
}
