import Link from "next/link";
import { siteConfig } from "@/lib/site";

const highlights = [
  {
    accent: "border-red-100 bg-red-50 text-primary",
    description: "Mang theo pin, sạc hoặc thiết bị đang dùng để kỹ thuật kiểm tra đúng tình trạng.",
    iconPath:
      "M9 12h6m-3-3v6m9 0a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Pin và sạc đi kèm",
  },
  {
    accent: "border-amber-100 bg-amber-50 text-amber-700",
    description: "Cho biết thiết bị cần chạy bao lâu, tải nặng hay nhẹ, dùng trong nhà hay ngoài trời.",
    iconPath:
      "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Công suất và thời gian dùng",
  },
  {
    accent: "border-orange-100 bg-orange-50 text-orange-700",
    description: "Với camera và đèn NLMT, gửi ảnh cổng, sân, quầy hoặc vị trí muốn lắp để chọn góc phù hợp.",
    iconPath:
      "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z",
    title: "Ảnh vị trí lắp đặt",
  },
  {
    accent: "border-emerald-100 bg-emerald-50 text-emerald-700",
    description: "Không cần chốt ngay. Có đủ thông tin thì phương án sẽ sát hơn và tránh mua dư.",
    iconPath: "M5 13l4 4L19 7",
    title: "Ngân sách dự kiến",
  },
] as const;

export default function TrustHighlights() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      <div className="rounded-[1.45rem] border border-orange-100 bg-white p-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] sm:rounded-[1.75rem] sm:p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.28fr_0.86fr]">
          <div>
            <span className="inline-flex items-center rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-primary">
              Báo đúng cần thông tin đúng
            </span>
            <div className="mt-4 max-w-2xl">
              <h2 className="text-pretty font-heading text-3xl font-extrabold text-slate-900 md:text-4xl">
                Chuẩn bị vài thông tin là tư vấn sẽ sát hơn nhiều.
              </h2>
              <p className="mt-4 font-body text-base leading-7 text-slate-600">
                Pin Lithium, camera, đèn năng lượng và nguồn dự phòng đều phụ thuộc vào thiết bị,
                công suất và môi trường sử dụng. Càng rõ nhu cầu thật, càng dễ chọn cấu hình vừa đủ.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
              {highlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.25rem] border border-slate-100 bg-slate-50/75 p-4 sm:rounded-[1.6rem] sm:p-5"
                >
                  <div
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border ${item.accent}`}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d={item.iconPath}
                      />
                    </svg>
                  </div>
                  <h3 className="mt-4 font-body text-lg font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 font-body text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="rounded-[1.3rem] border border-slate-200 bg-[linear-gradient(155deg,#fff7ed,#ffffff_58%,#fffaf5)] p-5 shadow-[0_20px_60px_-40px_rgba(220,38,38,0.22)] sm:rounded-[1.5rem] sm:p-6">
            <p className="text-sm font-semibold text-primary">
              Liên hệ trực tiếp
            </p>
            <h3 className="mt-3 text-pretty font-heading text-2xl font-extrabold text-slate-900">
              Cần làm rõ trước? Gửi thông tin để được hỏi đúng vấn đề.
            </h3>
            <p className="mt-3 font-body text-sm leading-6 text-slate-600">
              Đội ngũ sẽ hỏi tình trạng thiết bị, mục tiêu sử dụng và ngân sách mong muốn
              trước khi đề xuất hướng xử lý.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-white bg-white/92 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Hotline
                </p>
                <p className="mt-1 font-heading text-xl font-bold text-slate-900">
                  {siteConfig.hotlineDisplay}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white/92 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Khu vực hỗ trợ
                </p>
                <p className="mt-1 font-body text-sm font-semibold text-slate-800">
                  {siteConfig.locationLabel}
                </p>
              </div>
              <div className="rounded-2xl border border-white bg-white/92 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Khung giờ tiếp nhận
                </p>
                <p className="mt-1 font-body text-sm font-semibold text-slate-800">
                  {siteConfig.businessHoursLabel}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Link
                href="/bao-gia"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary"
              >
                Xem bảng giá tham khảo
              </Link>
              <Link
                href="#quote"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
              >
                Gửi yêu cầu tư vấn
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
