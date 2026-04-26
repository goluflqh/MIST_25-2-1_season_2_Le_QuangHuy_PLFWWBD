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
  floatingBadge: "AI hỗ trợ",
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

const CHATBOT_TRAINING_NOTES: Record<keyof typeof CHATBOT_SERVICE_LIBRARY, string[]> = {
  DONG_PIN: [
    "Đóng pin: luôn chốt thiết bị đang dùng, điện áp, dung lượng mong muốn, kích thước khay và tình trạng pin cũ trước khi tư vấn sâu.",
    "Nếu khách hỏi pin yếu, sạc nhanh đầy, tụt áp hoặc không nhận sạc, giải thích ngắn rằng cần kiểm tra cell, BMS và sạc; nhắc kiểm tra pin miễn phí hoàn toàn.",
    "Không kết luận phải đóng mới khi chưa kiểm tra; ưu tiên nói hướng xử lý: kiểm tra, phục hồi nếu hợp lý, đóng mới nếu cell/BMS không còn an toàn.",
  ],
  DEN_NLMT: [
    "Đèn năng lượng mặt trời: bám vào vị trí lắp, mức nắng, diện tích cần sáng, thời lượng sáng mỗi đêm và nhu cầu cảm biến/chống nước.",
    "Khi khách hỏi trời mưa hoặc có bền không, trả lời rằng đèn tốt vẫn dùng được ngoài trời nhưng hiệu quả phụ thuộc chuẩn chống nước, pin, tấm sạc và số ngày ít nắng.",
    "Nếu hỏi tiết kiệm điện, nói lợi ích rõ nhất ở sân, cổng, lối đi hoặc nơi khó kéo điện; tránh hứa sáng mạnh cả đêm nếu chưa biết công suất và vị trí.",
  ],
  PIN_LUU_TRU: [
    "Pin lưu trữ: luôn hỏi tải muốn chạy, công suất ước tính, số giờ cần duy trì, điện áp hệ và có inverter/UPS sẵn hay chưa.",
    "Khi khách hỏi dùng được bao lâu, giải thích theo công thức gần đúng dung lượng Wh chia tải W, rồi nói cần hệ số hao hụt để chọn an toàn.",
    "Nhấn mạnh BMS, dòng xả, dây dẫn và bảo vệ quá dòng vì đây là nhóm cần an toàn cao.",
  ],
  CAMERA: [
    "Camera: luôn khoanh số mắt, vị trí trong/ngoài trời, nhu cầu xem điện thoại, xem lại bao nhiêu ngày, đi dây hay Wi-Fi và có cần âm thanh/cảnh báo không.",
    "Khi khách hỏi xem qua điện thoại, trả lời được nếu chọn đúng hệ/app và mạng ổn; có thể xem trực tiếp, xem lại và nhận cảnh báo tùy cấu hình.",
    "Khi hỏi báo giá, ưu tiên gợi ý theo gói 2-4 mắt hoặc nhu cầu cửa hàng/nhà ở trước, rồi hỏi một chi tiết quan trọng nhất.",
  ],
  CUSTOM: [
    "Bộ pin theo yêu cầu: chốt kích thước, điện áp, dung lượng, đầu cắm, dòng xả và môi trường dùng trước khi báo phương án.",
    "Không cam kết làm được mọi thiết kế nếu thiếu thông số an toàn; hướng khách gửi ảnh, model hoặc pin cũ để kiểm tra nhanh hơn.",
  ],
};

export function buildChatbotTrainingContext(
  service: string | null | undefined,
  intent: string | null | undefined
) {
  const normalizedService = service as keyof typeof CHATBOT_TRAINING_NOTES;
  const serviceNotes = CHATBOT_TRAINING_NOTES[normalizedService] || [];
  const intentNotes = [
    "Cách trả lời đã train: trả lời một ý hữu ích trước, sau đó chỉ hỏi thêm tối đa 1 chi tiết quan trọng nhất.",
    "Không trả lời chung chung kiểu 'cần thêm thông tin' nếu có thể đưa ra hướng chọn, lưu ý kỹ thuật hoặc bước tiếp theo an toàn.",
    intent === "quote"
      ? "Với câu hỏi giá, nếu prompt có dữ liệu bảng giá thì đưa khoảng tham khảo trước; nếu thiếu dữ liệu thì nói rõ cần thêm thông tin để báo sát, không bịa con số."
      : "",
    intent === "open_question" || intent === "faq"
      ? "Với câu hỏi tìm hiểu, giải thích ngắn theo ngôn ngữ đời thường, ưu tiên tình huống thực tế của khách hơn thuật ngữ."
      : "",
  ].filter(Boolean);

  return [...intentNotes, ...serviceNotes].join("\n");
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
    return `Với ${serviceLabel}, em cần thêm đúng 1 thông tin chính để báo sát hơn: model/diện tích/tải dùng hoặc số lượng dự tính. Anh/chị để lại nhu cầu, bên em sẽ giữ đúng ngữ cảnh này và phản hồi sát hơn cho mình nhé.`;
  }

  if (intent === "contact" && serviceLabel) {
    return `Dạ em đã hiểu anh/chị đang cần hỗ trợ phần ${serviceLabel}. Anh/chị để lại nhu cầu giúp em, bên em sẽ phản hồi đúng phần này để mình đỡ phải nhắc lại từ đầu.`;
  }

  if ((intent === "open_question" || intent === "faq") && serviceLabel) {
    return `Với ${serviceLabel}, em sẽ tư vấn theo nhu cầu thực tế trước: mình cho em thêm model, vị trí lắp hoặc cách đang dùng hiện tại, em sẽ khoanh phương án phù hợp và an toàn hơn cho anh/chị.`;
  }

  if (serviceLabel) {
    return `Em đã giữ đúng ngữ cảnh ${serviceLabel}. Anh/chị gửi thêm model hoặc nhu cầu sử dụng, em sẽ gợi ý đúng hướng hơn cho mình nhé.`;
  }

  return "Anh/chị nói sơ giúp em mình đang quan tâm đóng pin, đèn NLMT, pin lưu trữ hay camera để em khoanh đúng hướng và tư vấn sát hơn nhé.";
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
