export const leadSourceLabels: Record<string, string> = {
  homepage: "Trang chủ",
  "homepage-services-camera": "Khối dịch vụ camera trang chủ",
  "homepage-services-dong-pin": "Khối dịch vụ đóng pin trang chủ",
  "pricing-page": "Trang báo giá",
  "service-dong-pin": "Trang dịch vụ đóng pin",
  "service-den-nlmt": "Trang đèn NLMT",
  "service-pin-luu-tru": "Trang pin lưu trữ",
  "service-camera": "Trang camera",
  "chatbot-general": "Chatbot tư vấn chung",
  "chatbot-dong-pin": "Chatbot tư vấn đóng pin",
  "chatbot-den-nlmt": "Chatbot tư vấn đèn NLMT",
  "chatbot-pin-luu-tru": "Chatbot tư vấn pin lưu trữ",
  "chatbot-camera": "Chatbot tư vấn camera",
  "chatbot-custom": "Chatbot tư vấn bộ pin theo yêu cầu",
} as const;

export function getLeadSourceLabel(source: string | null | undefined) {
  if (!source) return "Nguồn khác";
  return leadSourceLabels[source] || source;
}
