import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const ADMIN_PHONE = process.env.PLAYWRIGHT_ADMIN_PHONE ?? "0987443258";
const ADMIN_PASSWORD = process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "admin123";
const AUTH_REDIRECT_TIMEOUT = 30_000;
const APP_ORIGIN = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`;

function vietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
  }).formatToParts(date);

  return {
    day: parts.find((part) => part.type === "day")?.value ?? "01",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    year: parts.find((part) => part.type === "year")?.value ?? "2026",
  };
}

function vietnamDateText(date = new Date()) {
  const { day, month, year } = vietnamDateParts(date);
  return `${day}/${month}/${year}`;
}

function vietnamDateKey(date = new Date()) {
  const { day, month, year } = vietnamDateParts(date);
  return `${year}-${month}-${day}`;
}

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

async function seedServiceOrder(
  request: APIRequestContext,
  options: { orderDate?: string } = {}
) {
  await loginAdminRequest(request);
  const suffix = Date.now().toString().slice(-8);
  const phone = `09${suffix}`.slice(0, 10).padEnd(10, "1");
  const orderDate = options.orderDate ?? "26/05/2026";
  const response = await request.post("/api/admin/service-orders", {
    data: {
      customerName: `Khách phase2 ${suffix}`,
      customerPhone: phone,
      orderDate,
      paidAmount: 100_000,
      priceStatus: "CONFIRMED",
      productName: `Đơn phase2 ${suffix}`,
      quotedPrice: 500_000,
      service: "KHAC",
      source: "IMPORT",
      sourceName: "Đơn hàng đã bán",
      sourceRow: 2,
      status: "PENDING",
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return { order: body.order as { id: string; productName: string }, orderDate, phone, suffix };
}

async function expectMinTouchHeight(locator: ReturnType<Page["locator"]>, minHeight = 44) {
  const box = await locator.boundingBox();
  expect(box, "interactive control should be visible before measuring").not.toBeNull();
  expect(Math.round(box?.height || 0)).toBeGreaterThanOrEqual(minHeight);
}

test.describe("Admin phase 2 workflows", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90_000);

  test("source Sheet link sends an expired admin session through login and preserves the target", async ({ request }) => {
    const sourcePath = "/api/admin/minhhong-source-sheet-link?scope=partners&target=partners-current";
    const response = await request.get(sourcePath, { maxRedirects: 0 });

    expect(response.status()).toBe(307);
    const location = response.headers().location;
    expect(location).toBeTruthy();
    const loginUrl = new URL(location);
    expect(loginUrl.pathname).toBe("/dang-nhap");
    expect(loginUrl.searchParams.get("redirect")).toBe(sourcePath);

    const localhostUrl = new URL(sourcePath, APP_ORIGIN);
    localhostUrl.hostname = "localhost";
    const canonicalResponse = await request.get(localhostUrl.toString(), { maxRedirects: 0 });
    expect(canonicalResponse.status()).toBe(307);
    const canonicalUrl = new URL(canonicalResponse.headers().location || "");
    expect(canonicalUrl.hostname).toBe("127.0.0.1");
    expect(`${canonicalUrl.pathname}${canonicalUrl.search}`).toBe(sourcePath);

    await loginAdminRequest(request);
    const authenticatedResponse = await request.get(canonicalUrl.toString(), { maxRedirects: 0 });
    expect(authenticatedResponse.status()).toBe(307);
    expect(authenticatedResponse.headers().location).toMatch(
      /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit#gid=\d+$/
    );
  });

  test("admin login returns to a safe requested page", async ({ page }) => {
    await page.goto(`/dang-nhap?redirect=${encodeURIComponent("/dashboard/orders")}`);
    await expect(page.getByTestId("login-page")).toBeVisible();
    await page.getByTestId("login-phone").fill(ADMIN_PHONE);
    await page.getByTestId("login-password").fill(ADMIN_PASSWORD);
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/dashboard\/orders$/, { timeout: AUTH_REDIRECT_TIMEOUT });
  });

  test("partner purchase persists an optional discount as net debt", async ({ request }) => {
    await loginAdminRequest(request);
    const suffix = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 1000)}`;
    const partnerResponse = await request.post("/api/admin/partner-ledger", {
      data: {
        kind: "partner",
        code: `E2E_DISCOUNT_${suffix}`,
        name: `E2E đối tác chiết khấu ${suffix}`,
        type: "SUPPLIER",
      },
    });
    expect(partnerResponse.ok()).toBeTruthy();
    const partner = (await partnerResponse.json()).partner as { id: string };

    const entryResponse = await request.post("/api/admin/partner-ledger", {
      data: {
        description: `E2E hóa đơn chiết khấu ${suffix}`,
        discountPercent: 15,
        entryDate: "26/05/2026",
        entryType: "PURCHASE",
        partnerId: partner.id,
        quantity: 9,
        unit: "món",
        unitPrice: 55_000,
      },
    });
    expect(entryResponse.ok()).toBeTruthy();
    const savedPartner = (await entryResponse.json()).partner as {
      balance: number;
      ledgerEntries: Array<{
        amount: number;
        discountAmount: number;
        discountPercent: number | null;
        description: string;
      }>;
    };
    const savedEntry = savedPartner.ledgerEntries.find((entry) => entry.description.includes(suffix));

    expect(savedEntry).toMatchObject({
      amount: 420_750,
      discountAmount: 74_250,
      discountPercent: 15,
    });
    expect(savedPartner.balance).toBe(420_750);

    const invalidResponse = await request.post("/api/admin/partner-ledger", {
      data: {
        description: `E2E chiết khấu lỗi ${suffix}`,
        discountPercent: "15abc",
        entryDate: "26/05/2026",
        entryType: "PURCHASE",
        partnerId: partner.id,
        quantity: 9,
        unitPrice: 55_000,
      },
    });
    expect(invalidResponse.status()).toBe(400);
  });

  test("partner purchase accepts a full discount with zero net debt", async ({ page, request }) => {
    const partner = await seedPartnerLedger(request, 0);
    const description = `E2E mua hàng giảm toàn bộ ${Date.now()}`;

    await login(page);
    await page.goto("/dashboard/partners");
    await page.getByTestId("partner-search-input").fill(partner.code);
    await expect(page.getByTestId("partner-select")).toHaveValue(partner.id);
    await page.getByTestId("partner-open-entry-selected").click();
    await page.getByTestId("partner-entry-product").fill(description);
    await page.getByTestId("partner-entry-quantity").fill("1");
    await page.getByTestId("partner-entry-unit-price").fill("495k");
    await page.getByTestId("partner-entry-discount").fill("15abc");
    await page.getByTestId("partner-entry-submit").click();
    await expect(page.getByText("Chiết khấu phải nằm trong khoảng 0 đến 100%.")).toBeVisible();
    await expect(page.getByTestId("partner-entry-dialog")).toBeVisible();
    await page.getByTestId("partner-entry-discount").fill("100");
    await expect(page.getByTestId("partner-entry-total")).toContainText("0đ");
    await page.getByTestId("partner-entry-submit").click();

    await expect(page.getByTestId("partner-entry-dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("partner-recent-entries")).toContainText(description);
    await expect(page.getByTestId("partner-recent-entries")).toContainText("CK 100% (-495.000đ)");
  });

  test("partners page uses contextual entry dialog and paginated full history", async ({ page, request }) => {
    const partner = await seedPartnerLedger(request, 15);

    await login(page);
    await page.goto("/dashboard/partners");
    await expect(page.getByTestId("dashboard-partner-ledger")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-import-panel")).toBeVisible();
    await expect(page.getByTestId("dashboard-partner-ledger")).toContainText("Minh Hồng cần trả");
    await expect(page.getByTestId("dashboard-partner-ledger")).toContainText("Tổng tiền mua");
    await expect(page.getByTestId("dashboard-partner-ledger")).toContainText("Đã thanh toán");
    await expect(page.getByTestId("dashboard-partner-ledger")).toContainText("Đã trả hàng");
    await expect(page.getByTestId("dashboard-partner-ledger")).not.toContainText("Tác động lọc");
    await expect(page.getByTestId("dashboard-partner-ledger")).not.toContainText("Đã mua trong lọc");
    await expect(page.getByTestId("dashboard-partner-ledger")).not.toContainText("Chi tiết cách tính");
    await page.getByTestId("partner-search-input").fill(partner.code);
    await expect(page.getByTestId("partner-select")).toHaveValue(partner.id);
    await expect(page.getByRole("heading", { name: partner.name })).toBeVisible();

    await page.getByTestId("partner-open-entry-selected").click();
    const entryDialog = page.getByTestId("partner-entry-dialog");
    await expect(entryDialog).toBeVisible();
    await expect(entryDialog.getByText("Tên mặt hàng")).toBeVisible();
    await expect(page.getByTestId("partner-entry-product")).toBeFocused();
    await page.getByTestId("partner-entry-product").fill("Hóa đơn có chiết khấu");
    await page.getByTestId("partner-entry-quantity").fill("9");
    await page.getByTestId("partner-entry-unit-price").fill("55k");
    await expect(page.getByTestId("partner-entry-gross-total")).toContainText("495.000đ");
    await expect(page.getByTestId("partner-entry-discount-amount")).toContainText("0đ");
    await expect(page.getByTestId("partner-entry-total")).toContainText("495.000đ");
    await page.getByTestId("partner-entry-discount").fill("15");
    await expect(page.getByTestId("partner-entry-gross-total")).toContainText("495.000đ");
    await expect(page.getByTestId("partner-entry-discount-amount")).toContainText("74.250đ");
    await expect(page.getByTestId("partner-entry-total")).toContainText("420.750đ");
    await page.getByTestId("partner-entry-discount").fill("100");
    await expect(page.getByTestId("partner-entry-total")).toContainText("0đ");
    await page.getByTestId("partner-entry-discount").fill("15");
    await page.getByTestId("partner-entry-mode-PAYMENT").click();
    await expect(entryDialog.getByText("Nội dung thanh toán")).toBeVisible();
    await page.getByTestId("partner-entry-mode-RETURN").click();
    await expect(page.getByTestId("partner-entry-product")).toBeFocused();
    await page.getByTestId("partner-entry-product").fill("E2E trả lại phụ kiện");
    await page.getByTestId("partner-entry-quantity").fill("2");
    await page.getByTestId("partner-entry-unit-price").fill("25k");
    await page.getByTestId("partner-entry-unit-price").blur();
    await expect(page.getByTestId("partner-entry-total")).toContainText("50.000đ");
    await page.getByTestId("partner-entry-submit").click();
    await expect(page.getByTestId("partner-entry-dialog")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("partner-recent-entries")).toContainText("Tên mặt hàng / Nội dung thanh toán");
    await expect(page.getByTestId("partner-recent-entries")).toContainText("E2E trả lại phụ kiện");

    await page.getByTestId("partner-open-history").click();
    const historyDialog = page.getByTestId("partner-history-dialog");
    const historyResults = page.getByTestId("partner-history-results");
    await expect(historyDialog).toBeVisible();
    await expect(historyResults).toBeVisible();
    await expect(historyResults.getByRole("columnheader", { name: "Tên mặt hàng / Nội dung thanh toán" })).toBeVisible();
    await expect(historyResults.getByRole("columnheader", { name: "Nội dung", exact: true })).toHaveCount(0);
    await expect(page.getByTestId("partner-history-page-label")).toContainText("Trang 1/2");
    await page.getByTestId("partner-history-time-filter").selectOption("CUSTOM");
    await expect(page.getByTestId("partner-history-from-date")).toBeVisible();
    await expect(page.getByTestId("partner-history-to-date")).toBeVisible();
    await page.getByTestId("partner-history-search").fill("thanh toán");
    await page.getByTestId("partner-history-from-date").fill("2026-05-26");
    await page.getByTestId("partner-history-to-date").fill("2026-05-26");
    await page.getByTestId("partner-history-from-date").locator("..").getByRole("button", { name: "Chọn ngày" }).click();
    await expect(page.getByTestId("vietnamese-date-month-label")).toContainText("Tháng 5/2026");
    await page.getByTestId("vietnamese-date-month-label").click();
    await expect(page.getByTestId("vietnamese-date-month-panel")).toBeVisible();
    await expect(page.getByTestId("vietnamese-date-month-panel")).not.toContainText("2026");
    await expect(page.getByTestId("vietnamese-date-month-7")).toContainText("Tháng 7");
    await page.getByTestId("vietnamese-date-month-label").click();
    await expect(page.getByTestId("vietnamese-date-year-panel")).toBeVisible();
    await expect(page.getByTestId("vietnamese-date-month-label")).toContainText("2020 - 2029");
    await expect(page.getByTestId("vietnamese-date-year-2026")).toContainText("2026");
    await page.getByTestId("vietnamese-date-next").click();
    await expect(page.getByTestId("vietnamese-date-month-label")).toContainText("2030 - 2039");
    await expect(page.getByTestId("vietnamese-date-year-2040")).toContainText("2040");
    await page.getByTestId("vietnamese-date-year-2036").click();
    await expect(page.getByTestId("vietnamese-date-month-panel")).toBeVisible();
    await expect(page.getByTestId("vietnamese-date-month-label")).toContainText("2036");
    await page.getByTestId("vietnamese-date-month-7").click();
    await expect(page.getByTestId("vietnamese-date-month-label")).toContainText("Tháng 7/2036");
    await expect(page.getByTestId("vietnamese-date-weekday-T2")).toContainText("T2");
    await expect(page.getByTestId("vietnamese-date-weekday-CN")).toContainText("CN");
    await expect(page.getByTestId("vietnamese-date-clear")).toContainText("Xoá");
    await expect(page.getByTestId("vietnamese-date-today")).toContainText("Hôm nay");
    await page.keyboard.press("Escape");
    await expect(historyDialog).toContainText("E2E thanh toán");
    await page.getByTestId("partner-history-from-date").fill("2026-05-25");
    await page.getByTestId("partner-history-to-date").fill("2026-05-25");
    await expect(historyDialog).toContainText("Chưa có giao dịch nào khớp bộ lọc.");
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
    await page.getByTestId("partner-entry-close").click();
    await expect(page.getByTestId("partner-entry-dialog")).toBeHidden();

    await page.getByTestId("partner-open-history").click();
    await expect(page.getByTestId("partner-history-dialog")).toBeVisible();
    await expect(page.getByTestId("partner-history-filter-toggle")).toBeVisible();
    await expect(page.getByTestId("partner-history-filter-panel")).toBeHidden();
    await expect(page.getByTestId("partner-history-results")).toBeVisible();
  });

  test("source Sheet preview is stable across repeated reads without writing DB", async ({ page }) => {
    await login(page);
    let setupRequests = 0;
    await page.route("**/api/admin/minhhong-source-sheet-ids*", async (route) => {
      setupRequests += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ success: false, message: "Setup write blocked by the read-only test." }),
      });
    });

    for (const scope of ["service-orders", "partners"] as const) {
      const firstResponse = await page.request.post(`/api/admin/minhhong-import?mode=preview&source=raw-sheet&scope=${scope}`);
      const secondResponse = await page.request.post(`/api/admin/minhhong-import?mode=preview&source=raw-sheet&scope=${scope}`);
      expect(firstResponse.ok()).toBeTruthy();
      expect(secondResponse.ok()).toBeTruthy();
      const firstPreview = await firstResponse.json() as { previewFingerprint?: string };
      const secondPreview = await secondResponse.json() as { previewFingerprint?: string };
      expect(firstPreview.previewFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(secondPreview.previewFingerprint).toBe(firstPreview.previewFingerprint);
    }

    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();

    await page.getByTestId("minhhong-source-sheet-preview").click();

    const summary = page.getByTestId("minhhong-workbook-preview-summary");
    await expect(summary).toContainText("Đơn khách trong Sheet", { timeout: 20_000 });
    await expect(summary).not.toContainText("Ledger đối tác");
    await expect(summary).not.toContainText("Long cần trả");
    await expect(page.getByTestId("minhhong-workbook-blocking-issues")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-workbook-confirm")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-setup-card")).toHaveCount(0);
    expect(setupRequests).toBeLessThanOrEqual(1);
  });

  test("source Sheet preview is read-only and hides technical controls", async ({ page }) => {
    await login(page);
    let sourceIdentityRequests = 0;
    await page.route("**/api/admin/minhhong-source-sheet-ids*", async (route) => {
      sourceIdentityRequests += 1;
      await route.fulfill({ status: 500 });
    });
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      expect(route.request().method()).toBe("POST");
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
          totals: { longPayable: 0, longHistoricalPaid: 0, customerOrderTotal: 100000, customerOrderPaid: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 1, updated: 0, unchanged: 0 },
            conflicts: [],
            records: { partnerEntries: [], serviceOrders: [] },
          },
        }),
      });
    });
    await page.goto("/dashboard/orders");

    await page.getByTestId("minhhong-source-sheet-preview").click();
    await expect(page.getByTestId("minhhong-workbook-preview-report")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-import-panel")).not.toContainText("source_id");
    await expect(page.getByTestId("minhhong-workbook-import-panel")).not.toContainText("fingerprint");
    await expect(page.getByTestId("minhhong-workbook-import-panel")).not.toContainText("HEX");
    await expect(page.getByTestId("minhhong-source-sheet-preparation-note")).toContainText("Kiểm tra chỉ đọc");
    expect(sourceIdentityRequests).toBe(0);
  });

  test("first-time Google Sheet setup completes inside the initial check", async ({ page }) => {
    await login(page);
    let previewRequests = 0;
    let setupRequests = 0;

    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      previewRequests += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          sourceSetup: {
            required: previewRequests === 1,
            ...(previewRequests === 1 ? { fingerprint: "e".repeat(64) } : {}),
          },
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 1, updated: 0, unchanged: 0 },
            conflicts: [],
            records: { partnerEntries: [], serviceOrders: [] },
          },
        }),
      });
    });
    await page.route("**/api/admin/minhhong-source-sheet-ids?scope=*", async (route) => {
      setupRequests += 1;
      expect(route.request().method()).toBe("POST");
      expect(new URL(route.request().url()).searchParams.get("scope")).toBe("service-orders");
      expect(route.request().postDataJSON()).toEqual({ setupFingerprint: "e".repeat(64) });
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ success: true, message: "Google Sheet đã sẵn sàng." }),
      });
    });

    await page.goto("/dashboard/orders");
    await page.getByTestId("minhhong-source-sheet-preview").click();

    const previewSummary = page.getByTestId("minhhong-workbook-preview-summary");
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Cập nhật 1 đơn lên web");
    await expect(previewSummary.getByText("Sẵn sàng áp dụng", { exact: true }).locator("..")).toHaveClass(/bg-green-50/);
    await expect(page.getByTestId("minhhong-source-sheet-setup-card")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-setup")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-workbook-import-panel")).not.toContainText("source_id");
    await expect(page.getByTestId("minhhong-workbook-import-panel")).not.toContainText("fingerprint");
    expect(previewRequests).toBe(2);
    expect(setupRequests).toBe(1);
  });

  test("a Sheet change before update automatically prepares the Sheet and checks again", async ({ page }) => {
    await login(page);
    let previewRequests = 0;
    let setupRequests = 0;

    await page.route("**/api/admin/minhhong-import*", async (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("scope")).toBe("service-orders");
      if (url.searchParams.get("mode") === "confirm") {
        await route.fulfill({
          contentType: "application/json",
          status: 409,
          body: JSON.stringify({
            success: false,
            mode: "confirm",
            message: "Hãy hoàn tất thiết lập Google Sheet trước khi cập nhật dữ liệu lên web.",
            sourceSetup: { required: true },
          }),
        });
        return;
      }

      previewRequests += 1;
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "d".repeat(64),
          sourceSetup: {
            required: previewRequests === 2,
            ...(previewRequests === 2 ? { fingerprint: "e".repeat(64) } : {}),
          },
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 1, updated: 0, unchanged: 0 },
            conflicts: [],
            records: { partnerEntries: [], serviceOrders: [] },
          },
        }),
      });
    });
    await page.route("**/api/admin/minhhong-source-sheet-ids?scope=*", async (route) => {
      setupRequests += 1;
      expect(route.request().postDataJSON()).toEqual({ setupFingerprint: "e".repeat(64) });
      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({ success: true, message: "Google Sheet đã sẵn sàng." }),
      });
    });

    await page.goto("/dashboard/orders");
    await page.getByTestId("minhhong-source-sheet-preview").click();
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Cập nhật 1 đơn lên web");
    await page.getByTestId("minhhong-source-sheet-preview").click();

    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Cập nhật 1 đơn lên web");
    await expect(page.getByTestId("minhhong-source-sheet-setup-card")).toHaveCount(0);
    expect(previewRequests).toBe(3);
    expect(setupRequests).toBe(1);
  });

  test("source Sheet uses the reviewed fingerprint for the two-step check and update flow", async ({ page }) => {
    await login(page);
    let confirmRequests = 0;

    await page.route("**/api/admin/minhhong-import*", async (route) => {
      const url = new URL(route.request().url());
      const mode = url.searchParams.get("mode");
      expect(url.searchParams.get("scope")).toBe("service-orders");

      if (mode === "confirm") {
        confirmRequests += 1;
        expect(url.searchParams.get("previewFingerprint")).toBe("c".repeat(64));
        await route.fulfill({
          contentType: "application/json",
          status: 200,
          body: JSON.stringify({
            success: true,
            mode: "confirm",
            importResult: {
              changes: {
                partners: { created: 0, updated: 0, unchanged: 0 },
                partnerEntries: { created: 0, updated: 0, unchanged: 0 },
                serviceOrders: { created: 1, updated: 0, unchanged: 0 },
              },
            },
            reconciliation: { ok: true, blockingIssues: [], warnings: [] },
            changes: {
              partners: { created: 0, updated: 0, unchanged: 0 },
              partnerEntries: { created: 0, updated: 0, unchanged: 0 },
              serviceOrders: { created: 1, updated: 0, unchanged: 0 },
              conflicts: [],
              records: { partnerEntries: [], serviceOrders: [] },
            },
          }),
        });
        return;
      }

      await route.fulfill({
        contentType: "application/json",
        status: 200,
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          sourceSetup: { required: false },
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 1, updated: 0, unchanged: 0 },
            conflicts: [],
            records: { partnerEntries: [], serviceOrders: [] },
          },
        }),
      });
    });

    await page.goto("/dashboard/orders");
    const action = page.getByTestId("minhhong-source-sheet-preview");
    await action.click();
    await expect(action).toContainText("Cập nhật 1 đơn lên web");

    await action.click();

    await expect(page).toHaveURL(/\/dashboard\/orders/);
    await expect(action).toContainText("Kiểm tra dữ liệu từ Sheet");
    expect(confirmRequests).toBe(1);
  });

  test("a failed preview clears the previous source result and confirmation action", async ({ page }) => {
    await login(page);
    let previewRequests = 0;
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      previewRequests += 1;
      if (previewRequests === 1) {
        await route.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            mode: "preview",
            previewFingerprint: "c".repeat(64),
            sourceSetup: { required: false },
            reconciliation: { ok: true, blockingIssues: [], warnings: [] },
            counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
            totals: { longPayable: 0, longHistoricalPaid: 0, customerOrderTotal: 100000, customerOrderPaid: 0 },
            changes: {
              partners: { created: 0, updated: 0, unchanged: 0 },
              partnerEntries: { created: 0, updated: 0, unchanged: 0 },
              serviceOrders: { created: 0, updated: 0, unchanged: 1 },
              conflicts: [],
              records: { partnerEntries: [], serviceOrders: [] },
            },
          }),
        });
        return;
      }
      await route.fulfill({
        contentType: "application/json",
        status: 409,
        body: JSON.stringify({ success: false, message: "Google Sheet vừa được chỉnh sửa." }),
      });
    });
    await page.goto("/dashboard/orders");
    await page.getByTestId("minhhong-source-sheet-preview").click();
    await expect(page.getByTestId("minhhong-workbook-preview-report")).toBeVisible();
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Kiểm tra lại Sheet");

    await page.getByTestId("minhhong-source-sheet-preview").click();

    await expect(page.getByTestId("minhhong-workbook-preview-report")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Kiểm tra dữ liệu từ Sheet");
    expect(previewRequests).toBe(2);
  });

  test("source Sheet preview shows actionable change counts instead of only reconciliation text", async ({ page }) => {
    await login(page);
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      expect(new URL(route.request().url()).searchParams.get("scope")).toBe("service-orders");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          reconciliation: {
            ok: true,
            blockingIssues: [],
            warnings: [
              "Dòng Excel 19: ngày \"37/1/2026\" đã được tự sửa thành \"27/01/2026\".",
              "Dòng Excel 58: ngày \"7/72026\" đã được tự sửa thành \"07/07/2026\".",
            ],
          },
          counts: { partners: 10, partnerEntries: 80, customerOrders: 41, skippedRows: 0, errors: 0 },
          totals: { longPayable: 12720000, longHistoricalPaid: 60000000, customerOrderTotal: 36825000, customerOrderPaid: 29790000 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 10 },
            partnerEntries: { created: 2, updated: 1, unchanged: 77 },
            serviceOrders: { created: 3, updated: 4, unchanged: 34 },
            conflicts: [],
            records: {
              partnerEntries: [{ action: "created", key: "NHAP_HANG:NH-MOI-0001", label: "Đèn NLMT bc" }],
              serviceOrders: [{ action: "updated", key: "DH-0019", label: "Dòng Excel 19 · Phế liệu qs · Pin15cell" }],
            },
          },
        }),
      });
    });
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();

    await page.getByTestId("minhhong-source-sheet-preview").click();

    await expect(page.getByTestId("minhhong-workbook-preview-toggle")).toContainText("Thu gọn kết quả", { timeout: 15_000 });
    await expectMinTouchHeight(page.getByTestId("minhhong-workbook-preview-toggle"));
    await expect(page.getByTestId("minhhong-workbook-preview-body")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-preview-summary")).toContainText("Đơn khách trong Sheet");
    await expect(page.getByTestId("minhhong-workbook-preview-summary")).not.toContainText("Ledger đối tác");
    await expect(page.getByTestId("minhhong-workbook-change-headline")).toContainText("Báo cáo đơn bán khách");
    await expect(page.getByTestId("minhhong-workbook-change-headline")).toContainText("3 đơn mới");
    await expect(page.getByTestId("minhhong-workbook-change-headline")).toContainText("4 đơn đã sửa");
    await expect(page.getByTestId("minhhong-workbook-change-summary")).not.toContainText("Giao dịch đối tác");
    await expect(page.getByTestId("minhhong-workbook-change-details")).toContainText("DH-0019");
    await expect(page.getByTestId("minhhong-workbook-change-details")).toContainText("Dòng Excel 19");
    await expect(page.getByTestId("minhhong-workbook-change-details")).not.toContainText("Đèn NLMT bc");
    await expect(page.getByTestId("minhhong-source-sheet-date-repair-note")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Cập nhật 7 đơn lên web");
    await expect(page.getByTestId("minhhong-workbook-warnings")).toContainText("Dòng cần kiểm tra trong Sheet");
    await expect(page.getByTestId("minhhong-workbook-warnings")).toContainText("Dòng Excel 19");
    await expect(page.getByTestId("minhhong-workbook-warnings")).toContainText("Dòng Excel 58");
    await expect(page.getByTestId("minhhong-workbook-warnings")).not.toContainText("Đối soát");
    await expectMinTouchHeight(page.getByTestId("minhhong-workbook-preview-collapse-bottom"));
    await page.getByTestId("minhhong-workbook-preview-collapse-bottom").click();
    await expect(page.getByTestId("minhhong-workbook-preview-body")).toBeHidden();
    await expect(page.getByTestId("minhhong-workbook-preview-toggle")).toContainText("Mở kết quả");
  });

  test("import preview groups technical relinks, conflicts, and paginates changed rows", async ({ page }) => {
    await login(page);
    const visibleRecords = Array.from({ length: 11 }, (_, index) => ({
      action: "created",
      key: `DH-PAGE-${index + 1}`,
      label: `Đơn trang ${index + 1}`,
    }));
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 12, skippedRows: 0, errors: 0 },
          totals: { longPayable: 0, longHistoricalPaid: 0, customerOrderTotal: 0, customerOrderPaid: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 11, updated: 1, unchanged: 0 },
            conflicts: [
              "source_id của dòng A đang thuộc một giao dịch khác.",
              "source_id của dòng B đang thuộc một giao dịch khác.",
            ],
            records: {
              partnerEntries: [],
              serviceOrders: [
                ...visibleRecords,
                { action: "updated", key: "DH-RELINK", label: "Đơn chỉ liên kết lại", changes: [] },
              ],
            },
          },
        }),
      });
    });
    await page.goto("/dashboard/orders");
    await page.getByTestId("minhhong-source-sheet-preview").click();

    const conflicts = page.getByTestId("minhhong-workbook-conflicts");
    await expect(conflicts).toContainText("Có xung đột");
    await expect(conflicts).toContainText("2 dòng");
    await expect(conflicts).not.toContainText("source_id");
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toBeDisabled();
    await expect(page.getByTestId("minhhong-workbook-identity-relink-note")).toContainText("1 đơn");
    await expect(page.getByTestId("minhhong-workbook-preview-summary").getByText("Có xung đột", { exact: true }).locator("..")).toHaveClass(/bg-red-50/);

    const details = page.getByTestId("minhhong-workbook-change-details");
    await details.locator("summary").click();
    await expect(page.getByTestId("minhhong-workbook-change-pagination")).toContainText("Trang 1/2");
    await expectMinTouchHeight(page.getByTestId("minhhong-workbook-change-page-previous"));
    await expectMinTouchHeight(page.getByTestId("minhhong-workbook-change-page-next"));
    await expect(details).toContainText("Đơn trang 1");
    await expect(details).not.toContainText("Đơn trang 11");

    await page.getByTestId("minhhong-workbook-change-page-next").click();
    await expect(page.getByTestId("minhhong-workbook-change-pagination")).toContainText("Trang 2/2");
    await expect(details).toContainText("Đơn trang 11");
    await expect(details).not.toContainText("Đơn chỉ liên kết lại");
  });

  test("partner Sheet import previews only partner scope and respects the confirmation gate", async ({ page }) => {
    await login(page);
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      expect(new URL(route.request().url()).searchParams.get("scope")).toBe("partners");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          confirmation: {
            enabled: false,
            message: "Dữ liệu công nợ đối tác đang chờ duyệt.",
          },
          sourceSetup: { required: true },
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 1, partnerEntries: 1, customerOrders: 0, skippedRows: 0, errors: 0 },
          totals: { longPayable: 100000, longHistoricalPaid: 0, customerOrderTotal: 0, customerOrderPaid: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 1 },
            partnerEntries: { created: 1, updated: 0, unchanged: 0 },
            serviceOrders: { created: 0, updated: 0, unchanged: 0 },
            conflicts: [],
            records: {
              partners: [],
              partnerEntries: [{ action: "created", key: "NHAP_HANG:TEST-001", label: "Giao dịch kiểm thử" }],
              serviceOrders: [],
            },
          },
        }),
      });
    });
    await page.goto("/dashboard/partners");

    await expect(page.getByTestId("dashboard-partner-ledger")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-import-panel")).toBeVisible();
    await page.getByTestId("minhhong-source-sheet-preview").click();
    await expect(page.getByTestId("minhhong-workbook-confirmation-gate")).toContainText("chờ duyệt");
    await expect(page.getByTestId("minhhong-source-sheet-setup-card")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toContainText("Chờ duyệt số liệu");
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toBeDisabled();
  });

  test("server rejects combined raw imports before reading a source Sheet", async ({ request }) => {
    await loginAdminRequest(request);

    const response = await request.post("/api/admin/minhhong-import?mode=preview&source=raw-sheet&scope=all");

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: "Hãy chọn một phạm vi cập nhật riêng: đơn bán khách hoặc công nợ đối tác.",
    });
  });

  test("server rejects Google Sheet setup requests without a same-origin browser request", async ({ request }) => {
    await loginAdminRequest(request);

    const response = await request.post(
      "/api/admin/minhhong-source-sheet-ids?scope=service-orders"
    );

    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({
      success: false,
      message: "Yêu cầu không hợp lệ. Hãy thao tác lại từ trang quản trị.",
    });
  });

  test("server rejects Google Sheet setup when the reviewed preview is missing", async ({ request }) => {
    await loginAdminRequest(request);

    const response = await request.post(
      "/api/admin/minhhong-source-sheet-ids?scope=service-orders",
      {
        data: {},
        headers: { Origin: APP_ORIGIN },
      }
    );

    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      message: "Dữ liệu kiểm tra đã cũ. Hãy bấm Kiểm tra dữ liệu rồi thử lại.",
    });
  });

  test("mobile keeps only the main Sheet actions visible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();

    await expect(page.getByTestId("minhhong-workbook-mobile-toggle")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-source-sheet-preview")).toBeVisible();
    await expect(page.getByTestId("minhhong-source-sheet-open")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-fallback")).toHaveCount(0);
    await expect(page.getByTestId("minhhong-workbook-file")).toHaveCount(0);
    await expect(page.getByText("Nhập từ file Excel dự phòng")).toHaveCount(0);
    await expectMinTouchHeight(page.getByTestId("minhhong-source-sheet-preview"));
    await expectMinTouchHeight(page.getByTestId("minhhong-source-sheet-open"));
  });

  test("mobile toast notifications appear at the top instead of covering lower content", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.route("**/api/admin/minhhong-import?mode=preview&source=raw-sheet*", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          mode: "preview",
          previewFingerprint: "c".repeat(64),
          reconciliation: { ok: true, blockingIssues: [], warnings: [] },
          counts: { partners: 0, partnerEntries: 0, customerOrders: 1, skippedRows: 0, errors: 0 },
          totals: { longPayable: 0, longHistoricalPaid: 0, customerOrderTotal: 100000, customerOrderPaid: 0 },
          changes: {
            partners: { created: 0, updated: 0, unchanged: 0 },
            partnerEntries: { created: 0, updated: 0, unchanged: 0 },
            serviceOrders: { created: 1, updated: 0, unchanged: 0 },
            conflicts: [],
            records: { partnerEntries: [], serviceOrders: [{ action: "created", key: "DH-TEST", label: "Dòng Excel 10 · Test" }] },
          },
        }),
      });
    });
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
    await page.getByTestId("minhhong-source-sheet-preview").click();

    const toast = page.getByText(/Google Sheet đã kiểm tra/);
    await expect(toast).toBeVisible();
    const box = await toast.boundingBox();
    expect(box, "toast should be measurable").not.toBeNull();
    expect(Math.round(box?.y || 0)).toBeLessThan(120);
    await page.waitForTimeout(3500);
    await expect(toast).toBeVisible();
  });

  test("orders mobile separates each order card and keeps advanced filters collapsible", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();

    await expect(page.getByTestId("dashboard-orders-filter-panel")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-advanced-filters-panel")).toBeHidden();
    await expectMinTouchHeight(page.getByTestId("dashboard-orders-advanced-filters-toggle"));

    await page.getByTestId("dashboard-orders-advanced-filters-toggle").click();
    await expect(page.getByTestId("dashboard-orders-advanced-filters-panel")).toBeVisible();
    await page.getByTestId("dashboard-orders-advanced-filters-toggle").click();
    await expect(page.getByTestId("dashboard-orders-advanced-filters-panel")).toBeHidden();

    const cards = page.getByTestId("dashboard-order-card");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(2);

    const firstCard = cards.first();
    await expect(firstCard.getByTestId("dashboard-order-card-topline")).toBeVisible();
    await expect(firstCard.getByTestId("dashboard-order-card-end")).toBeVisible();

    const firstBox = await firstCard.boundingBox();
    const secondBox = await cards.nth(1).boundingBox();
    expect(firstBox).not.toBeNull();
    expect(secondBox).not.toBeNull();
    expect(Math.round((secondBox?.y || 0) - (firstBox?.y || 0) - (firstBox?.height || 0))).toBeGreaterThanOrEqual(16);

    const hasPageOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(hasPageOverflow).toBe(false);
  });

  test("service orders no longer expose the advanced single CSV workflow", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();

    await expect(page.getByTestId("dashboard-orders-open-import")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-orders-single-import-panel")).toHaveCount(0);
    await expect(page.getByText("CSV đơn lẻ (nâng cao)")).toHaveCount(0);
  });

  test("web to Sheet sync buttons use page-specific scopes", async ({ page }) => {
    const seenScopes: string[] = [];
    await login(page);
    await page.route("**/api/admin/sheets-sync*", async (route) => {
      const scope = new URL(route.request().url()).searchParams.get("scope") || "";
      seenScopes.push(scope);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          spreadsheetId: "test-sheet",
          spreadsheetUrl: "https://docs.google.com/spreadsheets/d/test-sheet/edit",
          tabs: scope === "partners"
            ? ["WEB_Đơn đối tác"]
            : ["WEB_Đơn hàng"],
          totalUpdatedCells: 10,
        }),
      });
    });

    await page.goto("/dashboard/orders");
    await page.getByRole("button", { name: "Xuất sang Sheet" }).click();
    await page.getByRole("button", { name: "Xuất", exact: true }).click();
    await expect(page.getByText(/tab đơn bán/)).toBeVisible();

    await page.goto("/dashboard/partners");
    await page.getByRole("button", { name: "Xuất sang Sheet" }).click();
    await page.getByRole("button", { name: "Xuất", exact: true }).click();
    await expect(page.getByText(/sổ đối tác/)).toBeVisible();

    expect(seenScopes).toEqual(["service-orders", "partners"]);
  });

  test("orders mobile card actions are readable touch targets", async ({ page, request }) => {
    const { phone } = await seedServiceOrder(request, { orderDate: vietnamDateText() });

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
    await page.getByTestId("dashboard-orders-search-input").fill(phone);
    await expect(page.getByText(phone).last()).toBeVisible();

    const editButton = page.getByTestId("dashboard-order-edit-button").first();
    await editButton.scrollIntoViewIfNeeded();
    await expectMinTouchHeight(editButton);
    await expectMinTouchHeight(page.locator('select[title="Cập nhật trạng thái"]').first());
    await expectMinTouchHeight(page.getByRole("button", { name: /khách/i }).first());
    await expectMinTouchHeight(page.locator('input[title="Cập nhật số tiền đã thu"]').first());
    await expectMinTouchHeight(page.getByRole("button", { name: "Ghi thu" }).first());
    await expectMinTouchHeight(page.getByRole("button", { name: "Thu đủ" }).first());
    await expectMinTouchHeight(page.getByRole("button", { name: "Xoá" }).first());
  });

  test("dashboard financial summary includes confirmed-order receivables", async ({ page, request }) => {
    await seedServiceOrder(request, { orderDate: vietnamDateText() });

    const ordersResponse = await request.get("/api/admin/service-orders");
    expect(ordersResponse.ok()).toBeTruthy();
    const { orders } = await ordersResponse.json() as {
      orders: Array<{
        discountAmount: number | null;
        paidAmount: number | null;
        priceStatus: string;
        quotedPrice: number | null;
      }>;
    };
    const expectedDebt = orders.reduce((total, order) => {
      if (order.priceStatus !== "CONFIRMED") return total;
      return total + Math.max((order.quotedPrice ?? 0) - (order.discountAmount ?? 0) - (order.paidAmount ?? 0), 0);
    }, 0);

    expect(expectedDebt).toBeGreaterThan(0);
    await login(page);
    await page.goto("/dashboard");

    const debtCard = page.getByText("Còn phải thu", { exact: true }).locator("..");
    await expect(debtCard).toContainText(`${expectedDebt.toLocaleString("vi-VN")}đ`);
  });

  test("orders edit drawer saves without jumping to the create form", async ({ page, request }) => {
    const orderDate = vietnamDateText();
    const orderDateKey = vietnamDateKey();
    const { phone, suffix } = await seedServiceOrder(request, { orderDate });
    const updatedProduct = `Đơn phase2 đã sửa ${suffix}`;

    await login(page);
    await page.goto("/dashboard/orders");
    await expect(page.getByTestId("dashboard-service-orders")).toBeVisible();
    await expect(page.getByTestId("minhhong-workbook-import-panel")).toBeVisible();
    await expect(page.getByTestId("dashboard-service-orders")).toContainText("Bộ lọc đơn hàng");
    await page.getByTestId("dashboard-orders-search-input").fill(phone);
    await expect(page.getByText(phone).last()).toBeVisible();

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
    await expect(page.locator("span").filter({ hasText: "Dòng gốc:" }).first()).toBeVisible();
    await expect(page.locator("strong").filter({ hasText: "Đơn hàng đã bán · dòng 2" }).first()).toBeVisible();

    await page.getByTestId("dashboard-orders-time-filter").selectOption("THIS_MONTH");
    await expect(page.getByText(updatedProduct)).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-from-date-filter")).toHaveCount(0);
    await expect(page.getByTestId("dashboard-orders-to-date-filter")).toHaveCount(0);
    await page.getByTestId("dashboard-orders-time-filter").selectOption("CUSTOM");
    await expect(page.getByTestId("dashboard-orders-date-range")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-from-date-filter")).toBeVisible();
    await expect(page.getByTestId("dashboard-orders-to-date-filter")).toBeVisible();
    await expect(page.locator('input[type="date"], input[type="month"]')).toHaveCount(0);
    await page.getByTestId("dashboard-orders-from-date-filter").fill("2000-01-01");
    await page.getByTestId("dashboard-orders-to-date-filter").fill("2000-01-01");
    await expect(page.getByTestId("dashboard-orders-active-filter-chips")).toContainText("Tìm:");
    await expect(page.getByTestId("dashboard-orders-active-filter-chips")).toContainText("Thời gian: Tùy chọn");
    await expect(page.getByText("Chưa có đơn nào khớp bộ lọc.")).toBeVisible();
    await page.getByTestId("dashboard-orders-advanced-filters-toggle").click();
    await expect(page.getByTestId("dashboard-orders-source-filter")).toBeVisible();
    await page.getByTestId("dashboard-orders-from-date-filter").fill(orderDateKey);
    await page.getByTestId("dashboard-orders-to-date-filter").fill(orderDateKey);
    await expect(page.getByText(updatedProduct)).toBeVisible();
  });
});
