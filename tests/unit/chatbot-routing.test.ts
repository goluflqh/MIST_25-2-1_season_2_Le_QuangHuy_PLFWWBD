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

test("routes open-ended solar usage questions to the right service context", () => {
  const result = analyzeChatbotMessage("đèn năng lượng mặt trời dùng như thế nào");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /ban ngày|tấm pin|cả đêm/i);
});

test("keeps solar savings questions on a meaningful energy answer", () => {
  const result = analyzeChatbotMessage("dùng đèn năng lượng có tiết kiệm thật ko");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /tiết kiệm điện|chỗ lắp có nắng|khó kéo điện/i);
  assert.doesNotMatch(result.localReply || "", /nhận làm pin cho đèn/i);
});

test("treats solar budget questions as pricing instead of weather FAQs", () => {
  const result = analyzeChatbotMessage("1 triệu có đủ mua đèn năng lượng ko");

  assert.equal(result.intent, "quote");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /1 triệu|ngân sách đó/i);
  assert.equal(result.shouldOfferLeadForm, true);
});

test("reuses solar context for short budget follow-ups and changes the amount", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Đèn NLMT có thể tiết kiệm điện nếu lắp đúng chỗ.",
      meta: { intent: "faq" as const, service: "DEN_NLMT" as const },
    },
    {
      role: "user" as const,
      content: "2 triệu mua được mấy cái",
    },
    {
      role: "assistant" as const,
      content: "Ngân sách 2 triệu thì đã dễ chọn hơn nhiều rồi anh/chị ạ.",
      meta: { intent: "quote" as const, service: "DEN_NLMT" as const },
    },
  ];

  const result = analyzeChatbotMessage("3 triệu thì sao", { history });

  assert.equal(result.intent, "quote");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /3 triệu/i);
  assert.doesNotMatch(result.localReply || "", /1 triệu/i);
});

test("reuses service context for short usage follow-ups", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Đèn NLMT có thể tiết kiệm điện nếu lắp đúng chỗ.",
      meta: { intent: "faq" as const, service: "DEN_NLMT" as const },
    },
  ];

  const result = analyzeChatbotMessage("dùng như thế nào", { history });

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "DEN_NLMT");
  assert.match(result.localReply || "", /ban ngày|tấm pin|cả đêm/i);
});

test("suggests other service groups when the user asks beyond the current solar topic", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Đèn NLMT có thể tiết kiệm điện nếu lắp đúng chỗ.",
      meta: { intent: "faq" as const, service: "DEN_NLMT" as const },
    },
  ];

  const result = analyzeChatbotMessage("mua được cái gì ngoài đèn năng lượng", { history });

  assert.equal(result.intent, "general");
  assert.equal(result.shouldSuggestServices, true);
  assert.match(result.localReply || "", /ngoài đèn năng lượng mặt trời|camera|đóng pin|pin lưu trữ/i);
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
