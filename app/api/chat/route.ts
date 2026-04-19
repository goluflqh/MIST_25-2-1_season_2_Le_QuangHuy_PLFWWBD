import { NextResponse } from "next/server";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";

type AIProvider = "gemini" | "openai" | "9router";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatCompletionOptions {
  apiKey: string;
  baseUrl: string;
  history?: ChatMessage[];
  label: string;
  model: string;
  userMessage: string;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_9ROUTER_BASE_URL = "http://127.0.0.1:20128/v1";
const DEFAULT_9ROUTER_MODEL = "cx/gpt-5.2";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_HISTORY_MESSAGES = 6;
const DEFAULT_FALLBACK_REPLY =
  "Xin lỗi, hệ thống đang bận. Bạn vui lòng gọi 0987.443.258 để được hỗ trợ nhanh nhất ạ!";

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của Minh Hồng tại Xã Đồng Dương, TP. Đà Nẵng.
Minh Hồng chuyên đóng pin xe điện, pin máy khoan, pin loa kéo, pin đèn năng lượng mặt trời và lắp camera an ninh.
Trả lời bằng tiếng Việt tự nhiên, đi thẳng vào ý chính, chỉ 2 đến 4 câu ngắn.
Không dùng markdown, không dùng ký hiệu như **, __, # hoặc danh sách dài.
Nếu cần báo giá hoặc kiểm tra tình trạng pin thì mời khách gọi 0987.443.258.
Không bịa giá cụ thể nếu chưa đủ thông tin. Nếu câu hỏi không liên quan đến dịch vụ của Minh Hồng thì từ chối ngắn gọn.`;

function normalizeProvider(provider: string | undefined): AIProvider {
  const value = provider?.trim().toLowerCase();
  if (value === "openai") return "openai";
  if (value === "9router") return "9router";
  return "gemini";
}

function removeTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeLookupText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAssistantReply(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function getAIConfig() {
  const provider = normalizeProvider(process.env.AI_PROVIDER);

  if (provider === "9router") {
    return {
      provider,
      apiKey: process.env.NINE_ROUTER_API_KEY || process.env.AI_API_KEY,
      baseUrl: removeTrailingSlash(
        process.env.NINE_ROUTER_BASE_URL || process.env.AI_BASE_URL || DEFAULT_9ROUTER_BASE_URL
      ),
      model: process.env.NINE_ROUTER_MODEL || process.env.AI_MODEL || DEFAULT_9ROUTER_MODEL,
    };
  }

  if (provider === "openai") {
    return {
      provider,
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY,
      baseUrl: removeTrailingSlash(
        process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || DEFAULT_OPENAI_BASE_URL
      ),
      model: process.env.OPENAI_MODEL || process.env.AI_MODEL || DEFAULT_OPENAI_MODEL,
    };
  }

  return {
    provider,
    apiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY,
    baseUrl: "",
    model: "",
  };
}

function isMissingAIKey(apiKey: string | undefined): boolean {
  return (
    !apiKey ||
    apiKey === "your-ai-api-key-here" ||
    apiKey === "your-openai-api-key-here" ||
    apiKey === "your-9router-api-key-here"
  );
}

function sanitizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item): item is ChatMessage =>
        typeof item === "object" &&
        item !== null &&
        typeof item.role === "string" &&
        typeof item.content === "string"
    )
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: sanitizeText(item.content).slice(0, 800),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-MAX_HISTORY_MESSAGES);
}

function getQuickReply(message: string): string | null {
  const lookup = normalizeLookupText(message);

  if (!lookup) return null;

  if (
    includesAny(lookup, [
      "dia chi",
      "o dau",
      "lien he",
      "so dien thoai",
      "hotline",
      "may gio",
      "mo cua",
      "gio mo cua",
    ])
  ) {
    return "Minh Hồng ở Xã Đồng Dương, TP. Đà Nẵng và mở cửa từ 6h đến 21h mỗi ngày. Anh/chị cần tư vấn hoặc báo giá nhanh thì gọi 0987.443.258 nhé.";
  }

  if (
    includesAny(lookup, ["gia", "bao nhieu", "chi phi"]) &&
    includesAny(lookup, ["pin", "dong pin", "binh", "cell", "xe dien", "loa", "may khoan"])
  ) {
    return "Giá còn tùy loại pin, số cell, dung lượng và thiết bị nên bên em cần xem đúng mẫu mới báo chuẩn. Anh/chị gửi model hoặc gọi 0987.443.258 để Minh Hồng báo nhanh cho mình nhé.";
  }

  if (
    includesAny(lookup, ["sac nhanh day", "nhanh het", "pin yeu", "tu hao", "bao ao"]) &&
    includesAny(lookup, ["pin", "binh", "cell", "sac", "dien"])
  ) {
    return "Dấu hiệu này thường do cell pin chai, lệch cell hoặc mạch pin lỗi. Minh Hồng kiểm tra miễn phí rồi mới báo nên sửa hay đóng lại pin, anh/chị có thể gửi model hoặc gọi 0987.443.258 để được hướng dẫn nhanh.";
  }

  if (includesAny(lookup, ["phong pin", "pin phong", "khong nhan sac", "sut ap", "chai pin"])) {
    return "Pin có dấu hiệu phồng hoặc sụt áp thì nên ngưng dùng sớm để tránh hư thêm và mất an toàn. Minh Hồng có thể kiểm tra tình trạng pin và tư vấn phương án phù hợp, anh/chị gọi 0987.443.258 nhé.";
  }

  if (includesAny(lookup, ["camera"]) && includesAny(lookup, ["lap", "gan", "thi cong", "an ninh"])) {
    return "Có, Minh Hồng nhận lắp camera cho nhà ở, cửa hàng và xưởng, có khảo sát miễn phí và hỗ trợ cài xem trên điện thoại. Anh/chị gọi 0987.443.258 để bên em tư vấn cấu hình phù hợp.";
  }

  return null;
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request);
    const rl = checkRateLimit(`chat:${ip}`, RATE_LIMITS.chat);

    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, reply: "Bạn gửi quá nhanh. Vui lòng đợi một chút nhé!" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const message = sanitizeText(body?.message || "");
    const history = sanitizeHistory(body?.history);

    if (!message) {
      return NextResponse.json(
        { success: false, reply: "Vui lòng nhập câu hỏi." },
        { status: 400 }
      );
    }

    const quickReply = getQuickReply(message);
    if (quickReply) {
      return NextResponse.json({ success: true, reply: normalizeAssistantReply(quickReply) });
    }

    const aiConfig = getAIConfig();

    if (isMissingAIKey(aiConfig.apiKey)) {
      return NextResponse.json({
        success: true,
        reply: normalizeAssistantReply(
          "Cảm ơn bạn đã quan tâm. Hiện tại hệ thống AI đang cập nhật, bạn vui lòng gọi 0987.443.258 hoặc nhắn Zalo để được tư vấn ngay nhé."
        ),
      });
    }

    let reply = DEFAULT_FALLBACK_REPLY;

    if (aiConfig.provider === "gemini") {
      reply = await callGemini(aiConfig.apiKey!, message, history);
    } else if (aiConfig.provider === "openai") {
      reply = await callOpenAI(aiConfig.apiKey!, aiConfig.model, aiConfig.baseUrl, message, history);
    } else {
      reply = await callNineRouter(
        aiConfig.apiKey!,
        aiConfig.model,
        aiConfig.baseUrl,
        message,
        history
      );
    }

    const response = NextResponse.json({
      success: true,
      reply: normalizeAssistantReply(reply) || DEFAULT_FALLBACK_REPLY,
    });
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json({
      success: true,
      reply: DEFAULT_FALLBACK_REPLY,
    });
  }
}

async function callGemini(
  apiKey: string,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const contents =
    history.length > 0
      ? history.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        }))
      : [{ role: "user", parts: [{ text: userMessage }] }];

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        maxOutputTokens: 220,
        temperature: 0.35,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[Gemini] API Error:", res.status, JSON.stringify(data));

    try {
      return await callGeminiFallback(apiKey, userMessage);
    } catch {
      return DEFAULT_FALLBACK_REPLY;
    }
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || DEFAULT_FALLBACK_REPLY;
}

async function callGeminiFallback(apiKey: string, userMessage: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: 180,
        temperature: 0.3,
      },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("[Gemini Fallback] API Error:", res.status, JSON.stringify(data));
    throw new Error(`Gemini fallback error: ${res.status}`);
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || DEFAULT_FALLBACK_REPLY;
}

async function callOpenAICompatible({
  apiKey,
  baseUrl,
  history = [],
  label,
  model,
  userMessage,
}: ChatCompletionOptions): Promise<string> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM_PROMPT }];

  if (history.length > 0) {
    messages.push(...history);
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  const res = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 220,
      temperature: 0.3,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`[${label}] API Error:`, res.status, JSON.stringify(data));
    throw new Error(`${label} error: ${res.status}`);
  }

  return data?.choices?.[0]?.message?.content || DEFAULT_FALLBACK_REPLY;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  baseUrl: string,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  return callOpenAICompatible({
    apiKey,
    baseUrl,
    history,
    label: "OpenAI",
    model,
    userMessage,
  });
}

async function callNineRouter(
  apiKey: string,
  model: string,
  baseUrl: string,
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> {
  return callOpenAICompatible({
    apiKey,
    baseUrl,
    history,
    label: "9Router",
    model,
    userMessage,
  });
}
