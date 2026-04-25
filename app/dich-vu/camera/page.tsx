import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { ServicePreviewCatalog } from "@/components/service/ServicePreviewCatalog";
import { cameraPreviewItems } from "@/lib/service-previews";
import { buildMarketingMetadata, siteConfig } from "@/lib/site";
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from "@/lib/structured-data";

export const metadata = buildMarketingMetadata({
  title: "Lắp Đặt Camera An Ninh Đà Nẵng",
  description:
    "Khảo sát, lắp đặt camera an ninh tại Đà Nẵng cho gia đình, cửa hàng, kho và xưởng với cấu hình đủ dùng, đi dây gọn và bàn giao dễ theo dõi.",
  path: "/dich-vu/camera",
});

const heroPoints = [
  "Khảo sát góc nhìn trước khi chốt số lượng camera",
  "Đi dây gọn và tối ưu trải nghiệm theo dõi trên điện thoại",
  "Bàn giao rõ cách xem trực tiếp và xem lại",
] as const;

const features = [
  {
    description: "Bố trí mắt camera cho cổng, sân, phòng khách hoặc khu vực cần theo dõi thường xuyên.",
    iconPath:
      "M3 10l9-7 9 7v10a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10z",
    title: "Nhà ở & cổng",
  },
  {
    description: "Ưu tiên góc quan sát quầy, cửa ra vào và khu giữ xe theo đúng lưu lượng khách.",
    iconPath:
      "M4 7h16M5 7l1-3h12l1 3m-1 0v11a2 2 0 01-2 2H8a2 2 0 01-2-2V7m4 5h4",
    title: "Cửa hàng",
  },
  {
    description: "Đề xuất số mắt, góc nhìn và giải pháp lưu trữ phù hợp cho khu vực rộng hơn.",
    iconPath:
      "M3 21h18M5 21V9l7-4 7 4v12M9 13h6",
    title: "Kho & xưởng",
  },
  {
    description: "Cài đặt app, xem từ xa và hướng dẫn cách dùng để khách thao tác thoải mái sau bàn giao.",
    iconPath:
      "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h7a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    title: "Xem từ xa dễ dùng",
  },
] as const;

const benefits = [
  "Khảo sát tận nơi nếu cần để tránh thiếu góc hoặc lắp thừa mắt camera.",
  "Ưu tiên cấu hình đủ dùng, hình ảnh rõ và quản lý ổn định trên điện thoại.",
  "Giải thích trước về đầu ghi, lưu trữ và mức độ phù hợp cho từng không gian.",
  "Giữ đầu mối hỗ trợ khi khách cần kiểm tra lại, đổi góc hoặc hỏi thêm cách sử dụng.",
] as const;

export default function CameraServicePage() {
  return (
    <>
      <JsonLd
        data={[
          buildServiceJsonLd("camera"),
          buildBreadcrumbJsonLd([
            { name: "Trang chủ", path: "/" },
            { name: "Dịch vụ", path: "/dich-vu" },
            { name: "Camera an ninh", path: "/dich-vu/camera" },
          ]),
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <section className="relative mb-14 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-[linear-gradient(135deg,#eff6ff,#ffffff_54%,#fff7ed)] p-6 shadow-[0_30px_90px_-48px_rgba(15,23,42,0.42)] md:p-10">
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_0.82fr] lg:items-center">
          <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-1.5 text-sm font-semibold text-sky-700">
            Camera an ninh
          </span>
          <h1 className="mt-5 bg-linear-to-r from-slate-950 via-blue-700 to-sky-500 bg-clip-text font-heading text-3xl font-extrabold leading-tight text-transparent md:text-6xl">
            Lắp camera rõ góc, xem lại dễ.
          </h1>
          <p className="mt-4 max-w-3xl font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Minh Hồng tập trung vào việc khảo sát góc nhìn, bố trí số mắt hợp lý, đi dây gọn
            và bàn giao để khách xem trực tiếp hoặc xem lại thật thuận tay trên điện thoại.
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
              href="/?service=CAMERA&source=service-camera#quote"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-bold text-white transition-colors hover:bg-primary sm:px-8 sm:text-lg"
            >
              Khảo sát
            </Link>
            <a
              href={siteConfig.hotlineHref}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-textMain transition-colors hover:border-primary hover:text-primary sm:px-8 sm:text-lg"
            >
              Gọi ngay
            </a>
          </div>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-white bg-white shadow-[0_24px_80px_-48px_rgba(2,132,199,0.38)]">
            <div className="relative h-56 bg-slate-100 sm:h-96">
              <Image
                src="/showcase/generated/hero-camera-install-v2.png"
                alt="Camera an ninh Wi-Fi ngoài trời được lắp ở mặt tiền cửa hàng."
                fill
                priority
                unoptimized
                sizes="(max-width: 1024px) 100vw, 38vw"
                className="object-cover"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-2xl bg-sky-50 px-4 py-3">
                <p className="text-xs font-semibold text-sky-700">Khảo sát</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Góc nhìn</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500">Bàn giao</p>
                <p className="mt-1 font-heading text-lg font-bold text-slate-900">Xem từ xa</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ServicePreviewCatalog
        accent="blue"
        eyebrow="Mẫu lắp đặt thực tế"
        title="Các gói camera phổ biến"
        description="Khách có thể tham khảo nhanh quy mô hệ thống. Minh Hồng vẫn sẽ điều chỉnh số mắt, vị trí lắp và giải pháp lưu trữ sau khi khảo sát thực tế."
        items={cameraPreviewItems}
      />

      <section className="mb-16 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {features.map((feature) => (
          <article
            key={feature.title}
            className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-[0_22px_70px_-50px_rgba(15,23,42,0.32)]"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-700">
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
              Cách Minh Hồng làm dịch vụ camera
            </h2>
            <p className="mt-4 font-body text-base leading-7 text-slate-300 md:text-lg">
              Không chỉ là lắp được hình ảnh. Điều quan trọng hơn là góc nhìn hợp lý, quản lý dễ
              dùng và có người hỗ trợ rõ ràng khi khách cần kiểm tra lại.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/?service=CAMERA&source=service-camera#quote"
                className="inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Gửi nhu cầu lắp camera
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
