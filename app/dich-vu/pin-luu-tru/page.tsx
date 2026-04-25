import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { ServiceGuidanceSection } from "@/components/service/ServiceGuidanceSection";
import { ServiceLocalTrustSection } from "@/components/service/ServiceLocalTrustSection";
import { ServicePreviewCatalog } from "@/components/service/ServicePreviewCatalog";
import { storagePreviewItems } from "@/lib/service-previews";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/structured-data";

export const metadata = buildMarketingMetadata({
  title: "Pin Lưu Trữ & Kích Đề Đà Nẵng",
  description:
    "Thiết kế pin lưu trữ, pin kích đề và nguồn dự phòng tại Đà Nẵng theo tải xả, dung lượng và mức an toàn cần thiết.",
  path: "/dich-vu/pin-luu-tru",
});

const heroPoints = [
  "Tính theo tải xả và thời gian cần lưu điện",
  "Ưu tiên cell ổn định, dễ bảo trì và dễ mở rộng",
  "Giải thích rõ điện áp, dung lượng và mức an toàn trước khi làm",
] as const;

const features = [
  {
    description: "Thiết kế theo điện áp và dòng xả cần thiết cho ô tô, xe tải hoặc bộ cứu hộ mang theo xe.",
    iconPath:
      "M5 17h14l1-5H4l1 5zm2 0a2 2 0 114 0m6 0a2 2 0 114 0M7 12h10l1-3H6l1 3z",
    title: "Bộ kích đề 12V / 24V",
  },
  {
    description: "Bộ pin lưu điện cho gia đình, cửa hàng hoặc hệ điện nhỏ cần duy trì hoạt động khi mất điện.",
    iconPath:
      "M4 7h16v10H4V7zm4 3v4m4-6v8m4-5v2",
    title: "Tủ pin lưu điện",
  },
  {
    description: "Nguồn dự phòng cỡ lớn cho thiết bị di động đặc thù, máy quay hoặc bài toán vận hành ngoài hiện trường.",
    iconPath:
      "M7 7h10v10H7V7zm3 3h4m-4 4h2",
    title: "Nguồn dự phòng dung lượng lớn",
  },
  {
    description: "Nhận đóng bộ pin riêng theo kích thước, đầu cắm, giao thức hoặc bài toán kỹ thuật cụ thể.",
    iconPath:
      "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Đóng bộ pin theo yêu cầu",
  },
] as const;

const benefits = [
  "Tính toán theo tải thật để hệ thống không thiếu công suất và cũng không bị dư thừa quá mức.",
  "Ưu tiên cấu hình dễ theo dõi, dễ thay thế linh kiện và dễ mở rộng sau này.",
  "Giải thích trước về điện áp, Ah, dòng xả và những giới hạn an toàn khi sử dụng lâu dài.",
  "Giữ đầu mối hỗ trợ khi khách cần nâng cấp, thay đổi đầu ra hoặc kiểm tra lại cấu hình.",
] as const;

const guidanceSteps = [
  {
    title: "Tính tải và thời gian lưu",
    description: "Hỏi thiết bị cần cấp nguồn, công suất xả và thời gian cần duy trì khi mất điện.",
  },
  {
    title: "Chọn điện áp và cell phù hợp",
    description: "Cân cấu hình cell, BMS, dây dẫn, vỏ và khả năng mở rộng theo mức an toàn cần thiết.",
  },
  {
    title: "Báo phương án theo ngân sách",
    description: "Chốt cấu hình đủ tải, dễ bảo trì và không đẩy khách vào hệ quá lớn nếu chưa cần.",
  },
] as const;

const priceFactors = [
  "Điện áp hệ, dung lượng Ah/Wh và dòng xả liên tục cần đáp ứng.",
  "Loại cell, BMS, vỏ tủ, dây dẫn và mức bảo vệ an toàn.",
  "Nhu cầu kích đề, lưu điện gia đình hay nguồn dự phòng theo yêu cầu riêng.",
  "Khả năng mở rộng sau này và mức độ hoàn thiện khi bàn giao.",
] as const;

const serviceFaqs = [
  {
    question: "Pin lưu trữ có thể chốt giá theo một mức chung không?",
    answer:
      "Không nên chốt cứng trước. Cần tính tải xả, thời gian lưu và mức an toàn trước khi đưa báo giá cuối.",
  },
  {
    question: "Bảng giá tham khảo trên web lấy từ đâu?",
    answer:
      "Bảng giá public lấy từ các mục đang được bật trong hệ thống quản trị. Admin có thể cập nhật để UI phản ánh lại theo dữ liệu hiện tại.",
  },
] as const;

