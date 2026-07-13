import Image from "next/image";
import Link from "next/link";
import JsonLd from "@/components/seo/JsonLd";
import { buildMarketingMetadata } from "@/lib/site";
import { buildBreadcrumbJsonLd } from "@/lib/structured-data";

export const metadata = buildMarketingMetadata({
  title: "Dịch Vụ Điện Máy & Pin Đà Nẵng",
  description:
    "Xem các dịch vụ đóng pin Lithium, đèn năng lượng mặt trời, pin lưu trữ và lắp camera an ninh tại Minh Hồng ở Đà Nẵng.",
  path: "/dich-vu",
});

const services = [
  {
    description:
      "Kiểm tra tình trạng pin, tư vấn cell, mạch bảo vệ và phương án đóng lại theo thiết bị thực tế.",
    href: "/dich-vu/dong-pin",
    image: "/showcase/generated/product-battery-tool-packs-v2.webp",
    imageAlt: "Ảnh minh hoạ bộ pin Lithium và mạch bảo vệ cho thiết bị dùng pin.",
    title: "Đóng pin Lithium",
  },
  {
    description:
      "Tư vấn đèn, tấm pin, hộp pin và vị trí lắp theo thời lượng sáng cùng điều kiện nắng tại chỗ.",
    href: "/dich-vu/den-nang-luong",
    image: "/showcase/generated/product-solar-floodlight-kit-v2.webp",
    imageAlt: "Ảnh minh hoạ bộ đèn pha năng lượng mặt trời và tấm pin rời.",
    title: "Đèn năng lượng mặt trời",
  },
  {
    description:
      "Tính tải, thời gian dùng và giới hạn an toàn cho pin lưu trữ, nguồn dự phòng hoặc bộ kích đề.",
    href: "/dich-vu/pin-luu-tru",
    image: "/showcase/generated/product-storage-lifepo4-bank-v2.webp",
    imageAlt: "Ảnh minh hoạ bộ pin lưu trữ LiFePO4 và linh kiện quản lý pin.",
    title: "Pin lưu trữ & kích đề",
  },
  {
    description:
      "Khảo sát góc nhìn, số mắt, đường dây và giải pháp lưu trữ để dễ xem trực tiếp hoặc xem lại.",
    href: "/dich-vu/camera",
    image: "/showcase/generated/product-camera-four-eye-shop-v3.webp",
    imageAlt: "Ảnh minh hoạ cụm camera an ninh và màn hình theo dõi từ xa.",
    title: "Camera an ninh",
  },
] as const;

export default function ServicesHubPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: "Trang chủ", path: "/" },
          { name: "Dịch vụ", path: "/dich-vu" },
        ])}
      />

      <section className="rounded-[1.75rem] border border-red-100 bg-[linear-gradient(135deg,#fff7ed,#ffffff_56%,#eff6ff)] px-6 py-8 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.42)] sm:px-10 sm:py-10">
        <span className="inline-flex rounded-full border border-red-100 bg-white/85 px-3 py-1 text-sm font-semibold text-primary">
          Dịch vụ tại Minh Hồng
        </span>
        <h1 className="mt-4 max-w-3xl font-heading text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">
          Chọn dịch vụ, rồi trao đổi theo thiết bị hoặc vị trí thực tế.
        </h1>
        <p className="mt-4 max-w-3xl font-body text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
          Mỗi hạng mục đều cần kiểm tra nhu cầu sử dụng, tình trạng thiết bị hoặc vị trí lắp trước
          khi chốt cấu hình và báo giá.
        </p>
        <Link
          href="/?source=services-hub#quote"
          className="mt-6 inline-flex rounded-2xl bg-slate-900 px-5 py-3 font-heading text-sm font-bold text-white transition-colors hover:bg-primary sm:px-7 sm:text-base"
        >
          Nhận tư vấn theo nhu cầu
        </Link>
      </section>

      <section className="mt-12" aria-labelledby="service-list-heading">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 id="service-list-heading" className="font-heading text-2xl font-extrabold text-slate-900 sm:text-3xl">
              Các nhóm dịch vụ
            </h2>
            <p className="mt-2 font-body text-slate-600">
              Xem phần hướng dẫn riêng để chuẩn bị thông tin phù hợp trước khi liên hệ.
            </p>
          </div>
          <Link href="/bao-gia" className="font-body text-sm font-bold text-primary hover:text-red-700">
            Xem bảng giá tham khảo
          </Link>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {services.map((service) => (
            <article
              key={service.href}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_64px_-46px_rgba(15,23,42,0.36)]"
            >
              <figure className="relative h-48 bg-slate-100 sm:h-56">
                <Image
                  src={service.image}
                  alt={service.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
                <figcaption className="absolute bottom-3 left-3 rounded-full bg-slate-950/72 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  Ảnh minh hoạ dịch vụ
                </figcaption>
              </figure>
              <div className="p-6">
                <h3 className="font-heading text-xl font-extrabold text-slate-900">{service.title}</h3>
                <p className="mt-3 font-body text-sm leading-6 text-slate-600">{service.description}</p>
                <Link
                  href={service.href}
                  className="mt-5 inline-flex font-body text-sm font-bold text-primary hover:text-red-700"
                >
                  Xem chi tiết
                </Link>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 font-body text-sm leading-6 text-slate-600">
          Hình ảnh trên dùng để minh hoạ nhóm dịch vụ và cấu hình tham khảo, không phải ảnh công
          trình hoặc cam kết cấu hình cố định.
        </p>
      </section>
    </main>
  );
}
