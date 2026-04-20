import Image from "next/image";
import Link from "next/link";

const serviceCards = [
  {
    title: "Đóng pin Lithium theo yêu cầu",
    accentText: "text-primary",
    accentSurface: "border-red-100 bg-red-50 text-primary",
    borderAccent: "border-red-100",
    image:
      "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80",
    alt: "Đóng pin chuyên nghiệp",
    imageSide: "left",
    eyebrow: "Đúng tải - đúng cấu hình - rõ cell và mạch",
    summary:
      "Tối ưu cho xe điện, máy công cụ, loa kéo, pin lưu trữ, kích đề và các bộ pin cần làm theo thông số riêng.",
    bullets: [
      "Kiểm tra nội trở, dòng xả và nhu cầu sử dụng thật trước khi đề xuất phương án.",
      "Ưu tiên cell phù hợp với ngân sách và độ bền, tránh tư vấn quá tay.",
      "Bàn giao kèm hướng dùng, kiểm tra lại đầu ra và tình trạng sạc xả.",
    ],
    support: ["Xe điện, loa kéo, máy công cụ", "Pin lưu trữ, kích đề, bộ custom"],
    primaryHref: "/?service=DONG_PIN&source=homepage-services-dong-pin#quote",
    primaryLabel: "Nhận tư vấn đóng pin",
    secondaryHref: "/bao-gia?source=homepage-services-dong-pin",
    secondaryLabel: "Xem bảng giá tham khảo",
  },
  {
    title: "Lắp đặt camera an ninh",
    accentText: "text-amber-700",
    accentSurface: "border-amber-100 bg-amber-50 text-amber-700",
    borderAccent: "border-amber-100",
    image:
      "https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=800",
    alt: "Lắp đặt camera an ninh",
    imageSide: "right",
    eyebrow: "Khảo sát góc nhìn kỹ - đi dây gọn - bàn giao dễ dùng",
    summary:
      "Phù hợp cho gia đình, cửa hàng, kho xưởng và các khu vực cần giám sát rõ ràng cả ngày lẫn đêm.",
    bullets: [
      "Khảo sát vị trí lắp, góc chết và nhu cầu theo dõi trước khi chốt số lượng camera.",
      "Ưu tiên giải pháp ổn định, dễ quản lý trên điện thoại và phù hợp mức đầu tư thực tế.",
      "Hỗ trợ bàn giao vận hành, xem lại dữ liệu và kiểm tra nhanh sau khi lắp đặt.",
    ],
    support: ["Gia đình, cửa hàng, kho xưởng", "Theo dõi từ xa, quay đêm, đàm thoại"],
    primaryHref: "/?service=CAMERA&source=homepage-services-camera#quote",
    primaryLabel: "Yêu cầu khảo sát tận nơi",
    secondaryHref: "/dich-vu/camera",
    secondaryLabel: "Xem chi tiết dịch vụ",
  },
] as const;

export default function Services() {
  return (
    <section id="services" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto mb-16 max-w-3xl text-center">
        <span className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">
          Dịch vụ trọng tâm
        </span>
        <h2 className="mt-4 font-heading text-4xl font-extrabold text-textMain">
          Hai mảng dịch vụ mang lại nhiều niềm tin nhất cho khách của Minh Hồng.
        </h2>
        <div className="mx-auto mt-6 h-1 w-24 rounded-full bg-gradient-to-r from-primary to-secondary"></div>
        <p className="mt-6 font-body text-lg leading-8 text-slate-600">
          Tập trung vào những dịch vụ có thể tư vấn sâu, làm rõ kỹ thuật và giữ trải nghiệm hậu mãi
          chỉn chu thay vì dàn trải quá nhiều lời hứa.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {serviceCards.map((service, index) => (
          <div
            key={service.title}
            className={`group overflow-hidden rounded-[2rem] border ${service.borderAccent} bg-white/90 shadow-[0_28px_90px_-54px_rgba(15,23,42,0.35)] backdrop-blur transition-transform duration-300 hover:-translate-y-1`}
          >
            <div
              className={`flex flex-col ${service.imageSide === "right" ? "md:flex-row-reverse" : "md:flex-row"}`}
            >
              <div className="relative h-72 overflow-hidden md:h-auto md:w-5/12">
                <Image
                  src={service.image}
                  alt={service.alt}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 768px) 100vw, 42vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  className={`absolute left-4 top-4 inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] shadow-lg backdrop-blur ${service.accentSurface}`}
                >
                  {service.imageSide === "right" ? "An ninh & giám sát" : "Pin & lưu trữ năng lượng"}
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-center p-8 md:p-12">
                <p className={`text-sm font-bold uppercase tracking-[0.2em] ${service.accentText}`}>
                  {service.eyebrow}
                </p>
                <h3 className="mt-3 font-heading text-3xl font-bold text-textMain">{service.title}</h3>
                <p className="mt-4 font-body text-lg leading-8 text-slate-600">{service.summary}</p>

                <div className="mt-6 flex flex-wrap gap-3">
                  {service.support.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <ul className="mt-8 space-y-4 font-body text-slate-700">
                  {service.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${service.accentSurface}`}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </span>
                      <span className="leading-7">{bullet}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href={service.primaryHref}
                    className="inline-flex w-max items-center justify-center rounded-2xl bg-slate-900 px-8 py-3 font-bold text-white transition-colors hover:bg-primary"
                  >
                    {service.primaryLabel}
                  </Link>
                  <Link
                    href={service.secondaryHref}
                    className="inline-flex w-max items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 py-3 font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
                  >
                    {service.secondaryLabel}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
