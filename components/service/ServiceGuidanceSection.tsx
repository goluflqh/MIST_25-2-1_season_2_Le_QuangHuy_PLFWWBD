import Link from "next/link";

type GuidanceAccent = "blue" | "green" | "red" | "yellow";

interface GuidanceItem {
  description: string;
  title: string;
}

interface GuidanceFaq {
  answer: string;
  question: string;
}

interface ServiceGuidanceSectionProps {
  accent: GuidanceAccent;
  faqs: readonly GuidanceFaq[];
  priceFactors: readonly string[];
  quoteHref: string;
  serviceName: string;
  steps: readonly GuidanceItem[];
}

const accentStyles = {
  blue: {
    badge: "border-sky-100 bg-sky-50 text-sky-700",
    dot: "bg-sky-600",
    marker: "bg-sky-50 text-sky-700",
    primaryLink: "bg-sky-700 text-white hover:bg-sky-800",
  },
  green: {
    badge: "border-emerald-100 bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-600",
    marker: "bg-emerald-50 text-emerald-700",
    primaryLink: "bg-emerald-700 text-white hover:bg-emerald-800",
  },
  red: {
    badge: "border-red-100 bg-red-50 text-primary",
    dot: "bg-primary",
    marker: "bg-red-50 text-primary",
    primaryLink: "bg-primary text-white hover:bg-red-500",
  },
  yellow: {
    badge: "border-amber-100 bg-amber-50 text-amber-700",
    dot: "bg-amber-600",
    marker: "bg-amber-50 text-amber-700",
    primaryLink: "bg-amber-600 text-white hover:bg-amber-700",
  },
} as const;

export function ServiceGuidanceSection({
  accent,
  faqs,
  priceFactors,
  quoteHref,
  serviceName,
  steps,
}: ServiceGuidanceSectionProps) {
  const styles = accentStyles[accent];

  return (
    <section className="mb-16 border-y border-slate-200 py-10">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${styles.badge}`}
          >
            Quy trình & báo giá
          </span>
          <h2 className="mt-4 max-w-2xl font-heading text-3xl font-extrabold leading-tight text-slate-900 md:text-4xl">
            {serviceName}: giá tham khảo, chốt theo tình trạng thật.
          </h2>
          <p className="mt-4 font-body text-base leading-7 text-slate-600">
            Bảng giá trên web chỉ giúp khách ước lượng ngân sách ban đầu. Đội quản trị Minh
            Hồng có thể cập nhật báo giá trong dashboard; giao diện public sẽ hiển thị theo
            các mục giá đang được bật, còn báo giá cuối vẫn dựa trên kiểm tra thực tế.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={quoteHref}
              className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-bold transition-colors ${styles.primaryLink}`}
            >
              Gửi thông tin cần tư vấn
            </Link>
            <Link
              href="/bao-gia"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-primary hover:text-primary"
            >
              Xem bảng giá tham khảo
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold ${styles.marker}`}
              >
                {index + 1}
              </span>
              <h3 className="mt-4 font-body text-base font-bold text-slate-900">{step.title}</h3>
              <p className="mt-2 font-body text-sm leading-6 text-slate-600">
                {step.description}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <h3 className="font-heading text-xl font-extrabold text-slate-900">
            Yếu tố làm giá thay đổi
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {priceFactors.map((factor) => (
              <li key={factor} className="flex gap-3 font-body text-sm leading-6 text-slate-600">
                <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${styles.dot}`} />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-heading text-xl font-extrabold text-slate-900">
            Câu hỏi khách hay hỏi
          </h3>
          <div className="mt-4 grid gap-3">
            {faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                <h4 className="font-body text-sm font-bold text-slate-900">{faq.question}</h4>
                <p className="mt-2 font-body text-sm leading-6 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
