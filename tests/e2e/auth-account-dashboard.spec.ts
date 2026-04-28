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

  test("auth forms can reveal and hide password text", async ({ page }) => {
    await page.goto("/dang-nhap");
    await page.getByTestId("login-password").fill("admin123");
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "password");
    await page.getByTestId("login-password-toggle").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "text");
    await page.getByTestId("login-password-toggle").click();
    await expect(page.getByTestId("login-password")).toHaveAttribute("type", "password");

    await page.goto("/dang-ky");
    await page.getByTestId("register-password").fill("123456");
    await expect(page.getByTestId("register-password")).toHaveAttribute("type", "password");
    await page.getByTestId("register-password-toggle").click();
    await expect(page.getByTestId("register-password")).toHaveAttribute("type", "text");
    await page.getByTestId("register-password-toggle").click();
    await expect(page.getByTestId("register-password")).toHaveAttribute("type", "password");
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
    const orderResponse = await request.post("/api/admin/service-orders", {
      data: {
        contactRequestId: contactBody.id,
        customerName: name,
        customerPhone: phone,
        customerVisible: true,
        issueDescription: "Yeu cau hoan thanh de danh gia trong e2e.",
        paidAmount: "500000",
        productName: "Pin test Phase 5",
        quotedPrice: "500000",
        service: "DONG_PIN",
        source: "CONTACT",
        status: "COMPLETED",
        warrantyMonths: "6",
      },
    });
    expect(orderResponse.ok()).toBeTruthy();
    const orderBody = await orderResponse.json();
    const orderId = orderBody.order?.id as string | undefined;

    await page.reload();
    await expect(page.getByText(serialNo)).toBeVisible();
    await expect(page.getByText(couponCode)).toBeVisible();

    await page.getByTestId("account-referral-generate").click();
    await expect(page.getByTestId("account-referral-link")).toHaveValue(/\/dang-ky\?ref=MH/, {
      timeout: 15_000,
    });

    await expect(page.getByTestId("account-warranty-lookup")).toHaveCount(0);

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
    await expect(page.getByTestId("account-review-submit")).toBeDisabled();

    await page.getByRole("button", { name: /Chờ đánh giá/ }).click();
    await page.getByTestId("account-review-from-request").click();
    await expect(page.getByTestId("account-review-service")).toHaveValue("DONG_PIN");
    await expect(page.getByTestId("account-review-submit")).toBeEnabled();
    await page.getByTestId("account-review-submit").click();
    await expect(page.getByText(/Cảm ơn bạn đã đánh giá/)).toBeVisible({
      timeout: AUTH_REDIRECT_TIMEOUT,
    });

    await page.getByRole("button", { name: /Bảo mật đăng nhập/ }).click();
    await expect(page.getByText("Kiểm tra trước khi đổi")).toBeVisible();

    if (orderId) {
      await request.delete("/api/admin/service-orders", { data: { id: orderId } });
    }
    await request.delete(`/api/contact/${contactBody.id}`).catch(() => undefined);
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

  test("redeemed coupon follows a contact into a service order payment", async ({ baseURL, page, request }) => {
    test.setTimeout(120_000);

    const unique = Date.now().toString().slice(-8);
    const couponCode = `E2EPAY${unique}`;
    const customerName = `Coupon Payment ${unique}`;
    const customerPhone = buildUniquePhone();
    const apiBaseURL = baseURL ?? "http://127.0.0.1:3001";
    const customerContext = await playwrightRequest.newContext({ baseURL: apiBaseURL });
    let contactId: string | undefined;
    let orderId: string | undefined;
    let userId: string | undefined;

    await loginAdminRequest(request);
    const couponResponse = await request.post("/api/admin/coupons", {
      data: {
        code: couponCode,
        description: "Coupon e2e follows contact into service order.",
        discount: "10%",
        pointsCost: 0,
        usageLimit: 1,
        active: true,
      },
    });
    expect(couponResponse.ok()).toBeTruthy();
    const couponBody = await couponResponse.json();
    const couponId = couponBody.coupon?.id as string | undefined;
    expect(couponId).toBeTruthy();

    try {
      const registerResponse = await customerContext.post("/api/auth/register", {
        data: {
          name: customerName,
          phone: customerPhone,
          password: "123456",
        },
      });
      expect(registerResponse.ok()).toBeTruthy();
      userId = (await registerResponse.json()).user?.id as string | undefined;

      const redeemResponse = await customerContext.post("/api/coupons/redeem", {
        data: { couponId },
      });
      expect(redeemResponse.ok()).toBeTruthy();

      const ownedCouponsResponse = await customerContext.get("/api/coupons/owned");
      expect(ownedCouponsResponse.ok()).toBeTruthy();
      const ownedCouponsBody = await ownedCouponsResponse.json();
      const redemption = ownedCouponsBody.coupons.find((coupon: { code: string }) => coupon.code === couponCode);
      expect(redemption?.redemptionId).toBeTruthy();

      const contactResponse = await customerContext.post("/api/contact", {
        data: {
          name: customerName,
          phone: customerPhone,
          service: "DONG_PIN",
          message: "Customer wants to apply coupon to this service request.",
          source: "account-e2e",
          couponRedemptionId: redemption.redemptionId,
        },
      });
      expect(contactResponse.ok()).toBeTruthy();
      contactId = (await contactResponse.json()).id as string | undefined;
      expect(contactId).toBeTruthy();

      await login(page, customerPhone, "123456");
      await expect(page).toHaveURL(/\/tai-khoan/, { timeout: AUTH_REDIRECT_TIMEOUT });
      await expect(page.getByTestId("account-coupon-pending")).toContainText(couponCode);

      const orderResponse = await request.post("/api/admin/service-orders", {
        data: {
          contactRequestId: contactId,
          couponRedemptionId: redemption.id,
          customerName,
          customerPhone,
          customerVisible: true,
          issueDescription: "Apply coupon e2e request.",
          paidAmount: "200000",
          productName: "Pin coupon payment e2e",
          quotedPrice: "1000000",
          service: "DONG_PIN",
          source: "CONTACT",
          status: "CONTACTED",
          warrantyMonths: "0",
        },
      });
      expect(orderResponse.ok()).toBeTruthy();
      const orderBody = await orderResponse.json();
      orderId = orderBody.order?.id as string | undefined;
      expect(orderId).toBeTruthy();
      expect(orderBody.order.couponCode).toBe(couponCode);
      expect(orderBody.order.quotedPrice).toBe(1_000_000);
      expect(orderBody.order.discountAmount).toBe(100_000);
      expect(orderBody.order.paidAmount).toBe(200_000);

      const paymentResponse = await request.patch("/api/admin/service-orders", {
        data: {
          id: orderId,
          paidAmount: "900000",
          status: "COMPLETED",
        },
      });
      expect(paymentResponse.ok()).toBeTruthy();
      const paymentBody = await paymentResponse.json();
      expect(paymentBody.order.discountAmount).toBe(100_000);
      expect(paymentBody.order.paidAmount).toBe(900_000);

      const contactsResponse = await request.get("/api/contact");
      expect(contactsResponse.ok()).toBeTruthy();
      const contactsBody = await contactsResponse.json();
      const syncedContact = contactsBody.contacts.find((contact: { id: string }) => contact.id === contactId);
      expect(syncedContact?.status).toBe("COMPLETED");

      await page.reload();
      await page.getByRole("button", { name: /Đã mua/ }).click();
      await expect(page.getByTestId("account-service-orders")).toContainText("Pin coupon payment e2e");
      await expect(page.getByTestId("account-service-orders")).toContainText(couponCode);
      await expect(page.getByTestId("account-service-orders")).toContainText("900.000");
      if (await page.getByTestId("account-coupon-list").count()) {
        await expect(page.getByTestId("account-coupon-list")).not.toContainText(couponCode);
      }
    } finally {
      if (orderId) {
        await request.delete("/api/admin/service-orders", { data: { id: orderId } }).catch(() => undefined);
      }
      if (contactId) {
        await request.delete(`/api/contact/${contactId}`).catch(() => undefined);
      }
      if (couponId) {
        await request.delete("/api/admin/coupons", { data: { id: couponId } }).catch(() => undefined);
      }
      if (userId) {
        await request.delete("/api/admin/users", { data: { userId } }).catch(() => undefined);
      }
      await customerContext.dispose();
    }
  });

  test("admin can sign in and open the dashboard health widgets", async ({ page }) => {
    await login(page, ADMIN_PHONE, ADMIN_PASSWORD);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });
    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-crm-overview")).toBeVisible();
    await expect(page.getByTestId("dashboard-action-queue")).toBeVisible();
    await expect(page.getByTestId("dashboard-chatbot-health")).toBeVisible();

    await page.getByTestId("dashboard-open-orders").click();
    await expect(page).toHaveURL(/\/dashboard\/orders/, { timeout: AUTH_REDIRECT_TIMEOUT });
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-source-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-account-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-payment-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-warranty-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-coupon-filter")).toBeVisible();
  });

  test("admin can scan and filter the customer CRM list", async ({ page }) => {
    await login(page, ADMIN_PHONE, ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: AUTH_REDIRECT_TIMEOUT });

    await page.goto("/dashboard/users");
    await expect(page.getByTestId("dashboard-users-crm")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-metrics")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-origin-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-debt-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-warranty-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-users-recent-order-filter")).toBeVisible();

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

  test("admin can archive and recreate a linked service-order warranty", async ({ request }) => {
    const unique = Date.now().toString().slice(-8);
    const customerPhone = buildUniquePhone();
    let warrantyId: string | undefined;

    await loginAdminRequest(request);
    const orderResponse = await request.post("/api/admin/service-orders", {
      data: {
        customerName: `Warranty Archive ${unique}`,
        customerPhone,
        customerVisible: true,
        issueDescription: "Completed order for warranty archive e2e.",
        paidAmount: "100000",
        productName: `Pin warranty archive ${unique}`,
        quotedPrice: "100000",
        service: "DONG_PIN",
        source: "MANUAL",
        status: "COMPLETED",
        warrantyMonths: "6",
      },
    });
    expect(orderResponse.ok()).toBeTruthy();
    const orderBody = await orderResponse.json();
    const orderId = orderBody.order?.id as string | undefined;
    warrantyId = orderBody.order?.warranty?.id as string | undefined;
    expect(orderId).toBeTruthy();
    expect(warrantyId).toBeTruthy();

    try {
      const deleteWarrantyResponse = await request.delete("/api/admin/warranty", {
        data: { id: warrantyId },
      });
      expect(deleteWarrantyResponse.ok()).toBeTruthy();

      const ordersAfterDeleteResponse = await request.get("/api/admin/service-orders");
      expect(ordersAfterDeleteResponse.ok()).toBeTruthy();
      const ordersAfterDeleteBody = await ordersAfterDeleteResponse.json();
      const orderAfterDelete = ordersAfterDeleteBody.orders.find((order: { id: string }) => order.id === orderId);
      expect(orderAfterDelete?.warranty).toBeNull();
      expect(orderAfterDelete?.warrantyEndDate).toBeNull();

      const recreateWarrantyResponse = await request.post("/api/admin/warranty", {
        data: { serviceOrderId: orderId, warrantyMonths: "6" },
      });
      expect(recreateWarrantyResponse.ok()).toBeTruthy();
      const recreateWarrantyBody = await recreateWarrantyResponse.json();
      expect(recreateWarrantyBody.created).toBeTruthy();
      warrantyId = recreateWarrantyBody.warranty?.id as string | undefined;
      expect(warrantyId).toBeTruthy();

      const ordersAfterRecreateResponse = await request.get("/api/admin/service-orders");
      expect(ordersAfterRecreateResponse.ok()).toBeTruthy();
      const ordersAfterRecreateBody = await ordersAfterRecreateResponse.json();
      const orderAfterRecreate = ordersAfterRecreateBody.orders.find((order: { id: string }) => order.id === orderId);
      expect(orderAfterRecreate?.warranty?.id).toBe(warrantyId);
      expect(orderAfterRecreate?.warrantyEndDate).toBeTruthy();
    } finally {
      if (warrantyId) {
        await request.delete("/api/admin/warranty", { data: { id: warrantyId } }).catch(() => undefined);
      }
      if (orderId) {
        await request.delete("/api/admin/service-orders", { data: { id: orderId } }).catch(() => undefined);
      }
    }
  });

  test("contact status creates the matching order status and archives warranty on rollback", async ({ request }) => {
    const unique = Date.now().toString().slice(-8);
    const customerName = `Status Map ${unique}`;
    const customerPhone = buildUniquePhone();
    let orderId: string | undefined;

    await loginAdminRequest(request);
    const contactResponse = await request.post("/api/contact", {
      data: {
        name: customerName,
        phone: customerPhone,
        service: "DONG_PIN",
        message: "Contact status should map into a service order status.",
        source: "account-e2e",
      },
    });
    expect(contactResponse.ok()).toBeTruthy();
    const contactId = (await contactResponse.json()).id as string | undefined;
    expect(contactId).toBeTruthy();

    try {
      const contactStatusResponse = await request.patch(`/api/contact/${contactId}`, {
        data: { status: "CONTACTED" },
      });
      expect(contactStatusResponse.status()).toBe(409);
      const blockedContactStatusBody = await contactStatusResponse.json();
      expect(blockedContactStatusBody.code).toBe("SERVICE_ORDER_REQUIRED");

      const orderResponse = await request.post("/api/admin/service-orders", {
        data: {
          contactRequestId: contactId,
          customerName,
          customerPhone,
          customerVisible: true,
          issueDescription: "Order should not fall back to received.",
          orderDate: "15/01/2026",
          paidAmount: "0",
          productName: `Pin status mapping ${unique}`,
          quotedPrice: "600000",
          service: "DONG_PIN",
          source: "CONTACT",
          status: "CONTACTED",
          warrantyMonths: "6",
        },
      });
      expect(orderResponse.ok()).toBeTruthy();
      const orderBody = await orderResponse.json();
      orderId = orderBody.order?.id as string | undefined;
      expect(orderId).toBeTruthy();
      expect(orderBody.order?.status).toBe("CONTACTED");
      expect(orderBody.order?.warranty).toBeNull();

      const linkedContactStatusResponse = await request.patch(`/api/contact/${contactId}`, {
        data: { status: "IN_PROGRESS" },
      });
      expect(linkedContactStatusResponse.ok()).toBeTruthy();
      const orderAfterContactPatchResponse = await request.get("/api/admin/service-orders");
      expect(orderAfterContactPatchResponse.ok()).toBeTruthy();
      const orderAfterContactPatchBody = await orderAfterContactPatchResponse.json();
      const orderAfterContactPatch = orderAfterContactPatchBody.orders.find((order: { id: string }) => order.id === orderId);
      expect(orderAfterContactPatch?.status).toBe("IN_PROGRESS");

      const completedResponse = await request.patch("/api/admin/service-orders", {
        data: { id: orderId, status: "COMPLETED" },
      });
      expect(completedResponse.ok()).toBeTruthy();
      const completedBody = await completedResponse.json();
      expect(completedBody.order?.warranty?.id).toBeTruthy();
      expect(new Date(completedBody.order?.warrantyEndDate).getUTCFullYear()).toBe(2026);
      expect(new Date(completedBody.order?.warrantyEndDate).getUTCMonth()).toBe(6);

      const rollbackResponse = await request.patch("/api/admin/service-orders", {
        data: { id: orderId, status: "IN_PROGRESS" },
      });
      expect(rollbackResponse.ok()).toBeTruthy();
      const rollbackBody = await rollbackResponse.json();
      expect(rollbackBody.order?.warranty).toBeNull();
      expect(rollbackBody.order?.warrantyEndDate).toBeNull();
    } finally {
      if (orderId) {
        await request.delete("/api/admin/service-orders", { data: { id: orderId } }).catch(() => undefined);
      }
      if (contactId) {
        await request.delete(`/api/contact/${contactId}`).catch(() => undefined);
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
        referrer: "http://localhost:3001/e2e/crm",
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
      await expect(page.getByText("Kênh quảng cáo: crm-e2e")).toHaveCount(0);
      await expect(page.getByText("Trang khách mở: Đường dẫn /e2e/crm")).toHaveCount(0);
      await expect(page.getByText("Trang giới thiệu: localhost")).toHaveCount(0);
      await expect(page.getByText("Nguồn: Chatbot tư vấn camera")).toBeVisible();

      await page.getByTestId("dashboard-contacts-source-filter").selectOption("chatbot-camera");
      await expect(page.getByText(name)).toBeVisible();

      await page.getByTestId("dashboard-contacts-sort").selectOption("priority");
      await expect(page.getByText(name)).toBeVisible();

      await page.getByTestId("dashboard-contact-detail-open").click();
      const drawer = page.getByTestId("dashboard-contact-detail-drawer");
      await expect(drawer).toBeVisible();
      await expect(drawer).toContainText("Hành động đề xuất");

      const crmNote = `Ghi chú CRM ${unique}`;
      await drawer.getByRole("button", { name: "Sửa" }).click();
      await drawer.getByTestId("dashboard-contact-detail-notes").fill(crmNote);
      await drawer.getByTestId("dashboard-contact-detail-save-notes").click();
      await expect(drawer).toContainText(crmNote);

      await page.getByTestId("dashboard-contact-detail-close").click();
      await expect(drawer).toBeHidden();

      await page.getByTestId("dashboard-contacts-search").fill(`missing-${unique}`);
      await expect(page.getByTestId("dashboard-contacts-empty")).toBeVisible();

      await page.getByTestId("dashboard-contacts-search").fill(phone);
      await expect(page.getByTestId("dashboard-contact-card")).toHaveCount(1);
      await page.getByTestId("dashboard-contact-detail-open").click();
      await expect(drawer).toBeVisible();
      await drawer.getByTestId("dashboard-contact-detail-status-IN_PROGRESS").click();
      await expect(page).toHaveURL(/\/dashboard\/orders\?.*source=CONTACT/, { timeout: AUTH_REDIRECT_TIMEOUT });
      await expect(page).toHaveURL(/status=IN_PROGRESS/);
      await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
      await expect(page.getByTestId("dashboard-order-customer-name-input")).toHaveValue(name);
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
