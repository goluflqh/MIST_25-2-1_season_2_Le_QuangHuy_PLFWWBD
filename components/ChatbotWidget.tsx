"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  analyzeChatbotMessage,
  chatbotServiceChoices,
  getChatbotLeadSource,
  getChatbotServiceLabel,
  normalizeChatbotServiceId,
  type ChatbotConversationMessage,
  type ChatbotIntent,
  type ChatbotResponsePlan,
  type ChatbotServiceId,
} from "@/lib/chatbot";
import {
  buildChatbotRuntimeFallbackReply,
  CHATBOT_WIDGET_COPY,
  CHATBOT_WIDGET_QUICK_PROMPTS,
  getChatbotLeadActionLabel,
  getChatbotLoadingCopy,
  getChatbotZaloActionLabel,
} from "@/lib/chatbot-content";
import { siteConfig } from "@/lib/site";

interface AssistantMeta {
  intent: ChatbotIntent;
  service: ChatbotServiceId | null;
  serviceLabel: string | null;
  shouldOfferLeadForm: boolean;
  shouldOfferHumanSupport: boolean;
  shouldSuggestServices: boolean;
  usedFallback?: boolean;
}

interface MessageAction {
  external?: boolean;
  href?: string;
  id: string;
  kind: "link" | "prompt";
  label: string;
  prompt?: string;
  tone: "primary" | "secondary";
}

interface Message {
  actions?: MessageAction[];
  content: string;
  id: string;
  meta?: AssistantMeta;
  role: "user" | "assistant" | "system";
  timestamp: Date;
}

function normalizeChatText(value: string) {
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

function buildLeadHref(service: ChatbotServiceId | null, userMessage: string) {
  const params = new URLSearchParams();
  const normalizedMessage = normalizeChatText(userMessage).slice(0, 180);

  if (service && service !== "KHAC") {
    params.set("service", service);
  }

  params.set("source", getChatbotLeadSource(service));

  if (normalizedMessage) {
    params.set("message", normalizedMessage);
  }

  return `/?${params.toString()}#quote`;
}

function getLatestServiceContext(messages: Message[]) {
  const latestAssistantWithService = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.meta?.service);

  return latestAssistantWithService?.meta?.service || null;
}

function buildConversationHistory(messages: Message[]): ChatbotConversationMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .slice(-8)
    .map((message) => ({
      role: message.role,
      content: normalizeChatText(message.content),
      meta: message.meta
        ? {
            intent: message.meta.intent,
            service: message.meta.service,
          }
        : undefined,
    }));
}

function countRecentServiceAssistantMessages(messages: Message[], service: ChatbotServiceId | null) {
  if (!service) {
    return 0;
  }

  return messages
    .filter((message) => message.role === "assistant" && message.meta?.service === service)
    .slice(-3).length;
}

function enhanceAssistantMeta(
  meta: AssistantMeta | undefined,
  options: {
    serviceMomentum: number;
  }
): AssistantMeta | undefined {
  if (!meta) {
    return undefined;
  }

  const shouldSoftOfferLeadForm =
    Boolean(meta.service) &&
    !meta.shouldOfferLeadForm &&
    (meta.intent === "open_question" || Boolean(meta.usedFallback)) &&
    options.serviceMomentum >= 1;

  return {
    ...meta,
    shouldOfferLeadForm: meta.shouldOfferLeadForm || shouldSoftOfferLeadForm,
  };
}

function toAssistantMeta(
  value:
    | (Partial<AssistantMeta> & { usedFallback?: boolean })
    | (Partial<ChatbotResponsePlan> & { usedFallback?: boolean })
    | null
    | undefined,
  fallbackService: ChatbotServiceId | null = null
): AssistantMeta | undefined {
  if (!value) return undefined;

  const service =
    normalizeChatbotServiceId(
      typeof value.service === "string" ? value.service : fallbackService
    ) || fallbackService;

  return {
    intent: (value.intent as ChatbotIntent | undefined) || "general",
    service,
    serviceLabel:
      typeof value.serviceLabel === "string"
        ? value.serviceLabel
        : getChatbotServiceLabel(service),
    shouldOfferLeadForm: Boolean(value.shouldOfferLeadForm),
    shouldOfferHumanSupport: Boolean(value.shouldOfferHumanSupport),
    shouldSuggestServices: Boolean(value.shouldSuggestServices),
    usedFallback: Boolean(value.usedFallback),
  };
}

