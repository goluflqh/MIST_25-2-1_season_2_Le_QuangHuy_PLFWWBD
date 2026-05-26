import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const AUTH_REDIRECT_TIMEOUT = 30_000;

async function login(page: Page) {
  await page.goto("/dang-nhap");
  await expect(page.getByTestId("login-page")).toBeVisible();
  await page.getByTestId("login-phone").fill(ADMIN_PHONE);
  await page.getByTestId("login-password").fill(ADMIN_PASSWORD);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });
}

async function loginAdminRequest(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });
  expect(response.ok()).toBeTruthy();
}

async function seedPartnerLedger(
  request: APIRequestContext,
  purchaseCount = 15,
  options: { code?: string; entryDate?: string; name?: string } = {}
) {
  await loginAdminRequest(request);
  const suffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
  const entryDate = options.entryDate ?? "26/05/2026";
  const partnerResponse = await request.post("/api/admin/partner-ledger", {
    data: {
      kind: "partner",
      code: options.code ?? `E2E_${suffix}`,
      name: options.name ?? `E2E Đối tác ${suffix}`,
      notes: "Đối tác kiểm thử phase 2",
      type: "SUPPLIER",
    },
  });
  expect(partnerResponse.ok()).toBeTruthy();
  const partnerBody = await partnerResponse.json();
  const partner = partnerBody.partner as { id: string; name: string; code: string };

  for (let index = 0; index < purchaseCount; index += 1) {
    const response = await request.post("/api/admin/partner-ledger", {
      data: {
        amount: 100_000 + index * 1_000,
        description: `E2E mua hàng ${suffix}-${index}`,
        entryDate,
        entryType: "PURCHASE",
        partnerId: partner.id,
        quantity: 1,
        unit: "món",
        unitPrice: 100_000 + index * 1_000,
        reference: `E2E-NH-${index}`,
      },
    });
    expect(response.ok()).toBeTruthy();
  }

  for (const entry of [
    { amount: 200_000, description: `E2E thanh toán ${suffix}`, entryType: "PAYMENT", paymentMethod: "CK", reference: "E2E-TT" },
    { amount: 50_000, description: `E2E trả hàng ${suffix}`, entryType: "RETURN", reference: "E2E-TH", quantity: 1, unit: "món", unitPrice: 50_000 },
  ]) {
    const response = await request.post("/api/admin/partner-ledger", {
      data: {
        ...entry,
        entryDate,
        partnerId: partner.id,
      },
    });
    expect(response.ok()).toBeTruthy();
  }

  return partner;
}

