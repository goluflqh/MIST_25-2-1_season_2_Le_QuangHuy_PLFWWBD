import { siteConfig } from "@/lib/site";

const HOTLINE = siteConfig.hotlineDisplay;
const LOCATION = siteConfig.locationLabel;
const BUSINESS_HOURS = siteConfig.businessHoursLabel;

export type ChatbotServiceId =
  | "DONG_PIN"
  | "DEN_NLMT"
  | "PIN_LUU_TRU"
  | "CAMERA"
  | "CUSTOM"
  | "KHAC";

export type ChatbotIntent =
  | "greeting"
  | "faq"
  | "quote"
  | "contact"
  | "open_question"
  | "general";

interface FaqRule {
  answer: string;
  requiredGroups: string[][];
  service?: ChatbotServiceId;
}

export interface ChatbotConversationMessage {
  content: string;
  meta?: {
    intent?: ChatbotIntent | null;
    service?: ChatbotServiceId | string | null;
  };
  role: "user" | "assistant" | "system";
}

interface ChatbotAnalysisOptions {
  history?: ChatbotConversationMessage[];
  serviceContext?: ChatbotServiceId | null;
}

interface ChatbotServiceConfig {
  keywords: string[];
  label: string;
  leadSource: string;
  prompt: string;
}

interface ConversationContext {
  activeService: ChatbotServiceId | null;
  lastBudgetVnd: number | null;
  lastIntent: ChatbotIntent | null;
}

export interface ChatbotResponsePlan {
  intent: ChatbotIntent;
  localReply: string | null;
  service: ChatbotServiceId | null;
  serviceLabel: string | null;
  shouldOfferLeadForm: boolean;
  shouldOfferHumanSupport: boolean;
  shouldSuggestServices: boolean;
}

const CHATBOT_SERVICE_CONFIG: Record<
  Exclude<ChatbotServiceId, "KHAC">,
  ChatbotServiceConfig
> = {
  DONG_PIN: {
    keywords: [
      "dong pin",
      "pin xe dien",
      "xe dien",
      "xe dap dien",
      "xe may dien",
      "may khoan",
      "loa keo",
      "laptop",
      "cell pin",
      "pin lithium",
      "pin khoan",
      "bms",
    ],
    label: "đóng pin",
    leadSource: "chatbot-dong-pin",
    prompt: "Em cần tư vấn đóng pin",
  },
  DEN_NLMT: {
    keywords: [
      "den nang luong",
      "nang luong mat troi",
      "nlmt",
      "mat troi",
      "solar",
      "den san vuon",
      "den cong",
      "den duong",
      "den pha solar",
    ],
    label: "đèn năng lượng mặt trời",
    leadSource: "chatbot-den-nlmt",
    prompt: "Em cần tư vấn đèn năng lượng mặt trời",
  },
  PIN_LUU_TRU: {
    keywords: [
      "pin luu tru",
      "luu tru",
      "kich de",
      "du phong",
      "backup",
      "ups",
      "inverter",
      "bo luu dien",
      "xe hoi",
      "o to",
      "binh du phong",
    ],
    label: "pin lưu trữ",
    leadSource: "chatbot-pin-luu-tru",
    prompt: "Em cần tư vấn pin lưu trữ",
  },
  CAMERA: {
    keywords: [
      "camera",
      "giam sat",
      "an ninh",
      "dau ghi",
      "mat camera",
      "nvr",
      "dvr",
      "mat cam",
    ],
    label: "camera",
    leadSource: "chatbot-camera",
    prompt: "Em cần tư vấn lắp camera",
  },
  CUSTOM: {
    keywords: ["theo yeu cau", "custom", "bo pin rieng", "thiet ke rieng", "dat lam rieng"],
    label: "bộ pin theo yêu cầu",
    leadSource: "chatbot-custom",
    prompt: "Em cần tư vấn bộ pin theo yêu cầu",
  },
};

export const chatbotServiceChoices = (
  ["DONG_PIN", "DEN_NLMT", "PIN_LUU_TRU", "CAMERA"] as const
).map((service) => ({
  id: service,
  label: CHATBOT_SERVICE_CONFIG[service].label,
  prompt: CHATBOT_SERVICE_CONFIG[service].prompt,
}));

const LOCATION_SIGNALS = [
  "dia chi",
  "o dau",
  "chi duong",
  "duong di",
  "so dien thoai",
  "hotline",
  "zalo",
  "lien lac",
];

const WARRANTY_SIGNALS = ["bao hanh", "warranty", "doi tra", "loi 1 doi 1"];

const GREETING_SIGNALS = ["xin chao", "chao em", "hello", "hi", "alo", "shop oi"];

