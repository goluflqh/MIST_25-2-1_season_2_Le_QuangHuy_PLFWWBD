import { NextResponse } from "next/server";
import { getLocalChatbotReply } from "@/lib/chatbot";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { siteConfig } from "@/lib/site";

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
const HOTLINE = siteConfig.hotlineDisplay;
const LOCATION = siteConfig.locationLabel;
const DEFAULT_FALLBACK_REPLY =
  `Dạ, hiện tại hệ thống đang hơi bận. Anh/chị gọi ${HOTLINE} thì bên em hỗ trợ nhanh hơn ngay ạ!`;

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của ${siteConfig.name} tại ${LOCATION}.
Bạn luôn xưng hô thống nhất là "em" với khách và gọi khách là "anh/chị".
Minh Hồng chuyên đóng pin xe điện, pin máy khoan, pin loa kéo, pin đèn năng lượng mặt trời và lắp camera an ninh.
Trả lời bằng tiếng Việt tự nhiên, đi thẳng vào ý chính, chỉ 2 đến 4 câu ngắn.
Giọng điệu mềm, chăm sóc, tạo cảm giác dễ chịu và đáng tin, nhưng không xu nịnh hay lặp khuôn bán hàng.
Không dùng markdown, không dùng ký hiệu như **, __, # hoặc danh sách dài.
Với câu hỏi kỹ thuật liên quan dịch vụ, hãy trả lời ngắn gọn và hữu ích trước.
Chỉ mời anh/chị gọi ${HOTLINE} khi cần báo giá, chốt cấu hình, xem model cụ thể hoặc kiểm tra thực tế.
Không bịa giá cụ thể nếu chưa đủ thông tin.
Nếu câu hỏi không liên quan đến dịch vụ của ${siteConfig.name}, hãy trả lời lịch sự rằng em chỉ hỗ trợ tư vấn về pin, NLMT và camera của cửa hàng, không trả lời sai chủ đề.
Không được trả lời nhầm sang báo giá hay dịch vụ khác nếu câu hỏi không khớp ý định của khách.`;

function normalizeProvider(provider: string | undefined): AIProvider {
  const value = provider?.trim().toLowerCase();
  if (value === "openai") return "openai";
  if (value === "9router") return "9router";
  return "gemini";
}

function removeTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
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
        { success: false, reply: "Anh/chị gửi hơi nhanh giúp em rồi ạ. Anh/chị chờ em một chút nhé!" },
        { status: 429 }
      );
    }

    const body = await request.json();
    const message = sanitizeText(body?.message || "");
    const history = sanitizeHistory(body?.history);

    if (!message) {
      return NextResponse.json(
        { success: false, reply: "Anh/chị nhập giúp em câu hỏi nhé." },
        { status: 400 }
      );
    }

    const quickReply = getLocalChatbotReply(message);
    if (quickReply) {
      return NextResponse.json({ success: true, reply: normalizeAssistantReply(quickReply) });
    }

    const aiConfig = getAIConfig();

    if (isMissingAIKey(aiConfig.apiKey)) {
      return NextResponse.json({
        success: true,
        reply: normalizeAssistantReply(
          `Dạ, hiện tại phần tư vấn AI đang cập nhật. Anh/chị gọi ${HOTLINE} hoặc nhắn Zalo giúp em, bên em hỗ trợ ngay nhé.`
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
