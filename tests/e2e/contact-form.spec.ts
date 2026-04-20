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

  test("submits a quote request successfully", async ({ page }) => {
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
    await expect(page.getByText(/G.i Th.nh C.ng!/i)).toBeVisible();
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
