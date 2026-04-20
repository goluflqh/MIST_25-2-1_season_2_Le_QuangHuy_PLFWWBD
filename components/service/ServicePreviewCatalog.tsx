import Image from "next/image";
import Link from "next/link";
import type {
  ServicePreviewAccent,
  ServicePreviewItem,
} from "@/lib/service-previews";
import { siteConfig } from "@/lib/site";

const accentStyles: Record<
  ServicePreviewAccent,
  {
    badge: string;
    button: string;
    chip: string;
    glow: string;
    panel: string;
  }
> = {
  red: {
    badge: "border-red-200 bg-red-100/90 text-red-700",
    button: "bg-red-600 text-white hover:bg-red-700",
    chip: "border-red-200 bg-red-50 text-red-700",
    glow: "from-red-500/20 via-orange-400/10 to-transparent",
    panel: "border-red-100 bg-gradient-to-br from-red-50 via-white to-orange-50",
  },
  blue: {
    badge: "border-blue-200 bg-blue-100/90 text-blue-700",
    button: "bg-blue-600 text-white hover:bg-blue-700",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    glow: "from-blue-500/20 via-sky-400/10 to-transparent",
    panel: "border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50",
  },
  yellow: {
    badge: "border-yellow-200 bg-yellow-100/95 text-yellow-800",
    button: "bg-yellow-500 text-slate-900 hover:bg-yellow-400",
    chip: "border-yellow-200 bg-yellow-50 text-yellow-800",
    glow: "from-yellow-400/25 via-orange-300/10 to-transparent",
    panel: "border-yellow-100 bg-gradient-to-br from-yellow-50 via-white to-orange-50",
  },
  green: {
    badge: "border-green-200 bg-green-100/90 text-green-700",
    button: "bg-green-600 text-white hover:bg-green-700",
    chip: "border-green-200 bg-green-50 text-green-700",
    glow: "from-green-500/20 via-emerald-400/10 to-transparent",
    panel: "border-green-100 bg-gradient-to-br from-green-50 via-white to-emerald-50",
  },
};

export function ServicePreviewCatalog({
  accent,
  description,
  eyebrow,
  items,
  title,
}: {
  accent: ServicePreviewAccent;
  description: string;
  eyebrow: string;
  items: ServicePreviewItem[];
  title: string;
}) {
  const tone = accentStyles[accent];

  return (
    <section className={`mb-12 overflow-hidden rounded-[2rem] border ${tone.panel}`}>
      <div className="border-b border-white/70 px-6 py-6 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-body font-bold uppercase tracking-[0.18em] ${tone.chip}`}
          >
            {eyebrow}
          </span>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h2 className="font-heading text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {title}
            </h2>
            <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-body font-bold uppercase tracking-wide text-slate-500">
              Đặt online sắp mở
            </span>
          </div>
          <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:p-10">
        {items.map((item) => (
          <article
            key={item.title}
            className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="relative overflow-hidden bg-slate-950">
              <div className={`absolute inset-0 bg-gradient-to-br ${tone.glow}`} />
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                width={960}
                height={720}
                className="h-64 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-body font-bold backdrop-blur ${tone.badge}`}
                >
                  Hình minh họa
                </span>
                <span className="rounded-full border border-white/25 bg-slate-950/55 px-3 py-1 text-[11px] font-body font-bold text-white">
                  {item.fulfillmentLabel}
                </span>
              </div>
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-body text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {item.kicker}
                  </p>
                  <h3 className="mt-1 font-heading text-xl font-extrabold text-slate-900">
                    {item.title}
                  </h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-body font-bold text-slate-600">
                  {item.availabilityLabel}
                </span>
              </div>

              <p className="mt-3 font-body text-sm leading-6 text-slate-600">
                {item.summary}
              </p>

              <ul className="mt-4 space-y-2">
                {item.specs.map((spec) => (
                  <li
                    key={spec}
                    className="flex items-start gap-2 font-body text-sm text-slate-700"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    {spec}
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-body text-sm font-bold text-slate-700">
                  {item.consultLabel}
                </p>
                <p className="mt-1 font-body text-xs leading-5 text-slate-500">
                  Hiện tại em chốt cấu hình qua Zalo, điện thoại hoặc form báo giá.
                  Khi mở đặt online, mình sẽ giữ logic này để chuyển thành trang
                  đặt hàng nhanh hơn.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href={item.quoteHref}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 font-body text-sm font-bold transition-colors ${tone.button}`}
                >
                  {item.ctaLabel}
                </Link>
                <a
                  href={siteConfig.hotlineHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Gọi nhanh {siteConfig.hotlineDisplay}
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
