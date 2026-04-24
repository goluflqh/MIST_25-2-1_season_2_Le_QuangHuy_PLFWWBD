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

function buildChatResponse(reply: string, meta: Record<string, unknown>) {
  return {
    success: true,
    reply,
    meta,
  };
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
      const body = route.request().postDataJSON();

      expect(body.message).toMatch(/báo giá lắp camera/i);
      expect(body.serviceContext).toBe("CAMERA");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          buildChatResponse(
            "Em tư vấn sơ bộ cho anh/chị được nhé. Với camera cửa hàng, chi phí thường lệch theo số mắt, góc nhìn và cách đi dây nên em cần thêm mặt bằng hoặc số mắt dự tính để gợi ý sát hơn.",
            {
              intent: "quote",
              service: "CAMERA",
              serviceLabel: "camera",
              shouldOfferLeadForm: true,
              shouldOfferHumanSupport: false,
              shouldSuggestServices: false,
            }
          )
        ),
      });
    });

    await openChatbot(page);
    await sendChatMessage(page, "Mình muốn báo giá lắp camera cho cửa hàng tạp hóa.");

    const leadLink = page.getByRole("link", { name: /Nhận gợi ý cấu hình sát nhu cầu/i });
    await expect(leadLink).toBeVisible();
    const href = await leadLink.getAttribute("href");

    expect(href).toMatch(/service=CAMERA/);
    expect(href).toMatch(/source=chatbot-camera/);

    await page.goto(href || "/");

    await expect(page).toHaveURL(/service=CAMERA/);
    await expect(page.getByTestId("contact-form")).toBeVisible();
    await expect(page.getByTestId("contact-source-label")).toContainText(/Chatbot tư vấn camera/i);
    await expect(page.getByTestId("contact-service")).toHaveValue("CAMERA");
    await expect(page.getByTestId("contact-message")).toHaveValue(
      /Mình muốn báo giá lắp camera cho cửa hàng tạp hóa./i
    );
  });

  test("uses the API path for multi-turn solar questions while preserving service context", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON();
      const message = String(body.message);

      expect(body.serviceContext).toBe("DEN_NLMT");

      let payload;
      if (message === "dùng đèn năng lượng có tiết kiệm thật ko") {
        payload = buildChatResponse(
          "Đèn năng lượng mặt trời tiết kiệm điện khá rõ nếu chỗ lắp có nắng tốt và mình chọn đúng nhu cầu sáng. Hợp nhất vẫn là cổng, sân hoặc lối đi khó kéo điện.",
          {
            intent: "open_question",
            service: "DEN_NLMT",
            serviceLabel: "đèn năng lượng mặt trời",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "dùng như thế nào") {
        payload = buildChatResponse(
          "Nguyên lý là ban ngày tấm pin sạc, tối đèn lấy điện từ pin để sáng. Muốn ổn thì nên nhìn thêm vị trí nắng với thời lượng sáng mong muốn mỗi đêm.",
          {
            intent: "open_question",
            service: "DEN_NLMT",
            serviceLabel: "đèn năng lượng mặt trời",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "2 triệu mua dc mấy cái") {
        payload = buildChatResponse(
          "Tầm 2 triệu thì em tư vấn sơ bộ được, nhưng vẫn phải nhìn theo công suất, pin và khu vực lắp chứ chưa chốt theo số lượng cứng được anh/chị nhé.",
          {
            intent: "quote",
            service: "DEN_NLMT",
            serviceLabel: "đèn năng lượng mặt trời",
            shouldOfferLeadForm: true,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "3 triệu thì sao") {
        payload = buildChatResponse(
          "Với tầm 3 triệu thì mình có dư địa chọn bộ sáng khỏe hơn hoặc chia vài điểm sáng tùy mặt bằng. Em cần thêm chỗ lắp với thời lượng sáng để gợi ý sát hơn.",
          {
            intent: "quote",
            service: "DEN_NLMT",
            serviceLabel: "đèn năng lượng mặt trời",
            shouldOfferLeadForm: true,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "500k thì") {
        payload = buildChatResponse(
          "Tầm 500k thì nên nghiêng về nhu cầu sáng điểm nhỏ thôi anh/chị nhé. Nếu muốn sáng rộng và trụ lâu qua đêm thì mức này sẽ khá chật.",
          {
            intent: "quote",
            service: "DEN_NLMT",
            serviceLabel: "đèn năng lượng mặt trời",
            shouldOfferLeadForm: true,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else {
        throw new Error(`Unexpected chatbot request: ${message}`);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    await openChatbot(page);

    await sendChatMessage(page, "dùng đèn năng lượng có tiết kiệm thật ko");
    await expect(lastAssistantMessage(page)).toContainText(/tiết kiệm điện|nắng tốt|khó kéo điện/i);

    await sendChatMessage(page, "dùng như thế nào");
    await expect(lastAssistantMessage(page)).toContainText(/ban ngày|tấm pin|mỗi đêm/i);
    await expect(page.getByRole("link", { name: /Giữ nhu cầu này để em tư vấn tiếp/i })).toBeVisible();

    await sendChatMessage(page, "2 triệu mua dc mấy cái");
    await expect(lastAssistantMessage(page)).toContainText(/2 triệu/i);
    await expect(page.getByRole("link", { name: /Nhận gợi ý cấu hình sát nhu cầu/i })).toBeVisible();

    await sendChatMessage(page, "3 triệu thì sao");
    await expect(lastAssistantMessage(page)).toContainText(/3 triệu/i);
    await expect(lastAssistantMessage(page)).not.toContainText(/1 triệu/i);

    await sendChatMessage(page, "500k thì");
    await expect(lastAssistantMessage(page)).toContainText(/500k|500 nghìn/i);

    await sendChatMessage(page, "mua dc cái gì ngoài đèn năng lượng");
    await expect(lastAssistantMessage(page)).toContainText(
      /ngoài đèn năng lượng mặt trời|đóng pin|pin lưu trữ|camera/i
    );
    await expect(page.getByTestId("chatbot-message-actions").last().getByRole("button").first()).toBeVisible();
  });

  test("keeps camera and storage follow-ups on the right service context through the API", async ({
    page,
  }) => {
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON();
      const message = String(body.message);

      let payload;
      if (message === "Camera cửa hàng") {
        expect(body.serviceContext).toBe("CAMERA");
        payload = buildChatResponse(
          "Với camera cửa hàng, mình thường ưu tiên quầy thu ngân, cửa ra vào và khu trưng bày trước rồi mới chốt số mắt với loại đầu ghi.",
          {
            intent: "open_question",
            service: "CAMERA",
            serviceLabel: "camera",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "xem trên điện thoại được không") {
        expect(body.serviceContext).toBe("CAMERA");
        payload = buildChatResponse(
          "Dạ xem trên điện thoại được anh/chị nhé. Phần này thường cần app đúng loại camera và mạng ổn để xem trực tiếp, xem lại hoặc nhận cảnh báo từ xa.",
          {
            intent: "open_question",
            service: "CAMERA",
            serviceLabel: "camera",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "pin lưu trữ mất điện dùng được bao lâu") {
        expect(body.serviceContext).toBe("PIN_LUU_TRU");
        payload = buildChatResponse(
          "Pin lưu trữ trụ được bao lâu khi mất điện sẽ lệch theo dung lượng pin, điện áp hệ và mức tải đang giữ lại. Nếu anh/chị nói rõ tải muốn giữ với thời gian mong muốn thì em sẽ khoanh sát hơn.",
          {
            intent: "open_question",
            service: "PIN_LUU_TRU",
            serviceLabel: "pin lưu trữ",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else if (message === "mất điện thì trụ được bao lâu") {
        expect(body.serviceContext).toBe("PIN_LUU_TRU");
        payload = buildChatResponse(
          "Nếu vẫn đang nói về pin lưu trữ thì thời gian trụ chủ yếu phụ thuộc dung lượng, điện áp và mức tải thực tế anh/chị giữ lại. Cùng một bộ pin nhưng chạy modem, camera hay quạt sẽ khác nhau khá nhiều.",
          {
            intent: "open_question",
            service: "PIN_LUU_TRU",
            serviceLabel: "pin lưu trữ",
            shouldOfferLeadForm: false,
            shouldOfferHumanSupport: false,
            shouldSuggestServices: false,
          }
        );
      } else {
        throw new Error(`Unexpected chatbot request: ${message}`);
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(payload),
      });
    });

    await openChatbot(page);

    await sendChatMessage(page, "Camera cửa hàng");
    await expect(lastAssistantMessage(page)).toContainText(/quầy thu ngân|cửa ra vào|khu trưng bày/i);

    await sendChatMessage(page, "xem trên điện thoại được không");
    await expect(lastAssistantMessage(page)).toContainText(/điện thoại|app|mạng/i);
    await expect(page.getByRole("link", { name: /Giữ nhu cầu này để em tư vấn tiếp/i })).toBeVisible();

    await sendChatMessage(page, "pin lưu trữ mất điện dùng được bao lâu");
    await expect(lastAssistantMessage(page)).toContainText(/bao lâu|dung lượng|điện áp|tải/i);

    await sendChatMessage(page, "mất điện thì trụ được bao lâu");
    await expect(lastAssistantMessage(page)).toContainText(/bao lâu|dung lượng|điện áp|tải/i);
  });
});
