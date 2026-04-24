import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";
import { getNotificationCountForUser } from "@/lib/notifications";
import { getCurrentSessionUser } from "@/lib/session";
import { siteConfig, siteUrl } from "@/lib/site";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteConfig.name} - ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "đóng pin lithium",
    "lắp camera",
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
  },
  robots: { index: true, follow: true },
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
        className={`${spaceGrotesk.variable} ${dmSans.variable} flex min-h-screen flex-col bg-[#fffdfa] font-body text-slate-800 antialiased`}
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
