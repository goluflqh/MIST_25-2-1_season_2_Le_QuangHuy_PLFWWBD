import { expect, test } from "@playwright/test";

test.describe("Public accessibility", () => {
  test("provides a skip link, labelled auth fields, and keyboard-safe disclosures", async ({
    page,
  }) => {
    await page.goto("/dang-nhap");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Chuyển đến nội dung chính" });
    await expect(skipLink).toBeFocused();
    await skipLink.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    // Start the form assertions from a clean navigation after the hash-link focus check.
    await page.goto("/dang-nhap");

    const phone = page.getByRole("textbox", { name: "Số Điện Thoại" });
    await expect(phone).toHaveAttribute("name", "phone");
    await expect(phone).toHaveAttribute("autocomplete", "tel");
    await expect(page.getByTestId("login-password")).toHaveAttribute("autocomplete", "current-password");

    const forgotPassword = page.getByRole("button", { name: "Quên mật khẩu?" });
    await forgotPassword.click();
    await expect(forgotPassword).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("login-forgot-help")).toBeVisible();

    const servicesButton = page.getByRole("button", { name: "Dịch Vụ" });
    await servicesButton.click();
    await expect(servicesButton).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(servicesButton).toBeFocused();
    await expect(servicesButton).toHaveAttribute("aria-expanded", "false");

    await page.goto("/dang-ky");
    await expect(page.getByLabel("Họ và Tên")).toHaveAttribute("autocomplete", "name");
    await expect(page.getByLabel("Số Điện Thoại")).toHaveAttribute("autocomplete", "tel");
    await expect(page.getByTestId("register-password")).toHaveAttribute("autocomplete", "new-password");
  });

  test("moves focus into the mobile navigation and restores it on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dang-nhap");

    const menuButton = page.locator('button[aria-controls="mobile-navigation-menu"]');
    await menuButton.click();

    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Điều hướng trên thiết bị di động" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Trang Chủ" }).last()).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menuButton).toBeFocused();
    await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  });
});
