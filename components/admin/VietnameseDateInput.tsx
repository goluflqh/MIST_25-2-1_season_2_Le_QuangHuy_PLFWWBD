"use client";

import { useMemo, useState } from "react";
import { parseAdminDateInput } from "@/lib/admin-date";

interface VietnameseDateInputProps {
  dataTestId?: string;
  helper?: string;
  label: string;
  name: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  value: string;
}

const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function formatDateInput(value: Date) {
  return value.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1)),
  ];
}

function sameCalendarDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

export default function VietnameseDateInput({
  dataTestId,
  helper,
  label,
  name,
  onChange,
  placeholder = "Ví dụ: 30/04/2026",
  required = false,
  value,
}: VietnameseDateInputProps) {
  const parsedValue = parseAdminDateInput(value);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parsedValue || new Date());
  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const today = new Date();

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const selectDate = (date: Date) => {
    onChange(formatDateInput(date));
    setVisibleMonth(date);
    setIsOpen(false);
  };

  return (
    <div className="relative space-y-1.5">
      <label htmlFor={name} className="font-body text-xs font-bold text-slate-600">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={name}
          data-testid={dataTestId}
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
          autoComplete="off"
          required={required}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 font-body text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:ring-2 focus-visible:ring-red-100"
        />
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 font-body text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
        >
          Chọn ngày
        </button>
      </div>
      {helper ? <p className="font-body text-xs text-slate-400">{helper}</p> : null}

      {isOpen ? (
        <div className="absolute z-30 mt-2 w-full max-w-xs rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              aria-label="Tháng trước"
              className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              ‹
            </button>
            <p className="font-body text-sm font-bold text-slate-800">
              Tháng {visibleMonth.getMonth() + 1}/{visibleMonth.getFullYear()}
            </p>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              aria-label="Tháng sau"
              className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((weekday) => (
              <div key={weekday} className="py-1 font-body text-[10px] font-bold text-slate-400">
                {weekday}
              </div>
            ))}
            {days.map((day, index) =>
              day ? (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`aspect-square rounded-lg font-body text-xs font-bold transition-colors ${
                    parsedValue && sameCalendarDay(day, parsedValue)
                      ? "bg-red-600 text-white"
                      : sameCalendarDay(day, today)
                        ? "bg-red-50 text-red-600"
                        : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day.getDate()}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              )
            )}
          </div>
          <div className="mt-3 flex justify-between gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded-lg px-3 py-1.5 font-body text-xs font-bold text-slate-500 hover:bg-slate-100"
            >
              Xoá
            </button>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 font-body text-xs font-bold text-white hover:bg-slate-800"
            >
              Hôm nay
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
