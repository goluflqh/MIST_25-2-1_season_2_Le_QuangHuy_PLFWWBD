export const leadSourceLabels: Record<string, string> = {
  homepage: "Trang chủ",
  "account-e2e": "Trang tài khoản khách",
  "homepage-services-camera": "Khối dịch vụ camera trang chủ",
  "homepage-services-dong-pin": "Khối dịch vụ đóng pin trang chủ",
  "homepage-services-den-nlmt": "Khối dịch vụ đèn năng lượng trang chủ",
  "homepage-services-pin-luu-tru": "Khối dịch vụ pin lưu trữ trang chủ",
  "pricing-page": "Trang báo giá",
  "service-dong-pin": "Trang dịch vụ đóng pin",
  "service-den-nlmt": "Trang đèn NLMT",
  "service-pin-luu-tru": "Trang pin lưu trữ",
  "service-camera": "Trang camera",
  "preview-ebike-pack": "Mẫu pin xe điện tham khảo",
  "preview-power-tool-pack": "Mẫu pin máy công cụ tham khảo",
  "preview-home-camera-kit": "Mẫu camera gia đình tham khảo",
  "preview-shop-camera-kit": "Mẫu camera cửa hàng tham khảo",
  "preview-solar-garden": "Mẫu đèn sân vườn tham khảo",
  "preview-solar-gate-kit": "Mẫu đèn cổng năng lượng tham khảo",
  "preview-starter-pack": "Mẫu pin kích đề tham khảo",
  "preview-energy-bank": "Mẫu tủ pin lưu trữ tham khảo",
  "chatbot-general": "Chatbot tư vấn chung",
  "chatbot-dong-pin": "Chatbot tư vấn đóng pin",
  "chatbot-den-nlmt": "Chatbot tư vấn đèn NLMT",
  "chatbot-pin-luu-tru": "Chatbot tư vấn pin lưu trữ",
  "chatbot-camera": "Chatbot tư vấn camera",
  "chatbot-custom": "Chatbot tư vấn bộ pin theo yêu cầu",
} as const;

const serviceSourceFallbacks = [
  { token: "camera", label: "Nguồn liên hệ camera" },
  { token: "dong-pin", label: "Nguồn liên hệ đóng pin" },
  { token: "den-nlmt", label: "Nguồn liên hệ đèn năng lượng" },
  { token: "solar", label: "Nguồn liên hệ đèn năng lượng" },
  { token: "pin-luu-tru", label: "Nguồn liên hệ pin lưu trữ" },
  { token: "storage", label: "Nguồn liên hệ pin lưu trữ" },
  { token: "battery", label: "Nguồn liên hệ đóng pin" },
  { token: "account", label: "Trang tài khoản khách" },
] as const;

export function getLeadSourceLabel(source: string | null | undefined) {
  if (!source) return "Nguồn khác";
  if (leadSourceLabels[source]) return leadSourceLabels[source];

  const normalizedSource = source.toLowerCase();
  const matchedService = serviceSourceFallbacks.find((item) =>
    normalizedSource.includes(item.token)
  );

  return matchedService?.label || "Nguồn liên hệ khác";
}
