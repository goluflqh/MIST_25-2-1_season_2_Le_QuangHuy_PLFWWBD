import Link from "next/link";
import { siteConfig } from "@/lib/site";

type LocalTrustAccent = "blue" | "green" | "red" | "yellow";

interface LocalTrustCase {
  decision: string;
  situation: string;
  title: string;
}

interface ServiceLocalTrustSectionProps {
  accent: LocalTrustAccent;
  cases: readonly LocalTrustCase[];
  prepareItems: readonly string[];
  quoteHref: string;
  serviceName: string;
}

const accentStyles = {
  blue: {
    badge: "border-sky-100 bg-sky-50 text-sky-700",
    button: "bg-sky-700 text-white hover:bg-sky-800",
    dot: "bg-sky-600",
    panel: "border-sky-100 bg-sky-50/60",
  },
  green: {
    badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
    dot: "bg-emerald-600",
    panel: "border-emerald-100 bg-emerald-50/60",
  },
  red: {
    badge: "border-red-100 bg-red-50 text-primary",
    button: "bg-primary text-white hover:bg-red-500",
    dot: "bg-primary",
    panel: "border-red-100 bg-red-50/60",
  },
  yellow: {
    badge: "border-amber-100 bg-amber-50 text-amber-700",
    button: "bg-amber-600 text-white hover:bg-amber-700",
    dot: "bg-amber-600",
    panel: "border-amber-100 bg-amber-50/60",
  },
} as const;

const localSignals = [
  siteConfig.locationLabel,
  siteConfig.cityLabel,
  siteConfig.businessHoursLabel,
] as const;

export function ServiceLocalTrustSection({
  accent,
  cases,
  prepareItems,
  quoteHref,
  serviceName,
}: ServiceLocalTrustSectionProps) {
  const styles = accentStyles[accent];

  return (
    <section className="mb-16 py-2">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${styles.badge}`}>
            Đà Nẵng & khu vực lân cận
          </span>
          <h2 className="mt-4 max-w-2xl font-heading text-3xl font-extrabold leading-tight text-slate-900 md:text-4xl">
            Tư vấn {serviceName} theo đúng vị trí và cách khách sử dụng.
          </h2>
          <p className="mt-4 font-body text-base leading-7 text-slate-600">
            Minh Hồng ưu tiên hỏi rõ địa điểm, thiết bị, tải dùng và mong muốn bàn giao trước
            khi chốt phương án. Hotline, Zalo và Google Maps dùng chung thông tin để khách
            dễ kiểm tra và liên hệ lại khi cần.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {localSignals.map((signal) => (
              <span
                key={signal}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
              >
                {signal}
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={quoteHref}
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition-colors ${styles.button}`}
            >
              Gửi tình huống cần tư vấn
            </Link>
            <a
              href={siteConfig.mapUrl}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
              rel="noreferrer"
              target="_blank"
            >
              Xem vị trí Minh Hồng
            </a>
          </div>
        </div>

        <div className="grid gap-4">
          {cases.map((item) => (
            <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${styles.dot}`} />
                <div>
                  <h3 className="font-body text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-2 font-body text-sm leading-6 text-slate-600">
                    {item.situation}
                  </p>
                  <p className="mt-3 font-body text-sm font-semibold leading-6 text-slate-700">
                    Cách chốt: {item.decision}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className={`mt-8 rounded-[1.5rem] border px-5 py-5 sm:px-6 ${styles.panel}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="font-heading text-xl font-extrabold text-slate-900">
              Chuẩn bị trước để nhận tư vấn nhanh hơn
            </h3>
            <p className="mt-2 font-body text-sm leading-6 text-slate-600">
              Không bắt buộc đầy đủ, nhưng càng rõ thông tin thì Minh Hồng càng dễ báo đúng phương án.
            </p>
          </div>
          <a
            href={siteConfig.zaloUrl}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
            rel="noreferrer"
            target="_blank"
          >
            Gửi nhanh qua Zalo
          </a>
        </div>

        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {prepareItems.map((item) => (
            <li key={item} className="flex gap-3 font-body text-sm leading-6 text-slate-700">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
