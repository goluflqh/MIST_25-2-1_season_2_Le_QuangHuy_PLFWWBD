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
    <html lang="vi" className="scroll-smooth scroll-pt-32 motion-reduce:scroll-auto" data-scroll-behavior="smooth">
      <body
        className="flex min-h-screen flex-col bg-[#fffdfa] font-body text-slate-800 antialiased [--app-header-offset:96px] sm:[--app-header-offset:108px]"
      >
        <AuthProvider
          key={currentUser ? `${currentUser.id}:${currentUser.role}:${currentUser.name}` : "guest"}
          initialUser={
            currentUser
              ? { id: currentUser.id, name: currentUser.name, phone: currentUser.phone, role: currentUser.role }
              : null
          }
        >
          <a
            href="#main-content"
            className="fixed left-4 top-3 z-[100] -translate-y-24 rounded-xl bg-slate-950 px-4 py-3 font-body text-sm font-bold text-white shadow-xl transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 motion-reduce:transition-none"
          >
            Chuyển đến nội dung chính
          </a>
          <div className="pointer-events-none fixed inset-0 z-[-1] bg-[linear-gradient(180deg,#fff7ed_0%,#fffdfa_36%,#f8fafc_100%)]" />

          <Header
            initialNotificationCount={initialNotificationCount}
            initialNotificationUserId={currentUser?.id ?? null}
          />
          <main id="main-content" tabIndex={-1} className="flex-grow pt-[var(--app-header-offset)]">
            {children}
          </main>
          <Footer />
          <ChatbotWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
