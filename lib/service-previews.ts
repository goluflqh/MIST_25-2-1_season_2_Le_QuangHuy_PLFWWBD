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
    imageAlt: "Bộ pin Lithium, cell xanh và mạch BMS cho nhu cầu xe điện gia đình.",
    imageSrc: "/showcase/generated/product-battery-ebike-cells-v2.webp",
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
    fulfillmentLabel: "Pin máy công cụ",
    imageAlt: "Các bộ pin máy công cụ 18V và mạch điều khiển đang được phục hồi.",
    imageSrc: "/showcase/generated/product-battery-tool-packs-v2.webp",
    kicker: "Dùng thực tế nhiều",
    quoteHref: "/?service=DONG_PIN&source=preview-power-tool-pack#quote",
    specs: ["Máy khoan/máy mài", "Cell đồng bộ", "BMS bảo vệ"],
    summary:
      "Gói tham khảo cho thợ lắp đặt hoặc xưởng nhỏ cần phục hồi pin máy công cụ, ưu tiên dòng xả ổn định và vỏ đóng chắc tay.",
    title: "Pin máy khoan, máy mài",
  },
  {
    availabilityLabel: "Tính theo công suất",
    consultLabel:
      "Phù hợp quạt, đèn LED, thiết bị DC hoặc bài toán dùng pin riêng. Tải lớn như điều hòa mini cần đo công suất và thời gian chạy trước.",
    ctaLabel: "Tư vấn nguồn pin riêng",
    fulfillmentLabel: "Thiết bị dùng pin",
    imageAlt: "Bộ pin Lithium cấp nguồn cho quạt, đèn LED và thiết bị DC nhỏ.",
    imageSrc: "/showcase/generated/product-battery-fan-light-pack-v3.webp",
    kicker: "Theo thiết bị thật",
    quoteHref: "/?service=DONG_PIN&source=preview-device-power-pack#quote",
    specs: ["Tính theo watt", "Đầu ra phù hợp", "Có mạch bảo vệ"],
    summary:
      "Dành cho nhu cầu biến thiết bị nhỏ thành dùng pin hoặc tăng thời lượng dùng. Minh Hồng sẽ hỏi công suất, điện áp và thời gian chạy mong muốn trước khi chốt.",
    title: "Nguồn pin cho quạt, đèn, thiết bị DC",
  },
];

export const cameraPreviewItems: ServicePreviewItem[] = [
  {
    availabilityLabel: "Khảo sát miễn phí",
    consultLabel:
      "Phù hợp nhà phố hoặc nhà có cổng cần xem điện thoại, xem lại nhanh và không muốn đi dây rối.",
    ctaLabel: "Nhận sơ đồ lắp tương tự",
    fulfillmentLabel: "Combo gia đình 2 mắt",
    imageAlt: "Bộ camera Wi-Fi gia đình gồm camera trong nhà và camera ngoài trời.",
    imageSrc: "/showcase/generated/product-camera-home-kit-v2.webp",
    kicker: "Gia đình phổ biến",
    quoteHref: "/?service=CAMERA&source=preview-home-camera-kit#quote",
    specs: ["2 camera ngoài trời", "Xem điện thoại 24/7", "Lưu trữ an toàn"],
    summary:
      "Mẫu lắp đặt tối ưu cho nhà ở, cổng và sân trước, giúp chủ nhà quan sát nhanh trên điện thoại mà vẫn gọn thẩm mỹ.",
    title: "Bộ camera gia đình 2 mắt",
  },
  {
    availabilityLabel: "Theo dõi nhiều góc",
    consultLabel: "Phù hợp cửa hàng muốn một cụm camera đa ống kính để nhìn quầy, cửa ra vào và khu để xe gọn hơn.",
    ctaLabel: "Yêu cầu camera cửa hàng",
    fulfillmentLabel: "Camera 4 mắt",
    imageAlt: "Camera an ninh 4 mắt dạng một cụm camera đa ống kính kèm điện thoại xem từ xa.",
    imageSrc: "/showcase/generated/product-camera-four-eye-shop-v3.webp",
    kicker: "Cửa hàng bán lẻ",
    quoteHref: "/?service=CAMERA&source=preview-shop-camera-kit#quote",
    specs: ["Một cụm đa ống kính", "Xem điện thoại", "Theo dõi nhiều khu vực"],
    summary:
      "Mẫu tham khảo cho shop vừa và nhỏ cần quan sát nhiều hướng mà vẫn muốn lắp gọn, dễ xem lại và dễ theo dõi trên điện thoại.",
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
    imageAlt: "Bộ đèn pha năng lượng mặt trời có tấm pin rời và remote điều khiển.",
    imageSrc: "/showcase/generated/product-solar-floodlight-kit-v2.webp",
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
    imageAlt: "Bộ đèn cổng năng lượng mặt trời kèm hộp pin, mạch BMS và dây kết nối.",
    imageSrc: "/showcase/generated/product-solar-gate-battery-kit-v2.webp",
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
    imageAlt: "Bộ kích đề 12V nhỏ gọn với kẹp bình và túi đựng.",
    imageSrc: "/showcase/generated/product-storage-jump-starter-v2.webp",
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
    imageAlt: "Bộ pin lưu trữ LiFePO4 có cell, BMS và dây kết nối trên bàn kỹ thuật.",
    imageSrc: "/showcase/generated/product-storage-lifepo4-bank-v2.webp",
    kicker: "Lưu điện gia đình",
    quoteHref: "/?service=PIN_LUU_TRU&source=preview-energy-bank#quote",
    specs: ["51.2V", "BMS thông minh", "Có thể mở rộng"],
    summary:
      "Gói tham khảo cho khách muốn có bộ lưu điện gọn, dễ theo dõi tình trạng pin và sẵn đường nâng cấp sau này.",
    title: "Tủ pin lưu trữ 51.2V",
  },
];
