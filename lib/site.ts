import type { Metadata } from "next";

const LOCAL_SITE_URL = "http://localhost:3000";

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return LOCAL_SITE_URL;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.endsWith("/") ? withProtocol.slice(0, -1) : withProtocol;
}

export const siteUrl = normalizeSiteUrl(
  process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    LOCAL_SITE_URL
);

export const siteConfig = {
  name: "Điện máy pin Minh Hồng",
  tagline: "Đóng pin lithium Đà Nẵng",
  description:
    "Điện máy pin Minh Hồng tại Đà Nẵng nhận đóng pin xe điện, sửa pin lithium, pin lưu trữ, đèn năng lượng mặt trời và lắp đặt camera an ninh.",
  ogDescription:
    "Đóng pin xe điện, sửa pin lithium, pin lưu trữ, đèn năng lượng mặt trời và lắp camera an ninh tại Đà Nẵng.",
  locale: "vi_VN",
  cityLabel: "Đà Nẵng",
  locationLabel: "Xã Đồng Dương, TP. Đà Nẵng",
  businessHoursLabel: "6h đến 21h mỗi ngày",
  hotlineRaw: "0987443258",
  hotlineDisplay: "0987.443.258",
  hotlineHref: "tel:0987443258",
  zaloUrl: "https://zalo.me/0987443258",
  mapUrl: "https://maps.app.goo.gl/gCtACM49w2sPEc5dA",
  facebookUrl: "https://www.facebook.com/profile.php?id=61580417924412",
} as const;

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function getAbsoluteUrl(path: string) {
  return new URL(normalizePath(path), siteUrl).toString();
}

export const defaultOpenGraphImage = {
  url: "/showcase/generated/hero-battery-workbench-v2.webp",
  alt: `${siteConfig.name} - ${siteConfig.tagline}`,
} as const;

export const marketingSitemapRoutes = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/dich-vu/dong-pin", changeFrequency: "weekly", priority: 0.9 },
  { path: "/dich-vu/camera", changeFrequency: "weekly", priority: 0.9 },
  { path: "/dich-vu/den-nang-luong", changeFrequency: "weekly", priority: 0.9 },
  { path: "/dich-vu/pin-luu-tru", changeFrequency: "weekly", priority: 0.9 },
  { path: "/bao-gia", changeFrequency: "weekly", priority: 0.8 },
] as const;

export function buildMarketingMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const normalizedPath = normalizePath(path);

  return {
    title,
    description,
    alternates: {
      canonical: normalizedPath,
    },
    openGraph: {
      title: `${title} | ${siteConfig.name}`,
      description,
      url: normalizedPath,
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      images: [defaultOpenGraphImage],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.name}`,
      description,
      images: [defaultOpenGraphImage.url],
    },
  };
}
