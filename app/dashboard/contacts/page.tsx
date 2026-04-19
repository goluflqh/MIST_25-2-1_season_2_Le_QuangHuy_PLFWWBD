import { prisma } from "@/lib/prisma";
import ContactsManagementClient from "./ContactsManagementClient";

export default async function ContactsManagementPage() {
  const contacts = await prisma.contactRequest.findMany({
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
