import { expect, test, type Page } from "@playwright/test";

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

test.describe("Auth, account and dashboard smoke", () => {
  test("redirects guests away from protected account and dashboard pages", async ({ page }) => {
    await page.goto("/tai-khoan");
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByTestId("login-page")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dang-nhap/);
    await expect(page.getByTestId("login-page")).toBeVisible();
  });

  test("guest can register a new account, land on account page and log out", async ({ page }) => {
    const name = "Khach Test Phase 5";
    const phone = buildUniquePhone();

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
    await expect(page.getByTestId("account-request-history")).toBeVisible();

    await page.getByRole("button", { name: /Bảo mật đăng nhập/ }).click();
    await expect(page.getByText("Kiểm tra trước khi đổi")).toBeVisible();

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
});
