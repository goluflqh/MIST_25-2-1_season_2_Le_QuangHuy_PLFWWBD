"use client";

import { useMemo, useRef, useState } from "react";
import { parseAdminDateInput } from "@/lib/admin-date";
import { getVietnamCalendarParts } from "@/lib/vietnam-time";

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
const monthLabels = Array.from({ length: 12 }, (_, index) => "Tháng " + (index + 1));

type CalendarView = "date" | "month" | "year";

function createCalendarDate(year: number, month: number, day = 1) {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfDecade(year: number) {
  return Math.floor(year / 10) * 10;
}

function getYearOptions(year: number) {
  const decadeStart = startOfDecade(year);
  return Array.from({ length: 16 }, (_, index) => decadeStart - 2 + index);
}

function formatDateInput(value: Date) {
  return [
    String(value.getDate()).padStart(2, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    value.getFullYear(),
  ].join("/");
}

function toCalendarDate(value: Date) {
  const parts = getVietnamCalendarParts(value);
  return createCalendarDate(parts.year, parts.month - 1, parts.day);
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = createCalendarDate(year, month, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const daysInMonth = createCalendarDate(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => createCalendarDate(year, month, index + 1)),
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
  const parsedAdminValue = parseAdminDateInput(value);
  const parsedValue = parsedAdminValue ? toCalendarDate(parsedAdminValue) : null;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>("date");
  const [opensUp, setOpensUp] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parsedValue || toCalendarDate(new Date()));
  const days = useMemo(() => getCalendarDays(visibleMonth), [visibleMonth]);
  const today = toCalendarDate(new Date());
  const activeDecadeStart = startOfDecade(visibleMonth.getFullYear());
  const yearOptions = useMemo(() => getYearOptions(visibleMonth.getFullYear()), [visibleMonth]);
  const headerLabel = calendarView === "date"
    ? `Tháng ${visibleMonth.getMonth() + 1}/${visibleMonth.getFullYear()}`
    : calendarView === "month"
      ? String(visibleMonth.getFullYear())
      : `${activeDecadeStart} - ${activeDecadeStart + 9}`;

  const moveCurrentView = (delta: number) => {
    setVisibleMonth((current) => {
      if (calendarView === "year") return createCalendarDate(current.getFullYear() + delta * 10, current.getMonth(), 1);
      if (calendarView === "month") return createCalendarDate(current.getFullYear() + delta, current.getMonth(), 1);
      return createCalendarDate(current.getFullYear(), current.getMonth() + delta, 1);
    });
  };

  const openHigherView = () => {
    setCalendarView((current) => {
      if (current === "date") return "month";
      if (current === "month") return "year";
      return "year";
    });
  };

  const selectDate = (date: Date) => {
    onChange(formatDateInput(date));
    setVisibleMonth(date);
    setCalendarView("date");
    setIsOpen(false);
  };

  const selectMonth = (month: number) => {
    setVisibleMonth((current) => createCalendarDate(current.getFullYear(), month, 1));
    setCalendarView("date");
  };

  const selectYear = (year: number) => {
    setVisibleMonth((current) => createCalendarDate(year, current.getMonth(), 1));
    setCalendarView("month");
  };

  const toggleCalendar = () => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const estimatedCalendarHeight = 380;
    setOpensUp(Boolean(rect && rect.bottom + estimatedCalendarHeight > window.innerHeight && rect.top > estimatedCalendarHeight));
    if (!isOpen && parsedValue) setVisibleMonth(parsedValue);
    if (isOpen) setCalendarView("date");
    setIsOpen((current) => !current);
  };

  return (
    <div ref={wrapperRef} className="relative space-y-1.5" onKeyDown={(event) => {
      if (event.key === "Escape") setIsOpen(false);
    }}>
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
          onClick={toggleCalendar}
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 font-body text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
        >
          Chọn ngày
        </button>
      </div>
      {helper ? <p className="font-body text-xs text-slate-400">{helper}</p> : null}

      {isOpen ? (
        <div
          data-testid="vietnamese-date-calendar"
          className={`absolute left-0 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:w-80 ${opensUp ? "bottom-full mb-2" : "mt-2"}`}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => moveCurrentView(-1)}
              aria-label={calendarView === "date" ? "Tháng trước" : calendarView === "month" ? "Năm trước" : "Giai đoạn năm trước"}
              className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
              data-testid="vietnamese-date-prev"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={openHigherView}
              className="rounded-lg px-2 py-1 font-body text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
              data-testid="vietnamese-date-month-label"
            >
              {headerLabel}
            </button>
            <button
              type="button"
              onClick={() => moveCurrentView(1)}
              aria-label={calendarView === "date" ? "Tháng sau" : calendarView === "month" ? "Năm sau" : "Giai đoạn năm sau"}
              className="rounded-lg px-2 py-1 text-sm font-bold text-slate-500 hover:bg-slate-100"
              data-testid="vietnamese-date-next"
            >
              ›
            </button>
          </div>
          {calendarView === "month" ? (
            <div
              data-testid="vietnamese-date-month-panel"
              className="mb-3 rounded-xl border border-slate-100 bg-slate-50 p-2"
            >
              <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">Chọn tháng</p>
              <div className="grid grid-cols-3 gap-1">
                {monthLabels.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    onClick={() => selectMonth(index)}
                    className={"rounded-lg px-2 py-1.5 font-body text-xs font-bold transition-colors " + (visibleMonth.getMonth() === index ? "bg-red-600 text-white" : "bg-white text-slate-700 hover:bg-slate-100")}
                    data-testid={"vietnamese-date-month-" + (index + 1)}
                  >
                    {month}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {calendarView === "year" ? (
            <div
              data-testid="vietnamese-date-year-panel"
              className="mb-3 rounded-xl border border-slate-100 bg-slate-50 p-2"
            >
              <p className="mb-2 font-body text-[11px] font-bold uppercase tracking-wider text-slate-500">Chọn năm</p>
              <div className="grid grid-cols-4 gap-1">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => selectYear(year)}
                    className={"rounded-lg px-2 py-2 font-body text-xs font-bold transition-colors " + (
                      visibleMonth.getFullYear() === year
                        ? "bg-red-600 text-white"
                        : year >= activeDecadeStart && year <= activeDecadeStart + 9
                          ? "bg-white text-slate-700 hover:bg-slate-100"
                          : "bg-white text-slate-400 hover:bg-slate-100"
                    )}
                    data-testid={"vietnamese-date-year-" + year}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdayLabels.map((weekday) => (
              <div key={weekday} className="py-1 font-body text-[10px] font-bold text-slate-400" data-testid={`vietnamese-date-weekday-${weekday}`}>
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
              onClick={() => {
                onChange("");
                setCalendarView("date");
                setIsOpen(false);
              }}
              className="rounded-lg px-3 py-1.5 font-body text-xs font-bold text-slate-500 hover:bg-slate-100"
              data-testid="vietnamese-date-clear"
            >
              Xoá
            </button>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 font-body text-xs font-bold text-white hover:bg-slate-800"
              data-testid="vietnamese-date-today"
            >
              Hôm nay
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
