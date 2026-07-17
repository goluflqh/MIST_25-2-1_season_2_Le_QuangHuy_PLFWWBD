import type { ReactNode } from "react";

export default function AdminPageHeader({
  eyebrow,
  title,
  summary,
  actions,
}: {
  eyebrow?: string;
  title: string;
  summary?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="font-body text-xs font-bold uppercase tracking-[0.12em] text-red-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-pretty font-heading text-[22px] font-extrabold leading-tight text-slate-900 sm:text-2xl">
          {title}
        </h2>
        {summary ? (
          <div className="mt-1 font-body text-[15px] leading-6 text-slate-600">{summary}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:shrink-0 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
