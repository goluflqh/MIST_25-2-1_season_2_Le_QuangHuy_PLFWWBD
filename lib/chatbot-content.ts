import { siteConfig } from "@/lib/site";

export const CHATBOT_SERVICE_LIBRARY = {
  DONG_PIN: {
    fact:
      "Dữ kiện đã xác nhận: Minh Hồng nhận đóng và phục hồi pin cho xe điện, máy công cụ, loa kéo và laptop; hỗ trợ kiểm tra pin miễn phí hoàn toàn, ưu tiên cell chính hãng, có BMS bảo vệ và test dòng xả trước khi giao.",
    label: "đóng pin",
    leadSource: "chatbot-dong-pin",
    prompt: "Em cần tư vấn đóng pin",
  },
  DEN_NLMT: {
    fact:
      "Dữ kiện đã xác nhận: Minh Hồng nhận đóng pin, thay cell và lắp đèn năng lượng mặt trời cho gia đình, sân vườn, cổng và kho; có các điểm mạnh như pin Lithium, tự động bật tắt và lắp đặt không cần kéo dây điện dài.",
    label: "đèn năng lượng mặt trời",
    leadSource: "chatbot-den-nlmt",
    prompt: "Em cần tư vấn đèn năng lượng mặt trời",
  },
  PIN_LUU_TRU: {
    fact:
      "Dữ kiện đã xác nhận: Minh Hồng làm pin lưu trữ cho điện mặt trời hoặc UPS, pin kích đề 12V-24V, pin dự phòng dung lượng lớn và các bộ pin theo yêu cầu; thường phải chốt điện áp, dung lượng, tải và mức xả trước khi báo sát.",
    label: "pin lưu trữ",
    leadSource: "chatbot-pin-luu-tru",
    prompt: "Em cần tư vấn pin lưu trữ",
  },
  CAMERA: {
    fact:
      "Dữ kiện đã xác nhận: Minh Hồng lắp camera cho gia đình, cửa hàng và xưởng; có khảo sát tận nơi, thi công gọn dây, hỗ trợ xem qua điện thoại và bảo hành kỹ thuật theo từng cấu hình hoặc hãng.",
    label: "camera",
    leadSource: "chatbot-camera",
    prompt: "Em cần tư vấn lắp camera",
  },
  CUSTOM: {
    fact:
      "Dữ kiện đã xác nhận: Minh Hồng có nhận các bộ pin thiết kế riêng, nhưng phải chốt kích thước, điện áp, dung lượng, đầu cắm và mức xả trước khi tư vấn sâu hoặc báo giá.",
    label: "bộ pin theo yêu cầu",
    leadSource: "chatbot-custom",
    prompt: "Em cần tư vấn bộ pin theo yêu cầu",
  },
} as const;

export const CHATBOT_PRIMARY_SERVICE_IDS = [
  "DONG_PIN",
  "DEN_NLMT",
  "PIN_LUU_TRU",
  "CAMERA",
] as const;

export const CHATBOT_WIDGET_COPY = {
  defaultReplyFallback:
    "Dạ em đang phản hồi hơi chậm một chút. Anh/chị nói thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý sát hơn cho mình nhé.",
  floatingBadge: "Hỏi AI tư vấn",
  inputPlaceholder: "Anh/chị đang cần em hỗ trợ gì?",
  onlineStatus: "Trực tuyến",
  title: `${siteConfig.name} AI`,
  welcomeMessage: `Xin chào anh/chị! Em là trợ lý tư vấn của ${siteConfig.name}. Anh/chị cứ nói sơ nhu cầu, em sẽ hỗ trợ ngắn gọn và đi đúng ý hơn cho mình nhé.`,
} as const;

export const CHATBOT_WIDGET_QUICK_PROMPTS = [
  {
    label: "Lắp camera cửa hàng",
    prompt: "Em muốn lắp camera cho cửa hàng nhỏ, cần xem qua điện thoại.",
  },
  {
    label: "Đèn NLMT sân cổng",
    prompt: "Nhà em muốn làm đèn năng lượng mặt trời cho sân và cổng.",
  },
  {
    label: "Pin lưu trữ mất điện",
    prompt: "Tư vấn giúp em pin lưu trữ khi mất điện ở nhà.",
  },
  {
    label: "Đóng pin theo thiết bị",
    prompt: "Em muốn đóng pin theo thiết bị đang dùng, chưa rõ nên chọn loại nào.",
  },
] as const;

