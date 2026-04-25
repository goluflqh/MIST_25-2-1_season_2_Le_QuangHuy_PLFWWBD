import { getAbsoluteUrl, siteConfig } from "@/lib/site";

type ServiceSchemaKey = "battery" | "camera" | "solar" | "storage";

const businessId = getAbsoluteUrl("/#local-business");

const serviceSchemas = {
  battery: {
    name: "Đóng pin Lithium Đà Nẵng",
    path: "/dich-vu/dong-pin",
    serviceType: "Đóng pin Lithium",
    description:
      "Đóng mới và phục hồi pin Lithium theo tải thực tế cho xe điện, máy công cụ, loa kéo và bộ pin theo thông số riêng tại Đà Nẵng.",
  },
  camera: {
    name: "Lắp camera an ninh Đà Nẵng",
    path: "/dich-vu/camera",
    serviceType: "Lắp đặt camera an ninh",
    description:
      "Khảo sát, lắp đặt camera an ninh cho gia đình, cửa hàng, kho và xưởng tại Đà Nẵng với cấu hình đủ dùng và bàn giao dễ theo dõi.",
  },
  solar: {
    name: "Đèn năng lượng mặt trời Đà Nẵng",
    path: "/dich-vu/den-nang-luong",
    serviceType: "Đèn năng lượng mặt trời",
    description:
      "Tư vấn, lắp đặt và thay pin đèn năng lượng mặt trời cho sân, cổng, lối đi và khu vực cần chiếu sáng tự động tại Đà Nẵng.",
  },
  storage: {
    name: "Pin lưu trữ và kích đề Đà Nẵng",
    path: "/dich-vu/pin-luu-tru",
    serviceType: "Pin lưu trữ và kích đề",
    description:
      "Thiết kế pin lưu trữ, bộ kích đề và nguồn dự phòng theo tải xả, dung lượng và mức an toàn cần thiết tại Đà Nẵng.",
  },
} as const;

function cityAreaServed() {
  return {
    "@type": "City",
    name: siteConfig.cityLabel,
  };
}

function businessReference() {
  return {
    "@id": businessId,
  };
}

export function buildLocalBusinessJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": businessId,
    name: siteConfig.name,
    description: siteConfig.description,
    url: getAbsoluteUrl("/"),
    telephone: siteConfig.hotlineRaw,
    areaServed: cityAreaServed(),
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.locationLabel,
      addressLocality: siteConfig.cityLabel,
      addressCountry: "VN",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "06:00",
        closes: "21:00",
      },
    ],
    sameAs: [siteConfig.facebookUrl, siteConfig.zaloUrl, siteConfig.mapUrl],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: siteConfig.hotlineRaw,
        contactType: "customer service",
        areaServed: "VN",
        availableLanguage: ["vi"],
      },
    ],
  };
}

export function buildWebsiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": getAbsoluteUrl("/#website"),
    name: siteConfig.name,
    url: getAbsoluteUrl("/"),
    publisher: businessReference(),
    inLanguage: "vi-VN",
  };
}

export function buildServiceJsonLd(key: ServiceSchemaKey) {
  const service = serviceSchemas[key];

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": getAbsoluteUrl(`${service.path}#service`),
    name: service.name,
    description: service.description,
    serviceType: service.serviceType,
    provider: businessReference(),
    areaServed: cityAreaServed(),
    url: getAbsoluteUrl(service.path),
    offers: {
      "@type": "Offer",
      url: getAbsoluteUrl("/bao-gia"),
      priceCurrency: "VND",
      availability: "https://schema.org/InStock",
    },
  };
}

export function buildBreadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getAbsoluteUrl(item.path),
    })),
  };
}

export function buildPricingFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Bảng giá Minh Hồng có phải giá cố định không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Không. Bảng giá là mức tham khảo để khách ước lượng ngân sách. Minh Hồng có thể cập nhật báo giá trong dashboard quản trị và website hiển thị theo các mục đang được bật; giá chốt vẫn phụ thuộc vào tình trạng thiết bị, cấu hình thật, linh kiện và phương án thi công sau khi kiểm tra.",
        },
      },
      {
        "@type": "Question",
        name: "Minh Hồng có khảo sát hoặc kiểm tra trước khi báo giá không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Có. Với pin, camera, đèn năng lượng mặt trời và pin lưu trữ, Minh Hồng ưu tiên kiểm tra tải, vị trí lắp hoặc tình trạng thiết bị trước khi chốt phương án.",
        },
      },
    ],
  };
}
