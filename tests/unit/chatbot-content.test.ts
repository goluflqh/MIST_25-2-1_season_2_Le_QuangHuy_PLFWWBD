import assert from "node:assert/strict";
import test from "node:test";
import {
  buildChatbotMissingAiReply,
  buildChatbotRuntimeFallbackReply,
  buildChatbotTrainingContext,
  CHATBOT_WIDGET_COPY,
  CHATBOT_WIDGET_QUICK_PROMPTS,
  getChatbotLeadActionLabel,
  getChatbotLoadingCopy,
  getChatbotServiceFact,
} from "../../lib/chatbot-content";

test("exposes confirmed service facts for the chatbot prompt layer", () => {
  assert.match(getChatbotServiceFact("DONG_PIN"), /kiểm tra pin miễn phí hoàn toàn/i);
  assert.match(getChatbotServiceFact("CAMERA"), /xem qua điện thoại/i);
  assert.match(getChatbotServiceFact("PIN_LUU_TRU"), /UPS|điện mặt trời/i);
});

test("adds service-specific training notes to the chatbot prompt layer", () => {
  const cameraContext = buildChatbotTrainingContext("CAMERA", "quote");
  const storageContext = buildChatbotTrainingContext("PIN_LUU_TRU", "open_question");

  assert.match(cameraContext, /số mắt/i);
  assert.match(cameraContext, /xem điện thoại/i);
  assert.match(storageContext, /tải muốn chạy/i);
  assert.match(storageContext, /Wh chia tải W/i);
});

test("keeps lead CTA labels centralized by intent", () => {
  assert.equal(getChatbotLeadActionLabel("quote"), "Nhận gợi ý cấu hình sát nhu cầu");
  assert.equal(getChatbotLeadActionLabel("open_question"), "Giữ nhu cầu này để em tư vấn tiếp");
  assert.equal(
    getChatbotLeadActionLabel("general", true),
    "Để lại nhu cầu để em ưu tiên hỗ trợ"
  );
});

test("provides loading and fallback copy from the shared content layer", () => {
  assert.match(getChatbotLoadingCopy("quote", "camera").headline, /camera/i);
  assert.match(buildChatbotMissingAiReply("contact", "camera"), /camera/i);
  assert.match(buildChatbotRuntimeFallbackReply("general", null), /phản hồi hơi chậm/i);
  assert.equal(CHATBOT_WIDGET_QUICK_PROMPTS.length, 4);
  assert.match(CHATBOT_WIDGET_COPY.welcomeMessage, /trợ lý tư vấn/i);
});
