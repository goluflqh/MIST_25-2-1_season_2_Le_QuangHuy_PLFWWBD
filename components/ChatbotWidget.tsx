"use client";

import { useState, useRef, useEffect } from "react";
import { getLocalChatbotReply } from "@/lib/chatbot";
import { siteConfig } from "@/lib/site";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

const HOTLINE = siteConfig.hotlineDisplay;

function normalizeChatText(value: string): string {
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

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Xin chào anh/chị! Em là trợ lý tư vấn của Minh Hồng. Anh/chị đang cần tư vấn về đóng pin, đèn năng lượng mặt trời hay lắp camera ạ?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: normalizeChatText(text),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    // Bước 1: Phân loại — FAQ hay AI?
    const faqAnswer = getLocalChatbotReply(text);

    if (faqAnswer) {
      // Câu hỏi đơn giản → trả lời tức thì (MIỄN PHÍ, không tốn quota)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: normalizeChatText(faqAnswer),
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      return;
    }

    // Bước 2: Câu hỏi mở/phức tạp → gửi AI API (tốn quota)
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .slice(-6)
        .map((m) => ({ role: m.role, content: normalizeChatText(m.content) }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content:
            normalizeChatText(data.reply) ||
            `Em chưa hiểu rõ ý anh/chị lắm. Anh/chị có thể hỏi rõ hơn một chút, hoặc gọi ${HOTLINE} nếu muốn bên em tư vấn nhanh nhé!`,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Dạ, hiện tại hệ thống đang hơi bận. Anh/chị gọi ${HOTLINE} thì bên em hỗ trợ nhanh hơn ngay ạ!`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[340px] sm:w-[380px] h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-slate-900 px-5 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-linear-to-r from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
                MH
              </div>
              <div>
                <p className="font-heading font-bold text-white text-sm">Minh Hồng AI</p>
                <p className="text-[10px] text-green-400 font-body flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span> Trực tuyến
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="Đóng chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm font-body leading-relaxed ${
                    msg.role === "user"
                      ? "bg-slate-900 text-white rounded-br-sm"
                      : "bg-white text-slate-700 border border-slate-200 rounded-bl-sm shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce animation-delay-150"></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce animation-delay-300"></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto shrink-0">
            {["Giá đóng pin?", "Đèn NLMT", "Lắp camera", "Địa chỉ shop"].map((q) => (
              <button
                key={q}
                onClick={() => sendMessage(q)}
                className="shrink-0 text-xs font-body font-semibold px-3 py-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="px-3 py-3 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-body focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !inputValue.trim()}
                className="w-10 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white flex items-center justify-center transition-colors shrink-0"
                aria-label="Gửi tin nhắn"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bubble */}
      <div className="fixed bottom-6 right-4 sm:right-6 z-50 flex items-end gap-3">
        {/* Tooltip label — visible when closed */}
        {!isOpen && (
          <div className="mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-body font-bold rounded-xl shadow-lg animate-fade-in-up whitespace-nowrap">
            Hỏi AI tư vấn 🤖
            <div className="absolute -right-1.5 bottom-3 w-3 h-3 bg-slate-900 rotate-45"></div>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative group rounded-full w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center shadow-lg hover:shadow-2xl transition-all transform hover:scale-110"
          aria-label="Mở chatbot tư vấn AI"
          style={{ background: "linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #f59e0b 100%)" }}
        >
          {/* Pulse glow ring */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "linear-gradient(135deg, #dc2626, #f59e0b)" }}></span>
          )}

          {isOpen ? (
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            /* Robot face icon */
            <svg className="w-8 h-8 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="none">
              {/* Head */}
              <rect x="4" y="6" width="16" height="14" rx="3" fill="white" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
              {/* Antenna */}
              <line x1="12" y1="6" x2="12" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="2.5" r="1.5" fill="currentColor" />
              {/* Eyes */}
              <circle cx="9" cy="12" r="1.8" fill="currentColor" />
              <circle cx="15" cy="12" r="1.8" fill="currentColor" />
              {/* Smile */}
              <path d="M9 16 C10 17.5, 14 17.5, 15 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              {/* Sparkle */}
              <circle cx="9" cy="11.5" r="0.5" fill="white" opacity="0.8"/>
              <circle cx="15" cy="11.5" r="0.5" fill="white" opacity="0.8"/>
            </svg>
          )}

          {/* Notification badge */}
          {!isOpen && (
            <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60"></span>
              <span className="relative inline-flex items-center justify-center rounded-full h-5 w-5 bg-green-500 border-2 border-white text-[8px] text-white font-black">AI</span>
            </span>
          )}
        </button>
      </div>
    </>
  );
}