const QUOTE_SIGNALS = [
  "bao gia",
  "gia",
  "chi phi",
  "bao nhieu tien",
  "mat bao nhieu",
  "ton bao nhieu",
  "uoc tinh",
  "tam bao nhieu",
  "gia khoang",
  "co du mua",
  "ngan sach",
  "mua duoc may cai",
  "mua duoc cai gi",
  "tam nay",
];

const HUMAN_SUPPORT_SIGNALS = [
  "goi lai",
  "lien he",
  "de lai so",
  "nhan vien goi",
  "tu van giup",
  "khao sat",
  "zalo",
  "xem truc tiep",
  "kiem tra giup",
];

const OPEN_ENDED_SIGNALS = [
  "la gi",
  "nhu the nao",
  "nhu nao",
  "thi sao",
  "sao",
  "tai sao",
  "vi sao",
  "giai thich",
  "so sanh",
  "khac gi",
  "tot hon",
  "nen chon",
  "co nen",
  "loi ich",
  "uu diem",
  "nhuoc diem",
  "tac dung",
  "hoat dong",
  "nguyen ly",
  "cach dung",
  "huong dan",
  "mua mua",
  "loai nao",
  "bao nhieu moi on",
  "nhu nao moi ok",
  "the nao moi ok",
  "moi on",
  "cell pin",
  "on khong",
  "duoc khong",
  "loai gi",
  "tiet kiem",
  "dang tien",
];

const FOLLOW_UP_CONTEXT_SIGNALS = [
  "gia",
  "bao nhieu",
  "chi phi",
  "the nao",
  "nhu nao",
  "sao em",
  "sao vay",
  "co ben khong",
  "co on khong",
  "co duoc khong",
  "lam duoc khong",
  "goi y giup",
  "tu van tiep",
  "loai nao",
  "loai gi",
  "thi sao",
  "cai gi",
  "may cai",
  "tam nay",
  "tam do",
];

const SOLAR_SAVINGS_SIGNALS = [
  "tiet kiem",
  "giam tien dien",
  "co loi khong",
  "co tiet kiem khong",
  "dang tien khong",
];

const SOLAR_USAGE_SIGNALS = [
  "dung nhu the nao",
  "cach dung",
  "huong dan",
  "nguyen ly",
  "van hanh",
  "lap sao",
  "su dung sao",
];

const ALTERNATIVE_SERVICE_SIGNALS = ["ngoai", "ngoai ra", "con gi nua", "con gi khac", "khac nua"];

const OUT_OF_SCOPE_HINTS = [
  "thu do",
  "viet nam",
  "lich su",
  "dia ly",
  "toan hoc",
  "van hoc",
  "lap trinh",
  "code",
  "bong da",
  "chinh tri",
  "quoc gia",
  "tong thong",
];

const DOMAIN_HINTS = [
  "pin",
  "cell",
  "bms",
  "camera",
  "nlmt",
  "nang luong",
  "mat troi",
  "luu tru",
  "kich de",
  "xe dien",
  "may khoan",
  "loa keo",
  "laptop",
  "bao hanh",
  "bao gia",
  "gia",
  "hotline",
  "zalo",
  "dia chi",
  "lien he",
  "cua hang",
  "shop",
  "tu van",
];

const FAQ_RULES: FaqRule[] = [
  {
    answer:
      "Giá đóng pin phụ thuộc vào loại cell, dung lượng, dòng xả và thiết bị cụ thể. Anh/chị gửi model hoặc nhu cầu sử dụng, bên em mới báo đúng cấu hình và chi phí được.",
    requiredGroups: [
      ["gia", "bao gia", "chi phi", "ton bao nhieu", "mat bao nhieu", "bao nhieu tien"],
      [
        "dong pin",
        "cell",
        "xe dien",
        "xe dap dien",
        "xe may dien",
        "loa keo",
        "may khoan",
        "laptop",
        "pin luu tru",
        "kich de",
      ],
    ],
    service: "DONG_PIN",
  },
  {
    answer:
      "Dạ có anh/chị nhé. Bên em nhận lắp camera cho nhà ở, cửa hàng và xưởng, có khảo sát tận nơi, thi công gọn dây và hỗ trợ cài xem trên điện thoại.",
    requiredGroups: [["camera"], ["lap", "lap dat", "thi cong", "gan", "an ninh", "giam sat"]],
    service: "CAMERA",
  },
  {
    answer:
      "Dạ có anh/chị nhé. Bên em nhận đóng pin xe đạp điện và xe máy điện bằng cell Lithium chính hãng, cấu hình theo nhu cầu đi thực tế và độ bền anh/chị mong muốn.",
    requiredGroups: [["xe dien", "xe dap dien", "xe may dien"], ["dong pin", "pin"]],
    service: "DONG_PIN",
  },
  {
    answer:
      "Dạ có anh/chị nhé. Bên em nhận làm pin cho đèn năng lượng mặt trời và pin lưu trữ dân dụng. Khi cần, bên em sẽ kiểm tra luôn tình trạng tấm pin, bộ sạc và mức tiêu thụ tải để tư vấn cho đúng.",
    requiredGroups: [
      ["den nang luong", "nlmt", "mat troi", "solar"],
      ["pin", "thay pin", "lam pin", "binh", "luu tru"],
    ],
    service: "DEN_NLMT",
  },
  {
    answer:
      "Bên em nhận đóng pin loa kéo, nâng cấp dung lượng hoặc thay cell theo mức tải sử dụng thực tế. Nếu anh/chị có model loa thì bên em tư vấn sẽ sát hơn nhiều.",
    requiredGroups: [["loa keo", "karaoke", "loa bluetooth"], ["pin", "dong pin"]],
    service: "DONG_PIN",
  },
  {
    answer:
      "Dạ có anh/chị nhé. Bên em nhận làm pin kích đề, pin lưu trữ và các bộ pin theo yêu cầu riêng. Với ô tô hoặc tải nặng thì cần chốt đúng điện áp, dòng xả đỉnh và mức an toàn trước khi đóng.",
    requiredGroups: [["kich de", "o to", "xe hoi", "du phong"], ["pin", "binh"]],
    service: "PIN_LUU_TRU",
  },
  {
    answer:
      "Bên em có nhận phục hồi và đóng mới pin laptop một số dòng phổ biến. Nếu anh/chị có model máy hoặc mã pin cũ thì bên em sẽ kiểm tra khả năng làm thực tế nhanh hơn.",
    requiredGroups: [["laptop", "macbook", "dell", "hp", "asus", "lenovo"], ["pin", "cell"]],
    service: "DONG_PIN",
  },
];

