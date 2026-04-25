import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { ServicePreviewCatalog } from "@/components/service/ServicePreviewCatalog";
import { solarPreviewItems } from "@/lib/service-previews";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/structured-data";

export const metadata = buildMarketingMetadata({
  title: "Đèn Năng Lượng Mặt Trời Đà Nẵng",
  description:
    "Tư vấn, lắp đặt và thay pin đèn năng lượng mặt trời tại Đà Nẵng cho sân, cổng, lối đi và khu vực cần chiếu sáng tự động.",
  path: "/dich-vu/den-nang-luong",
});

const heroPoints = [
  "Tính theo thời lượng sáng và vị trí lắp thật",
  "Ưu tiên pin thay được và bảo trì dễ về sau",
  "Chỉ đề xuất NLMT ở nơi thật sự phù hợp",
] as const;

const features = [
  {
    description: "Giải pháp chiếu sáng nhẹ, đẹp và ít bảo trì cho khu vực thường xuyên đi lại.",
    iconPath:
      "M12 3v2m0 14v2m9-9h-2M5 12H3m14.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m10.728 0L15.95 8.05M8.05 15.95l-1.414 1.414",
    title: "Đèn sân vườn & lối đi",
  },
  {
    description: "Bố trí đèn đủ sáng cho cổng, biển số nhà hoặc khu vực cần đi lại buổi tối.",
    iconPath:
      "M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z",
    title: "Đèn cổng & khu ra vào",
  },
  {
    description: "Giải pháp tăng cường ánh sáng cho sân bãi, kho nhỏ hoặc vị trí cần rọi tập trung hơn.",
    iconPath:
      "M7 8h10l2 12H5L7 8zm5-5v5",
    title: "Đèn pha công suất vừa",
  },
  {
    description: "Thay pin, xử lý hộp lưu trữ hoặc tư vấn lại bộ đèn khi hệ cũ đã xuống cấp.",
    iconPath:
      "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Pin & hộp lưu trữ",
  },
] as const;

const benefits = [
  "Chỉ tư vấn dùng NLMT ở những vị trí thật sự phù hợp để khách tránh kỳ vọng sai.",
  "Giải thích trước về thời lượng sáng, mùa mưa và khả năng thay pin về sau.",
  "Ưu tiên cấu hình đủ sáng, dễ bảo trì và dễ thay linh kiện khi cần.",
  "Khảo sát và cân lại công suất theo khu vực sử dụng thực tế thay vì chốt theo quảng cáo.",
] as const;

export default function SolarLightPage() {
  return (
    <>
      <JsonLd
        data={[
          buildServiceJsonLd("solar"),
          buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Dịch vụ", path: "/dich-vu" },
            { name: "Đèn năng lượng mặt trời", path: "/dich-vu/den-nang-luong" },
          ]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <section className="relative mb-14 overflow-hidden rounded-[1.75rem] border border-amber-100 bg-[linear-gradient(135deg,#fffbeb,#ffffff_54%,#fff7ed)] p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.42)] md:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
            Đèn năng lượng mặt trời
          </span>
          <h1 className="mt-5 bg-linear-to-r from-amber-700 via-orange-600 to-primary bg-clip-text font-heading text-3xl font-extrabold leading-tight text-transparent md:text-6xl">
            Đèn sáng đúng chỗ, tiết kiệm đúng cách.
          </h1>
          <p className="mt-4 max-w-3xl font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Minh Hồng tập trung vào những vị trí thật sự hợp dùng NLMT như sân, cổng và lối đi.
            Mục tiêu là đủ sáng, dùng ổn định và dễ thay pin hoặc nâng cấp khi hệ cũ xuống cấp.
          </p>

          <div className="mt-7 hidden gap-3 sm:grid sm:grid-cols-3">
            {heroPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
                {point}
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:flex sm:flex-row">
            <Link
              href="/?service=DEN_NLMT&source=service-den-nlmt#quote"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary sm:px-8 sm:text-lg"
            >
              Tư vấn
            </Link>
            <a
              href={siteConfig.hotlineHref}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-textMain transition-colors hover:border-primary hover:text-primary sm:px-8 sm:text-lg"
            >
              Gọi ngay
            </a>
          </div>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_24px_80px_-48px_rgba(217,119,6,0.38)]">
            <div className="relative h-56 bg-slate-100 sm:h-96">
              <Image
                src="/showcase/generated/hero-solar-install-v2.png"
                alt="Đèn pha năng lượng mặt trời và tấm pin rời lắp ở cổng nhà."
                fill
                priority
                unoptimized
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-2xl bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-700">Tính theo</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Giờ sáng</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Ưu tiên</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Dễ bảo trì</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicePreviewCatalog
        accent="yellow"
        eyebrow="Mẫu hệ đèn tiêu biểu"
        title="Các giải pháp chiếu sáng NLMT"
        description="Tham khảo nhanh các bộ đèn và hệ pin lưu trữ được dùng nhiều. Minh Hồng vẫn sẽ cân lại công suất, thời lượng sáng và cách bảo trì theo nhu cầu thật."
        items={solarPreviewItems}
      />

      <section className="mb-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.32)]"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 text-amber-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d={feature.iconPath}
                />
              </svg>
            </div>
            <h2 className="mt-5 font-body text-lg font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-2 font-body text-sm leading-7 text-slate-600">{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="relative overflow-hidden rounded-[2.25rem] bg-slate-900 px-6 py-10 text-white md:px-10 md:py-12">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-linear-to-l from-primary/12 to-transparent"></div>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.92fr_1fr] lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-extrabold md:text-4xl">
              Khi nào nên chọn giải pháp NLMT
            </h2>
            <p className="mt-4 font-body text-base leading-7 text-slate-300 md:text-lg">
              Tốt nhất khi khu vực lắp khó kéo điện, cần chiếu sáng tự động và chấp nhận cấu
              hình theo mức nắng, mùa mưa và thời lượng dùng thật.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/?service=DEN_NLMT&source=service-den-nlmt#quote"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Gửi nhu cầu chiếu sáng
              </Link>
              <Link
                href="/bao-gia"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/10 px-6 py-3 font-bold text-white transition-colors hover:bg-white/15"
              >
                Xem bảng giá tham khảo
              </Link>
            </div>
          </div>

          <ul className="space-y-4">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3 font-body text-slate-200">
                <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="text-base leading-7">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
      </div>
    </>
  );
}
