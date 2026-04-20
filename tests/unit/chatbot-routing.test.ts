import assert from "node:assert/strict";
import test from "node:test";
import { analyzeChatbotMessage } from "../../lib/chatbot";

test("answers battery warranty questions with the right scope", () => {
  const result = analyzeChatbotMessage("Bảo hành pin ra sao?");

  assert.equal(result.intent, "faq");
  assert.match(result.localReply || "", /bảo hành pin theo từng dòng và cấu hình/i);
  assert.equal(result.shouldOfferLeadForm, false);
});

test("does not confuse camera store questions with location lookup", () => {
  const result = analyzeChatbotMessage("Camera cửa hàng");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "CAMERA");
  assert.match(result.localReply || "", /camera cho cửa hàng/i);
  assert.doesNotMatch(result.localReply || "", /xã đồng dương/i);
});

test("answers solar light rain questions more helpfully", () => {
  const result = analyzeChatbotMessage("Đèn NLMT dùng mưa ổn không?");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /mùa mưa|ngoài trời|kín nước/i);
});

test("routes open-ended solar usage questions to the API layer instead of a canned FAQ", () => {
  const result = analyzeChatbotMessage("đèn năng lượng mặt trời dùng như thế nào");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
});

test("treats solar budget questions as pricing instead of rain-weather FAQs", () => {
  const result = analyzeChatbotMessage("1 triệu có đủ mua đèn năng lượng ko");

  assert.equal(result.intent, "quote");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /tầm 1 triệu|ngân sách đó/i);
  assert.equal(result.shouldOfferLeadForm, true);
});

test("keeps address requests on the location answer", () => {
  const result = analyzeChatbotMessage("Địa chỉ shop");

  assert.equal(result.intent, "faq");
  assert.match(result.localReply || "", /xã đồng dương/i);
  assert.doesNotMatch(result.localReply || "", /em chào anh\/chị/i);
});

test("rejects obvious out-of-scope knowledge questions locally", () => {
  const result = analyzeChatbotMessage("thủ đô của việt nam là gì");

  assert.equal(result.intent, "general");
  assert.match(result.localReply || "", /không thuộc mảng bên em hỗ trợ/i);
});

test("answers common battery-choice questions without forcing a quote", () => {
  const result = analyzeChatbotMessage("đóng pin loại nào thì ok?");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "DONG_PIN");
  assert.match(result.localReply || "", /không có một loại pin nào hợp cho mọi máy/i);
  assert.equal(result.shouldOfferLeadForm, false);
});
