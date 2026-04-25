import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";

function buildUniquePhone() {
  const timestamp = Date.now().toString().slice(-5);
  const randomSuffix = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");

  return `09${timestamp}${randomSuffix}`;
}

async function login(page: Page, phone: string, password: string) {
  await page.goto("/dang-nhap");
  await expect(page.getByTestId("login-page")).toBeVisible();

  await page.getByTestId("login-phone").fill(phone);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

async function loginAdminRequest(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: { phone: ADMIN_PHONE, password: ADMIN_PASSWORD },
  });

  expect(response.ok()).toBeTruthy();
}

test.describe("Auth, account and dashboard smoke", () => {
  test("redirects guests away from protected account and dashboard pages", async ({ page }) => {
    await page.goto("/tai-khoan");
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByTestId("login-page")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("stale session cookie does not trap guests in an auth redirect loop", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: "session_token",
        value: "stale-e2e-session-token",
        url: baseURL ?? "http://127.0.0.1:3001",
      },
    ]);

    await page.goto("/dang-ky");
    await expect(page).toHaveURL(/\/dang-ky/);
    await expect(page.getByTestId("register-page")).toBeVisible();

    await page.goto("/tai-khoan");
    await expect(page).toHaveURL(/\/dang-nhap/, { timeout: 15_000 });
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("guest can register a new account, land on account page and log out", async ({ page, request }) => {
    const name = "Khach Test Phase 5";
    const phone = buildUniquePhone();
    const serialNo = `MH-E2E-${Date.now()}`;
    const couponCode = `E2E${Date.now().toString().slice(-8)}`;

    await page.goto("/dang-ky");
    await expect(page.getByTestId("register-page")).toBeVisible();

    await page.getByTestId("register-name").fill(name);
    await page.getByTestId("register-phone").fill(phone);
    await page.getByTestId("register-password").fill("123456");
    await page.getByTestId("register-submit").click();

    await expect(page).toHaveURL(/\/tai-khoan/, { timeout: 15_000 });
    await expect(page.getByTestId("account-page")).toBeVisible();
    await expect(page.getByTestId("account-name")).toContainText(name);
    await expect(page.getByText("Hồ sơ khách hàng")).toBeVisible();
    await expect(page.getByText("Yêu cầu đã gửi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phiếu Bảo Hành" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Điểm Thưởng & Giới Thiệu" })).toBeVisible();
    await expect(page.getByTestId("account-status-panel")).toBeVisible();
    await expect(page.getByTestId("account-request-history")).toBeVisible();

    await loginAdminRequest(request);
    const couponResponse = await request.post("/api/admin/coupons", {
      data: {
        code: couponCode,
        description: "Ưu đãi e2e cho tài khoản khách hàng",
        discount: "5%",
        pointsCost: 0,
        usageLimit: 1,
        active: true,
      },
    });
    expect(couponResponse.ok()).toBeTruthy();
    const couponBody = await couponResponse.json();

    const warrantyResponse = await request.post("/api/admin/warranty", {
      data: {
        serialNo,
        productName: "Pin test Phase 5",
        customerPhone: phone,
        service: "DONG_PIN",
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Bảo hành e2e Phase 5",
      },
    });
    expect(warrantyResponse.ok()).toBeTruthy();
    const warrantyBody = await warrantyResponse.json();

    const contactResponse = await request.post("/api/contact", {
      data: {
        name,
        phone,
        service: "DONG_PIN",
        message: "Yêu cầu hoàn thành để đánh giá trong e2e.",
        source: "account-e2e",
      },
    });
    expect(contactResponse.ok()).toBeTruthy();
    const contactBody = await contactResponse.json();
    const contactUpdateResponse = await request.patch(`/api/contact/${contactBody.id}`, {
      data: { status: "COMPLETED" },
    });
    expect(contactUpdateResponse.ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByText(serialNo)).toBeVisible();
    await expect(page.getByText(couponCode)).toBeVisible();

    await page.getByTestId("account-referral-generate").click();
    await expect(page.getByTestId("account-referral-link")).toHaveValue(/\/dang-ky\?ref=MH/);

    await page.getByTestId("account-warranty-serial").fill(`MH-MISSING-${Date.now()}`);
    await page.getByTestId("account-warranty-lookup").click();
    await expect(page.getByTestId("account-warranty-message")).toContainText("Không tìm thấy");
    await page.getByTestId("account-warranty-serial").fill(serialNo);
    await page.getByTestId("account-warranty-lookup").click();
    await expect(page.getByTestId("account-warranty-result")).toContainText("Pin test Phase 5");

    await page.getByTestId("account-coupon-redeem").click();
    await expect(page.getByTestId("account-coupon-message")).toContainText("Đổi thành công");
    await expect(page.getByTestId("account-coupon-owned")).toContainText(couponCode);

    await page.getByTestId("account-request-toggle").click();
    await expect(page.getByTestId("account-request-submit")).toBeDisabled();
    await page.getByTestId("account-request-service").selectOption("DONG_PIN");
    await expect(page.getByTestId("account-request-submit")).toBeEnabled();

    await page.getByTestId("account-review-toggle").click();
    await expect(page.getByTestId("account-review-submit")).toBeDisabled();
    await page.getByTestId("account-review-service").selectOption("DONG_PIN");
    await page.getByTestId("account-review-comment").fill("Dịch vụ tư vấn rõ ràng, phản hồi nhanh.");
    await expect(page.getByTestId("account-review-submit")).toBeEnabled();

    await page.getByTestId("account-review-from-request").click();
    await expect(page.getByTestId("account-review-service")).toHaveValue("DONG_PIN");

    await page.getByRole("button", { name: /Bảo mật đăng nhập/ }).click();
    await expect(page.getByText("Kiểm tra trước khi đổi")).toBeVisible();

    await request.delete(`/api/contact/${contactBody.id}`);
    if (warrantyBody.warranty?.id) {
      await request.delete("/api/admin/warranty", { data: { id: warrantyBody.warranty.id } });
    }
    if (couponBody.coupon?.id) {
      await request.delete("/api/admin/coupons", { data: { id: couponBody.coupon.id } });
    }

    await page.getByTestId("account-logout").click();
    await expect(page).toHaveURL(/\/dang-nhap/, { timeout: 15_000 });
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("admin can sign in and open the dashboard health widgets", async ({ page }) => {
    await login(page, ADMIN_PHONE, ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-chatbot-health")).toBeVisible();
  });

  test("admin can search and filter the contacts CRM list", async ({ page, request }) => {
    const unique = Date.now().toString().slice(-8);
    const name = `CRM Lead ${unique}`;
    const phone = buildUniquePhone();

    await loginAdminRequest(request);
    const contactResponse = await request.post("/api/contact", {
      data: {
        name,
        phone,
        service: "CAMERA",
        message: "Lead CRM e2e can be found by search and source filters.",
        source: "chatbot-camera",
        sourcePath: "/e2e/crm",
        utmSource: "crm-e2e",
      },
    });
    expect(contactResponse.ok()).toBeTruthy();
    const contactBody = await contactResponse.json();
    const contactId = contactBody.id as string | undefined;

    try {
      await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

      await page.goto("/dashboard/contacts");
      await expect(page.getByTestId("dashboard-contacts-crm")).toBeVisible();
      await expect(page.getByTestId("dashboard-contacts-metrics")).toBeVisible();

      await page.getByTestId("dashboard-contacts-search").fill(phone);
      await expect(page.getByTestId("dashboard-contacts-result-count")).toContainText("1 /");
      await expect(page.getByTestId("dashboard-contact-card")).toHaveCount(1);
      await expect(page.getByText(name)).toBeVisible();

      await page.getByTestId("dashboard-contacts-source-filter").selectOption("chatbot-camera");
      await expect(page.getByText(name)).toBeVisible();

      await page.getByTestId("dashboard-contacts-sort").selectOption("priority");
      await expect(page.getByText(name)).toBeVisible();

      await page.getByTestId("dashboard-contacts-search").fill(`missing-${unique}`);
      await expect(page.getByTestId("dashboard-contacts-empty")).toBeVisible();
    } finally {
      if (contactId) {
        await request.delete(`/api/contact/${contactId}`);
      }
    }
  });
});