function buildAssistantActions(meta: AssistantMeta | undefined, userMessage: string): MessageAction[] {
  if (!meta) {
    return [];
  }

  if (meta.shouldSuggestServices) {
    return chatbotServiceChoices.map((choice) => ({
      id: `suggest-${choice.id.toLowerCase()}`,
      kind: "prompt",
      label: choice.label,
      prompt: choice.prompt,
      tone: "secondary",
    }));
  }

  const actions: MessageAction[] = [];

  if (meta.shouldOfferLeadForm) {
    actions.push({
      id: "lead-form",
      kind: "link",
      label: getChatbotLeadActionLabel(meta.intent, meta.usedFallback),
      href: buildLeadHref(meta.service, userMessage),
      tone: "primary",
    });
  }

  if (meta.shouldOfferHumanSupport || (meta.shouldOfferLeadForm && Boolean(meta.service))) {
    actions.push({
      id: "zalo",
      external: true,
      href: siteConfig.zaloUrl,
      kind: "link",
      label: getChatbotZaloActionLabel(meta.shouldOfferHumanSupport),
      tone: "secondary",
    });
  }

  return actions;
}

function createAssistantMessage(
  content: string,
  meta?: AssistantMeta,
  userMessage = ""
): Message {
  return {
    actions: buildAssistantActions(meta, userMessage),
    content: normalizeChatText(content),
    id: (Date.now() + Math.random()).toString(),
    meta,
    role: "assistant",
    timestamp: new Date(),
  };
}

