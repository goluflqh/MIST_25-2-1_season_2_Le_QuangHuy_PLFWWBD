import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1_000)}`;
const phone = `09${uniqueSuffix.slice(-8)}`;
const serialNo = `PUBLIC-${uniqueSuffix}`;
const serialSuffix = serialNo.slice(-4);
const productName = "Pin lithium kiểm thử công khai";
const customerName = "Khách hàng không được công khai";

test.describe("Public warranty lookup", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await prisma.warranty.create({
      data: {
        serialNo,
        productName,
        customerName,
        customerPhone: phone,
        service: "DONG_PIN",
        startDate: new Date("2026-01-15T00:00:00.000Z"),
        endDate: new Date("2027-08-15T00:00:00.000Z"),
        notes: "Ghi chú nội bộ không được công khai",
      },
    });
  });

  test.afterAll(async () => {
    await prisma.warranty.deleteMany({ where: { serialNo } });
    await prisma.$disconnect();
  });

  test("uses POST and returns only masked, minimal data with no-store", async ({ request }) => {
    const legacyGet = await request.get(
      `/api/warranty/lookup?phone=${encodeURIComponent(phone)}&serial=${encodeURIComponent(serialNo)}`
    );
    expect(legacyGet.status()).toBe(405);

    const response = await request.post("/api/warranty/lookup", {
      data: { phone },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");

    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      lookupType: "phone",
      total: 1,
      hasMore: false,
    });
    expect(body.warranties).toHaveLength(1);
    expect(body.warranties[0]).toEqual({
      maskedSerial: expect.stringMatching(new RegExp(`${serialSuffix}$`)),
      productName,
      service: "Đóng pin",
      status: "active",
      expiryMonth: 8,
      expiryYear: 2027,
    });

    const serializedBody = JSON.stringify(body);
    expect(serializedBody).not.toContain(serialNo);
    expect(serializedBody).not.toContain(customerName);
    expect(serializedBody).not.toContain(phone);
    expect(serializedBody).not.toContain("Ghi chú nội bộ");
    for (const forbiddenKey of [
      "id",
      "serialNo",
      "customerName",
      "customerPhone",
      "notes",
      "startDate",
      "endDate",
    ]) {
      expect(body.warranties[0]).not.toHaveProperty(forbiddenKey);
    }
  });

  test("offers a fast, accessible phone-only lookup on desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tra-cuu-bao-hanh");

    await expect(
      page.getByRole("heading", { name: "Tra cứu bảo hành bằng số điện thoại" })
    ).toBeVisible();
    const phoneInput = page.getByRole("textbox", { name: "Số điện thoại" });
    await expect(phoneInput).toHaveAttribute("type", "tel");
    await expect(phoneInput).toHaveAttribute("inputmode", "tel");
    await expect(phoneInput).toHaveAttribute("autocomplete", "tel");

    await phoneInput.fill(`${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`);
    await page.getByRole("button", { name: "Tra cứu bảo hành" }).click();

    await expect(page.getByRole("heading", { name: "1 phiếu bảo hành" })).toBeVisible();
    await expect(page.getByText(productName)).toBeVisible();
    await expect(page.getByText("Còn bảo hành")).toBeVisible();
    await expect(page.getByText("tháng 08, 2027")).toBeVisible();
    await expect(page.getByText(serialNo, { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true
    );
  });
});
