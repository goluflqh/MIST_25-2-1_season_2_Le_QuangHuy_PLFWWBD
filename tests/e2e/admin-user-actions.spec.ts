import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "../../lib/auth";

loadEnvConfig(process.cwd());
const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const prisma = new PrismaClient();

function uniquePhone() {
  return `09${`${Date.now()}${Math.floor(Math.random() * 1_000)}`.slice(-8)}`;
}

function uniqueTestIp() {
  const seed = Date.now() % 16_000_000;
  return `10.${Math.floor(seed / 65_536) % 256}.${Math.floor(seed / 256) % 256}.${(seed % 254) + 1}`;
}

async function loginRequest(context: APIRequestContext, phone: string, password: string) {
  return context.post("/api/auth/login", { data: { phone, password } });
}

async function loginPage(page: Page, phone: string, password: string) {
  const response = await page.request.post("/api/auth/login", {
    data: { phone, password },
    headers: { "x-forwarded-for": uniqueTestIp() },
  });
  expect(response.status()).toBe(200);
}

test.describe("Admin customer actions", () => {
  test.setTimeout(120_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("server issues a one-time secure temporary password and revokes old sessions", async ({ baseURL }) => {
    const phone = uniquePhone();
    const oldPassword = "old-password-123";
    const user = await prisma.user.create({
      data: { name: "Khách cấp lại mật khẩu", phone, password: await hashPassword(oldPassword) },
    });
    const customer = await playwrightRequest.newContext({ baseURL });
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await loginRequest(customer, phone, oldPassword)).status()).toBe(200);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBeGreaterThan(0);
      expect((await loginRequest(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      const response = await admin.patch("/api/admin/users", { data: { userId: user.id } });
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.temporaryPassword).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect((await loginRequest(customer, phone, oldPassword)).status()).toBe(401);
      expect((await loginRequest(customer, phone, body.temporaryPassword)).status()).toBe(200);
      expect(await prisma.auditLog.count({
        where: { action: "USER_PASSWORD_RESET", entityId: user.id },
      })).toBeGreaterThan(0);
    } finally {
      await customer.dispose();
      await admin.dispose();
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("rejects temporary password resets for ADMIN targets", async ({ baseURL }) => {
    const phone = uniquePhone();
    const originalPassword = await hashPassword("admin-target-password-123");
    const user = await prisma.user.create({
      data: {
        name: "Admin reset target",
        phone,
        password: originalPassword,
        role: "ADMIN",
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: `admin-target-session-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await loginRequest(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      const response = await admin.patch("/api/admin/users", { data: { userId: user.id } });
      expect(response.status()).toBe(403);
      expect(await response.json()).toMatchObject({ success: false });

      const target = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      expect(target?.password).toBe(originalPassword);
      expect(await prisma.session.count({ where: { id: session.id } })).toBe(1);
      expect(await prisma.auditLog.count({
        where: { action: "USER_PASSWORD_RESET", entityId: user.id },
      })).toBe(0);
    } finally {
      await admin.dispose();
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("rolls back the password update when session revocation fails", async ({ baseURL }) => {
    const phone = uniquePhone();
    const originalPassword = await hashPassword("transaction-password-123");
    const user = await prisma.user.create({
      data: { name: "Transaction reset target", phone, password: originalPassword },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: `transaction-session-${Date.now()}-${Math.random()}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    const suffix = `${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
    const functionName = `block_session_revoke_${suffix}`;
    const triggerName = `block_session_revoke_trigger_${suffix}`;
    let functionCreated = false;
    let triggerCreated = false;
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      await prisma.$executeRawUnsafe(`
        CREATE FUNCTION "${functionName}"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF OLD."userId" = '${user.id}' THEN
            RAISE EXCEPTION 'forced session revocation failure';
          END IF;
          RETURN OLD;
        END;
        $$;
      `);
      functionCreated = true;

      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE DELETE ON "Session"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"();
      `);
      triggerCreated = true;

      expect((await loginRequest(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      const response = await admin.patch("/api/admin/users", { data: { userId: user.id } });
      expect(response.status()).toBe(500);

      const target = await prisma.user.findUnique({
        where: { id: user.id },
        select: { password: true },
      });
      expect(target?.password).toBe(originalPassword);
      expect(await prisma.session.count({ where: { id: session.id } })).toBe(1);
      expect(await prisma.auditLog.count({
        where: { action: "USER_PASSWORD_RESET", entityId: user.id },
      })).toBe(0);
    } finally {
      await admin.dispose();

      if (triggerCreated) {
        await prisma.$executeRawUnsafe(`DROP TRIGGER "${triggerName}" ON "Session";`);
      }
      if (functionCreated) {
        await prisma.$executeRawUnsafe(`DROP FUNCTION "${functionName}"();`);
      }

      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  test("desktop customer actions use clear business labels and specific confirmations", async ({ page }) => {
    const phone = uniquePhone();
    const user = await prisma.user.create({
      data: {
        name: "Khách kiểm tra thao tác",
        phone,
        password: await hashPassword("customer-actions-123"),
      },
    });
    const contact = await prisma.contactRequest.create({
      data: { name: user.name, phone },
    });

    try {
      await loginPage(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await page.goto("/dashboard/users");
      await page.getByTestId("dashboard-users-search").fill(phone);

      const table = page.locator("table");
      const actionMenu = table.getByTestId("dashboard-user-actions-desktop");
      await expect(actionMenu).toBeVisible();
      await expect(table.getByRole("button", { name: "Nối 1 mục lịch sử cũ vào tài khoản" })).toBeVisible();
      await expect(table.getByRole("button", { name: "Cấp lại mật khẩu" })).toBeVisible();
      await expect(table.getByRole("button", { name: "Đặt điểm về 0" })).toBeVisible();
      await expect(table.getByRole("button", { name: "Xoá tài khoản" })).toBeVisible();

      await table.getByRole("button", { name: "Nối 1 mục lịch sử cũ vào tài khoản" }).click();
      await expect(page.getByRole("heading", { name: "Nối lịch sử cũ vào tài khoản" })).toBeVisible();
      await expect(page.getByText("1 yêu cầu tư vấn", { exact: false })).toBeVisible();
      await expect(page.getByRole("button", { name: "Nối vào tài khoản" })).toBeVisible();
      await page.getByRole("button", { name: "Huỷ" }).click();

      await table.getByRole("button", { name: "Cấp lại mật khẩu" }).click();
      await expect(page.getByRole("heading", { name: "Cấp lại mật khẩu" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cấp mật khẩu tạm" })).toBeVisible();
      await page.getByRole("button", { name: "Huỷ" }).click();

      await table.getByRole("button", { name: "Đặt điểm về 0" }).click();
      await expect(page.getByRole("heading", { name: "Đặt điểm thưởng về 0" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Đặt về 0" })).toBeVisible();
      await page.getByRole("button", { name: "Huỷ" }).click();

      await table.getByRole("button", { name: "Xoá tài khoản" }).click();
      await expect(page.getByRole("heading", { name: "Xoá tài khoản khách hàng" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Xoá vĩnh viễn" })).toBeVisible();
      await page.getByRole("button", { name: "Huỷ" }).click();
    } finally {
      await prisma.contactRequest.deleteMany({ where: { id: contact.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});
