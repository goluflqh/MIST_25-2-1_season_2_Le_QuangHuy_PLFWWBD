import { NextResponse } from "next/server";
import {
  analyzeChatbotMessage,
  buildChatbotServiceContextNote,
  normalizeChatbotServiceId,
  normalizeLookupText,
  type ChatbotIntent,
  type ChatbotConversationMessage,
  type ChatbotResponsePlan,
} from "@/lib/chatbot";
import {
  buildChatbotMissingAiReply,
  buildChatbotRuntimeFallbackReply,
  buildChatbotTrainingContext,
  CHATBOT_WIDGET_COPY,
} from "@/lib/chatbot-content";
import { recordChatbotEvent, type ChatbotEventType } from "@/lib/chatbot-metrics";
import { buildChatbotPricingContext } from "@/lib/chatbot-pricing";
import { getPublicActivePricingItems } from "@/lib/public-data";
import { checkRateLimitForRequest, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
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
const MAX_HISTORY_CONTENT_CHARS = 800;
const AI_MAX_OUTPUT_TOKENS = 220;
const CHAT_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_CHAT_CACHE_ENTRIES = 80;
const DEFAULT_FALLBACK_REPLY = CHATBOT_WIDGET_COPY.defaultReplyFallback;
const CHATBOT_BUSINESS_SCOPE_NOTE = `Phạm vi cửa hàng đã xác nhận: Minh Hồng tập trung vào đóng pin Lithium, đèn năng lượng mặt trời, pin lưu trữ hoặc kích đề và camera. Nếu câu hỏi chưa rõ đang thuộc nhóm nào, hãy giúp khách thu hẹp đúng dịch vụ trước rồi mới tư vấn sâu. Với đóng pin, kiểm tra pin là miễn phí hoàn toàn; có thể nhắc điều này khi khách hỏi kiểm tra, lỗi pin hoặc đang phân vân trước khi sửa/đóng lại.`;
const DIRECT_ANSWER_SIGNALS = [
  "hoi nhieu",
  "cu liet ke",
  "liet ke di",
  "liet ke nhanh",
  "noi luon",
  "noi thang",
  "bao khoang",
  "uoc chung",
  "dai khai",
  "khoi hoi",
  "dung hoi",
];
const QUOTE_REFINEMENT_SIGNALS = [
  "mp",
  "24/7",
  "24 7",
  "chuyen dong",
  "ghi lien tuc",
  "am tuong",
  "am tran",
  "trong nha",
  "ngoai troi",
  "xoay 360",
  "co mic",
  "co am thanh",
  "luu",
  "thang",
  "ngay",
  "nam",
];

const chatbotReplyCache = new Map<string, { expiresAt: number; reply: string }>();

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn của ${siteConfig.name} tại ${siteConfig.locationLabel}.
Bạn luôn xưng hô thống nhất là "em" với khách và gọi khách là "anh/chị".
Minh Hồng chuyên đóng pin xe điện, pin máy khoan, pin loa kéo, pin đèn năng lượng mặt trời và lắp camera an ninh.
Trả lời bằng tiếng Việt tự nhiên, đi thẳng vào ý chính, chỉ 2 đến 4 câu ngắn.
Giọng điệu mềm, chăm sóc, tạo cảm giác dễ chịu và đáng tin, nhưng không xu nịnh hay lặp khuôn bán hàng.
Nếu khách hỏi tiếp một câu ngắn, hãy luôn nhìn lịch sử gần nhất để giữ đúng ngữ cảnh thay vì tự đổi sang chủ đề khác.
Nếu khách chỉ muốn hiểu vấn đề, hãy giải thích ngắn gọn và hữu ích trước, đừng cố ép sang báo giá.
Chỉ gợi ý gọi điện, nhắn Zalo hoặc để lại nhu cầu khi khách hỏi giá, muốn chốt cấu hình, cần khảo sát thực tế hoặc chủ động xin hỗ trợ thêm.
Nếu khách đang phân vân, hãy giúp họ thu hẹp lựa chọn trước rồi mới gợi ý bước tiếp theo thật nhẹ nhàng.
Ưu tiên trả lời linh hoạt theo ý thật của khách và lịch sử chat, không lặp lại các mẫu FAQ cứng nhắc nếu chưa cần.
Chỉ coi các dữ kiện doanh nghiệp được cung cấp trong prompt là chắc chắn; nếu thiếu dữ liệu thực tế thì nói rõ cần thêm thông tin, không tự bịa giá, thông số hay cam kết.
Khi câu hỏi là tư vấn kỹ thuật hoặc so sánh phương án, có thể dùng hiểu biết chung an toàn để giải thích ngắn gọn, nhưng phải neo lại về nhu cầu thực tế của khách thay vì nói chung chung.
Không dùng markdown, không dùng ký hiệu như **, __, # hoặc danh sách dài.
Với câu hỏi kỹ thuật liên quan dịch vụ, hãy trả lời ngắn gọn và hữu ích trước.
Không bịa giá cụ thể nếu chưa đủ thông tin.
Nếu câu hỏi không liên quan đến dịch vụ của ${siteConfig.name}, hãy trả lời lịch sự rằng em chỉ hỗ trợ tư vấn về pin, NLMT và camera của cửa hàng, không trả lời sai chủ đề.
Không được trả lời nhầm sang báo giá hay dịch vụ khác nếu câu hỏi không khớp ý định của khách.`;

function buildChatbotIntentContextNote(
  plan: ChatbotResponsePlan,
  options: {
    hasRecentQuoteContext: boolean;
    prefersDirectAnswer: boolean;
    quoteRefinementMode: boolean;
  }
) {
  const serviceNote = plan.serviceLabel ? ` về ${plan.serviceLabel}` : "";

  if (
    plan.intent === "quote" ||
    options.quoteRefinementMode ||
    (options.prefersDirectAnswer && plan.service)
  ) {
    return [
      `Ý định hiện tại: khách đang hỏi giá hoặc chi phí${serviceNote}. Hãy trả lời mềm nhưng phải hữu ích ngay.`,
      options.quoteRefinementMode
        ? "Đây là lượt bổ sung thông số tiếp theo trong cùng mạch báo giá. Hãy cập nhật luôn khoảng phù hợp từ ngữ cảnh đã có, không quay lại hỏi từ đầu."
        : "",
      "Ưu tiên nêu khoảng giá hoặc 2 đến 4 phương án phù hợp trước, rồi mới hỏi thêm tối đa 1 chi tiết quan trọng nhất nếu thật sự cần.",
      "Không báo con số bịa ra ngoài dữ liệu công khai đã được cung cấp trong prompt.",
      options.prefersDirectAnswer
        ? "Khách đang muốn câu trả lời thẳng và nhanh. Đừng hỏi dồn; hãy liệt kê ngắn gọn các lựa chọn trước."
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  if (plan.intent === "contact") {
    return `Ý định hiện tại: khách đang muốn người thật hỗ trợ${serviceNote}. Hãy xác nhận là em đã hiểu nhu cầu, mời khách mô tả ngắn thêm nếu cần, nhưng đừng vòng vo và đừng ép bán.`;
  }

  if (plan.intent === "faq" || plan.intent === "open_question") {
    return [
      `Ý định hiện tại: khách muốn hiểu vấn đề${serviceNote}. Hãy trả lời trực diện, rõ và hữu ích trước.`,
      "Nếu khách hỏi kiểu 'là gì', 'dùng như thế nào', 'có nên không', 'khác nhau ra sao' thì hãy trả lời như một bách khoa mini: giải thích khái niệm dễ hiểu, ứng dụng thực tế, lưu ý chọn và cách dùng ngắn gọn.",
      options.hasRecentQuoteContext
        ? "Nếu lịch sử cho thấy khách vừa hỏi giá hoặc cấu hình thì sau phần giải thích ngắn, hãy nối lại bằng 1 khoảng giá hoặc 1-2 phương án phù hợp thay vì quay về hỏi dồn."
        : "Nếu còn thiếu dữ liệu thực tế thì hỏi lại tối đa 1 chi tiết thay vì trả lời quá cứng hoặc quá chung.",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return "Nếu câu hỏi còn mơ hồ, hãy giúp khách thu hẹp về đúng nhóm dịch vụ trước khi đi sâu.";
}

function hasRecentQuoteContext(history: ChatMessage[], service: ChatbotResponsePlan["service"]) {
  return history
    .slice(-4)
    .some(
      (item) =>
        item.meta?.intent === "quote" &&
        (!service || !item.meta?.service || item.meta.service === service)
    );
}

function prefersDirectAnswer(
  message: string,
  history: ChatMessage[],
  service: ChatbotResponsePlan["service"]
) {
  const normalizedMessage = normalizeLookupText(message);

  if (DIRECT_ANSWER_SIGNALS.some((signal) => normalizedMessage.includes(signal))) {
    return true;
  }

  if (!service) {
    return false;
  }

  const recentSameServiceAssistantTurns = history
    .slice(-4)
    .filter((item) => item.role === "assistant" && item.meta?.service === service).length;

  return recentSameServiceAssistantTurns >= 2 && normalizedMessage.split(" ").length <= 6;
}

function isQuoteRefinementMessage(
  message: string,
  history: ChatMessage[],
  service: ChatbotResponsePlan["service"],
  hasRecentQuoteContextValue: boolean
) {
  if (!service || !hasRecentQuoteContextValue) {
    return false;
  }

  const normalizedMessage = normalizeLookupText(message);

  if (!normalizedMessage) {
    return false;
  }

  const wordCount = normalizedMessage.split(" ").filter(Boolean).length;
  const hasStandaloneNumber = /(?:^|\s)\d+(?:[.,]\d+)?(?:\s|$)/u.test(normalizedMessage);
  const mentionsQuoteRefinementSignal = QUOTE_REFINEMENT_SIGNALS.some((signal) =>
    normalizedMessage.includes(signal)
  );
  const lastAssistantAskedForDetails = history
    .slice(-3)
    .some(
      (item) =>
        item.role === "assistant" &&
        item.meta?.service === service &&
        /(bao nhieu|luu|thang|ngay|mp|24\/7|chuyen dong|am tuong|camera)/iu.test(
          normalizeLookupText(item.content)
        )
    );

  return (
    (wordCount <= 6 && (hasStandaloneNumber || mentionsQuoteRefinementSignal)) ||
    lastAssistantAskedForDetails
  );
}

function shouldTrackAsTrainingGap(plan: ChatbotResponsePlan) {
  if (plan.shouldSuggestServices) {
    return false;
  }

  return !plan.service && plan.intent !== "quote" && plan.intent !== "contact";
}

function buildPricingSignalText(message: string, history: ChatMessage[]) {
  const recentUserMessages = history
    .filter((item) => item.role === "user")
    .slice(-3)
    .map((item) => item.content.trim())
    .filter(Boolean);

  if (!recentUserMessages.some((item) => item === message)) {
    recentUserMessages.push(message);
  }

  return recentUserMessages.join(" | ");
}

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

function buildChatCacheKey(
  provider: AIProvider,
  model: string,
  plan: ChatbotResponsePlan,
  message: string,
  history: ChatMessage[]
) {
  const historyFingerprint = history
    .slice(-3)
    .map((item) => `${item.role}:${item.content.slice(0, 120)}`)
    .join("|");

  return JSON.stringify({
    historyFingerprint,
    intent: plan.intent,
    message,
    model,
    provider,
    service: plan.service,
  });
}

function getCachedChatReply(cacheKey: string) {
  const cached = chatbotReplyCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    chatbotReplyCache.delete(cacheKey);
    return null;
  }

  return cached.reply;
}

function setCachedChatReply(cacheKey: string, reply: string) {
  if (chatbotReplyCache.size >= MAX_CHAT_CACHE_ENTRIES) {
    const firstKey = chatbotReplyCache.keys().next().value;

    if (firstKey) {
      chatbotReplyCache.delete(firstKey);
    }
  }

  chatbotReplyCache.set(cacheKey, {
    expiresAt: Date.now() + CHAT_CACHE_TTL_MS,
    reply,
  });
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
      content: sanitizeText(item.content).slice(0, MAX_HISTORY_CONTENT_CHARS),
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
    const rl = await checkRateLimitForRequest(`chat:${ip}`, RATE_LIMITS.chat);

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
    const recentQuoteContext = hasRecentQuoteContext(history, plan.service);
    const directAnswerMode = prefersDirectAnswer(message, history, plan.service);
    const quoteRefinementMode = isQuoteRefinementMessage(
      message,
      history,
      plan.service,
      recentQuoteContext
    );

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
    const pricingItems =
      plan.service &&
      (plan.intent === "quote" || recentQuoteContext || directAnswerMode || quoteRefinementMode)
        ? await getPublicActivePricingItems()
        : [];
    const pricingSignalText = buildPricingSignalText(message, history);
    const systemPrompt = [
      SYSTEM_PROMPT,
      CHATBOT_BUSINESS_SCOPE_NOTE,
      buildChatbotServiceContextNote(plan.service || serviceContext),
      buildChatbotTrainingContext(plan.service || serviceContext, plan.intent),
      buildChatbotPricingContext(plan.service, pricingSignalText, pricingItems),
      buildChatbotIntentContextNote(plan, {
        hasRecentQuoteContext: recentQuoteContext,
        prefersDirectAnswer: directAnswerMode,
        quoteRefinementMode,
      }),
    ]
      .filter(Boolean)
      .join("\n");

    if (isMissingAIKey(aiConfig.apiKey)) {
      const fallbackReply = buildChatbotMissingAiReply(plan.intent, plan.serviceLabel);
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

    const responseEvent = shouldTrackAsTrainingGap(plan) ? "unmatched" : "ai_answered";

    await logChatbotEvent(responseEvent, {
      fallbackReason: responseEvent === "unmatched" ? "training_gap" : undefined,
      intent: plan.intent,
      service: plan.service,
      sourcePath,
      messagePreview,
    });

    const cacheKey = buildChatCacheKey(aiConfig.provider, aiConfig.model, plan, message, history);
    const cachedReply = getCachedChatReply(cacheKey);
    let reply = cachedReply || DEFAULT_FALLBACK_REPLY;

    if (!cachedReply) {
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

      reply =
        normalizeAssistantReply(reply) ||
        buildChatbotRuntimeFallbackReply(plan.intent, plan.serviceLabel);
      setCachedChatReply(cacheKey, reply);
    }

    if (plan.shouldOfferLeadForm || plan.shouldOfferHumanSupport || plan.shouldSuggestServices) {
      await logChatbotEvent("lead_signal", {
        intent: plan.intent,
        service: plan.service,
        sourcePath,
        messagePreview,
      });
    }

    return NextResponse.json({
      success: true,
      reply,
      meta: buildRouteMeta(plan),
    });
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
      reply: plan
        ? buildChatbotRuntimeFallbackReply(plan.intent, plan.serviceLabel)
        : DEFAULT_FALLBACK_REPLY,
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
        maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
        temperature: 0.3,
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
        temperature: 0.25,
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
      max_tokens: AI_MAX_OUTPUT_TOKENS,
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
