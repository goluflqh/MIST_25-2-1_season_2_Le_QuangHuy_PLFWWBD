import { expect, test, type Page } from "@playwright/test";

async function openChatbot(page: Page) {
  await page.goto("/");
  await page.getByTestId("chatbot-toggle").click();
  await expect(page.getByTestId("chatbot-panel")).toBeVisible();
}

async function sendChatMessage(page: Page, message: string) {
  await page.getByTestId("chatbot-input").fill(message);
  await page.getByTestId("chatbot-send").click();
  await expect(page.getByTestId("chatbot-user-message").last()).toContainText(message, {
    ignoreCase: true,
  });
}

function lastAssistantMessage(page: Page) {
  return page.getByTestId("chatbot-assistant-message").last();
}

test.describe("Chatbot widget", () => {
  test("keeps FAQ answers helpful without pushing quote actions", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort();
    });

    await openChatbot(page);
    await sendChatMessage(page, "Bảo hành pin bao lâu vậy em?");

    await expect(lastAssistantMessage(page)).toContainText(/bảo hành pin theo từng dòng và cấu hình/i);
    await expect(page.getByRole("link", { name: /Nhận gợi ý cấu hình sát nhu cầu/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Giữ nhu cầu này để em tư vấn tiếp/i })).toHaveCount(0);
  });

  test("carries chatbot context into the quote form when the user asks for pricing", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort();
    });

    await openChatbot(page);
    await sendChatMessage(page, "Mình muốn báo giá lắp camera cho cửa hàng tạp hóa.");

    const leadLink = page.getByRole("link", { name: /Nhận gợi ý cấu hình sát nhu cầu/i });
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

  test("handles multi-turn solar questions with better context and budget reasoning", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort();
    });

    await openChatbot(page);

    await sendChatMessage(page, "dùng đèn năng lượng có tiết kiệm thật ko");
    await expect(lastAssistantMessage(page)).toContainText(/tiết kiệm điện|khó kéo điện|chỗ lắp có nắng/i);

    await sendChatMessage(page, "dùng như thế nào");
    await expect(lastAssistantMessage(page)).toContainText(/ban ngày|tấm pin|cả đêm/i);

    await sendChatMessage(page, "2 triệu mua dc mấy cái");
    await expect(lastAssistantMessage(page)).toContainText(/2 triệu/i);

    await sendChatMessage(page, "3 triệu thì sao");
    await expect(lastAssistantMessage(page)).toContainText(/3 triệu/i);
    await expect(lastAssistantMessage(page)).not.toContainText(/1 triệu/i);

    await sendChatMessage(page, "500k thì");
    await expect(lastAssistantMessage(page)).toContainText(/500 nghìn|500k/i);

    await sendChatMessage(page, "mua dc cái gì ngoài đèn năng lượng");
    await expect(lastAssistantMessage(page)).toContainText(
      /ngoài đèn năng lượng mặt trời|đóng pin|pin lưu trữ|camera/i
    );
    await expect(page.getByTestId("chatbot-message-actions").last().getByRole("button").first()).toBeVisible();
  });
});
