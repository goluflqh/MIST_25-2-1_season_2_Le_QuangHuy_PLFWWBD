import assert from "node:assert/strict";
import test from "node:test";
import { buildChatbotPricingContext } from "../../lib/chatbot-pricing";

test("highlights the 4-camera range first for detailed camera quote requests", () => {
  const context = buildChatbotPricingContext("CAMERA", "camera 4 mat 5MP luu 6 thang");

  assert.match(context, /4 camera/i);
  assert.match(context, /5MP/i);
  assert.match(context, /tham khảo/i);
});

test("points solar yard and gate questions to floodlight pricing first", () => {
  const context = buildChatbotPricingContext("DEN_NLMT", "den san cong dung bao lau");

  assert.match(context, /100W-300W/i);
  assert.doesNotMatch(context, /Khảo sát tận nơi/i);
});

test("prefers public pricing items over local fallback data when available", () => {
  const context = buildChatbotPricingContext("CAMERA", "camera 4 mat", [
    {
      category: "CAMERA",
      name: "Tron bo 4 camera AI",
      price: "6.500.000 - 8.500.000d",
      note: "Co mic va on dinh hon",
    },
  ]);

  assert.match(context, /Tron bo 4 camera AI/i);
  assert.doesNotMatch(context, /2 camera/i);
});

test("surfaces the free battery check as a clear benefit", () => {
  const context = buildChatbotPricingContext("DONG_PIN", "kiem tra pin xe dien truoc khi dong lai");

  assert.match(context, /Kiểm tra tình trạng pin/i);
  assert.match(context, /Miễn phí/i);
});
