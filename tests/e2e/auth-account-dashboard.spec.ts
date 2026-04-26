import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const AUTH_REDIRECT_TIMEOUT = 30_000;

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
  test.setTimeout(60_000);

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
    test.setTimeout(120_000);

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

    await expect(page).toHaveURL(/\/tai-khoan/, { timeout: AUTH_REDIRECT_TIMEOUT });
    await expect(page.getByTestId("account-page")).toBeVisible();
    await expect(page.getByTestId("account-name")).toContainText(name);
    await expect(page.getByText("Hồ sơ khách hàng")).toBeVisible();
    await expect(page.getByText("Yêu cầu đã gửi")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Phiếu Bảo Hành" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Điểm Thưởng & Giới Thiệu" })).toBeVisible();
    await expect(page.getByText("Link mời bạn bè")).toBeVisible();
    await expect(page.getByTestId("account-referral-count")).toContainText("0");
    await expect(page.getByTestId("account-status-panel")).toBeVisible();
    await expect(page.getByTestId("account-request-history")).toBeVisible();

    await loginAdminRequest(request);
    const couponResponse = await request.post("/api/admin/coupons", {
      data: {
        code: couponCode,
        description: "Ưu đãi e2e cho tài khoản khách hàng",
        discount: "5%",
        pointsCost: 0,
        usageLimit: 2,
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
    await expect(page.getByTestId("account-referral-link")).toHaveValue(/\/dang-ky\?ref=MH/, {
      timeout: 15_000,
    });

    await page.getByTestId("account-warranty-serial").fill(`MH-MISSING-${Date.now()}`);
    await page.getByTestId("account-warranty-lookup").click();
    await expect(page.getByTestId("account-warranty-lookup")).toBeEnabled({ timeout: 15_000 });
    await expect(page.getByTestId("account-warranty-message")).toContainText("Không tìm thấy", {
      timeout: 15_000,
    });
    await page.getByTestId("account-warranty-serial").fill(serialNo);
    await page.getByTestId("account-warranty-lookup").click();
    await expect(page.getByTestId("account-warranty-result")).toContainText("Pin test Phase 5");

    const couponCard = page
      .getByTestId("account-coupon-list")
      .locator("> div")
      .filter({ hasText: couponCode });
    await couponCard.getByTestId("account-coupon-redeem").click();
    await expect(page.getByTestId("account-coupon-message")).toContainText("Đổi thành công", {
      timeout: AUTH_REDIRECT_TIMEOUT,
    });
    await expect(page.getByTestId("account-coupon-owned").filter({ hasText: couponCode })).toBeVisible();
    const adminCouponsResponse = await request.get("/api/admin/coupons");
    expect(adminCouponsResponse.ok()).toBeTruthy();
    const adminCouponsBody = await adminCouponsResponse.json();
    const redeemedCoupon = adminCouponsBody.coupons.find((coupon: { code: string }) => coupon.code === couponCode);
    expect(
      redeemedCoupon?.redemptions?.some((redemption: { user: { phone: string } }) => (
        redemption.user.phone === phone
      ))
    ).toBeTruthy();

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

  test("coupon with multiple uses remains available for different customers", async ({ baseURL, request }) => {
    const unique = Date.now().toString().slice(-8);
    const couponCode = `E2EMULTI${unique}`;
    const apiBaseURL = baseURL ?? "http://127.0.0.1:3001";
    let firstUserId: string | undefined;
    let secondUserId: string | undefined;
    const firstCustomer = await playwrightRequest.newContext({ baseURL: apiBaseURL });
    const secondCustomer = await playwrightRequest.newContext({ baseURL: apiBaseURL });

    await loginAdminRequest(request);
    const couponResponse = await request.post("/api/admin/coupons", {
      data: {
        code: couponCode,
        description: "Coupon e2e cho nhiều khách cùng nhận.",
        discount: "20%",
        pointsCost: 0,
        usageLimit: 2,
        active: true,
      },
    });
    expect(couponResponse.ok()).toBeTruthy();
    const couponBody = await couponResponse.json();
    const couponId = couponBody.coupon?.id as string | undefined;
    expect(couponId).toBeTruthy();

    try {
      const firstRegister = await firstCustomer.post("/api/auth/register", {
        data: {
          name: "Coupon Multi One",
          phone: buildUniquePhone(),
          password: "123456",
        },
      });
      expect(firstRegister.ok()).toBeTruthy();
      firstUserId = (await firstRegister.json()).user?.id as string | undefined;

      const firstRedeem = await firstCustomer.post("/api/coupons/redeem", {
        data: { couponId },
      });
      expect(firstRedeem.ok()).toBeTruthy();

      const secondRegister = await secondCustomer.post("/api/auth/register", {
        data: {
          name: "Coupon Multi Two",
          phone: buildUniquePhone(),
          password: "123456",
        },
      });
      expect(secondRegister.ok()).toBeTruthy();
      secondUserId = (await secondRegister.json()).user?.id as string | undefined;

      const secondRedeem = await secondCustomer.post("/api/coupons/redeem", {
        data: { couponId },
      });
      expect(secondRedeem.ok()).toBeTruthy();

      const adminCouponsResponse = await request.get("/api/admin/coupons");
      expect(adminCouponsResponse.ok()).toBeTruthy();
      const adminCouponsBody = await adminCouponsResponse.json();
      const redeemedCoupon = adminCouponsBody.coupons.find((coupon: { code: string }) => (
        coupon.code === couponCode
      ));
      expect(redeemedCoupon?.usedCount).toBe(2);
      expect(redeemedCoupon?._count?.redemptions).toBe(2);
    } finally {
      if (couponId) {
        await request.delete("/api/admin/coupons", { data: { id: couponId } });
      }
      if (firstUserId) {
        await request.delete("/api/admin/users", { data: { userId: firstUserId } });
      }
      if (secondUserId) {
        await request.delete("/api/admin/users", { data: { userId: secondUserId } });
      }
      await firstCustomer.dispose();
      await secondCustomer.dispose();
    }
  });

  test("admin can sign in and open the dashboard health widgets", async ({ page }) => {
    await login(page, ADMIN_PHONE, ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-crm-overview")).toBeVisible();
    await expect(page.getByTestId("dashboard-action-queue")).toBeVisible();
    await expect(page.getByTestId("dashboard-chatbot-health")).toBeVisible();
  });

  test("admin can scan and filter the customer CRM list", async ({ page }) => {
    await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

    await page.goto("/dashboard/users");
    await expect(page.getByTestId("dashboard-users-crm")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-metrics")).toBeVisible();

    await page.getByTestId("dashboard-users-search").fill(ADMIN_PHONE);
    await page.getByTestId("dashboard-users-role-filter").selectOption("ADMIN");
    await expect(page.getByTestId("dashboard-users-result-count")).toContainText("1 /");
    await expect(page.getByTestId("dashboard-user-row")).toHaveCount(1);
    await expect(page.getByTestId("dashboard-user-row")).toContainText(ADMIN_PHONE);

    await page.getByTestId("dashboard-users-sort").selectOption("points");
    await expect(page.getByTestId("dashboard-user-row")).toContainText(ADMIN_PHONE);
  });

  test("admin can triage the warranty CRM list", async ({ page, request }) => {
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await loginAdminRequest(request);
    const warrantyResponse = await request.post("/api/admin/warranty", {
      data: {
        productName: "Pin CRM warranty E2E",
        customerPhone: ADMIN_PHONE,
        service: "DONG_PIN",
        endDate,
        notes: "Warranty CRM e2e can be found by serial and expiry filters.",
      },
    });
    expect(warrantyResponse.ok()).toBeTruthy();
    const warrantyBody = await warrantyResponse.json();
    const warrantyId = warrantyBody.warranty?.id as string | undefined;
    const serialNo = warrantyBody.warranty?.serialNo as string | undefined;
    const generatedSerialNo = serialNo || "";
    expect(generatedSerialNo).toMatch(/^MH-BH-\d{8}-[A-F0-9]{6}$/);

    try {
      await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

      await page.goto("/dashboard/warranty");
      await expect(page.getByTestId("dashboard-warranty-crm")).toBeVisible();
      await expect(page.getByTestId("dashboard-warranty-metrics")).toBeVisible();

      await page.getByTestId("dashboard-warranty-search").fill(generatedSerialNo);
      await page.getByTestId("dashboard-warranty-status-filter").selectOption("expiring");
      await page.getByTestId("dashboard-warranty-service-filter").selectOption("DONG_PIN");
      await expect(page.getByTestId("dashboard-warranty-result-count")).toContainText("1 /");
      await expect(page.getByTestId("dashboard-warranty-card")).toHaveCount(1);
      await expect(page.getByTestId("dashboard-warranty-card")).toContainText(generatedSerialNo);

      await page.getByTestId("dashboard-warranty-sort").selectOption("customer");
      await expect(page.getByTestId("dashboard-warranty-card")).toContainText("Pin CRM warranty E2E");
    } finally {
      if (warrantyId) {
        await request.delete("/api/admin/warranty", { data: { id: warrantyId } });
      }
    }
  });

  test("admin can moderate the reviews queue", async ({ page, request }) => {
    const unique = Date.now().toString().slice(-8);
    const comment = `Review CRM E2E ${unique}`;

    await loginAdminRequest(request);
    const reviewResponse = await request.post("/api/reviews", {
      data: {
        rating: 5,
        comment,
        service: "DONG_PIN",
      },
    });
    expect(reviewResponse.ok()).toBeTruthy();
    const reviewBody = await reviewResponse.json();
    const reviewId = reviewBody.review?.id as string | undefined;

    try {
      await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

      await page.goto("/dashboard/reviews");
      await expect(page.getByTestId("dashboard-reviews-moderation")).toBeVisible();
      await expect(page.getByTestId("dashboard-reviews-metrics")).toBeVisible();

      await page.getByTestId("dashboard-reviews-search").fill(comment);
      await page.getByTestId("dashboard-reviews-status-filter").selectOption("pending");
      await page.getByTestId("dashboard-reviews-service-filter").selectOption("DONG_PIN");
      await page.getByTestId("dashboard-reviews-rating-filter").selectOption("5");
      await expect(page.getByTestId("dashboard-reviews-result-count")).toContainText("1 /");
      await expect(page.getByTestId("dashboard-review-card")).toHaveCount(1);
      await expect(page.getByTestId("dashboard-review-card")).toContainText(comment);

      await page.getByTestId("dashboard-reviews-sort").selectOption("ratingHigh");
      await expect(page.getByTestId("dashboard-review-card")).toContainText("Chờ duyệt");
    } finally {
      if (reviewId) {
        await request.delete("/api/admin/reviews", { data: { id: reviewId } });
      }
    }
  });

  test("admin can filter the coupon rewards CRM list", async ({ page, request }) => {
    const unique = Date.now().toString().slice(-8);
    const couponCode = `E2ECPN${unique}`;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("vi-VN");

    await loginAdminRequest(request);
    const couponResponse = await request.post("/api/admin/coupons", {
      data: {
        code: couponCode,
        description: "Coupon CRM e2e can be found by code and status filters.",
        discount: "15%",
        pointsCost: 77,
        usageLimit: 3,
        expiresAt,
      },
    });
    expect(couponResponse.ok()).toBeTruthy();
    const couponBody = await couponResponse.json();
    const couponId = couponBody.coupon?.id as string | undefined;

    try {
      await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

      await page.goto("/dashboard/coupons");
      await expect(page.getByTestId("dashboard-coupons-crm")).toBeVisible();
      await expect(page.getByTestId("dashboard-coupons-metrics")).toBeVisible();

      await page.getByTestId("dashboard-coupons-search").fill(couponCode);
      await page.getByTestId("dashboard-coupons-status-filter").selectOption("active");
      await expect(page.getByTestId("dashboard-coupons-result-count")).toContainText("1 /");
      await expect(page.getByTestId("dashboard-coupon-card")).toHaveCount(1);
      await expect(page.getByTestId("dashboard-coupon-card")).toContainText(couponCode);

      await page.getByTestId("dashboard-coupons-sort").selectOption("points");
      await expect(page.getByTestId("dashboard-coupon-card")).toContainText("77 điểm");
    } finally {
      if (couponId) {
        await request.delete("/api/admin/coupons", { data: { id: couponId } });
      }
    }
  });

  test("admin can filter the pricing CMS list", async ({ page, request }) => {
    const unique = Date.now().toString().slice(-8);
    const itemName = `Pricing CRM E2E ${unique}`;

    await loginAdminRequest(request);
    const pricingResponse = await request.post("/api/admin/pricing", {
      data: {
        category: "CAMERA",
        name: itemName,
        price: "123.000",
        unit: "VNĐ",
        description: "Pricing CRM e2e can be found by search and category filters.",
        note: "E2E pricing note",
        sortOrder: 99,
        active: true,
      },
    });
    expect(pricingResponse.ok()).toBeTruthy();
    const pricingBody = await pricingResponse.json();
    const pricingId = pricingBody.item?.id as string | undefined;

    try {
      await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

      await page.goto("/dashboard/pricing");
      await expect(page.getByTestId("dashboard-pricing-crm")).toBeVisible();
      await expect(page.getByTestId("dashboard-pricing-metrics")).toBeVisible();

      await page.getByTestId("dashboard-pricing-search").fill(itemName);
      await page.getByTestId("dashboard-pricing-category-filter").selectOption("CAMERA");
      await expect(page.getByTestId("dashboard-pricing-result-count")).toContainText("1 /");
      await expect(page.getByTestId("dashboard-pricing-item")).toHaveCount(1);
      await expect(page.getByTestId("dashboard-pricing-item")).toContainText(itemName);

      await page.getByTestId("dashboard-pricing-sort").selectOption("name");
      await expect(page.getByTestId("dashboard-pricing-item")).toContainText("123.000");
    } finally {
      if (pricingId) {
        await request.delete("/api/admin/pricing", { data: { id: pricingId } });
      }
    }
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
      await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

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

      await page.getByTestId("dashboard-contact-detail-open").click();
      const drawer = page.getByTestId("dashboard-contact-detail-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("Hành động đề xuất");

      await drawer.getByTestId("dashboard-contact-detail-status-IN_PROGRESS").click();
      await expect(drawer).toContainText("Đang xử lý");

      const crmNote = `Ghi chú CRM ${unique}`;
      await drawer.getByRole("button", { name: "Sửa" }).click();
      await drawer.getByTestId("dashboard-contact-detail-notes").fill(crmNote);
      await drawer.getByTestId("dashboard-contact-detail-save-notes").click();
      await expect(drawer).toContainText(crmNote);

      await page.getByTestId("dashboard-contact-detail-close").click();
      await expect(drawer).toBeHidden();

      await page.getByTestId("dashboard-contacts-search").fill(`missing-${unique}`);
      await expect(page.getByTestId("dashboard-contacts-empty")).toBeVisible();
    } finally {
      if (contactId) {
        try {
          await request.delete(`/api/contact/${contactId}`);
        } catch {
          // Best-effort cleanup; dev server restarts should not fail the CRM assertions.
        }
      }
    }
  });
});
