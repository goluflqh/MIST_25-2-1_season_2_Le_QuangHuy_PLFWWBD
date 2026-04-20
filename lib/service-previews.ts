export type ServicePreviewAccent = "red" | "blue" | "yellow" | "green";

export interface ServicePreviewItem {
  availabilityLabel: string;
  consultLabel: string;
  ctaLabel: string;
  fulfillmentLabel: string;
  imageAlt: string;
  imageSrc: string;
  kicker: string;
  quoteHref: string;
  specs: string[];
  summary: string;
  title: string;
}

export const batteryPreviewItems: ServicePreviewItem[] = [
  {
    availabilityLabel: "Chốt cấu hình trong ngày",
    consultLabel: "Phù hợp khách cần thay nhanh để đi làm, đi học hoặc giao hàng hằng ngày.",
    ctaLabel: "Nhận cấu hình tương tự",
    fulfillmentLabel: "Pin xe điện 48V",
    imageAlt: "Minh họa bộ pin xe đạp điện 48V cho nhu cầu đi lại hằng ngày.",
    imageSrc: "/showcase/battery-ebike-pack.svg",
    kicker: "Mẫu khách hay hỏi",
    quoteHref: "/?service=DONG_PIN&source=preview-ebike-pack#quote",
    specs: ["48V 20Ah", "Cell mới đồng đều", "Có BMS bảo vệ"],
    summary:
      "Cấu hình tham khảo cho xe đạp điện gia đình hoặc ship nội thành, ưu tiên độ bền và quãng đường ổn định.",
    title: "Bộ pin xe đạp điện 48V 20Ah",
  },
  {
    availabilityLabel: "Ưu tiên hàng công việc",
    consultLabel: "Phù hợp máy khoan, máy cắt và các bộ dụng cụ phải dùng liên tục tại xưởng.",
    ctaLabel: "Yêu cầu đóng bộ tương tự",
    fulfillmentLabel: "Pin máy công cụ 21V",
    imageAlt: "Minh họa bộ pin máy công cụ 21V cho máy khoan và dụng cụ cầm tay.",
    imageSrc: "/showcase/battery-power-tool-pack.svg",
    kicker: "Dùng thực tế nhiều",
    quoteHref: "/?service=DONG_PIN&source=preview-power-tool-pack#quote",
    specs: ["21V 6Ah", "Dòng xả khỏe", "Vỏ đóng chắc tay"],
    summary:
      "Gói tham khảo cho thợ lắp đặt hoặc xưởng nhỏ cần pin khỏe, sạc ổn định và hạn chế sụt áp khi tải nặng.",
    title: "Pin máy khoan 21V 6Ah",
  },
];

export const cameraPreviewItems: ServicePreviewItem[] = [
  {
    availabilityLabel: "Khảo sát miễn phí",
    consultLabel:
      "Phù hợp nhà phố hoặc nhà có cổng cần xem điện thoại, xem lại nhanh và không muốn đi dây rối.",
    ctaLabel: "Nhận sơ đồ lắp tương tự",
    fulfillmentLabel: "Combo gia đình 2 mắt",
    imageAlt: "Minh họa bộ camera gia đình 2 mắt với màn hình điện thoại xem từ xa.",
    imageSrc: "/showcase/camera-home-kit.svg",
    kicker: "Gia đình phổ biến",
    quoteHref: "/?service=CAMERA&source=preview-home-camera-kit#quote",
    specs: ["2 camera ngoài trời", "Xem điện thoại 24/7", "Lưu trữ an toàn"],
    summary:
      "Mẫu lắp đặt tối ưu cho nhà ở, cổng và sân trước, giúp chủ nhà quan sát nhanh trên điện thoại mà vẫn gọn thẩm mỹ.",
    title: "Bộ camera gia đình 2 mắt",
  },
  {
    availabilityLabel: "Có thể mở rộng thêm mắt",
    consultLabel: "Phù hợp cửa hàng cần quan sát quầy, cửa ra vào và khu giữ xe trong cùng một bộ.",
    ctaLabel: "Yêu cầu bộ cửa hàng",
    fulfillmentLabel: "Combo cửa hàng 4 mắt",
    imageAlt: "Minh họa bộ camera cửa hàng 4 mắt với nhiều góc quan sát.",
    imageSrc: "/showcase/camera-shop-kit.svg",
    kicker: "Cửa hàng bán lẻ",
    quoteHref: "/?service=CAMERA&source=preview-shop-camera-kit#quote",
    specs: ["4 camera góc rộng", "Có hồng ngoại/đêm màu", "Lưu trữ đầu ghi"],
    summary:
      "Gói tham khảo cho shop vừa và nhỏ cần theo dõi khách ra vào, quầy thu ngân và hàng hóa trong giờ cao điểm.",
    title: "Combo camera cửa hàng 4 mắt",
  },
];

