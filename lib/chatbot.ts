import { siteConfig } from "@/lib/site";

const HOTLINE = siteConfig.hotlineDisplay;
const LOCATION = siteConfig.locationLabel;
const BUSINESS_HOURS = siteConfig.businessHoursLabel;

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
  "tu van",
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
];

interface FaqRule {
  answer: string;
  requiredGroups: string[][];
}

const FAQ_RULES: FaqRule[] = [
  {
    answer: `Giá đóng pin phụ thuộc vào loại cell, dung lượng, dòng xả và thiết bị cụ thể. Anh/chị gửi model hoặc nhu cầu sử dụng, bên em mới báo đúng cấu hình và chi phí được.`,
    requiredGroups: [
      ["gia", "bao gia", "chi phi", "ton bao nhieu", "mat bao nhieu", "bao nhieu tien"],
      [
        "pin",
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
  },
  {
    answer: "Bên em bảo hành pin 6-12 tháng lỗi 1 đổi 1 tùy loại. Với camera, thời gian bảo hành sẽ theo cấu hình lắp đặt và bên em vẫn hỗ trợ kiểm tra sau bán hàng.",
    requiredGroups: [["bao hanh", "warranty", "doi tra", "loi 1 doi 1"]],
  },
  {
    answer: `Bên em ở ${LOCATION}, mở cửa ${BUSINESS_HOURS}. Anh/chị cần chỉ đường, Zalo hay gọi nhanh thì liên hệ ${HOTLINE} nhé.`,
    requiredGroups: [["dia chi", "o dau", "cho nao", "so dien thoai", "hotline", "zalo", "chi duong", "shop", "cua hang"]],
  },
  {
    answer: "Dạ có anh/chị nhé. Bên em nhận lắp camera cho nhà ở, cửa hàng và xưởng, có khảo sát tận nơi, thi công gọn dây và hỗ trợ cài xem trên điện thoại.",
    requiredGroups: [["camera"], ["lap", "lap dat", "thi cong", "gan", "an ninh", "giam sat"]],
  },
  {
    answer: "Dạ có anh/chị nhé. Bên em nhận đóng pin xe đạp điện và xe máy điện bằng cell Lithium chính hãng, cấu hình theo nhu cầu đi thực tế và độ bền anh/chị mong muốn.",
    requiredGroups: [["xe dien", "xe dap dien", "xe may dien"], ["dong pin", "pin"]],
  },
  {
    answer: "Dạ có anh/chị nhé. Bên em nhận làm pin cho đèn năng lượng mặt trời và pin lưu trữ dân dụng. Khi cần, bên em sẽ kiểm tra luôn tình trạng tấm pin, bộ sạc và mức tiêu thụ tải để tư vấn cho đúng.",
    requiredGroups: [["den nang luong", "nlmt", "mat troi", "solar"], ["pin", "luu tru", "den"]],
  },
  {
    answer: "Bên em nhận đóng pin loa kéo, nâng cấp dung lượng hoặc thay cell theo mức tải sử dụng thực tế. Nếu anh/chị có model loa thì bên em tư vấn sẽ sát hơn nhiều.",
    requiredGroups: [["loa keo", "karaoke", "loa bluetooth"], ["pin", "dong pin"]],
  },
  {
    answer: "Dạ có anh/chị nhé. Bên em nhận làm pin kích đề, pin lưu trữ và các bộ pin theo yêu cầu riêng. Với ô tô hoặc tải nặng thì cần chốt đúng điện áp, dòng xả đỉnh và mức an toàn trước khi đóng.",
    requiredGroups: [["kich de", "o to", "xe hoi", "du phong"], ["pin", "binh"]],
  },
  {
    answer: "Bên em có nhận phục hồi và đóng mới pin laptop một số dòng phổ biến. Nếu anh/chị có model máy hoặc mã pin cũ thì bên em sẽ kiểm tra khả năng làm thực tế nhanh hơn.",
    requiredGroups: [["laptop", "macbook", "dell", "hp", "asus", "lenovo"], ["pin", "cell"]],
  },
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeKeywords(keywords: string[]) {
  return keywords.map((keyword) => normalizeLookupText(keyword));
}

function matchesRule(text: string, rule: FaqRule) {
  return rule.requiredGroups.every((group) => includesAny(text, normalizeKeywords(group)));
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

export function getLocalChatbotReply(message: string): string | null {
  const lookupMessage = normalizeLookupText(message);

  if (!lookupMessage) {
    return null;
  }

  if (
    (includesAny(lookupMessage, ["sac nhanh day", "nhanh het", "pin yeu", "tu hao", "bao ao"]) &&
      includesAny(lookupMessage, ["pin", "binh", "cell", "sac", "dien"])) ||
    includesAny(lookupMessage, ["phong pin", "pin phong", "khong nhan sac", "sut ap", "chai pin"])
  ) {
    return "Dấu hiệu này thường do cell pin chai, lệch cell hoặc mạch pin lỗi. Anh/chị nên ngưng dùng sớm nếu pin có dấu hiệu bất thường, rồi bên em kiểm tra trước khi chốt nên sửa hay đóng lại cho đúng bài toán sử dụng.";
  }

  if (includesAny(lookupMessage, OPEN_ENDED_SIGNALS)) {
    return null;
  }

  for (const rule of FAQ_RULES) {
    if (matchesRule(lookupMessage, rule)) {
      return rule.answer;
    }
  }

  return null;
}
