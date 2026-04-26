import assert from "node:assert/strict";
import test from "node:test";
import { analyzeChatbotMessage } from "../../lib/chatbot";

test("answers battery warranty questions with the right scope", () => {
  const result = analyzeChatbotMessage("Bảo hành pin ra sao?");

  assert.equal(result.intent, "faq");
  assert.match(result.localReply || "", /bảo hành pin theo từng dòng và cấu hình/i);
  assert.equal(result.shouldOfferLeadForm, false);
});

test("keeps narrow service-availability FAQ local", () => {
  const result = analyzeChatbotMessage("Có lắp camera cho cửa hàng không?");

  assert.equal(result.intent, "faq");
  assert.equal(result.service, "CAMERA");
  assert.match(result.localReply || "", /nhận lắp camera/i);
});

test("routes short camera topic prompts to AI instead of forcing a canned answer", () => {
  const result = analyzeChatbotMessage("Camera cửa hàng");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "CAMERA");
  assert.equal(result.localReply, null);
});

test("routes solar weather-resilience questions to AI while keeping the right service", () => {
  const result = analyzeChatbotMessage("Đèn NLMT dùng mưa ổn không?");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
});

test("routes open-ended solar usage questions to AI with the correct service context", () => {
  const result = analyzeChatbotMessage("đèn năng lượng mặt trời dùng như thế nào");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
});

test("keeps solar savings questions on the AI path instead of using a fixed FAQ reply", () => {
  const result = analyzeChatbotMessage("dùng đèn năng lượng có tiết kiệm thật ko");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
});

test("treats solar budget questions as pricing intent without forcing a local script", () => {
  const result = analyzeChatbotMessage("1 triệu có đủ mua đèn năng lượng ko");

  assert.equal(result.intent, "quote");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
  assert.equal(result.shouldOfferLeadForm, true);
});

test("reuses solar context for short budget follow-ups while staying on the AI path", () => {
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
      content: "Ngân sách 2 triệu thì cần nhìn thêm khu vực lắp với thời lượng sáng.",
      meta: { intent: "quote" as const, service: "DEN_NLMT" as const },
    },
  ];

  const result = analyzeChatbotMessage("3 triệu thì sao", { history });

  assert.equal(result.intent, "quote");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
  assert.equal(result.shouldOfferLeadForm, true);
});

test("reuses service context for short usage follow-ups without answering locally", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Đèn NLMT có thể tiết kiệm điện nếu lắp đúng chỗ.",
      meta: { intent: "faq" as const, service: "DEN_NLMT" as const },
    },
  ];

  const result = analyzeChatbotMessage("dùng như thế nào", { history });

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DEN_NLMT");
  assert.equal(result.localReply, null);
});

test("keeps short camera phone-view follow-ups inside camera context for AI", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Bên em có lắp camera cho cửa hàng anh/chị nhé.",
      meta: { intent: "faq" as const, service: "CAMERA" as const },
    },
  ];

  const result = analyzeChatbotMessage("xem trên điện thoại được không", { history });

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "CAMERA");
  assert.equal(result.localReply, null);
});

test("routes storage runtime questions to AI with the right service", () => {
  const result = analyzeChatbotMessage("pin lưu trữ mất điện dùng được bao lâu");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "PIN_LUU_TRU");
  assert.equal(result.localReply, null);
});

test("reuses storage context for short runtime follow-ups without a canned reply", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Pin lưu trữ sẽ đi theo điện áp, dung lượng và tải dùng thực tế.",
      meta: { intent: "faq" as const, service: "PIN_LUU_TRU" as const },
    },
  ];

  const result = analyzeChatbotMessage("mất điện thì trụ được bao lâu", { history });

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "PIN_LUU_TRU");
  assert.equal(result.localReply, null);
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
  assert.equal((result.localReply || "").toLowerCase().includes("em chào"), false);
});

test("rejects obvious out-of-scope knowledge questions locally", () => {
  const result = analyzeChatbotMessage("thủ đô của việt nam là gì");

  assert.equal(result.intent, "general");
  assert.match(result.localReply || "", /không thuộc mảng bên em hỗ trợ/i);
});

test("treats short acknowledgements as a graceful close without extra lead push", () => {
  const history = [
    {
      role: "assistant" as const,
      content: "Với camera cửa hàng, mình thường ưu tiên quầy thu ngân và cửa ra vào trước.",
      meta: { intent: "open_question" as const, service: "CAMERA" as const },
    },
  ];

  const result = analyzeChatbotMessage("ok nha", { history });

  assert.equal(result.intent, "general");
  assert.equal(result.service, "CAMERA");
  assert.match(result.localReply || "", /khi nào cần em tư vấn tiếp về camera/i);
  assert.equal(result.shouldOfferLeadForm, false);
});

test("routes common battery-choice questions to AI without forcing a quote", () => {
  const result = analyzeChatbotMessage("đóng pin loại nào thì ok?");

  assert.equal(result.intent, "open_question");
  assert.equal(result.service, "DONG_PIN");
  assert.equal(result.localReply, null);
  assert.equal(result.shouldOfferLeadForm, false);
});
