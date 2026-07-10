import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../lib/auth";

const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const prisma = new PrismaClient();

function buildUniquePhone() {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1_000)}`.slice(-8);
  return `09${suffix}`;
}

async function login(context: APIRequestContext, phone: string, password: string) {
  return context.post("/api/auth/login", { data: { phone, password } });
}

async function getSessionToken(context: APIRequestContext) {
  const storageState = await context.storageState();
  return storageState.cookies.find((cookie) => cookie.name === "session_token")?.value;
}

async function createStaleSessionContext(baseURL: string, token: string) {
  return playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { Cookie: `session_token=${token}` },
  });
}

test.describe("Backend hardening", () => {
  test.setTimeout(180_000);

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("logout revokes the server-side session token", async ({ baseURL }) => {
    const phone = buildUniquePhone();
    const password = "logout-test-123";
    const user = await prisma.user.create({
      data: { name: "Logout security test", phone, password: await hashPassword(password) },
    });
    const context = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await login(context, phone, password)).status()).toBe(200);
      const token = await getSessionToken(context);
      expect(token).toBeTruthy();
      expect(await prisma.session.findUnique({ where: { token: token! } })).toBeTruthy();

      expect((await context.post("/api/auth/logout")).status()).toBe(200);
      expect(await getSessionToken(context)).toBeUndefined();
      expect(await prisma.session.findUnique({ where: { token: token! } })).toBeNull();

      const staleContext = await createStaleSessionContext(baseURL!, token!);
      try {
        expect((await staleContext.get("/api/auth/me")).status()).toBe(401);
      } finally {
        await staleContext.dispose();
      }
    } finally {
      await context.dispose();
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("password change atomically revokes every existing session", async ({ baseURL }) => {
    const phone = buildUniquePhone();
    const oldPassword = "old-password-123";
    const newPassword = "new-password-456";
    const user = await prisma.user.create({
      data: { name: "Password security test", phone, password: await hashPassword(oldPassword) },
    });
    const firstContext = await playwrightRequest.newContext({ baseURL });
    const secondContext = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await login(firstContext, phone, oldPassword)).status()).toBe(200);
      expect((await login(secondContext, phone, oldPassword)).status()).toBe(200);
      const firstToken = await getSessionToken(firstContext);
      const secondToken = await getSessionToken(secondContext);
      expect(firstToken).toBeTruthy();
      expect(secondToken).toBeTruthy();
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

      const changeResponse = await firstContext.patch("/api/user/password", {
        data: { currentPassword: oldPassword, newPassword },
      });
      expect(changeResponse.status()).toBe(200);
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

      for (const token of [firstToken!, secondToken!]) {
        const staleContext = await createStaleSessionContext(baseURL!, token);
        try {
          expect((await staleContext.get("/api/auth/me")).status()).toBe(401);
        } finally {
          await staleContext.dispose();
        }
      }

      const loginContext = await playwrightRequest.newContext({ baseURL });
      try {
        expect((await login(loginContext, phone, oldPassword)).status()).toBe(401);
        expect((await login(loginContext, phone, newPassword)).status()).toBe(200);
      } finally {
        await loginContext.dispose();
      }
    } finally {
      await firstContext.dispose();
      await secondContext.dispose();
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("concurrent admin loyalty adjustments do not overwrite each other", async ({ baseURL }) => {
    const phone = buildUniquePhone();
    const user = await prisma.user.create({
      data: {
        name: "Concurrent loyalty test",
        phone,
        password: await hashPassword("loyalty-test-123"),
      },
    });
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await login(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);
      const responses = await Promise.all([
        admin.patch("/api/admin/loyalty", {
          data: { userId: user.id, points: 10, reason: "Concurrent adjustment A" },
        }),
        admin.patch("/api/admin/loyalty", {
          data: { userId: user.id, points: 15, reason: "Concurrent adjustment B" },
        }),
      ]);

      expect(responses.every((response) => response.status() === 200)).toBeTruthy();
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.loyaltyPoints).toBe(25);
    } finally {
      await admin.dispose();
      await prisma.auditLog.deleteMany({ where: { entityId: user.id } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });

  test("admin mutation routes reject invalid booleans, integers, and oversized imports", async ({ baseURL }) => {
    const admin = await playwrightRequest.newContext({ baseURL });

    try {
      expect((await login(admin, ADMIN_PHONE, ADMIN_PASSWORD)).status()).toBe(200);

      expect((await admin.patch("/api/admin/reviews", {
        data: { id: "invalid-review", approved: "true" },
      })).status()).toBe(400);

      expect((await admin.patch("/api/admin/loyalty", {
        data: { userId: "invalid-user", points: 1.5, setExact: false },
      })).status()).toBe(400);
      expect((await admin.patch("/api/admin/loyalty", {
        data: { userId: "invalid-user", points: 1, setExact: "false" },
      })).status()).toBe(400);

      expect((await admin.post("/api/admin/pricing", {
        data: { category: "PIN", name: "Invalid", price: "100.000", active: "false" },
      })).status()).toBe(400);
      expect((await admin.post("/api/admin/pricing", {
        data: { category: "PIN", name: "Invalid", price: "100.000", sortOrder: "1.5" },
      })).status()).toBe(400);

      const oversizedWorkbook = Buffer.alloc(10 * 1024 * 1024 + 1);
      expect((await admin.post("/api/admin/minhhong-import?mode=preview&source=workbook", {
        data: oversizedWorkbook,
        headers: {
          "content-type": "application/octet-stream",
          "x-workbook-name": "oversized.xlsx",
        },
      })).status()).toBe(413);
    } finally {
      await admin.dispose();
    }
  });

  test("cleanup endpoint fails closed for an undefined bearer value", async ({ request }) => {
    const response = await request.post("/api/admin/cleanup", {
      headers: { Authorization: "Bearer undefined" },
    });
    expect(response.ok()).toBeFalsy();
  });
});
