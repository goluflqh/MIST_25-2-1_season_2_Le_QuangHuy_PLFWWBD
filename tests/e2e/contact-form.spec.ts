import { expect, test, type Page } from "@playwright/test";

async function openContactForm(page: Page) {
  await page.goto("/");
  const form = page.getByTestId("contact-form");
  await form.scrollIntoViewIfNeeded();
  await expect(form).toBeVisible();
}

async function fillContactForm(page: Page) {
  await page.getByTestId("contact-name").fill("Nguyen Van A");
  await page.getByTestId("contact-phone").fill("0987123456");
  await page.getByTestId("contact-service").selectOption("CAMERA");
  await page
    .getByTestId("contact-message")
    .fill("Can tu van camera 4 mat cho cua hang.");
}

test.describe("Contact form", () => {
  test("shows client-side validation before submit", async ({ page }) => {
    await openContactForm(page);

    await page.getByTestId("contact-submit").click();

    await expect(page.getByText(/Vui l.ng nh.p h. t.n/i)).toBeVisible();
    await expect(page.getByText(/S. .i.n tho.i kh.ng h.p l./i)).toBeVisible();
    await expect(page.getByText(/Vui l.ng ch.n d.ch v. quan t.m/i)).toBeVisible();
  });

  test("keeps the success panel visible until the user decides what to do next", async ({
    page,
  }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          id: "test-contact-id",
          message: "ok",
        }),
      });
    });

    await openContactForm(page);
    await fillContactForm(page);
    await page.getByTestId("contact-submit").click();

    const successPanel = page.getByTestId("contact-success");

    await expect(successPanel).toBeVisible();
    await page.waitForTimeout(8500);
    await expect(successPanel).toBeVisible();

    await page.getByTestId("contact-success-back").click();
    await expect(page.getByTestId("contact-form")).toBeVisible();
    await expect(page.getByTestId("contact-name")).toHaveValue("Nguyen Van A");
  });

  test("lets the user start a brand new request from the success panel", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        name: "Nguyen Van A",
        phone: "0987123456",
        service: "CAMERA",
        message: "Can tu van camera 4 mat cho cua hang.",
      });

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          id: "test-contact-id",
          message: "ok",
        }),
      });
    });

    await openContactForm(page);
    await fillContactForm(page);
    await page.getByTestId("contact-submit").click();

    await expect(page.getByTestId("contact-success")).toBeVisible();
    await page.getByTestId("contact-success-new-request").click();

    await expect(page.getByTestId("contact-form")).toBeVisible();
    await expect(page.getByTestId("contact-name")).toHaveValue("");
    await expect(page.getByTestId("contact-phone")).toHaveValue("");
  });

  test("shows an API error message when the request fails", async ({ page }) => {
    await page.route("**/api/contact", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          message: "May chu tam ban, vui long thu lai sau.",
        }),
      });
    });

    await openContactForm(page);
    await fillContactForm(page);
    await page.getByTestId("contact-submit").click();

    await expect(page.getByTestId("contact-error")).toContainText(
      "May chu tam ban, vui long thu lai sau."
    );
    await expect(page.getByTestId("contact-form")).toBeVisible();
  });
});
