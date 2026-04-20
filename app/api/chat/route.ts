import { NextResponse } from "next/server";
import {
  analyzeChatbotMessage,
  buildChatbotServiceContextNote,
  normalizeChatbotServiceId,
  type ChatbotIntent,
  type ChatbotConversationMessage,
  type ChatbotResponsePlan,
} from "@/lib/chatbot";
import { recordChatbotEvent, type ChatbotEventType } from "@/lib/chatbot-metrics";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeText } from "@/lib/sanitize";
import { siteConfig } from "@/lib/site";

type AIProvider = "gemini" | "openai" | "9router";

interface ChatMessage {
  role: string;
  content: string;
  meta?: {
    intent?: string | null;
    service?: string | null;
  };
}

interface ChatCompletionOptions {
  apiKey: string;
  baseUrl: string;
  history?: ChatMessage[];
  label: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
}

interface ChatRouteMeta {
  intent: ChatbotResponsePlan["intent"];
  service: ChatbotResponsePlan["service"];
  serviceLabel: ChatbotResponsePlan["serviceLabel"];
  shouldOfferLeadForm: boolean;
  shouldOfferHumanSupport: boolean;
  shouldSuggestServices: boolean;
  usedFallback?: boolean;
}

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_9ROUTER_BASE_URL = "http://127.0.0.1:20128/v1";
const DEFAULT_9ROUTER_MODEL = "cx/gpt-5.2";
const REQUEST_TIMEOUT_MS = 12000;
const MAX_HISTORY_MESSAGES = 6;
const DEFAULT_FALLBACK_REPLY =
  "Dạ em đang xử lý hơi chậm một chút. Anh/chị nói thêm model hoặc nhu cầu sử dụng, em sẽ cố gắng gợi ý sát hơn cho mình nhé.";

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của ${siteConfig.name} tại ${siteConfig.locationLabel}.
Bạn luôn xưng hô thống nhất là "em" với khách và gọi khách là "anh/chị".
Minh Hồng chuyên đóng pin xe điện, pin máy khoan, pin loa kéo, pin đèn năng lượng mặt trời và lắp camera an ninh.
Trả lời bằng tiếng Việt tự nhiên, đi thẳng vào ý chính, chỉ 2 đến 4 câu ngắn.
Giọng điệu mềm, chăm sóc, tạo cảm giác dễ chịu và đáng tin, nhưng không xu nịnh hay lặp khuôn bán hàng.
Nếu khách hỏi tiếp một câu ngắn, hãy luôn nhìn lịch sử gần nhất để giữ đúng ngữ cảnh thay vì tự đổi sang chủ đề khác.
Nếu khách chỉ muốn hiểu vấn đề, hãy giải thích ngắn gọn và hữu ích trước, đừng cố ép sang báo giá.
Chỉ gợi ý gọi điện, nhắn Zalo hoặc để lại nhu cầu khi khách hỏi giá, muốn chốt cấu hình, cần khảo sát thực tế hoặc chủ động xin hỗ trợ thêm.
Nếu khách đang phân vân, hãy giúp họ thu hẹp lựa chọn trước rồi mới gợi ý bước tiếp theo thật nhẹ nhàng.
Không dùng markdown, không dùng ký hiệu như **, __, # hoặc danh sách dài.
Với câu hỏi kỹ thuật liên quan dịch vụ, hãy trả lời ngắn gọn và hữu ích trước.
Không bịa giá cụ thể nếu chưa đủ thông tin.
Nếu câu hỏi không liên quan đến dịch vụ của ${siteConfig.name}, hãy trả lời lịch sự rằng em chỉ hỗ trợ tư vấn về pin, NLMT và camera của cửa hàng, không trả lời sai chủ đề.
Không được trả lời nhầm sang báo giá hay dịch vụ khác nếu câu hỏi không khớp ý định của khách.`;

function normalizeProvider(provider: string | undefined): AIProvider {
  const value = provider?.trim().toLowerCase();
  if (value === "openai") return "openai";
  if (value === "9router") return "9router";
  return "gemini";
}

function removeTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeAssistantReply(value: string) {
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

function buildRouteMeta(
  plan: ChatbotResponsePlan,
  overrides: Partial<Pick<ChatRouteMeta, "usedFallback">> = {}
): ChatRouteMeta {
  return {
    intent: plan.intent,
    service: plan.service,
    serviceLabel: plan.serviceLabel,
    shouldOfferLeadForm: plan.shouldOfferLeadForm,
    shouldOfferHumanSupport: plan.shouldOfferHumanSupport,
    shouldSuggestServices: plan.shouldSuggestServices,
    ...overrides,
  };
}

function buildMissingAiReply(plan: ChatbotResponsePlan) {
  if (plan.intent === "quote" && plan.serviceLabel) {
    return `Em đang cập nhật phần tư vấn tự động sâu hơn cho ${plan.serviceLabel}. Nếu anh/chị để lại nhu cầu, bên em sẽ giữ đúng ngữ cảnh này và phản hồi sát hơn cho mình nhé.`;
  }

  if (plan.intent === "contact" && plan.serviceLabel) {
    return `Dạ em đã hiểu anh/chị đang cần hỗ trợ phần ${plan.serviceLabel}. Anh/chị để lại nhu cầu giúp em, bên em sẽ phản hồi đúng phần này để mình đỡ phải nhắc lại từ đầu.`;
  }

  if (plan.serviceLabel) {
    return `Em đang cập nhật phần hỏi đáp tự động cho ${plan.serviceLabel}. Anh/chị gửi thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý đúng hướng hơn cho mình nhé.`;
  }

  return "Em đang cập nhật phần hỏi đáp tự động. Anh/chị nói sơ giúp em mình đang quan tâm đóng pin, đèn NLMT hay camera để em gợi ý sát hơn nhé.";
}

function buildRuntimeFallbackReply(plan: ChatbotResponsePlan) {
  if (plan.intent === "quote" && plan.serviceLabel) {
    return `Dạ em đang phản hồi hơi chậm một chút ở phần ${plan.serviceLabel}. Nếu tiện, anh/chị để lại nhu cầu hoặc model giúp em, bên em sẽ tư vấn sát hơn cho mình nhé.`;
  }

  if (plan.intent === "contact" && plan.serviceLabel) {
    return `Dạ em vẫn đang theo đúng nhu cầu ${plan.serviceLabel} của anh/chị. Anh/chị để lại thông tin giúp em, bên em sẽ phản hồi tiếp để mình khỏi phải kể lại từ đầu nhé.`;
  }

  if (plan.serviceLabel) {
    return `Dạ em đang xử lý hơi chậm một chút ở phần ${plan.serviceLabel}. Anh/chị nói thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý sát hơn cho mình nhé.`;
  }

  return DEFAULT_FALLBACK_REPLY;
}

async function logChatbotEvent(
  event: ChatbotEventType,
  payload: Record<string, unknown> & {
    fallbackReason?: string;
    intent?: string | null;
    messagePreview?: string;
    service?: string | null;
    sourcePath?: string | null;
  }
) {
  const serialized = JSON.stringify(payload);

  if (event === "fallback") {
    console.warn(`[chatbot:${event}]`, serialized);
  } else {
    console.info(`[chatbot:${event}]`, serialized);
  }

  await recordChatbotEvent({
    eventType: event,
    fallbackReason: payload.fallbackReason,
    intent: payload.intent,
    messagePreview: payload.messagePreview,
    service: payload.service,
    sourcePath: payload.sourcePath,
  });
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

function normalizeHistoryIntent(value: string | null | undefined): ChatbotIntent | null {
  if (
    value === "greeting" ||
    value === "faq" ||
    value === "quote" ||
    value === "contact" ||
    value === "open_question" ||
    value === "general"
  ) {
    return value;
  }

  return null;
}

function normalizeHistoryRole(value: string): "user" | "assistant" {
  return value === "assistant" ? "assistant" : "user";
}

function sanitizeHistory(history: unknown): ChatbotConversationMessage[] {
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
      role: normalizeHistoryRole(item.role),
      content: sanitizeText(item.content).slice(0, 800),
      meta:
        item.meta && typeof item.meta === "object"
          ? {
              intent:
                typeof item.meta.intent === "string"
                  ? normalizeHistoryIntent(item.meta.intent)
                  : null,
              service: typeof item.meta.service === "string" ? item.meta.service : null,
            }
          : undefined,
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
  let plan: ChatbotResponsePlan | null = null;
  let sourcePath: string | null = null;
  let messagePreview = "";

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
    const serviceContext = normalizeChatbotServiceId(
      typeof body?.serviceContext === "string" ? body.serviceContext : null
    );
    sourcePath = sanitizeText(typeof body?.sourcePath === "string" ? body.sourcePath : "")
      .slice(0, 255)
      .trim() || null;
    messagePreview = message.slice(0, 120);

    if (!message) {
      return NextResponse.json(
        { success: false, reply: "Anh/chị nhập giúp em câu hỏi nhé." },
        { status: 400 }
      );
    }

    plan = analyzeChatbotMessage(message, { history, serviceContext });

    if (plan.localReply) {
      if (plan.shouldOfferLeadForm || plan.shouldSuggestServices || plan.shouldOfferHumanSupport) {
        await logChatbotEvent("lead_signal", {
          intent: plan.intent,
          service: plan.service,
          sourcePath,
          messagePreview,
        });
      }

      return NextResponse.json({
        success: true,
        reply: normalizeAssistantReply(plan.localReply),
        meta: buildRouteMeta(plan),
      });
    }

    const aiConfig = getAIConfig();
    const systemPrompt = [SYSTEM_PROMPT, buildChatbotServiceContextNote(plan.service || serviceContext)]
      .filter(Boolean)
      .join("\n");

    if (isMissingAIKey(aiConfig.apiKey)) {
      const fallbackReply = buildMissingAiReply(plan);
      await logChatbotEvent("fallback", {
        fallbackReason: "missing_ai_key",
        intent: plan.intent,
        service: plan.service,
        sourcePath,
        messagePreview,
      });

      return NextResponse.json({
        success: true,
        reply: normalizeAssistantReply(fallbackReply),
        meta: buildRouteMeta(plan, { usedFallback: true }),
      });
    }

    await logChatbotEvent("unmatched", {
      intent: plan.intent,
      service: plan.service,
      sourcePath,
      messagePreview,
    });

    let reply = DEFAULT_FALLBACK_REPLY;

    if (aiConfig.provider === "gemini") {
      reply = await callGemini(aiConfig.apiKey!, message, history, systemPrompt);
    } else if (aiConfig.provider === "openai") {
      reply = await callOpenAI(
        aiConfig.apiKey!,
        aiConfig.model,
        aiConfig.baseUrl,
        message,
        history,
        systemPrompt
      );
    } else {
      reply = await callNineRouter(
        aiConfig.apiKey!,
        aiConfig.model,
        aiConfig.baseUrl,
        message,
        history,
        systemPrompt
      );
    }

    const response = NextResponse.json({
      success: true,
      reply: normalizeAssistantReply(reply) || buildRuntimeFallbackReply(plan),
      meta: buildRouteMeta(plan),
    });
    response.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    console.error("Chat API Error:", error);

    if (plan) {
      await logChatbotEvent("fallback", {
        fallbackReason: "runtime_error",
        intent: plan.intent,
        service: plan.service,
        sourcePath,
        messagePreview,
      });
    }

    return NextResponse.json({
      success: true,
      reply: plan ? buildRuntimeFallbackReply(plan) : DEFAULT_FALLBACK_REPLY,
      meta: plan ? buildRouteMeta(plan, { usedFallback: true }) : undefined,
    });
  }
}

async function callGemini(
  apiKey: string,
  userMessage: string,
  history: ChatMessage[] = [],
  systemPrompt: string
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
      system_instruction: { parts: [{ text: systemPrompt }] },
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
      return await callGeminiFallback(apiKey, userMessage, systemPrompt);
    } catch {
      return DEFAULT_FALLBACK_REPLY;
    }
  }

  return data?.candidates?.[0]?.content?.parts?.[0]?.text || DEFAULT_FALLBACK_REPLY;
}

async function callGeminiFallback(
  apiKey: string,
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
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
  systemPrompt,
  userMessage,
}: ChatCompletionOptions): Promise<string> {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

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
  history: ChatMessage[] = [],
  systemPrompt: string
): Promise<string> {
  return callOpenAICompatible({
    apiKey,
    baseUrl,
    history,
    label: "OpenAI",
    model,
    systemPrompt,
    userMessage,
  });
}

async function callNineRouter(
  apiKey: string,
  model: string,
  baseUrl: string,
  userMessage: string,
  history: ChatMessage[] = [],
  systemPrompt: string
): Promise<string> {
  return callOpenAICompatible({
    apiKey,
    baseUrl,
    history,
    label: "9Router",
    model,
    systemPrompt,
    userMessage,
  });
}