const localTrustCases = [
  {
    title: "Nguồn dự phòng cho gia đình hoặc cửa hàng",
    situation:
      "Khách cần duy trì một số thiết bị quan trọng khi mất điện nhưng chưa muốn đầu tư hệ quá lớn.",
    decision: "tính tải, thời gian lưu và đường nâng cấp trước khi chốt dung lượng.",
  },
  {
    title: "Bộ kích đề mang theo xe",
    situation:
      "Cần bộ pin gọn, dòng xả đủ mạnh và thao tác nhanh khi ắc quy yếu.",
    decision: "chọn cell, dây kẹp, BMS và vỏ theo điện áp xe và mức an toàn cần có.",
  },
  {
    title: "Bộ nguồn riêng cho thiết bị đặc thù",
    situation:
      "Thiết bị cần điện áp, đầu ra hoặc thời gian chạy không có sẵn ở bộ pin phổ thông.",
    decision: "xác nhận tải xả, đầu cắm, kích thước và cách sạc trước khi đóng bộ riêng.",
  },
] as const;

const prepareItems = [
  "Danh sách thiết bị cần cấp nguồn và công suất nếu biết.",
  "Thời gian muốn duy trì khi mất điện hoặc khi dùng ngoài hiện trường.",
  "Điện áp hệ cần dùng: 12V, 24V, 48V, 51.2V hoặc thông số riêng.",
  "Yêu cầu về kích thước, vị trí đặt, khả năng mở rộng và mức ngân sách.",
] as const;

export default function StorageBatteryPage() {
  return (
    <>
      <JsonLd
        data={[
          buildServiceJsonLd("storage"),
          buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Dịch vụ", path: "/dich-vu" },
            { name: "Pin lưu trữ & kích đề", path: "/dich-vu/pin-luu-tru" },
          ]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <section className="relative mb-14 overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5,#ffffff_54%,#fff7ed)] p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.42)] md:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            Pin lưu trữ & kích đề
          </span>
          <h1 className="mt-5 bg-linear-to-r from-emerald-800 via-slate-900 to-primary bg-clip-text font-heading text-3xl font-extrabold leading-tight text-transparent md:text-6xl">
            Nguồn dự phòng đủ tải, an toàn lâu dài.
          </h1>
          <p className="mt-4 max-w-3xl font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Minh Hồng nhận thiết kế pin lưu trữ, bộ kích đề và nguồn dự phòng cho gia đình,
            cửa hàng hoặc bài toán kỹ thuật riêng. Trọng tâm là tính đúng tải xả, giữ hệ
            thống an toàn và dễ bảo trì lâu dài.
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
              href="/?service=PIN_LUU_TRU&source=service-pin-luu-tru#quote"
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

          <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_24px_80px_-48px_rgba(5,150,105,0.36)]">
            <div className="relative h-56 bg-slate-100 sm:h-96">
              <Image
                src="/showcase/generated/hero-storage-counter-v2.png"
                alt="Bộ pin lưu trữ và kích đề được sắp xếp trên quầy kỹ thuật."
                fill
                priority
                unoptimized
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold text-emerald-700">Tính theo</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Tải xả</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Mục tiêu</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">An toàn</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicePreviewCatalog
        accent="green"
        eyebrow="Cấu hình hệ thống tiêu biểu"
        title="Các giải pháp lưu trữ tham khảo"
        description="Khách có thể tham khảo nhanh các mức dung lượng phổ biến. Minh Hồng sẽ vẫn tính lại công suất xả, thời gian lưu và khả năng mở rộng theo nhu cầu thực tế."
        items={storagePreviewItems}
      />

      <section className="mb-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.32)]"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700">
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

      <ServiceGuidanceSection
        accent="green"
        faqs={serviceFaqs}
        priceFactors={priceFactors}
        quoteHref="/?service=PIN_LUU_TRU&source=service-pin-luu-tru-guidance#quote"
        serviceName="Pin lưu trữ & kích đề"
        steps={guidanceSteps}
      />

      <ServiceLocalTrustSection
        accent="green"
        cases={localTrustCases}
        prepareItems={prepareItems}
        quoteHref="/?service=PIN_LUU_TRU&source=service-pin-luu-tru-local-trust#quote"
        serviceName="pin lưu trữ & kích đề"
      />

      <section className="relative overflow-hidden rounded-[2.25rem] bg-slate-900 px-6 py-10 text-white md:px-10 md:py-12">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-linear-to-l from-primary/12 to-transparent"></div>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.92fr_1fr] lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-extrabold md:text-4xl">
              Khi nào nên làm pin lưu trữ riêng
            </h2>
            <p className="mt-4 font-body text-base leading-7 text-slate-300 md:text-lg">
              Khi khách cần một cấu hình thật sát tải, có đường nâng cấp rõ ràng và muốn giữ
              hệ nguồn dự phòng an toàn, dễ theo dõi theo thời gian.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/?service=PIN_LUU_TRU&source=service-pin-luu-tru#quote"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Gửi nhu cầu lưu trữ
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
