import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { ServiceGuidanceSection } from "@/components/service/ServiceGuidanceSection";
import { ServicePreviewCatalog } from "@/components/service/ServicePreviewCatalog";
import { batteryPreviewItems } from "@/lib/service-previews";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/structured-data";

export const metadata = buildMarketingMetadata({
  title: "Đóng Pin Lithium Đà Nẵng",
  description:
    "Đóng pin Lithium tại Đà Nẵng theo tải thực tế cho xe điện, máy công cụ, loa kéo và bộ pin theo thông số riêng, có kiểm tra cell và BMS.",
  path: "/dich-vu/dong-pin",
});

const heroPoints = [
  "Đo nội trở và dòng xả trước khi chốt cell",
  "Tư vấn theo tải thật, không làm quá tay",
  "Bàn giao rõ cách dùng và cách sạc xả",
] as const;

const features = [
  {
    description: "Đóng mới hoặc phục hồi cho xe đạp điện, xe máy điện và các nhu cầu đi lại hằng ngày.",
    iconPath:
      "M5 17a2 2 0 114 0m6 0a2 2 0 114 0M7 17h6l2-5H9l-2 5zm8-5h2l2-4h-4",
    title: "Pin xe điện",
  },
  {
    description: "Cân cấu hình cho máy khoan, máy cắt, máy mài và các bộ dụng cụ cần dòng xả ổn định.",
    iconPath:
      "M14.7 6.3l3 3m-9.4 9.4l-3-3m9.4-9.4L7.5 13.5a2.121 2.121 0 000 3l.5.5a2.121 2.121 0 003 0l7.2-7.2a2.121 2.121 0 000-3l-.5-.5a2.121 2.121 0 00-3 0z",
    title: "Pin máy công cụ",
  },
  {
    description: "Ưu tiên độ bền, độ ổn định và thời gian sử dụng thật cho loa kéo và thiết bị di động.",
    iconPath:
      "M11 5L6 9H3v6h3l5 4V5zm5.5 3.5a6 6 0 010 7m-2.5-5a3 3 0 010 3",
    title: "Loa kéo & thiết bị di động",
  },
  {
    description: "Nhận làm bộ pin theo kích thước, đầu cắm, điện áp hoặc yêu cầu vận hành riêng.",
    iconPath:
      "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Bộ pin theo thông số riêng",
  },
] as const;

const benefits = [
  "Nói rõ cell, mạch, phương án lắp và mức chi phí trước khi làm.",
  "Ưu tiên cấu hình phù hợp với thiết bị và ngân sách thật thay vì chạy theo thông số quá tay.",
  "Kiểm tra lại đầu ra, độ ổn định và tình trạng sạc xả trước khi bàn giao.",
  "Giữ đầu mối hỗ trợ nếu khách cần tinh chỉnh hoặc hỏi thêm trong quá trình sử dụng.",
] as const;

const guidanceSteps = [
  {
    title: "Hỏi thiết bị và tải dùng",
    description: "Xác nhận điện áp, dòng xả, thời gian dùng mong muốn và tình trạng bộ pin cũ nếu có.",
  },
  {
    title: "Kiểm tra cell, mạch, vỏ",
    description: "Đo tình trạng thật để biết nên phục hồi, thay cell hay đóng mới cả bộ.",
  },
  {
    title: "Báo phương án phù hợp",
    description: "Chốt cấu hình, linh kiện và chi phí sau khi khách hiểu rõ ưu nhược điểm.",
  },
] as const;

const priceFactors = [
  "Loại cell, dung lượng Ah, dòng xả và độ đồng đều của cell.",
  "Mạch BMS, đầu sạc, đầu xả, vỏ pin và mức chống rung/chống nước.",
  "Bộ pin cần phục hồi một phần hay đóng mới toàn bộ.",
  "Yêu cầu thời gian dùng, độ bền và ngân sách khách muốn giữ.",
] as const;