async function seedServiceOrder(request: APIRequestContext) {
  await loginAdminRequest(request);
  const suffix = Date.now().toString().slice(-8);
  const phone = `09${suffix}`.slice(0, 10).padEnd(10, "1");
  const response = await request.post("/api/admin/service-orders", {
    data: {
      customerName: `Khách phase2 ${suffix}`,
      customerPhone: phone,
      orderDate: "26/05/2026",
      paidAmount: 100_000,
      priceStatus: "CONFIRMED",
      productName: `Đơn phase2 ${suffix}`,
      quotedPrice: 500_000,
      service: "KHAC",
      source: "PHONE",
      status: "PENDING",
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return { order: body.order as { id: string; productName: string }, phone, suffix };
}

test.describe("Admin phase 2 workflows", () => {
  test.setTimeout(90_000);

  test("partners page uses contextual entry dialog and paginated full history", async ({ page, request }) => {
    const partner = await seedPartnerLedger(request, 15);

    await login(page);
    await page.goto("/dashboard/partners");
    await expect(page.getByTestId("dashboard-partner-ledger")).toBeVisible();
    await page.getByTestId("partner-search-input").fill(partner.code);
    await expect(page.getByTestId("partner-select")).toHaveValue(partner.id);
    await expect(page.getByRole("heading", { name: partner.name })).toBeVisible();

    await page.getByTestId("partner-open-entry-selected").click();
    await expect(page.getByTestId("partner-entry-dialog")).toBeVisible();
    await expect(page.getByTestId("partner-entry-product")).toBeFocused();
    await page.getByTestId("partner-entry-mode-RETURN").click();
    await expect(page.getByTestId("partner-entry-product")).toBeFocused();
    await page.getByTestId("partner-entry-product").fill("E2E trả lại phụ kiện");
    await page.getByTestId("partner-entry-quantity").fill("2");
    await page.getByTestId("partner-entry-unit-price").fill("25k");
    await page.getByTestId("partner-entry-unit-price").blur();
    await expect(page.getByTestId("partner-entry-total")).toContainText("50.000đ");
    await page.getByTestId("partner-entry-submit").click();
    await expect(page.getByTestId("partner-entry-dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("partner-recent-entries")).toContainText("E2E trả lại phụ kiện");

    await page.getByTestId("partner-open-history").click();
    await expect(page.getByTestId("partner-history-dialog")).toBeVisible();
    await expect(page.getByTestId("partner-history-page-label")).toContainText("Trang 1 / 2");
    await page.getByTestId("partner-history-search").fill("thanh toán");
    await page.getByTestId("partner-history-exact-date").fill("2026-05-26");
    await expect(page.getByTestId("partner-history-dialog")).toContainText("E2E thanh toán");
    await page.getByTestId("partner-history-exact-date").fill("2026-05-25");
    await expect(page.getByTestId("partner-history-dialog")).toContainText("Chưa có giao dịch nào khớp bộ lọc.");
  });

  test("partners search auto-selects the filtered result and add form focuses first field", async ({ page, request }) => {
    const oldPartner = await seedPartnerLedger(request, 1, { code: `E2E_OLD_${Date.now()}`, name: `ZZZ đối tác cũ ${Date.now()}` });
    const targetPartner = await seedPartnerLedger(request, 1, { code: `E2E_TARGET_${Date.now()}`, name: `AAA đối tác cần chọn ${Date.now()}` });

    await login(page);
    await page.goto("/dashboard/partners");
    await expect(page.getByTestId("dashboard-partner-ledger")).toBeVisible();
    await page.getByTestId("partner-select").selectOption(oldPartner.id);
    await expect(page.getByRole("heading", { name: oldPartner.name })).toBeVisible();

    await page.getByTestId("partner-search-input").fill(targetPartner.code);
    await expect(page.getByTestId("partner-select")).toHaveValue(targetPartner.id);
    await expect(page.getByRole("heading", { name: targetPartner.name })).toBeVisible();

    await page.getByTestId("partner-add-button").click();
    await expect(page.getByTestId("partner-form-name")).toBeFocused();
  });

  test("partners mobile layout has no page overflow and keeps bottom-sheet controls reachable", async ({ page, request }) => {
    const partner = await seedPartnerLedger(request, 3);

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/dashboard/partners");
    await page.getByTestId("partner-search-input").fill(partner.code);
    await expect(page.getByTestId("partner-select")).toHaveValue(partner.id);

    const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasPageOverflow).toBe(false);

    await page.getByTestId("partner-open-entry-selected").click();
    await expect(page.getByTestId("partner-entry-dialog")).toBeVisible();
    await expect(page.getByTestId("partner-entry-close")).toBeVisible();
    const dialogWidth = await page.getByTestId("partner-entry-dialog").evaluate((element) => element.getBoundingClientRect().width);
    expect(dialogWidth).toBeLessThanOrEqual(390);
  });

  test("orders edit drawer saves without jumping to the create form", async ({ page, request }) => {
    const { phone, suffix } = await seedServiceOrder(request);
    const updatedProduct = `Đơn phase2 đã sửa ${suffix}`;

    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
    await page.getByTestId("dashboard-orders-search-input").fill(phone);
    await expect(page.getByText(phone)).toBeVisible();

    await page.getByTestId("dashboard-order-edit-button").first().click();
    await expect(page.getByTestId("dashboard-order-product-input")).toBeVisible();
    await page.getByTestId("dashboard-order-product-input").fill(updatedProduct);
    await page.getByTestId("dashboard-order-quoted-price-input").fill("1000k");
    await page.getByTestId("dashboard-order-quoted-price-input").blur();
    await expect(page.getByTestId("dashboard-order-quoted-price-input")).toHaveValue("1.000.000");
    await page.getByTestId("dashboard-order-save-button").click();

    await expect(page.getByTestId("dashboard-order-product-input")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText(updatedProduct)).toBeVisible();
    await expect(page.getByText("1.000.000đ").first()).toBeVisible();

    await page.getByTestId("dashboard-orders-month-filter").fill("2026-05");
    await expect(page.getByText(updatedProduct)).toBeVisible();
    await page.getByTestId("dashboard-orders-exact-date-filter").fill("2026-05-25");
    await expect(page.getByText("Chưa có đơn nào khớp bộ lọc.")).toBeVisible();
    await page.getByTestId("dashboard-orders-exact-date-filter").fill("2026-05-26");
    await page.getByTestId("dashboard-orders-from-date-filter").fill("2026-05-26");
    await page.getByTestId("dashboard-orders-to-date-filter").fill("2026-05-26");
    await expect(page.getByText(updatedProduct)).toBeVisible();
  });
});
