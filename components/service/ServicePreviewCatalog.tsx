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
    title: string;
  }
> = {
  red: {
    badge: "border-red-200 bg-red-100/90 text-red-700",
    button: "bg-slate-900 text-white hover:bg-primary",
    chip: "border-red-200 bg-red-50 text-red-700",
    glow: "from-red-500/20 via-orange-400/10 to-transparent",
    panel: "border-red-100 bg-gradient-to-br from-red-50/85 via-white to-orange-50/75",
    title: "from-red-700 via-primary to-orange-500",
  },
  blue: {
    badge: "border-blue-200 bg-blue-100/90 text-blue-700",
    button: "bg-slate-900 text-white hover:bg-primary",
    chip: "border-blue-200 bg-blue-50 text-blue-700",
    glow: "from-blue-500/20 via-sky-400/10 to-transparent",
    panel: "border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-slate-50",
    title: "from-slate-950 via-blue-700 to-sky-500",
  },
  yellow: {
    badge: "border-yellow-200 bg-yellow-100/95 text-yellow-800",
    button: "bg-slate-900 text-white hover:bg-primary",
    chip: "border-yellow-200 bg-yellow-50 text-yellow-800",
    glow: "from-yellow-400/25 via-orange-300/10 to-transparent",
    panel: "border-yellow-100 bg-gradient-to-br from-yellow-50/85 via-white to-orange-50/75",
    title: "from-amber-700 via-orange-600 to-primary",
  },
  green: {
    badge: "border-green-200 bg-green-100/90 text-green-700",
    button: "bg-slate-900 text-white hover:bg-primary",
    chip: "border-green-200 bg-green-50 text-green-700",
    glow: "from-green-500/20 via-emerald-400/10 to-transparent",
    panel: "border-green-100 bg-gradient-to-br from-green-50/85 via-white to-emerald-50/75",
    title: "from-emerald-800 via-slate-900 to-primary",
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
            className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-body font-semibold ${tone.chip}`}
          >
            {eyebrow}
          </span>
          <h2 className={`mt-4 bg-linear-to-r bg-clip-text font-heading text-2xl font-extrabold text-transparent sm:text-3xl ${tone.title}`}>
            {title}
          </h2>
          <p className="mt-3 max-w-2xl font-body text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2 lg:p-10">
        {items.map((item) => (
          <article
            key={item.title}
            className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="relative overflow-hidden bg-slate-950">
              <div className={`absolute inset-0 bg-gradient-to-br ${tone.glow}`} />
              <Image
                src={item.imageSrc}
                alt={item.imageAlt}
                width={960}
                height={720}
                unoptimized
                className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] sm:h-64"
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

            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-body text-xs font-semibold text-slate-500">
                    {item.kicker}
                  </p>
                  <h3 className="mt-1 font-body text-lg font-semibold text-slate-900 sm:text-xl">
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

              <div className="mt-4 flex flex-wrap gap-2">
                {item.specs.map((spec) => (
                  <span
                    key={spec}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                  >
                    {spec}
                  </span>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-body text-sm font-bold text-slate-700">
                  {item.consultLabel}
                </p>
                <p className="mt-1 font-body text-xs leading-5 text-slate-500">
                  Bấm tư vấn để kỹ thuật hỏi đúng thiết bị, mức tải hoặc vị trí lắp trước khi
                  báo cấu hình phù hợp.
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={item.quoteHref}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-body text-sm font-bold transition-colors ${tone.button}`}
                >
                  {item.ctaLabel}
                </Link>
                <a
                  href={siteConfig.hotlineHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 font-body text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
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
