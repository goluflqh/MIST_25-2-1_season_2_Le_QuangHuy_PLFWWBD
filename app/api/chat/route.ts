import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `Bạn là trợ lý AI tư vấn cho cửa hàng "Minh Hồng" - chuyên đóng pin và lắp đặt camera an ninh.

=== THÔNG TIN CỬA HÀNG ===
- Tên: Minh Hồng (chủ cửa hàng tên Hồng)
- Địa chỉ: Xã Đồng Dương, TP. Đà Nẵng
- Hotline: 0987.443.258
- Giờ mở cửa: 6h - 21h hàng ngày
- Nhận ship toàn quốc

=== DỊCH VỤ ĐÓNG PIN (chuyên môn chính) ===
1. Pin xe điện (xe đạp điện, xe máy điện)
2. Pin máy công cụ (máy khoan, máy cắt, máy mài, máy bắn vít...)
3. Pin loa kéo
4. Pin lưu trữ năng lượng
5. Pin kích đề ô tô
6. Pin đèn năng lượng mặt trời (ĐÈN NLMT)
7. Pin dự phòng dung lượng lớn
8. Nhận đóng bình pin theo yêu cầu riêng (custom)
- Dùng cell Lithium chính hãng (Samsung, LG, EVE...)
- Bảo hành 6-12 tháng tuỳ loại
- Bảo dưỡng cân bằng cell miễn phí trọn đời

=== DỊCH VỤ CAMERA AN NINH ===
- Lắp đặt camera giám sát cho nhà ở, cửa hàng, xưởng sản xuất, kho bãi
- Khảo sát miễn phí tận nơi
- Thi công nhanh trong ngày
- Bảo hành 24 tháng phần cứng
- Hỗ trợ xem camera qua điện thoại

=== CÁCH TRẢ LỜI ===
1. Trả lời ngắn gọn, thân thiện, bằng tiếng Việt
2. Luôn gợi ý khách liên hệ hotline 0987.443.258 để được báo giá chính xác
3. Khi khách hỏi về sản phẩm Minh Hồng có bán/làm, hãy xác nhận "Có" và tư vấn thêm
4. Không bịa đặt giá cụ thể nếu không chắc chắn
5. Nếu câu hỏi hoàn toàn không liên quan (ví dụ: nấu ăn, thời tiết...), lịch sự từ chối
6. Minh Hồng CÓ làm đèn năng lượng mặt trời (đóng pin cho đèn NLMT)
7. Hãy tự tin giới thiệu tất cả dịch vụ trên khi được hỏi`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;
    const history: { role: string; content: string }[] = body?.history || [];

    if (!message) {
      return NextResponse.json(
        { success: false, reply: "Vui lòng nhập câu hỏi." },
        { status: 400 }
      );
    }

    const aiApiKey = process.env.AI_API_KEY;
    const aiProvider = process.env.AI_PROVIDER || "gemini";

    // If no API key configured, return a helpful fallback
    if (!aiApiKey || aiApiKey === "your-ai-api-key-here") {
      return NextResponse.json({
        success: true,
        reply: `Cảm ơn bạn đã quan tâm! Hiện tại hệ thống AI đang cập nhật. Để được tư vấn ngay, vui lòng gọi hotline 0987.443.258 hoặc nhắn tin qua Zalo nhé! 😊`,
      });
    }

    let reply = "";

    if (aiProvider === "gemini") {
      reply = await callGemini(aiApiKey, message, history);
    } else {
      reply = await callOpenAI(aiApiKey, message, history);
    }

    return NextResponse.json({ success: true, reply });
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({
      success: true,
      reply: "Xin lỗi, hệ thống đang bận. Bạn vui lòng gọi 0987.443.258 để được hỗ trợ nhanh nhất ạ!",
    });
  }
}

async function callGemini(apiKey: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  console.log("[Gemini] Calling API with", history.length, "history messages...");

  // Build multi-turn conversation for Gemini
  const contents = history.map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  // If history is empty, just send the current message
  if (contents.length === 0) {
    contents.push({ role: "user", parts: [{ text: userMessage }] });
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.7,
      },
    }),
  });

  const data = await res.json();
  
  // Log error details for debugging
  if (!res.ok) {
    console.error("[Gemini] API Error:", res.status, JSON.stringify(data));
    
    // Try fallback model for any error (404, 400, 429 rate limit, etc.)
    console.log("[Gemini] Trying fallback model gemini-1.5-flash...");
    try {
      return await callGeminiFallback(apiKey, userMessage);
    } catch {
      // Both models failed - return friendly message
      return "Hệ thống AI đang tạm quá tải. Anh/chị vui lòng gọi trực tiếp hotline 0987.443.258 để được tư vấn ngay nhé! 😊";
    }
  }

  console.log("[Gemini] Success:", data?.candidates?.[0]?.content?.parts?.[0]?.text?.substring(0, 50));

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Xin lỗi, mình chưa hiểu câu hỏi. Gọi 0987.443.258 để được tư vấn trực tiếp nhé!"
  );
}

async function callGeminiFallback(apiKey: string, userMessage: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: 300,
        temperature: 0.7,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[Gemini Fallback] API Error:", res.status, JSON.stringify(data));
    throw new Error(`Gemini fallback error: ${res.status}`);
  }

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Xin lỗi, mình chưa hiểu câu hỏi. Gọi 0987.443.258 để được tư vấn trực tiếp nhé!"
  );
}

async function callOpenAI(apiKey: string, userMessage: string, history: { role: string; content: string }[] = []): Promise<string> {
  // Build messages with history
  const messages: { role: string; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (history.length > 0) {
    messages.push(...history);
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[OpenAI] API Error:", res.status, JSON.stringify(data));
    throw new Error(`OpenAI error: ${res.status}`);
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "Xin lỗi, mình chưa hiểu câu hỏi. Gọi 0987.443.258 để được tư vấn trực tiếp nhé!"
  );
}
