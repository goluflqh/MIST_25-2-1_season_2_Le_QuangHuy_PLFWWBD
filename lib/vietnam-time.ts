export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

const vietnamDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

const vietnamDateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

const vietnamDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
  year: "numeric",
});

function getVietnamParts(date: Date) {
  const parts = vietnamDatePartsFormatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    day: get("day"),
    month: get("month"),
    year: get("year"),
  };
}

export function getVietnamCalendarParts(value: Date | string) {
  return getVietnamParts(typeof value === "string" ? new Date(value) : value);
}

export function buildVietnamDate(year: number, month: number, day: number, endOfDay = false, allowOverflow = false) {
  const normalized = new Date(Date.UTC(year, month - 1, day));
  const target = {
    day: normalized.getUTCDate(),
    month: normalized.getUTCMonth() + 1,
    year: normalized.getUTCFullYear(),
  };

  if (!allowOverflow && (target.year !== year || target.month !== month || target.day !== day)) {
    return null;
  }

  const date = endOfDay
    ? new Date(Date.UTC(target.year, target.month - 1, target.day, 16, 59, 59, 999))
    : new Date(Date.UTC(target.year, target.month - 1, target.day, -7, 0, 0, 0));
  const parts = getVietnamParts(date);

  if (parts.year !== target.year || parts.month !== target.month || parts.day !== target.day) {
    return null;
  }

  return date;
}

export function addMonthsInVietnam(date: Date, months: number, endOfDay = false) {
  const parts = getVietnamParts(date);
  return buildVietnamDate(parts.year, parts.month + months, parts.day, endOfDay, true) || new Date(date);
}

export function formatVietnamDate(value: Date | string | null | undefined) {
  if (!value) return "";
  return vietnamDateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function formatVietnamDateTime(value: Date | string | null | undefined) {
  if (!value) return "";
  return vietnamDateTimeFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export function getVietnamDateCode(date = new Date()) {
  const parts = getVietnamParts(date);
  return [
    parts.year,
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("");
}

export function todayVietnamText(date = new Date()) {
  return formatVietnamDate(date);
}
