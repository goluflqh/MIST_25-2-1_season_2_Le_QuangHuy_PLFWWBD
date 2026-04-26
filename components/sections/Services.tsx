import Image from "next/image";
import Link from "next/link";

const serviceCards = [
  {
    accentSurface: "border-red-100 bg-red-50 text-primary",
    chips: ["Máy khoan", "Xe điện", "Đèn/quạt pin"],
    description:
      "Đóng mới hoặc phục hồi pin cho máy khoan, xe điện, loa kéo, đèn/quạt dùng pin và các bộ nguồn theo thông số riêng.",
    href: "/dich-vu/dong-pin",
    imageAlt: "Các bộ pin máy công cụ 18V và mạch điều khiển đang được phục hồi.",
    imageSrc: "/showcase/generated/product-battery-tool-packs-v2.webp",
    iconPath:
      "M9 17v-6a3 3 0 013-3h7m-9 9h9M5 21h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    kicker: "Đóng pin theo tải",
    quoteHref: "/?service=DONG_PIN&source=homepage-services-dong-pin#quote",
    quoteLabel: "Nhận tư vấn đóng pin",
    title: "Đóng pin Lithium",
  },
  {
    accentSurface: "border-amber-100 bg-amber-50 text-amber-700",
    chips: ["Sân vườn", "Cổng nhà"],
    description:
      "Tư vấn đèn pha, tấm pin rời, hộp pin và vị trí lắp cho cổng nhà, sân vườn hoặc khu vực khó kéo điện.",
    href: "/dich-vu/den-nang-luong",
    imageAlt: "Bộ đèn pha năng lượng mặt trời, tấm pin và remote điều khiển.",
    imageSrc: "/showcase/generated/product-solar-floodlight-kit-v2.webp",
    iconPath:
      "M12 3v2m0 14v2m9-9h-2M5 12H3m14.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m10.728 0L15.95 8.05M8.05 15.95l-1.414 1.414M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    kicker: "Chiếu sáng tiết kiệm",
    quoteHref: "/?service=DEN_NLMT&source=homepage-services-den-nlmt#quote",
    quoteLabel: "Nhận tư vấn NLMT",
    title: "Đèn năng lượng",
  },
  {
    accentSurface: "border-emerald-100 bg-emerald-50 text-emerald-700",
    chips: ["Lưu điện", "Kích đề"],
    description:
      "Thiết kế pin lưu trữ, bộ kích đề và nguồn dự phòng theo công suất xả, thời gian dùng và giới hạn an toàn.",
    href: "/dich-vu/pin-luu-tru",
    imageAlt: "Bộ pin lưu trữ LiFePO4, cell và mạch BMS trên bàn kỹ thuật.",
    imageSrc: "/showcase/generated/product-storage-lifepo4-bank-v2.webp",
    iconPath:
      "M13 10V3L4 14h7v7l9-11h-7z",
    kicker: "Lưu điện ổn định",
    quoteHref: "/?service=PIN_LUU_TRU&source=homepage-services-pin-luu-tru#quote",
    quoteLabel: "Thiết kế cấu hình lưu trữ",
    title: "Pin lưu trữ & kích đề",
  },
  {
    accentSurface: "border-sky-100 bg-sky-50 text-sky-700",
    chips: ["Gia đình", "Cửa hàng"],
    description:
      "Khảo sát camera Wi-Fi/PTZ, camera đa ống kính hoặc đầu ghi cho nhà ở và cửa hàng để xem lại thuận tiện.",
    href: "/dich-vu/camera",
    imageAlt: "Camera an ninh 4 mắt dạng một cụm camera đa ống kính kèm điện thoại xem từ xa.",
    imageSrc: "/showcase/generated/product-camera-four-eye-shop-v3.webp",
    iconPath:
      "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h7a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
    kicker: "An ninh dễ quản lý",
    quoteHref: "/?service=CAMERA&source=homepage-services-camera#quote",
    quoteLabel: "Yêu cầu khảo sát camera",
    title: "Camera an ninh",
  },
] as const;

export default function Services() {
  return (
    <section id="services" className="relative z-10 mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
        <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-sm font-semibold text-primary">
          Dịch vụ trọng tâm
        </span>
        <h2 className="mt-4 text-pretty font-heading text-[1.75rem] font-extrabold leading-tight text-textMain sm:text-4xl">
          Chọn nhanh theo thiết bị cần sửa, lắp hoặc cấp nguồn.
        </h2>
        <p className="mt-4 font-body text-base leading-7 text-slate-600 sm:text-lg">
          Từ pin máy khoan, xe điện, đèn năng lượng, camera cửa hàng đến bộ nguồn dự phòng,
          Minh Hồng hỏi thiết bị, công suất và vị trí dùng trước khi báo phương án.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {serviceCards.map((service) => (
          <article
            key={service.title}
            className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_22px_70px_-48px_rgba(15,23,42,0.38)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_28px_90px_-46px_rgba(15,23,42,0.38)] sm:rounded-[1.5rem]"
          >
            <div className="relative h-40 overflow-hidden bg-slate-100 sm:h-52">
              <Image
                src={service.imageSrc}
                alt={service.imageAlt}
                fill
                unoptimized
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-3 sm:inset-x-4 sm:top-4">
                <div
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-white/90 shadow-sm backdrop-blur ${service.accentSurface}`}
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d={service.iconPath}
                    />
                  </svg>
                </div>
                <span className="rounded-full border border-white/70 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
                  {service.kicker}
                </span>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-4 sm:p-6">
              <h3 className="font-heading text-[1.45rem] font-extrabold leading-tight text-slate-900 sm:text-[1.9rem]">
                {service.title}
              </h3>
              <p className="mt-3 font-body text-sm leading-7 text-slate-600 sm:text-base">
                {service.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {service.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={service.quoteHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary"
                >
                  {service.quoteLabel}
                </Link>
                <Link
                  href={service.href}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
                >
                  Xem chi tiết
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