const serviceFaqs = [
  {
    question: "Có thể báo giá cố định ngay qua tin nhắn không?",
    answer:
      "Chỉ có thể báo mức tham khảo. Pin cần kiểm tra điện áp, cell, BMS và tải dùng trước khi chốt giá chính xác.",
  },
  {
    question: "Nếu bảng giá trên web thay đổi thì sao?",
    answer:
      "Trang web hiển thị theo dữ liệu báo giá đang được bật từ dashboard quản trị, nên Minh Hồng có thể cập nhật khi vật tư hoặc cấu hình thay đổi.",
  },
] as const;

export default function BatteryServicePage() {
  return (
    <>
      <JsonLd
        data={[
          buildServiceJsonLd("battery"),
          buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Dịch vụ", path: "/dich-vu" },
            { name: "Đóng pin Lithium", path: "/dich-vu/dong-pin" },
          ]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <section className="relative mb-14 overflow-hidden rounded-[1.75rem] border border-red-100 bg-[linear-gradient(135deg,#fff7ed,#ffffff_54%,#fff1f2)] p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.42)] md:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-1.5 text-sm font-semibold text-primary">
            Đóng pin Lithium
          </span>
          <h1 className="mt-5 bg-linear-to-r from-red-800 via-primary to-orange-500 bg-clip-text font-heading text-3xl font-extrabold leading-tight text-transparent md:text-6xl">
            Đóng pin đúng tải, bền để dùng thật.
          </h1>
          <p className="mt-4 max-w-3xl font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Minh Hồng nhận đóng mới hoặc phục hồi pin cho xe điện, máy công cụ, loa kéo và
            các bộ pin cần làm theo thông số riêng. Cách làm ưu tiên kiểm tra tải thật,
            giải thích rõ linh kiện và bàn giao để khách dễ theo dõi về sau.
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
              href="/?service=DONG_PIN&source=service-dong-pin#quote"
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

          <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_24px_80px_-48px_rgba(127,29,29,0.5)]">
            <div className="relative h-56 bg-slate-100 sm:h-96">
              <Image
                src="/showcase/generated/hero-battery-workbench-v2.png"
                alt="Bàn kỹ thuật đóng pin Lithium với cell, mạch BMS và pin máy công cụ."
                fill
                priority
                unoptimized
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-2xl bg-red-50 px-4 py-3">
                <p className="text-xs font-semibold text-red-700">Kiểm tra</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Cell & BMS</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Tư vấn</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Theo tải thật</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicePreviewCatalog
        accent="red"
        eyebrow="Mẫu cấu hình tham khảo"
        title="Các giải pháp pin tiêu biểu"
        description="Dưới đây là những cấu hình khách hỏi nhiều. Minh Hồng sẽ vẫn cân lại cell, mạch và mức tải theo đúng thiết bị thực tế trước khi chốt."
        items={batteryPreviewItems}
      />

      <section className="mb-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.32)]"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-red-100 bg-red-50 text-primary">
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
        accent="red"
        faqs={serviceFaqs}
        priceFactors={priceFactors}
        quoteHref="/?service=DONG_PIN&source=service-dong-pin-guidance#quote"
        serviceName="Đóng pin Lithium"
        steps={guidanceSteps}
      />

      <section className="relative overflow-hidden rounded-[2.25rem] bg-slate-900 px-6 py-10 text-white md:px-10 md:py-12">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-linear-to-l from-primary/12 to-transparent"></div>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[0.92fr_1fr] lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-extrabold md:text-4xl">
              Cách Minh Hồng làm dịch vụ đóng pin
            </h2>
            <p className="mt-4 font-body text-base leading-7 text-slate-300 md:text-lg">
              Tập trung vào độ ổn định, khả năng dùng lâu và mức cấu hình đủ hợp lý cho từng
              thiết bị, thay vì đẩy khách vào một bài toán quá tay.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/?service=DONG_PIN&source=service-dong-pin#quote"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Gửi nhu cầu đóng pin
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
