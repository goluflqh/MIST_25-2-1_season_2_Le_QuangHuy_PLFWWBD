import CompanyOverview from "@/components/company/CompanyOverview";
import { buildMarketingMetadata } from "@/lib/site";

const baseMetadata = buildMarketingMetadata({
  title: "Giới thiệu Minh Hồng",
  description: "Hoạt động kinh doanh pin từ khoảng tháng 10/2025, website ra mắt tháng 4/2026. Tìm hiểu dịch vụ, nền tảng phần mềm và kế hoạch tích hợp Claude của Minh Hồng.",
  path: "/gioi-thieu",
});

export const metadata = {
  ...baseMetadata,
  alternates: {
    canonical: "/gioi-thieu",
    languages: { vi: "/gioi-thieu", en: "/en/about", "x-default": "/gioi-thieu" },
  },
  openGraph: { ...baseMetadata.openGraph, alternateLocale: "en_US" },
};

export default function AboutPage() {
  return <CompanyOverview language="vi" />;
}
