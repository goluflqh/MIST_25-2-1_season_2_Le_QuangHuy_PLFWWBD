import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "../../lib/auth";

loadEnvConfig(process.cwd());
const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const prisma = new PrismaClient();

function uniqueValue() {
  return `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function uniquePhone() {
  return `09${`${Date.now()}${Math.floor(Math.random() * 1_000)}`.slice(-8)}`;
}

async function login(context: APIRequestContext, phone: string, password: string) {
  return context.post("/api/auth/login", { data: { phone, password } });
}

test.describe("Admin links unowned customer history", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("links only unowned records and reports ownership conflicts", async ({ baseURL, request }) => {
    const suffix = uniqueValue();
    const targetPhone = uniquePhone();
    const otherPhone = `${targetPhone.slice(0, -1)}${(Number(targetPhone.at(-1)) + 1) % 10}`;
    const password = "history-link-test-123";
    const targetUser = await prisma.user.create({
      data: { name: "Khách cần gắn lịch sử", phone: targetPhone, password: await hashPassword(password) },
    });
    const otherUser = await prisma.user.create({
      data: { name: "Chủ dữ liệu khác", phone: otherPhone, password: await hashPassword(password) },
    });
    const customer = await prisma.customer.create({
      data: { name: targetUser.name, phone: targetPhone },
    });
    const safeContact = await prisma.contactRequest.create({
      data: { name: targetUser.name, phone: targetPhone },
    });
    const safeOrder = await prisma.serviceOrder.create({
      data: {
        orderCode: `E2E-SAFE-${suffix}`,
        customerId: customer.id,
        customerName: targetUser.name,
        customerPhone: targetPhone,
        productName: "Thiết bị an toàn",
      },
    });
    const safeWarranty = await prisma.warranty.create({
      data: {
        serialNo: `E2E-SAFE-${suffix}`,
        productName: "Thiết bị an toàn",
        customerName: targetUser.name,
        customerPhone: targetPhone,
        endDate: new Date(Date.now() + 86_400_000),
        serviceOrderId: safeOrder.id,
      },
    });
    const conflictContact = await prisma.contactRequest.create({
      data: { name: targetUser.name, phone: targetPhone },
    });
    const conflictOrder = await prisma.serviceOrder.create({
      data: {
        orderCode: `E2E-CONFLICT-${suffix}`,
        customerId: customer.id,
        userId: otherUser.id,
        contactRequestId: conflictContact.id,
        customerName: targetUser.name,
        customerPhone: targetPhone,
        productName: "Thiết bị xung đột",
      },
    });
    const conflictWarranty = await prisma.warranty.create({
      data: {
        serialNo: `E2E-CONFLICT-${suffix}`,
        productName: "Thiết bị xung đột",
        customerName: targetUser.name,
        customerPhone: targetPhone,
        endDate: new Date(Date.now() + 86_400_000),
        serviceOrderId: conflictOrder.id,
      },
    });
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await request.post("/api/admin/users/link-history", {
        data: { userId: targetUser.id },
      })).status()).toBe(403);
      expect((await login(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      const response = await admin.post("/api/admin/users/link-history", {
        data: { userId: targetUser.id },
      });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.linked).toMatchObject({
        customerProfiles: 0,
        contactRequests: 1,
        serviceOrders: 1,
        warranties: 1,
        total: 3,
      });
      expect(body.conflicts).toMatchObject({
        customerProfiles: 1,
        contactRequests: 1,
        serviceOrders: 1,
        warranties: 1,
        total: 4,
      });

      expect((await prisma.customer.findUnique({ where: { id: customer.id } }))?.userId).toBeNull();
      expect((await prisma.contactRequest.findUnique({ where: { id: safeContact.id } }))?.userId).toBe(targetUser.id);
      expect((await prisma.serviceOrder.findUnique({ where: { id: safeOrder.id } }))?.userId).toBe(targetUser.id);
      expect((await prisma.warranty.findUnique({ where: { id: safeWarranty.id } }))?.userId).toBe(targetUser.id);
      expect((await prisma.contactRequest.findUnique({ where: { id: conflictContact.id } }))?.userId).toBeNull();
      expect((await prisma.serviceOrder.findUnique({ where: { id: conflictOrder.id } }))?.userId).toBe(otherUser.id);
      expect((await prisma.warranty.findUnique({ where: { id: conflictWarranty.id } }))?.userId).toBeNull();
      expect(await prisma.auditLog.count({
        where: { action: "USER_HISTORY_LINK", entityId: targetUser.id },
      })).toBeGreaterThan(0);
    } finally {
      await admin.dispose();
      await prisma.warranty.deleteMany({ where: { id: { in: [safeWarranty.id, conflictWarranty.id] } } });
      await prisma.serviceOrder.deleteMany({ where: { id: { in: [safeOrder.id, conflictOrder.id] } } });
      await prisma.contactRequest.deleteMany({ where: { id: { in: [safeContact.id, conflictContact.id] } } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: targetUser.id } });
      await prisma.user.deleteMany({ where: { id: { in: [targetUser.id, otherUser.id] } } });
    }
  });

  test("moves warranty ownership only to a customer profile that is already linked", async ({ baseURL }) => {
    const suffix = uniqueValue();
    const oldPhone = uniquePhone();
    const linkedPhone = uniquePhone();
    const unownedPhone = uniquePhone();
    const password = "warranty-owner-test-123";
    const oldUser = await prisma.user.create({
      data: { name: "Old warranty owner", phone: oldPhone, password: await hashPassword(password) },
    });
    const linkedUser = await prisma.user.create({
      data: { name: "New warranty owner", phone: linkedPhone, password: await hashPassword(password) },
    });
    const oldCustomer = await prisma.customer.create({
      data: { name: oldUser.name, phone: oldPhone, userId: oldUser.id },
    });
    const linkedCustomer = await prisma.customer.create({
      data: { name: linkedUser.name, phone: linkedPhone, userId: linkedUser.id },
    });
    const warranty = await prisma.warranty.create({
      data: {
        serialNo: `E2E-OWNER-${suffix}`,
        productName: "Warranty ownership device",
        customerName: oldUser.name,
        customerPhone: oldPhone,
        endDate: new Date(Date.now() + 86_400_000),
        userId: oldUser.id,
      },
    });
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await login(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      const disconnectResponse = await admin.patch("/api/admin/warranty", {
        data: { id: warranty.id, customerPhone: unownedPhone },
      });
      expect(disconnectResponse.status()).toBe(200);
      expect((await prisma.warranty.findUnique({ where: { id: warranty.id } }))?.userId).toBeNull();

      const reconnectResponse = await admin.patch("/api/admin/warranty", {
        data: { id: warranty.id, customerPhone: linkedPhone },
      });
      expect(reconnectResponse.status()).toBe(200);
      expect((await prisma.warranty.findUnique({ where: { id: warranty.id } }))?.userId).toBe(linkedUser.id);
    } finally {
      await admin.dispose();
      await prisma.warranty.deleteMany({ where: { id: warranty.id } });
      await prisma.customer.deleteMany({ where: { id: { in: [oldCustomer.id, linkedCustomer.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [oldUser.id, linkedUser.id] } } });
    }
  });
});