function getCurrentSourcePath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return `${window.location.pathname}${window.location.search}`;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: CHATBOT_WIDGET_COPY.welcomeMessage,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingMeta, setPendingMeta] = useState<AssistantMeta | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadingCopy = getChatbotLoadingCopy(pendingMeta?.intent, pendingMeta?.serviceLabel);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || inputValue).trim();
    if (!text || isLoading) return;

    const normalizedUserText = normalizeChatText(text);
    const serviceContext = getLatestServiceContext(messages);
    const conversationHistory = buildConversationHistory(messages);
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: normalizedUserText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    const localPlan = analyzeChatbotMessage(text, {
      history: conversationHistory,
      serviceContext,
    });

    if (localPlan.localReply) {
      const localReply = localPlan.localReply;
      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          localReply,
          toAssistantMeta(localPlan, localPlan.service || serviceContext),
          normalizedUserText
        ),
      ]);
      setPendingMeta(undefined);
      setIsLoading(false);
      return;
    }

    const responseMeta = enhanceAssistantMeta(
      toAssistantMeta(localPlan, localPlan.service || serviceContext),
      {
        serviceMomentum: countRecentServiceAssistantMessages(
          messages,
          localPlan.service || serviceContext
        ),
      }
    );

    setPendingMeta(responseMeta);
    setIsLoading(true);

    try {
      const history = [...conversationHistory, { role: "user", content: normalizedUserText }];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history,
          message: text,
          serviceContext: localPlan.service || serviceContext,
          sourcePath: getCurrentSourcePath(),
        }),
      });

      const data = await res.json();
      const assistantMeta = enhanceAssistantMeta(
        toAssistantMeta(data?.meta, localPlan.service || serviceContext),
        {
          serviceMomentum: countRecentServiceAssistantMessages(
            messages,
            localPlan.service || serviceContext
          ),
        }
      );

      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          typeof data?.reply === "string"
            ? data.reply
            : buildChatbotRuntimeFallbackReply(localPlan.intent, localPlan.serviceLabel),
          assistantMeta,
          normalizedUserText
        ),
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        createAssistantMessage(
          buildChatbotRuntimeFallbackReply(localPlan.intent, localPlan.serviceLabel)
        ),
      ]);
    } finally {
      setPendingMeta(undefined);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const renderMessageActions = (message: Message) => {
    if (!message.actions?.length) {
      return null;
    }

    return (
      <div data-testid="chatbot-message-actions" className="mt-2 flex max-w-[90%] flex-wrap gap-2">
        {message.actions.map((action) => {
          const baseClass =
            action.tone === "primary"
              ? "inline-flex items-center justify-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-body font-semibold text-white transition-colors hover:bg-slate-800"
              : "inline-flex items-center justify-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-body font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100";

          if (action.kind === "prompt") {
            return (
              <button
                key={action.id}
                data-testid={`chatbot-action-${action.id}`}
                onClick={() => sendMessage(action.prompt)}
                className={baseClass}
                type="button"
              >
                {action.label}
              </button>
            );
          }

          if (action.external) {
            return (
              <a
                key={action.id}
                data-testid={`chatbot-action-${action.id}`}
                href={action.href}
                target="_blank"
                rel="noopener noreferrer"
                className={baseClass}
                onClick={() => setIsOpen(false)}
              >
                {action.label}
              </a>
            );
          }

          return (
            <Link
              key={action.id}
              data-testid={`chatbot-action-${action.id}`}
              href={action.href || "/"}
              className={baseClass}
              onClick={() => setIsOpen(false)}
            >
              {action.label}
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          data-testid="chatbot-panel"
          className="animate-fade-in-up fixed bottom-20 left-3 right-3 z-50 flex h-[min(78dvh,34rem)] max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl sm:bottom-24 sm:left-auto sm:right-6 sm:h-[500px] sm:w-[380px] sm:max-w-[380px]"
        >
          <div className="flex shrink-0 items-center justify-between bg-slate-900 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-r from-red-500 to-orange-500 text-sm font-bold text-white">
                MH
              </div>
              <div>
                <p className="font-heading text-sm font-bold text-white">{CHATBOT_WIDGET_COPY.title}</p>
                <p className="flex items-center gap-1 text-[10px] text-green-400 font-body">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>{" "}
                  {CHATBOT_WIDGET_COPY.onlineStatus}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 transition-colors hover:text-white"
              aria-label="Đóng chat"
              type="button"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    message.role === "user"
                      ? "flex max-w-[80%] flex-col items-end"
                      : "flex max-w-[90%] flex-col items-start"
                  }
                >
                  <div
                    data-testid={
                      message.role === "assistant"
                        ? "chatbot-assistant-message"
                        : message.role === "user"
                          ? "chatbot-user-message"
                          : undefined
                    }
                    className={`px-4 py-2.5 text-sm leading-relaxed font-body ${
                      message.role === "user"
                        ? "rounded-2xl rounded-br-sm bg-slate-900 text-white"
                        : "rounded-2xl rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
                    }`}
                  >
                    {message.content}
                  </div>
                  {message.role === "assistant" ? renderMessageActions(message) : null}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-body font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"></span>
                    {loadingCopy.headline}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {loadingCopy.detail}
                  </p>
                  <div className="mt-3 flex gap-1.5">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-slate-300"></span>
                    <span className="animation-delay-150 h-2 w-2 animate-bounce rounded-full bg-slate-300"></span>
                    <span className="animation-delay-300 h-2 w-2 animate-bounce rounded-full bg-slate-300"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex shrink-0 snap-x gap-2 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {CHATBOT_WIDGET_QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => sendMessage(item.prompt)}
                  className="shrink-0 snap-start whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-body font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100"
                  type="button"
                >
                  {item.label}
                </button>
              )
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-white px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                data-testid="chatbot-input"
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={CHATBOT_WIDGET_COPY.inputPlaceholder}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-body outline-none transition-all focus:border-red-500 focus:ring-2 focus:ring-red-500 sm:text-sm"
                disabled={isLoading}
              />
              <button
                data-testid="chatbot-send"
                onClick={() => sendMessage()}
                disabled={isLoading || !inputValue.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:bg-slate-300"
                aria-label="Gửi tin nhắn"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-3 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
        {!isOpen && (
          <div className="animate-fade-in-up relative mr-1 hidden items-center gap-2 whitespace-nowrap rounded-full bg-slate-950 px-3.5 py-2 text-xs font-body font-bold text-white shadow-xl shadow-slate-900/20 sm:inline-flex">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
            </span>
            {CHATBOT_WIDGET_COPY.floatingBadge}
            <div className="absolute -bottom-1 right-6 h-3 w-3 rotate-45 bg-slate-950"></div>
          </div>
        )}

        <button
          data-testid="chatbot-toggle"
          onClick={() => setIsOpen((current) => !current)}
          className="chatbot-float-button group relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-200 sm:h-16 sm:w-16"
          aria-label="Mở AI tư vấn chuyên nghiệp"
          style={{
            background: "linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #f59e0b 100%)",
          }}
          type="button"
        >
          {!isOpen && (
            <>
              <span className="chatbot-float-aura absolute inset-0 rounded-full"></span>
              <span className="chatbot-float-ring absolute -inset-1 rounded-full border border-orange-300/70"></span>
            </>
          )}

          {isOpen ? (
            <svg className="relative z-10 h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="chatbot-float-icon relative z-10 h-7 w-7 text-white drop-shadow-sm sm:h-8 sm:w-8" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="14" rx="3" fill="white" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
              <line x1="12" y1="6" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="12" cy="2.5" r="1.5" fill="currentColor" />
              <circle cx="9" cy="12" r="1.8" fill="currentColor" />
              <circle cx="15" cy="12" r="1.8" fill="currentColor" />
              <path d="M9 16 C10 17.5, 14 17.5, 15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              <circle cx="9" cy="11.5" r="0.5" fill="white" opacity="0.8" />
              <circle cx="15" cy="11.5" r="0.5" fill="white" opacity="0.8" />
            </svg>
          )}

          {!isOpen && (
            <span className="absolute -right-0.5 -top-0.5 z-20 flex h-5 min-w-5">
              <span className="chatbot-ai-badge relative inline-flex h-5 min-w-5 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-emerald-500 px-1 text-[8px] font-black text-white shadow-md shadow-emerald-500/30">
                AI
              </span>
            </span>
          )}
        </button>
      </div>
    </>
  );
}
