import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Minh Hồng - Đại Lý Điện Máy & Đóng Pin Chuyên Nghiệp",
    template: "%s | Minh Hồng",
  },
  description: "Trung tâm phục hồi, đóng ráp bình ắc quy Lithium cao cấp và thiết bị công cụ. Lắp đặt thi công camera an ninh uy tín tại TPHCM.",
  keywords: ["đóng pin lithium", "lắp camera", "đèn năng lượng mặt trời", "pin lưu trữ", "Minh Hồng", "điện máy"],
  openGraph: {
    title: "Minh Hồng - Đại Lý Điện Máy & Đóng Pin Chuyên Nghiệp",
    description: "Trung tâm phục hồi, đóng ráp bình ắc quy Lithium cao cấp. Lắp đặt camera an ninh uy tín.",
    type: "website",
    locale: "vi_VN",
    siteName: "Minh Hồng",
  },
  robots: { index: true, follow: true },
};

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatbotWidget from "@/components/ChatbotWidget";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="scroll-smooth scroll-pt-32">
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} antialiased bg-slate-50 font-body text-slate-800 flex flex-col min-h-screen`}
      >
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-red-100 blur-3xl opacity-50 mix-blend-multiply"></div>
          <div className="absolute top-[20%] left-0 -ml-32 w-80 h-80 rounded-full bg-yellow-100 blur-3xl opacity-50 mix-blend-multiply"></div>
        </div>
        
        <div className="fixed bg-orange-300 w-80 h-80 bottom-[20%] left-[20%] animate-blob animate-delay-[4000ms] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] opacity-20 blur-3xl pointer-events-none z-[-1]"></div>

        <Header />
        <main className="flex-grow pt-[100px]">
          {children}
        </main>
        <Footer />
        <ChatbotWidget />
      </body>
    </html>
  );
}
