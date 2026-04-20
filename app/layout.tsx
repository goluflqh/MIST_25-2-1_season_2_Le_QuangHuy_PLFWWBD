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
        className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased bg-slate-50 font-body text-slate-800 flex flex-col min-h-screen`}
      >
        <AuthProvider
          key={currentUser ? `${currentUser.id}:${currentUser.role}:${currentUser.name}` : "guest"}
          initialUser={
            currentUser
              ? { id: currentUser.id, name: currentUser.name, role: currentUser.role }
              : null
          }
        >
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
            <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-red-100 blur-3xl opacity-50 mix-blend-multiply"></div>
            <div className="absolute top-[20%] left-0 -ml-32 w-80 h-80 rounded-full bg-yellow-100 blur-3xl opacity-50 mix-blend-multiply"></div>
          </div>

          <div className="fixed bg-orange-300 w-80 h-80 bottom-[20%] left-[20%] animate-blob animate-delay-[4000ms] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-20 blur-3xl pointer-events-none z-[-1]"></div>

          <Header
            initialNotificationCount={initialNotificationCount}
            initialNotificationUserId={currentUser?.id ?? null}
          />
          <main className="flex-grow pt-[100px]">{children}</main>
          <Footer />
          <ChatbotWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
