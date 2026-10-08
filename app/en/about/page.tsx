import CompanyOverview from "@/components/company/CompanyOverview";
import { buildMarketingMetadata } from "@/lib/site";

const baseMetadata = buildMarketingMetadata({
  title: "About Minh Hồng",
  description: "Battery business operations began around October 2025; the website launched in April 2026. Explore Minh Hồng's services, software and planned Claude integration.",
  path: "/en/about",
});

export const metadata = {
  ...baseMetadata,
  alternates: {
    canonical: "/en/about",
    languages: { vi: "/gioi-thieu", en: "/en/about", "x-default": "/gioi-thieu" },
  },
  openGraph: { ...baseMetadata.openGraph, locale: "en_US", alternateLocale: "vi_VN" },
};

export default function EnglishAboutPage() {
  return <CompanyOverview language="en" />;
}
