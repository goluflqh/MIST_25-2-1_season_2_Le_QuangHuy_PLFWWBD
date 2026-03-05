"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

// FAQ: câu hỏi đơn giản, trả lời cố định (tiết kiệm quota)
const FAQ_DATA = [
  {
    answer: "Giá đóng pin tuỳ thuộc vào loại cell, dung lượng và thiết bị. Pin máy khoan từ 350k-800k, pin xe đạp điện từ 2tr-5tr, pin loa kéo từ 200k-500k. Liên hệ 0987.443.258 để được báo giá chính xác!",
    keywords: ["giá", "bao nhiêu", "chi phí", "tiền"],
    requiredKeywords: ["pin", "đóng", "giá", "bao nhiêu"],
  },
  {
    answer: "Minh Hồng bảo hành pin 6-12 tháng lỗi 1 đổi 1 tuỳ loại. Camera bảo hành 24 tháng phần cứng. Bảo dưỡng cân bằng cell miễn phí trọn đời!",
    keywords: ["bảo hành", "warranty", "đổi trả", "lỗi 1 đổi 1"],
    requiredKeywords: ["bảo hành"],
  },
  {
    answer: "Có! Minh Hồng nhận lắp đặt camera an ninh cho nhà ở, cửa hàng, xưởng sản xuất. Khảo sát miễn phí tận nơi, thi công trong ngày. Gọi 0987.443.258!",
    keywords: ["camera", "lắp đặt", "an ninh", "giám sát"],
    requiredKeywords: ["camera", "lắp"],
  },
  {
    answer: "Minh Hồng tại: Xã Đồng Dương, TP. Đà Nẵng. Mở cửa 6h-21h hàng ngày. Hotline: 0987.443.258. Nhận ship toàn quốc!",
    keywords: ["địa chỉ", "ở đâu", "chỗ nào", "liên hệ", "số điện thoại", "hotline"],
    requiredKeywords: ["địa chỉ", "ở đâu", "chỗ nào", "liên hệ", "hotline"],
  },
  {
    answer: "Có! Minh Hồng chuyên đóng pin xe đạp điện, xe máy điện. Dùng cell Lithium Samsung/LG chính hãng. Bảo hành 12 tháng. Gọi 0987.443.258 để báo giá theo xe!",
    keywords: ["xe điện", "xe đạp điện", "xe máy điện"],
    requiredKeywords: ["xe điện", "xe đạp"],
  },
  {
    answer: "Có! Minh Hồng nhận đóng pin cho đèn năng lượng mặt trời, lắp ráp đèn NLMT tại nhà. Pin lưu trữ năng lượng chất lượng cao, bền bỉ. Gọi 0987.443.258!",
    keywords: ["đèn năng lượng", "mặt trời", "nlmt", "solar"],
    requiredKeywords: ["đèn", "năng lượng"],
  },
  {
    answer: "Minh Hồng nhận đóng pin loa kéo tất cả các hãng. Nâng cấp dung lượng, kéo dài thời gian sử dụng. Giá từ 200k-500k tuỳ loại. Gọi 0987.443.258!",
    keywords: ["loa kéo", "loa bluetooth", "karaoke"],
    requiredKeywords: ["loa"],
  },
  {
    answer: "Có! Minh Hồng đóng pin kích đề ô tô, xe hơi. Pin lưu trữ, pin dự phòng dung lượng lớn. Đóng theo yêu cầu riêng. Liên hệ 0987.443.258!",
    keywords: ["kích đề", "ô tô", "xe hơi", "dự phòng"],
    requiredKeywords: ["kích đề", "ô tô"],
  },
  {
    answer: "Có ạ! Minh Hồng nhận phục hồi và đóng mới pin laptop các hãng Dell, HP, Asus, Lenovo, Macbook. Thay cell chính hãng, bảo hành 6 tháng.",
    keywords: ["laptop", "máy tính", "dell", "hp", "macbook", "asus", "lenovo"],
    requiredKeywords: ["laptop", "máy tính"],
  },
];

// Dấu hiệu câu hỏi MỞ → cần AI trả lời
const OPEN_ENDED_SIGNALS = [
  "là gì", "như thế nào", "tại sao", "vì sao", "giải thích",
  "so sánh", "khác gì", "tốt hơn", "nên chọn", "tư vấn",
  "có nên", "lợi ích", "ưu điểm", "nhược điểm", "tác dụng",
  "hoạt động", "nguyên lý", "cách dùng", "hướng dẫn", "mấy loại",
  "loại nào", "dùng được bao lâu", "bền không", "có tốt không",
  "chia sẻ", "cho mình hỏi"
];

function classifyAndAnswer(userMessage: string): string | null {
  const lowerMsg = userMessage.toLowerCase().trim();

  // 1. Nếu tin nhắn quá ngắn (≤ 3 từ), FAQ có thể handle
  // 2. Nếu có dấu hiệu mở → luôn dùng AI
  const isOpenEnded = OPEN_ENDED_SIGNALS.some((signal) => lowerMsg.includes(signal));

  if (isOpenEnded) {
    return null; // → gửi AI
  }

  // 3. Tìm FAQ match: phải match ít nhất 1 requiredKeyword
  for (const faq of FAQ_DATA) {
    const hasRequired = faq.requiredKeywords.some((kw) => lowerMsg.includes(kw));
    const keywordHits = faq.keywords.filter((kw) => lowerMsg.includes(kw)).length;

    // Match nếu: có required keyword + ít nhất 1 keyword khác, HOẶC 2+ required keywords
    if (hasRequired && (keywordHits >= 1 || lowerMsg.length < 25)) {
      return faq.answer;
    }
  }

  // 4. Không match FAQ → gửi AI
  return null;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Xin chào! 👋 Mình là trợ lý AI của Minh Hồng. Bạn cần tư vấn về đóng pin, đèn năng lượng mặt trời hay lắp camera ạ?",
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
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    // Bước 1: Phân loại — FAQ hay AI?
    const faqAnswer = classifyAndAnswer(text);

    if (faqAnswer) {
      // Câu hỏi đơn giản → trả lời tức thì (MIỄN PHÍ, không tốn quota)
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: faqAnswer,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }, 400);
      return;
    }

    // Bước 2: Câu hỏi mở/phức tạp → gửi AI API (tốn quota)
    try {
      const history = [...messages, userMsg]
        .filter((m) => m.role !== "system")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

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
          content: data.reply || "Xin lỗi, mình chưa hiểu câu hỏi. Bạn có thể gọi 0987.443.258 để được tư vấn trực tiếp nhé!",
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Rất tiếc, hệ thống đang bận. Vui lòng gọi trực tiếp qua hotline 0987.443.258 để được hỗ trợ ngay ạ!",
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