function normalizeNaturalText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeLookupText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesPhrase(text: string, phrase: string) {
  if (!phrase) {
    return false;
  }

  return (
    text === phrase ||
    text.startsWith(`${phrase} `) ||
    text.endsWith(` ${phrase}`) ||
    text.includes(` ${phrase} `)
  );
}

function matchesKeyword(text: string, keyword: string) {
  const normalizedKeyword = normalizeLookupText(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  return matchesPhrase(text, normalizedKeyword);
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => matchesKeyword(text, keyword));
}

function scoreKeywords(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => (matchesKeyword(text, keyword) ? score + 1 : score), 0);
}

function parseBudgetVnd(lookupMessage: string) {
  const match = lookupMessage.match(/(\d+(?:[.,]\d+)?)\s*(tr|trieu|k|nghin|ngan|vnd|dong)(?=\s|$)/);

  if (!match) {
    return null;
  }

  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  switch (match[2]) {
    case "tr":
    case "trieu":
      return Math.round(amount * 1_000_000);
    case "k":
    case "nghin":
    case "ngan":
      return Math.round(amount * 1_000);
    case "vnd":
    case "dong":
      return amount >= 1_000 ? Math.round(amount) : null;
    default:
      return null;
  }
}

function formatBudgetVnd(amount: number) {
  if (amount >= 1_000_000) {
    const value = Math.round((amount / 1_000_000) * 10) / 10;
    return `${value.toString().replace(".", ",")} triệu`;
  }

  const thousandValue = Math.round(amount / 1_000);
  return `${thousandValue} nghìn`;
}

