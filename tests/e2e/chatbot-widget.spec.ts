import { expect, test, type Page } from "@playwright/test";

async function openChatbot(page: Page) {
  await page.goto("/");
  await page.getByTestId("chatbot-toggle").click();
  await expect(page.getByTestId("chatbot-panel")).toBeVisible();
}

test.describe("Chatbot widget", () => {
  test("keeps FAQ answers helpful without pushing quote actions", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort();
    });

    await openChatbot(page);
    await page.getByTestId("chatbot-input").fill("Bảo hành pin bao lâu vậy em?");
    await page.getByTestId("chatbot-send").click();

    await expect(page.getByText(/bảo hành pin theo từng dòng và cấu hình/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Gửi nhu cầu để em báo sát hơn/i })).toHaveCount(0);
  });

  test("carries chatbot context into the quote form when the user asks for pricing", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort();
    });

    await openChatbot(page);
    await page
      .getByTestId("chatbot-input")
      .fill("Mình muốn báo giá lắp camera cho cửa hàng tạp hóa.");
    await page.getByTestId("chatbot-send").click();

    const leadLink = page.getByRole("link", { name: /Gửi nhu cầu để em báo sát hơn/i });
    await expect(leadLink).toBeVisible();
    await leadLink.click();

    await expect(page).toHaveURL(/service=CAMERA/);
    await expect(page.getByTestId("contact-form")).toBeVisible();
    await expect(page.getByTestId("contact-source-label")).toContainText(/Chatbot tư vấn camera/i);
    await expect(page.getByTestId("contact-service")).toHaveValue("CAMERA");
    await expect(page.getByTestId("contact-message")).toHaveValue(
      /Mình muốn báo giá lắp camera cho cửa hàng tạp hóa./i
    );
  });
});
