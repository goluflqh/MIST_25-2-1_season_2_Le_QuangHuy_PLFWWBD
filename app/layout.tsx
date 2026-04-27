import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";
import { getNotificationCountForUser } from "@/lib/notifications";
import { getCurrentSessionUser } from "@/lib/session";
import { defaultOpenGraphImage, siteConfig, siteUrl } from "@/lib/site";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/space-grotesk/vietnamese-400.css";
import "@fontsource/space-grotesk/vietnamese-500.css";
import "@fontsource/space-grotesk/vietnamese-600.css";
import "@fontsource/space-grotesk/vietnamese-700.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/dm-sans/latin-ext-400.css";
import "@fontsource/dm-sans/latin-ext-500.css";
import "@fontsource/dm-sans/latin-ext-600.css";
import "@fontsource/dm-sans/latin-ext-700.css";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "đóng pin lithium",
    "sửa pin lithium",
    "đóng pin xe điện",
    "lắp camera an ninh Đà Nẵng",
    "đèn năng lượng mặt trời",
    "pin lưu trữ",
    siteConfig.name,
    "điện máy",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.ogDescription,
    url: "/",
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    images: [defaultOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - ${siteConfig.tagline}`,
    description: siteConfig.ogDescription,
    images: [defaultOpenGraphImage.url],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getCurrentSessionUser();
  const initialNotificationCount = currentUser
    ? await getNotificationCountForUser(currentUser)
    : 0;

  return (
    <html lang="vi" className="scroll-smooth scroll-pt-32" data-scroll-behavior="smooth">
      <body
        className="flex min-h-screen flex-col bg-[#fffdfa] font-body text-slate-800 antialiased"
      >
        <AuthProvider
          key={currentUser ? `${currentUser.id}:${currentUser.role}:${currentUser.name}` : "guest"}
          initialUser={
            currentUser
              ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
              : null
          }
        >
          <div className="pointer-events-none fixed inset-0 z-[-1] bg-[linear-gradient(180deg,#fff7ed_0%,#fffdfa_36%,#f8fafc_100%)]" />

          <Header
            initialNotificationCount={initialNotificationCount}
            initialNotificationUserId={currentUser?.id ?? null}
          />
          <main className="flex-grow pt-[96px] sm:pt-[108px]">{children}</main>
          <Footer />
          <ChatbotWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
