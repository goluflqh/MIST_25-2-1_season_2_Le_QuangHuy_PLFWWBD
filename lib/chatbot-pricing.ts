import type { ChatbotServiceId } from "@/lib/chatbot";

type PricingCategory = "PIN" | "NLMT" | "LUU_TRU" | "CAMERA";

interface PricingFallbackItem {
  name: string;
  note: string;
  price: string;
}

interface PricingFallbackGroup {
  category: PricingCategory;
  items: PricingFallbackItem[];
}

interface PricingSourceItem {
  category: string;
  description?: string | null;
  name: string;
  note?: string | null;
  price: string;
  unit?: string | null;
}

const CHATBOT_PRICING_FALLBACK_DATA: PricingFallbackGroup[] = [
  {
    category: "PIN",
    items: [
      {
        name: "Kiểm tra tình trạng pin",
        price: "Miễn phí",
        note: "Quyền lợi trước khi chốt sửa hoặc đóng lại",
      },
      {
        name: "Pin máy khoan / bắn vít",
        price: "350.000 - 800.000đ",
        note: "Tuỳ dung lượng & hãng",
      },
      {
        name: "Pin xe đạp điện",
        price: "2.000.000 - 5.000.000đ",
        note: "Tuỳ Ah & loại xe",
      },
      {
        name: "Pin xe máy điện",
        price: "3.500.000 - 8.000.000đ",
        note: "Tuỳ dung lượng",
      },
      { name: "Pin loa kéo", price: "200.000 - 500.000đ", note: "Tuỳ hãng loa" },
      {
        name: "Pin laptop (thay cell)",
        price: "400.000 - 900.000đ",
        note: "Tuỳ hãng & model",
      },
    ],
  },
  {
    category: "NLMT",
    items: [
      {
        name: "Thay pin đèn NLMT",
        price: "150.000 - 400.000đ",
        note: "Tuỳ dung lượng",
      },
      {
        name: "Đèn pha NLMT 100W-300W",
        price: "500.000 - 1.500.000đ",
        note: "Bao lắp đặt",
      },
      { name: "Pin lưu trữ NLMT", price: "Liên hệ", note: "Tuỳ hệ thống" },
    ],
  },
  {
    category: "LUU_TRU",
    items: [
      {
        name: "Pin kích đề ô tô 12V",
        price: "800.000 - 2.000.000đ",
        note: "Tuỳ dòng xả",
      },
      {
        name: "Pin dự phòng dung lượng lớn",
        price: "500.000 - 3.000.000đ",
        note: "Tuỳ mAh",
      },
      {
        name: "Đóng bình pin theo yêu cầu",
        price: "Liên hệ",
        note: "Báo giá theo thông số",
      },
    ],
  },
  {
    category: "CAMERA",
    items: [
      {
        name: "Trọn bộ 2 camera",
        price: "2.500.000 - 4.000.000đ",
        note: "Bao lắp đặt",
      },
      {
        name: "Trọn bộ 4 camera",
        price: "4.000.000 - 7.000.000đ",
        note: "Bao lắp đặt",
      },
      {
        name: "Camera PTZ xoay 360°",
        price: "1.500.000 - 3.000.000đ/cam",
        note: "Tuỳ hãng",
      },
      { name: "Khảo sát tận nơi", price: "Miễn phí", note: "Đà Nẵng & lân cận" },
    ],
  },
];