export function getChatbotServiceFact(service: string | null | undefined) {
  if (!service) {
    return "";
  }

  return CHATBOT_SERVICE_LIBRARY[service as keyof typeof CHATBOT_SERVICE_LIBRARY]?.fact || "";
}

export function getChatbotLeadActionLabel(
  intent: string | null | undefined,
  usedFallback = false
) {
  if (usedFallback) {
    return "Để lại nhu cầu để em ưu tiên hỗ trợ";
  }

  if (intent === "quote") {
    return "Nhận gợi ý cấu hình sát nhu cầu";
  }

  if (intent === "open_question") {
    return "Giữ nhu cầu này để em tư vấn tiếp";
  }

  return "Để lại nhu cầu";
}

export function getChatbotZaloActionLabel(shouldOfferHumanSupport: boolean) {
  return shouldOfferHumanSupport ? "Nhắn Zalo" : "Nhắn Zalo nhanh";
}

export function getChatbotLoadingCopy(
  intent: string | null | undefined,
  serviceLabel: string | null | undefined
) {
  if (intent === "quote" && serviceLabel) {
    return {
      detail: "Em đang giữ đúng ngữ cảnh để gợi ý nhanh và dễ chốt hơn cho mình.",
      headline: `Đang lên gợi ý nhanh cho ${serviceLabel}`,
    };
  }

  if (intent === "open_question" && serviceLabel) {
    return {
      detail: "Ưu tiên câu trả lời gọn, rõ và bám đúng nhu cầu anh/chị đang hỏi.",
      headline: `Đang rút gọn ý chính về ${serviceLabel}`,
    };
  }

  if (serviceLabel) {
    return {
      detail: "Em đang giữ đúng ngữ cảnh để câu trả lời bớt lan man hơn.",
      headline: `Đang xem nhanh phần ${serviceLabel}`,
    };
  }

  return {
    detail: "Em đang khoanh lại đúng nhóm dịch vụ trước khi trả lời cho mình.",
    headline: "Đang ghép nhu cầu với dịch vụ phù hợp",
  };
}

export function buildChatbotMissingAiReply(
  intent: string | null | undefined,
  serviceLabel: string | null | undefined
) {
  if (intent === "quote" && serviceLabel) {
    return `Em đang cập nhật phần tư vấn tự động sâu hơn cho ${serviceLabel}. Nếu anh/chị để lại nhu cầu, bên em sẽ giữ đúng ngữ cảnh này và phản hồi sát hơn cho mình nhé.`;
  }

  if (intent === "contact" && serviceLabel) {
    return `Dạ em đã hiểu anh/chị đang cần hỗ trợ phần ${serviceLabel}. Anh/chị để lại nhu cầu giúp em, bên em sẽ phản hồi đúng phần này để mình đỡ phải nhắc lại từ đầu.`;
  }

  if (serviceLabel) {
    return `Em đang cập nhật phần hỏi đáp tự động cho ${serviceLabel}. Anh/chị gửi thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý đúng hướng hơn cho mình nhé.`;
  }

  return "Em đang cập nhật phần hỏi đáp tự động. Anh/chị nói sơ giúp em mình đang quan tâm đóng pin, đèn NLMT hay camera để em gợi ý sát hơn nhé.";
}

export function buildChatbotRuntimeFallbackReply(
  intent: string | null | undefined,
  serviceLabel: string | null | undefined
) {
  if (intent === "quote" && serviceLabel) {
    return `Dạ em đang phản hồi hơi chậm một chút ở phần ${serviceLabel}. Nếu tiện, anh/chị để lại nhu cầu hoặc model giúp em, bên em sẽ tư vấn sát hơn cho mình nhé.`;
  }

  if (intent === "contact" && serviceLabel) {
    return `Dạ em vẫn đang theo đúng nhu cầu ${serviceLabel} của anh/chị. Anh/chị để lại thông tin giúp em, bên em sẽ phản hồi tiếp để mình khỏi phải kể lại từ đầu nhé.`;
  }

  if (serviceLabel) {
    return `Dạ em đang xử lý hơi chậm một chút ở phần ${serviceLabel}. Anh/chị nói thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý sát hơn cho mình nhé.`;
  }

  return CHATBOT_WIDGET_COPY.defaultReplyFallback;
}
