import type { ReactNode } from "react";

type MetricTone = "neutral" | "blue" | "green" | "amber" | "red" | "orange" | "violet";

export interface AdminMetricItem {
  key: string;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: MetricTone;
  active?: boolean;
  onSelect?: () => void;
}

const toneClasses: Record<MetricTone, { card: string; label: string; value: string; ring: string }> = {
  neutral: {
    card: "border-slate-200 bg-white",
    label: "text-slate-500",
    value: "text-slate-900",
    ring: "border-slate-400 ring-slate-300",
  },
  blue: {
    card: "border-blue-100 bg-blue-50",
    label: "text-blue-700",
    value: "text-blue-800",
    ring: "border-blue-500 ring-blue-200",
  },
  green: {
    card: "border-green-100 bg-green-50",
    label: "text-green-700",
    value: "text-green-800",
    ring: "border-green-500 ring-green-200",
  },
  amber: {
    card: "border-amber-200 bg-amber-50",
    label: "text-amber-700",
    value: "text-amber-800",
    ring: "border-amber-500 ring-amber-200",
  },
  red: {
    card: "border-red-100 bg-red-50",
    label: "text-red-700",
    value: "text-red-800",
    ring: "border-red-500 ring-red-200",
  },
  orange: {
    card: "border-orange-100 bg-orange-50",
    label: "text-orange-700",
    value: "text-orange-800",
    ring: "border-orange-500 ring-orange-200",
  },
  violet: {
    card: "border-violet-100 bg-violet-50",
    label: "text-violet-700",
    value: "text-violet-800",
    ring: "border-violet-500 ring-violet-200",
  },
};

function getDesktopGridClass(itemCount: number) {
  if (itemCount >= 5) return "sm:grid-cols-3 xl:grid-cols-5";
  if (itemCount === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (itemCount === 3) return "sm:grid-cols-3";
  return "sm:grid-cols-2";
}

export default function AdminMetricStrip({
  items,
  dataTestId,
}: {
  items: AdminMetricItem[];
  dataTestId?: string;
}) {
  return (
    <div
      data-testid={dataTestId}
      className={`grid grid-cols-2 gap-3 ${getDesktopGridClass(items.length)}`}
    >
      {items.map((item) => {
        const tone = toneClasses[item.tone || "neutral"];
        const content = (
          <>
            <p className={`font-body text-xs font-bold uppercase leading-5 tracking-[0.08em] ${tone.label}`}>
              {item.label}
            </p>
            <p className={`mt-2 whitespace-nowrap font-heading text-[clamp(1.15rem,4.8vw,1.5rem)] font-extrabold leading-none tracking-tight tabular-nums sm:text-2xl ${tone.value}`}>
              {item.value}
            </p>
            {item.helper ? (
              <p className={`mt-2 line-clamp-2 font-body text-xs leading-4 ${tone.label}`}>{item.helper}</p>
            ) : null}
          </>
        );
        const className = `min-h-28 min-w-0 rounded-xl border px-4 py-3.5 text-left shadow-sm transition-[border-color,box-shadow,background-color] sm:min-h-24 ${tone.card} ${item.active ? `ring-1 ${tone.ring}` : ""}`;

        return item.onSelect ? (
          <button
            key={item.key}
            type="button"
            aria-pressed={item.active}
            onClick={item.onSelect}
            className={`${className} cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
          >
            {content}
          </button>
        ) : (
          <div key={item.key} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