const SERVICE_CATEGORY_MAP: Partial<Record<Exclude<ChatbotServiceId, "KHAC">, PricingCategory>> = {
  CAMERA: "CAMERA",
  DEN_NLMT: "NLMT",
  DONG_PIN: "PIN",
  PIN_LUU_TRU: "LUU_TRU",
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesStandaloneNumber(text: string, value: number) {
  return new RegExp(`(?:^|\\s)${value}(?:\\s|$)`, "u").test(text);
}

function mapSourceItems(items: PricingSourceItem[]): PricingFallbackGroup[] {
  return CHATBOT_PRICING_FALLBACK_DATA.map((group) => ({
    category: group.category,
    items: items
      .filter((item) => item.category === group.category)
      .map((item) => ({
        name: item.name,
        note: item.note || item.description || "",
        price: item.price,
      })),
  }));
}

function scorePricingItem(
  service: ChatbotServiceId,
  item: PricingFallbackItem,
  normalizedMessage: string
) {
  const itemText = normalizeText(`${item.name} ${item.note}`);
  let score = 0;

  if (service === "CAMERA") {
    if (includesStandaloneNumber(normalizedMessage, 4) && itemText.includes("4 camera")) score += 7;
    if (includesStandaloneNumber(normalizedMessage, 2) && itemText.includes("2 camera")) score += 7;
    if (
      (itemText.includes("ptz") || itemText.includes("360")) &&
      (normalizedMessage.includes("360") || normalizedMessage.includes("xoay"))
    ) {
      score += 7;
    }
  }

  if (service === "DONG_PIN") {
    if (normalizedMessage.includes("kiem tra") && itemText.includes("kiem tra")) score += 7;
    if (normalizedMessage.includes("may khoan") && itemText.includes("may khoan")) score += 7;
    if (normalizedMessage.includes("xe dap dien") && itemText.includes("xe dap dien")) score += 7;
    if (normalizedMessage.includes("xe may dien") && itemText.includes("xe may dien")) score += 7;
    if (normalizedMessage.includes("loa keo") && itemText.includes("loa keo")) score += 7;
    if (normalizedMessage.includes("laptop") && itemText.includes("laptop")) score += 7;
  }

  if (service === "DEN_NLMT") {
    if (
      (normalizedMessage.includes("thay pin") || normalizedMessage.includes("pin cu")) &&
      itemText.includes("thay pin")
    ) {
      score += 7;
    }
    if (
      (normalizedMessage.includes("den pha") ||
        normalizedMessage.includes("san") ||
        normalizedMessage.includes("cong") ||
        normalizedMessage.includes("loi di")) &&
      itemText.includes("den pha")
    ) {
      score += 7;
    }
    if (normalizedMessage.includes("luu tru") && itemText.includes("luu tru")) score += 7;
  }

  if (service === "PIN_LUU_TRU") {
    if (
      (normalizedMessage.includes("kich de") ||
        normalizedMessage.includes("o to") ||
        normalizedMessage.includes("12v")) &&
      itemText.includes("kich de")
    ) {
      score += 7;
    }
    if (
      (normalizedMessage.includes("mat dien") ||
        normalizedMessage.includes("du phong") ||
        normalizedMessage.includes("backup")) &&
      itemText.includes("du phong")
    ) {
      score += 7;
    }
    if (normalizedMessage.includes("theo yeu cau") && itemText.includes("theo yeu cau")) score += 7;
  }

  if (itemText && normalizedMessage) {
    for (const word of normalizedMessage.split(" ")) {
      if (word.length >= 3 && itemText.includes(word)) {
        score += 1;
      }
    }
  }

  return score;
}

function buildAdjustmentNote(service: ChatbotServiceId, normalizedMessage: string) {
  if (
    service === "CAMERA" &&
    (normalizedMessage.includes("5mp") ||
      normalizedMessage.includes("6 thang") ||
      normalizedMessage.includes("24 7") ||
      normalizedMessage.includes("24/7") ||
      normalizedMessage.includes("am tuong"))
  ) {
    return "Nếu khách nhắc 5MP, lưu nhiều tháng, ghi 24/7 hoặc đi dây âm tường thì hãy nói rõ thực tế thường sẽ nghiêng về đầu trên của khoảng hoặc cần thêm ổ cứng, đầu ghi hay công thi công.";
  }

  if (
    service === "DEN_NLMT" &&
    (normalizedMessage.includes("san") ||
      normalizedMessage.includes("cong") ||
      normalizedMessage.includes("100w") ||
      normalizedMessage.includes("200w") ||
      normalizedMessage.includes("300w"))
  ) {
    return "Nếu khách nói khu sân hoặc cổng rộng, công suất lớn hay cần sáng lâu qua đêm thì hãy nói mức thực tế thường sẽ nghiêng lên đầu trên của khoảng.";
  }

  if (
    service === "PIN_LUU_TRU" &&
    (normalizedMessage.includes("mat dien") ||
      normalizedMessage.includes("inverter") ||
      normalizedMessage.includes("ups") ||
      normalizedMessage.includes("tai"))
  ) {
    return "Với pin lưu trữ cho mất điện, inverter hay tải cụ thể thì hãy nói rõ mức công khai chỉ là mốc sơ bộ; cấu hình thật vẫn lệch theo điện áp, tải và thời gian lưu điện mong muốn.";
  }

  if (
    service === "DONG_PIN" &&
    (normalizedMessage.includes("cell") ||
      normalizedMessage.includes("ah") ||
      normalizedMessage.includes("model") ||
      normalizedMessage.includes("dung luong"))
  ) {
    return "Nếu khách đã nhắc model, dung lượng hay loại cell thì hãy nói rõ mức giá sẽ nghiêng theo đúng model và loại cell chứ không chốt cứng theo bảng tham khảo.";
  }

  return "";
}

export function buildChatbotPricingContext(
  service: ChatbotServiceId | null,
  message: string,
  items: PricingSourceItem[] = []
) {
  if (!service || service === "KHAC") {
    return "";
  }

  const category = SERVICE_CATEGORY_MAP[service];

  if (!category) {
    return "";
  }

  const normalizedMessage = normalizeText(message);
  const sourceGroups = items.length > 0 ? mapSourceItems(items) : CHATBOT_PRICING_FALLBACK_DATA;
  const categoryItems = sourceGroups.find((group) => group.category === category)?.items || [];

  if (categoryItems.length === 0) {
    return "";
  }

  const rankedItems = [...categoryItems]
    .map((item) => ({
      item,
      score: scorePricingItem(service, item, normalizedMessage),
    }))
    .sort((left, right) => right.score - left.score);

  const hasStrongMatch = rankedItems.slice(0, 3).some((entry) => entry.score > 0);
  const highlightedItems = (
    hasStrongMatch ? rankedItems.map((entry) => entry.item) : categoryItems
  ).slice(0, 3);

  const priceSummary = highlightedItems
    .map((item) => `${item.name}: ${item.price}${item.note ? ` (${item.note})` : ""}`)
    .join(" | ");

  const adjustmentNote = buildAdjustmentNote(service, normalizedMessage);

  return [
    `Khoảng giá tham khảo công khai có thể dùng để tư vấn sơ bộ: ${priceSummary}.`,
    "Đây chỉ là mức tham khảo để định hướng nhanh, không phải báo giá chốt cuối cùng.",
    "Khi khách hỏi giá, hãy ưu tiên nêu ngay 1 đến 3 khoảng phù hợp trước rồi mới hỏi thêm tối đa 1 chi tiết quan trọng nhất còn thiếu.",
    adjustmentNote,
  ]
    .filter(Boolean)
    .join(" ");
}