function buildServiceLabels(serviceIds: ChatbotServiceId[]) {
  return serviceIds
    .map((serviceId) => getChatbotServiceLabel(serviceId))
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function hasBudgetIntent(lookupMessage: string, naturalMessage: string) {
  return (
    parseBudgetVnd(lookupMessage) !== null ||
    includesAny(lookupMessage, ["ngan sach", "co du mua", "tam nay", "tam do"]) ||
    /\b\d+([.,]\d+)?\s*(tr|triệu|trieu|k|nghìn|nghin|ngan|vnd|đ|dong)\b/u.test(
      naturalMessage
    )
  );
}

function matchesRule(text: string, rule: FaqRule) {
  return rule.requiredGroups.every((group) => includesAny(text, group));
}

function shouldReuseServiceContext(text: string) {
  const wordCount = text.split(" ").filter(Boolean).length;
  return wordCount <= 8 || includesAny(text, FOLLOW_UP_CONTEXT_SIGNALS);
}

function detectMentionedServices(text: string) {
  return (Object.entries(CHATBOT_SERVICE_CONFIG) as Array<
    [Exclude<ChatbotServiceId, "KHAC">, ChatbotServiceConfig]
  >)
    .map(([service, config]) => ({
      score: scoreKeywords(text, config.keywords),
      service,
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((match) => match.service);
}

function detectExplicitService(text: string) {
  return detectMentionedServices(text)[0] || null;
}

function normalizeIntent(value: string | null | undefined): ChatbotIntent | null {
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

export function normalizeChatbotServiceId(
  value: string | null | undefined
): ChatbotServiceId | null {
  if (!value) return null;

  const normalizedValue = value.trim().toUpperCase();

  if (
    normalizedValue === "DONG_PIN" ||
    normalizedValue === "DEN_NLMT" ||
    normalizedValue === "PIN_LUU_TRU" ||
    normalizedValue === "CAMERA" ||
    normalizedValue === "CUSTOM" ||
    normalizedValue === "KHAC"
  ) {
    return normalizedValue;
  }

  return null;
}

function inferIntentFromHistoryText(lookupMessage: string, naturalMessage: string) {
  if (includesAny(lookupMessage, HUMAN_SUPPORT_SIGNALS)) return "contact" satisfies ChatbotIntent;
  if (includesAny(lookupMessage, LOCATION_SIGNALS) || includesAny(lookupMessage, WARRANTY_SIGNALS)) {
    return "faq" satisfies ChatbotIntent;
  }
  if (includesAny(lookupMessage, OPEN_ENDED_SIGNALS) || hasBudgetIntent(lookupMessage, naturalMessage)) {
    return "open_question" satisfies ChatbotIntent;
  }
  if (includesAny(lookupMessage, QUOTE_SIGNALS)) return "quote" satisfies ChatbotIntent;
  return null;
}

function resolveConversationContext(
  history: ChatbotConversationMessage[] = [],
  fallbackService: ChatbotServiceId | null = null
): ConversationContext {
  let activeService = fallbackService;
  let lastIntent: ChatbotIntent | null = null;
  let lastBudgetVnd: number | null = null;

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const item = history[index];
    const lookupContent = normalizeLookupText(item.content);
    const naturalContent = normalizeNaturalText(item.content);

    if (item.role === "user" && lastBudgetVnd === null) {
      lastBudgetVnd = parseBudgetVnd(lookupContent);
    }

    if (!lastIntent) {
      lastIntent =
        normalizeIntent(typeof item.meta?.intent === "string" ? item.meta.intent : null) ||
        inferIntentFromHistoryText(lookupContent, naturalContent);
    }

    if (!activeService) {
      activeService =
        normalizeChatbotServiceId(
          typeof item.meta?.service === "string" ? item.meta.service : null
        ) || detectExplicitService(lookupContent);
    }

    if (activeService && lastIntent && lastBudgetVnd !== null) {
      break;
    }
  }

  return {
    activeService,
    lastBudgetVnd,
    lastIntent,
  };
}

function detectChatbotService(text: string, fallbackService: ChatbotServiceId | null = null) {
  const explicitService = detectExplicitService(text);
  if (explicitService) {
    return explicitService;
  }

  if (fallbackService && shouldReuseServiceContext(text)) {
    return fallbackService;
  }

  return null;
}

function wantsAlternativeServiceSuggestions(
  lookupMessage: string,
  activeService: ChatbotServiceId | null,
  mentionedServices: ChatbotServiceId[]
) {
  if ((!activeService && mentionedServices.length === 0) || includesAny(lookupMessage, ["ngoai troi"])) {
    return false;
  }

  return (
    (/\bngoai\b/u.test(lookupMessage) || includesAny(lookupMessage, ALTERNATIVE_SERVICE_SIGNALS)) &&
    includesAny(lookupMessage, ["mua duoc cai gi", "cai gi", "goi y", "con gi", "nhom nao"])
  );
}

function buildLocationReply() {
  return `Bên em ở ${LOCATION}, mở cửa ${BUSINESS_HOURS}. Anh/chị cần chỉ đường, Zalo hay gọi nhanh thì liên hệ ${HOTLINE} nhé.`;
}

function buildWarrantyReply(lookupMessage: string, service: ChatbotServiceId | null) {
  if (service === "CAMERA" || includesAny(lookupMessage, ["camera", "dau ghi"])) {
    return "Với camera thì thời gian bảo hành sẽ theo cấu hình lắp đặt và từng thiết bị cụ thể như mắt camera, đầu ghi hay ổ cứng. Bên em vẫn hỗ trợ kiểm tra lại hệ thống nếu có lỗi phát sinh trong quá trình sử dụng.";
  }

  return "Bên em bảo hành pin theo từng dòng và cấu hình: thường gồm lỗi kỹ thuật của cell hoặc BMS như sụt áp bất thường, lệch cell, tự ngắt hay không nhận sạc. Không bảo hành các trường hợp vào nước, rơi vỡ, chập cháy do đấu sai, dùng sạc không đúng hoặc chai dần theo thời gian sử dụng. Anh/chị cho em biết pin loại nào và thông số cơ bản, em sẽ nói rõ thời gian với điều kiện cụ thể của bộ pin mình.";
}

function buildHumanSupportReply(service: ChatbotServiceId) {
  const serviceLabel = getChatbotServiceLabel(service)?.toLowerCase() || "nhu cầu này";
  return `Dạ được anh/chị nhé. Anh/chị để lại nhu cầu giúp em, bên em sẽ giữ đúng phần ${serviceLabel} và phản hồi cho mình để đỡ phải nhắc lại từ đầu.`;
}

function buildAlternativeServicesReply(
  excludedService: ChatbotServiceId | null,
  budgetVnd: number | null
) {
  const remainingServices = chatbotServiceChoices
    .map((choice) => choice.id)
    .filter((serviceId) => serviceId !== excludedService);
  const serviceList = buildServiceLabels(remainingServices);
  const excludedLabel = getChatbotServiceLabel(excludedService) || "nhóm này";

  if (budgetVnd) {
    return `Ngoài ${excludedLabel}, bên em còn làm ${serviceList}. Với tầm ${formatBudgetVnd(
      budgetVnd
    )}, em nên khoanh lại đúng nhóm trước rồi mới gợi ý món hợp ngân sách cho anh/chị thì sẽ sát hơn nhiều.`;
  }

  return `Ngoài ${excludedLabel}, bên em còn làm ${serviceList}. Anh/chị muốn em nghiêng sang nhóm nào để em gợi ý nhanh đúng hướng hơn?`;
}

function buildSolarSavingsReply() {
  return "Đèn năng lượng mặt trời có thể tiết kiệm điện thật nếu chỗ lắp có nắng tốt và mình chọn đúng nhu cầu sáng. Hợp nhất là các vị trí như cổng, sân, lối đi hoặc chỗ khó kéo điện; còn nếu nắng yếu, bật quá lâu hoặc chọn công suất không phù hợp thì hiệu quả sẽ giảm. Nếu anh/chị nói giúp khu vực lắp và số giờ nắng mỗi ngày, em sẽ gợi ý thực tế hơn cho chỗ nhà mình.";
}

function buildSolarUsageReply() {
  return "Nguyên lý dùng khá đơn giản anh/chị nhé: ban ngày tấm pin hứng nắng để sạc vào pin, tối đèn lấy điện từ pin để sáng. Mình nên đặt tấm pin ở chỗ có nắng trực tiếp khoảng 5-6 tiếng trở lên, tránh bị che bóng và chọn chế độ sáng vừa nhu cầu để pin trụ ổn qua đêm. Nếu anh/chị nói giúp vị trí lắp với thời lượng sáng mong muốn, em sẽ gợi ý cách dùng sát hơn.";
}

function buildSolarBudgetReply(budgetVnd: number, lookupMessage: string) {
  const budgetLabel = formatBudgetVnd(budgetVnd);
  const wantsCount = includesAny(lookupMessage, ["may cai", "bao nhieu cai", "mua duoc may"]);

  if (budgetVnd < 700_000) {
    return `Tầm ${budgetLabel} thì mình nên nghiêng về đèn tường, lối đi hoặc nhu cầu sáng điểm nhỏ là hợp hơn. Nếu muốn sáng rộng sân hoặc cổng và trụ lâu cả đêm thì mức này sẽ hơi chật. ${
      wantsCount
        ? "Phần số lượng khó chốt chính xác chỉ theo ngân sách, vì còn lệch khá nhiều ở pin và công suất từng bộ. "
        : ""
    }Anh/chị nói giúp chỗ lắp với thời lượng sáng mong muốn, em sẽ gợi ý sát hơn.`;
  }

  if (budgetVnd < 1_500_000) {
    return `Tầm ${budgetLabel} thì đã có thể lên một bộ đèn NLMT dân dụng khá ổn cho cổng, sân nhỏ hoặc lối đi rồi anh/chị nhé. ${
      wantsCount
        ? "Nếu hỏi mấy cái thì thường vẫn phải nhìn theo công suất và pin đi kèm hơn là đếm theo giá cứng. "
        : ""
    }Anh/chị cho em biết khu vực cần sáng và muốn sáng trong bao lâu mỗi đêm, em sẽ gợi ý cấu hình sát hơn.`;
  }

  if (budgetVnd < 3_000_000) {
    return `Ngân sách ${budgetLabel} thì dễ chọn hơn nhiều rồi anh/chị ạ. Mình có thể nghiêng sang bộ sáng khỏe hơn cho sân hoặc cổng, hoặc chia thành vài điểm sáng vừa tùy cách lắp và thời lượng sáng mong muốn. ${
      wantsCount
        ? "Phần mấy cái vẫn nên chốt theo công suất và nhu cầu sáng thực tế, chứ cùng một tầm tiền nhưng mỗi bộ lệch khá nhiều. "
        : ""
    }Anh/chị nói giúp chỗ lắp và mức sáng mong muốn, em sẽ khoanh phương án đúng hơn.`;
  }

  return `Với tầm ${budgetLabel}, mình đã có dư địa để ưu tiên bộ đèn sáng khỏe hơn, pin lớn hơn hoặc chia ra nhiều điểm sáng tùy mặt bằng thực tế. Nếu anh/chị cho em biết khu vực lắp, cần sáng rộng hay sáng tập trung và muốn trụ bao lâu mỗi đêm, em sẽ gợi ý phương án hợp ngân sách hơn nhiều.`;
}

function buildQuoteReply(
  service: ChatbotServiceId,
  options: {
    budgetVnd: number | null;
    lookupMessage: string;
  }
) {
  const budgetLabel = options.budgetVnd ? formatBudgetVnd(options.budgetVnd) : null;

  switch (service) {
    case "CAMERA":
      if (budgetLabel) {
        return `Ngân sách ${budgetLabel} thì em vẫn gợi ý sơ bộ cho anh/chị được, nhưng camera còn lệch khá nhiều theo số mắt, nhu cầu xem ban đêm, loại đầu ghi và cách đi dây. Nếu anh/chị nói giúp sơ mặt bằng hoặc số mắt dự tính, em sẽ gợi ý sát hơn nhiều.`;
      }
      return "Em có thể tư vấn sơ bộ trước cho anh/chị được ạ. Với camera, giá còn lệch theo số mắt, nhu cầu xem ban đêm, loại đầu ghi và cách đi dây, nên nếu anh/chị cho em biết sơ mặt bằng hoặc số mắt dự tính thì em sẽ gợi ý sát hơn nhiều.";

    case "DEN_NLMT":
      if (options.budgetVnd) {
        return buildSolarBudgetReply(options.budgetVnd, options.lookupMessage);
      }
      return "Em có thể gợi ý nhanh cho anh/chị trước nhé. Với đèn NLMT, chi phí thường phụ thuộc công suất đèn, thời gian sáng mong muốn và tình trạng pin cũ nếu mình đang cần thay pin.";

    case "PIN_LUU_TRU":
      if (budgetLabel) {
        return `Ngân sách ${budgetLabel} thì em tư vấn sơ bộ được anh/chị nhé, nhưng pin lưu trữ vẫn phải nhìn theo điện áp, dung lượng, dòng xả và mức tải thực tế. Có thêm thông số hoặc ảnh bộ pin cũ thì bên em báo sẽ sát hơn.`;
      }
      return "Phần này em tư vấn sơ bộ được ạ. Giá pin lưu trữ sẽ đi theo điện áp, dung lượng, dòng xả và mức tải thực tế, nên có thêm thông số hoặc ảnh bộ pin cũ thì bên em báo sẽ sát hơn.";

    case "CUSTOM":
      if (budgetLabel) {
        return `Với tầm ${budgetLabel}, bên em vẫn khoanh sơ bộ được, nhưng bộ pin theo yêu cầu còn phải chốt kích thước, điện áp, dung lượng và mức xả trước thì mới báo sát được. Anh/chị gửi giúp em nhu cầu chi tiết hơn là em đi đúng cấu hình ngay.`;
      }
      return "Với bộ pin theo yêu cầu, bên em sẽ cần chốt kích thước, điện áp, dung lượng và mức xả trước thì mới báo sát được. Nếu tiện, anh/chị để lại nhu cầu chi tiết giúp em để bên em đi đúng cấu hình ngay từ đầu.";

    case "DONG_PIN":
    default:
      if (budgetLabel) {
        return `Ngân sách ${budgetLabel} thì em vẫn khoanh sơ bộ cho anh/chị được, nhưng đóng pin còn lệch theo model, điện áp, dung lượng và loại cell mình muốn dùng. Có thêm ảnh pin cũ hoặc tên thiết bị thì bên em sẽ gợi ý sát hơn nhiều.`;
      }
      return "Em có thể tư vấn sơ bộ cho anh/chị trước được nhé. Với đóng pin, giá thường lệch theo model, điện áp, dung lượng và loại cell mình muốn dùng, nên có thêm ảnh pin cũ hoặc tên thiết bị thì bên em báo sẽ sát hơn nhiều.";
  }
}

function buildServiceSpecificReply(
  lookupMessage: string,
  naturalMessage: string,
  service: ChatbotServiceId | null
) {
  if (!service) {
    return null;
  }

  if (service === "DEN_NLMT" && includesAny(lookupMessage, SOLAR_SAVINGS_SIGNALS)) {
    return buildSolarSavingsReply();
  }

  if (service === "DEN_NLMT" && includesAny(lookupMessage, SOLAR_USAGE_SIGNALS)) {
    return buildSolarUsageReply();
  }

  if (
    service === "CAMERA" &&
    includesAny(lookupMessage, ["cua hang", "tap hoa", "shop", "nha", "xuong", "van phong"])
  ) {
    return "Dạ bên em có lắp camera cho cửa hàng anh/chị nhé. Thường với cửa hàng mình sẽ ưu tiên góc nhìn quầy thu ngân, cửa ra vào và khu trưng bày để dễ theo dõi hơn, rồi mới chốt số mắt và loại camera cho vừa nhu cầu.";
  }

  if (
    service === "DEN_NLMT" &&
    (includesAny(lookupMessage, ["chong nuoc", "vao nuoc", "ngoai troi", "tham nuoc"]) ||
      includesAny(normalizeLookupText(naturalMessage), ["mua", "mua mua"]))
  ) {
    return "Nếu bộ đèn, pin và hộp điều khiển đúng chuẩn ngoài trời thì dùng mùa mưa vẫn ổn anh/chị nhé. Phần hay cần kiểm tra kỹ là độ kín nước của hộp pin, chất lượng cell và thời lượng dự phòng khi trời âm u nhiều ngày liên tiếp.";
  }

  if (
    service === "DONG_PIN" &&
    includesAny(lookupMessage, ["loai nao", "loai gi", "cell nao", "nen chon", "chon loai", "ok"])
  ) {
    return "Không có một loại pin nào hợp cho mọi máy đâu anh/chị. Bên em thường chọn theo thiết bị, điện áp, dòng xả, nhu cầu dùng mạnh hay bền, rồi mới cân giữa cell mới, cell chính hãng và mức chi phí để ra cấu hình ổn nhất.";
  }

  if (
    service === "PIN_LUU_TRU" &&
    includesAny(lookupMessage, ["loai nao", "loai gi", "nen chon", "cell nao"])
  ) {
    return "Với pin lưu trữ thì loại nào ổn còn phụ thuộc điện áp hệ thống, tải dùng thực tế và việc anh/chị ưu tiên bền, xả khỏe hay tối ưu chi phí. Có thêm thông số inverter hoặc bộ tải đang dùng thì em sẽ gợi ý sát hơn nhiều.";
  }

  return null;
}

function isLikelyOutOfScopeQuestion(text: string) {
  return includesAny(text, OUT_OF_SCOPE_HINTS) && !includesAny(text, DOMAIN_HINTS);
}

export function getChatbotServiceLabel(service: ChatbotServiceId | null) {
  if (!service || service === "KHAC") return null;
  return CHATBOT_SERVICE_CONFIG[service]?.label || null;
}

export function getChatbotLeadSource(service: ChatbotServiceId | null) {
  if (!service || service === "KHAC") {
    return "chatbot-general";
  }

  return CHATBOT_SERVICE_CONFIG[service]?.leadSource || "chatbot-general";
}

export function buildChatbotServiceContextNote(service: ChatbotServiceId | null) {
  const serviceLabel = getChatbotServiceLabel(service);

  if (!serviceLabel) {
    return "";
  }

  return `Ngữ cảnh gần nhất: khách đang quan tâm ${serviceLabel}. Khi trả lời, hãy bám đúng nhóm dịch vụ này trừ khi khách đổi chủ đề thật rõ.`;
}

export function analyzeChatbotMessage(
  message: string,
  options: ChatbotAnalysisOptions = {}
): ChatbotResponsePlan {
  const lookupMessage = normalizeLookupText(message);
  const naturalMessage = normalizeNaturalText(message);
  const conversation = resolveConversationContext(options.history, options.serviceContext || null);

  if (!lookupMessage) {
    return {
      intent: "general",
      localReply: null,
      service: conversation.activeService,
      serviceLabel: getChatbotServiceLabel(conversation.activeService),
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  const service = detectChatbotService(lookupMessage, conversation.activeService);
  const serviceLabel = getChatbotServiceLabel(service);
  const wordCount = lookupMessage.split(" ").filter(Boolean).length;
  const mentionedServices = detectMentionedServices(lookupMessage);
  const budgetVnd =
    parseBudgetVnd(lookupMessage) ||
    (shouldReuseServiceContext(lookupMessage) && conversation.lastIntent === "quote"
      ? conversation.lastBudgetVnd
      : null);
  const hasGreeting = includesAny(lookupMessage, GREETING_SIGNALS);
  const hasExplicitBudgetIntent = hasBudgetIntent(lookupMessage, naturalMessage);
  const hasQuoteIntent = includesAny(lookupMessage, QUOTE_SIGNALS) || hasExplicitBudgetIntent;
  const hasHumanSupportIntent = includesAny(lookupMessage, HUMAN_SUPPORT_SIGNALS);
  const hasOpenEndedIntent = includesAny(lookupMessage, OPEN_ENDED_SIGNALS);
  const hasLocationIntent = includesAny(lookupMessage, LOCATION_SIGNALS);
  const hasWarrantyIntent = includesAny(lookupMessage, WARRANTY_SIGNALS);
  const wantsAlternativeServices = wantsAlternativeServiceSuggestions(
    lookupMessage,
    service || conversation.activeService,
    mentionedServices
  );
  const isPureGreeting =
    hasGreeting &&
    wordCount <= 4 &&
    !service &&
    !hasQuoteIntent &&
    !hasHumanSupportIntent &&
    !hasOpenEndedIntent &&
    !hasLocationIntent &&
    !hasWarrantyIntent;

  if (isPureGreeting) {
    return {
      intent: "greeting",
      localReply:
        "Em chào anh/chị ạ. Anh/chị cứ nói sơ nhu cầu, em sẽ cố gắng tư vấn ngắn gọn và đi đúng ý hơn cho mình.",
      service,
      serviceLabel,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (hasLocationIntent) {
    return {
      intent: "faq",
      localReply: buildLocationReply(),
      service,
      serviceLabel,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (hasWarrantyIntent) {
    return {
      intent: "faq",
      localReply: buildWarrantyReply(lookupMessage, service),
      service,
      serviceLabel,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (
    (includesAny(lookupMessage, ["sac nhanh day", "nhanh het", "pin yeu", "tu hao", "bao ao"]) &&
      includesAny(lookupMessage, ["pin", "binh", "cell", "sac", "dien"])) ||
    includesAny(lookupMessage, ["phong pin", "pin phong", "khong nhan sac", "sut ap", "chai pin"])
  ) {
    return {
      intent: "faq",
      localReply:
        "Dấu hiệu này thường do cell pin chai, lệch cell hoặc mạch pin lỗi. Anh/chị nên ngưng dùng sớm nếu pin có dấu hiệu bất thường, rồi bên em kiểm tra trước khi chốt nên sửa hay đóng lại cho đúng bài toán sử dụng.",
      service: service || "DONG_PIN",
      serviceLabel: getChatbotServiceLabel(service || "DONG_PIN"),
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (isLikelyOutOfScopeQuestion(lookupMessage)) {
    return {
      intent: "general",
      localReply:
        "Dạ câu này không thuộc mảng bên em hỗ trợ ạ. Em chỉ tư vấn về pin, đèn năng lượng mặt trời, pin lưu trữ và camera của Minh Hồng thôi anh/chị nhé.",
      service: null,
      serviceLabel: null,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (wantsAlternativeServices) {
    return {
      intent: "general",
      localReply: buildAlternativeServicesReply(service || mentionedServices[0] || conversation.activeService, budgetVnd),
      service: null,
      serviceLabel: null,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: true,
    };
  }

  if (!service && (hasQuoteIntent || hasHumanSupportIntent)) {
    return {
      intent: hasHumanSupportIntent ? "contact" : "quote",
      localReply:
        "Dạ em hỗ trợ được anh/chị nhé. Anh/chị đang nghiêng về đóng pin, đèn NLMT, pin lưu trữ hay camera để em đi đúng hướng hơn và tránh tư vấn lan man ạ?",
      service: null,
      serviceLabel: null,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: true,
    };
  }

  if (service && hasHumanSupportIntent) {
    return {
      intent: "contact",
      localReply: buildHumanSupportReply(service),
      service,
      serviceLabel,
      shouldOfferLeadForm: true,
      shouldOfferHumanSupport: true,
      shouldSuggestServices: false,
    };
  }

  if (service && hasQuoteIntent) {
    return {
      intent: "quote",
      localReply: buildQuoteReply(service, { budgetVnd, lookupMessage }),
      service,
      serviceLabel,
      shouldOfferLeadForm: true,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  const serviceSpecificReply = buildServiceSpecificReply(lookupMessage, naturalMessage, service);
  if (serviceSpecificReply) {
    return {
      intent: "faq",
      localReply: serviceSpecificReply,
      service,
      serviceLabel,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  if (hasOpenEndedIntent) {
    return {
      intent: service ? "open_question" : "general",
      localReply: null,
      service,
      serviceLabel,
      shouldOfferLeadForm: false,
      shouldOfferHumanSupport: false,
      shouldSuggestServices: false,
    };
  }

  for (const rule of FAQ_RULES) {
    if (matchesRule(lookupMessage, rule)) {
      const resolvedService = service || rule.service || null;

      return {
        intent: "faq",
        localReply: rule.answer,
        service: resolvedService,
        serviceLabel: getChatbotServiceLabel(resolvedService),
        shouldOfferLeadForm: false,
        shouldOfferHumanSupport: false,
        shouldSuggestServices: false,
      };
    }
  }

  return {
    intent: service ? "open_question" : "general",
    localReply: null,
    service,
    serviceLabel,
    shouldOfferLeadForm: false,
    shouldOfferHumanSupport: false,
    shouldSuggestServices: false,
  };
}

export function getLocalChatbotReply(
  message: string,
  options: ChatbotAnalysisOptions = {}
): string | null {
  return analyzeChatbotMessage(message, options).localReply;
}