export const solarPreviewItems: ServicePreviewItem[] = [
  {
    availabilityLabel: "Lắp gọn ngoài trời",
    consultLabel:
      "Phù hợp sân vườn, lối đi hoặc khu cổng cần sáng đẹp, ít bảo trì và không muốn kéo dây điện.",
    ctaLabel: "Nhận mẫu đèn tương tự",
    fulfillmentLabel: "Đèn sân vườn NLMT",
    imageAlt: "Minh họa đèn sân vườn năng lượng mặt trời cho lối đi và sân nhà.",
    imageSrc: "/showcase/solar-garden-light.svg",
    kicker: "Mẫu sân vườn",
    quoteHref: "/?service=DEN_NLMT&source=preview-solar-garden#quote",
    specs: ["Cảm biến sáng tối", "Pin lithium thay được", "Dùng ngoài trời"],
    summary:
      "Mẫu tham khảo cho sân nhà và lối đi, ưu tiên ánh sáng dễ chịu, lên đèn tự động và dễ bảo trì khi vào mùa mưa.",
    title: "Đèn sân vườn năng lượng mặt trời",
  },
  {
    availabilityLabel: "Dễ nâng cấp pin",
    consultLabel:
      "Phù hợp cổng nhà, biển hiệu hoặc khu vực cần sáng mạnh hơn nhưng vẫn muốn tiết kiệm điện.",
    ctaLabel: "Yêu cầu bộ cổng tương tự",
    fulfillmentLabel: "Đèn cổng + pin lưu trữ",
    imageAlt: "Minh họa bộ đèn cổng năng lượng mặt trời kèm hộp pin lưu trữ.",
    imageSrc: "/showcase/solar-gate-kit.svg",
    kicker: "Cần sáng bền hơn",
    quoteHref: "/?service=DEN_NLMT&source=preview-solar-gate-kit#quote",
    specs: ["Đèn pha công suất vừa", "Hộp pin kín nước", "Tư vấn theo giờ sáng"],
    summary:
      "Gói tham khảo cho khách muốn tăng thời lượng sáng và có thể thay cell nhanh khi hệ pin cũ đã xuống cấp.",
    title: "Bộ đèn cổng NLMT có pin lưu trữ",
  },
];

export const storagePreviewItems: ServicePreviewItem[] = [
  {
    availabilityLabel: "Chốt nhanh theo xe",
    consultLabel:
      "Phù hợp ô tô cá nhân, xe tải nhỏ hoặc khách muốn có sẵn bộ cứu hộ gọn nhẹ trên xe.",
    ctaLabel: "Nhận bộ kích đề tương tự",
    fulfillmentLabel: "Pin kích đề 12V",
    imageAlt: "Minh họa bộ pin kích đề ô tô 12V nhỏ gọn.",
    imageSrc: "/showcase/storage-starter-pack.svg",
    kicker: "Mang theo trên xe",
    quoteHref: "/?service=PIN_LUU_TRU&source=preview-starter-pack#quote",
    specs: ["12V", "Dòng xả mạnh", "Kẹp bình chắc chắn"],
    summary:
      "Mẫu tham khảo cho khách cần khởi động nhanh khi ắc quy yếu, ưu tiên gọn, dễ cất trong xe và dễ thao tác.",
    title: "Bộ kích đề ô tô 12V",
  },
  {
    availabilityLabel: "Đóng theo nhu cầu thật",
    consultLabel:
      "Phù hợp hệ điện mặt trời mini, lưu điện gia đình hoặc công trình nhỏ cần pin dự phòng ban đêm.",
    ctaLabel: "Yêu cầu tủ pin tương tự",
    fulfillmentLabel: "Tủ pin lưu trữ 51.2V",
    imageAlt: "Minh họa tủ pin lưu trữ năng lượng 51.2V cho hệ điện dự phòng.",
    imageSrc: "/showcase/storage-energy-bank.svg",
    kicker: "Lưu điện gia đình",
    quoteHref: "/?service=PIN_LUU_TRU&source=preview-energy-bank#quote",
    specs: ["51.2V", "BMS thông minh", "Có thể mở rộng"],
    summary:
      "Gói tham khảo cho khách muốn có bộ lưu điện gọn, dễ theo dõi tình trạng pin và sẵn đường nâng cấp sau này.",
    title: "Tủ pin lưu trữ 51.2V",
  },
];
