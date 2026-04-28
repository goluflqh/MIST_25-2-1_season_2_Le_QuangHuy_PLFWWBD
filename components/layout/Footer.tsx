import Link from "next/link";
import { siteConfig } from "@/lib/site";

export default function Footer() {
  return (
    <>
      <footer className="bg-slate-900 border-t border-slate-800 pt-8 pb-4 sm:pt-16 sm:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4 md:gap-12">
            <div className="col-span-2 md:col-span-2">
              <div className="mb-2 flex items-center gap-3 sm:mb-6">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 200 200"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient id="gradRedFooter" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#EF4444" />
                      <stop offset="100%" stopColor="#991B1B" />
                    </linearGradient>
                    <linearGradient id="gradYellowFooter" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#FCD34D" />
                      <stop offset="100%" stopColor="#B45309" />
                    </linearGradient>
                    <linearGradient id="gradTopFooter" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#FCA5A5" />
                      <stop offset="100%" stopColor="#FDE68A" />
                    </linearGradient>
                  </defs>
                  <g>
                    <path
                      d="M100 20 L169 60 L100 100 L31 60 Z"
                      fill="url(#gradTopFooter)"
                    />
                    <path
                      d="M31 60 L45 68 L45 148 L31 140 Z"
                      fill="url(#gradRedFooter)"
                    />
                    <path
                      d="M58 76 L72 84 L72 164 L58 156 Z"
                      fill="url(#gradRedFooter)"
                    />
                    <path
                      d="M86 92 L100 100 L100 180 L86 172 Z"
                      fill="url(#gradRedFooter)"
                    />
                    <path
                      d="M100 100 L118 89.6 L118 169.6 L100 180 Z"
                      fill="url(#gradYellowFooter)"
                    />
                    <path
                      d="M151 70.4 L169 60 L169 140 L151 150.4 Z"
                      fill="url(#gradYellowFooter)"
                    />
                    <path
                      d="M118 114.6 L151 95.4 L151 115.4 L118 134.6 Z"
                      fill="url(#gradYellowFooter)"
                    />
                  </g>
                </svg>
                <div className="flex flex-col">
                  <span className="font-heading font-extrabold text-xl tracking-tight text-white leading-none">
                    MINH HỒNG
                  </span>
                  <span className="font-body text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Điện Máy - Đóng Pin
                  </span>
                </div>
              </div>
              <p className="mb-4 hidden max-w-md font-body text-sm leading-6 text-slate-400 sm:mb-6 sm:block sm:text-base sm:leading-relaxed">
                Xưởng tư vấn và thi công pin Lithium, pin lưu trữ, đèn năng lượng mặt trời
                và camera tại Đà Nẵng. Ưu tiên kiểm tra trước, báo giá rõ và hỗ trợ sau
                bàn giao.
              </p>
              <div className="mb-4 flex gap-3 sm:mb-0">
                <a
                  href={siteConfig.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition-colors hover:bg-blue-600 hover:text-white"
                  title="Facebook"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a
                  href={siteConfig.zaloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition-colors hover:bg-blue-500 hover:text-white"
                  title="Zalo"
                >
                  <span className="text-sm font-black">Zalo</span>
                </a>
                <a
                  href={siteConfig.hotlineHref}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition-colors hover:bg-green-600 hover:text-white"
                  title="Gọi ngay"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-heading text-base font-bold text-white sm:mb-6 sm:text-lg">
                Liên Kết Nhanh
              </h4>
              <ul className="grid grid-cols-1 gap-2 font-body text-sm sm:block sm:space-y-3 sm:text-base">
                <li>
                  <Link
                    href="/dich-vu/dong-pin"
                    className="block rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300 transition-colors hover:text-yellow-400 sm:bg-transparent sm:px-0 sm:py-0 sm:text-slate-400"
                  >
                    Dịch Vụ Đóng Pin
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dich-vu/camera"
                    className="block rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300 transition-colors hover:text-yellow-400 sm:bg-transparent sm:px-0 sm:py-0 sm:text-slate-400"
                  >
                    Lắp Đặt Camera
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#process"
                    className="block rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300 transition-colors hover:text-yellow-400 sm:bg-transparent sm:px-0 sm:py-0 sm:text-slate-400"
                  >
                    Quy Trình Làm Việc
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#testimonials"
                    className="block rounded-lg bg-slate-800/60 px-3 py-2 text-slate-300 transition-colors hover:text-yellow-400 sm:bg-transparent sm:px-0 sm:py-0 sm:text-slate-400"
                  >
                    Khách Hàng Đánh Giá
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-heading text-base font-bold text-white sm:mb-6 sm:text-lg">
                Liên Hệ Chuyên Viên
              </h4>
              <p className="mb-3 font-body text-sm text-slate-400 sm:text-base">
                Cơ sở tại: <a href={siteConfig.mapUrl} target="_blank" rel="noopener noreferrer" className="text-white hover:text-primary transition-colors underline underline-offset-2"><strong>{siteConfig.locationLabel}</strong></a>
              </p>
              <p className="mb-2 flex items-center gap-2 font-bold text-slate-400">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>
                </svg>
                <a href={siteConfig.hotlineHref} className="text-white hover:text-primary transition-colors">{siteConfig.hotlineDisplay}</a>
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <a href={siteConfig.mapUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-body font-bold text-white transition-colors hover:bg-slate-700">
                  Chỉ Đường
                </a>
                <a href={siteConfig.zaloUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-body font-bold text-white transition-colors hover:bg-blue-500">
                  Chat Zalo
                </a>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-slate-800 pt-4 text-center font-body text-xs text-slate-500 sm:mt-10 sm:pt-6 sm:text-sm">
            © 2026 Minh Hồng. Tối ưu cho tư vấn và chăm sóc khách hàng.
          </div>
        </div>
      </footer>
    </>
  );
}
