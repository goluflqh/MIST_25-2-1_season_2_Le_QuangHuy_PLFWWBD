export type AdminTimePreset = "ALL" | "TODAY" | "LAST_7_DAYS" | "THIS_MONTH" | "LAST_MONTH" | "CUSTOM";

export const adminTimePresetLabels: Record<AdminTimePreset, string> = {
  ALL: "Tất cả",
  TODAY: "Hôm nay",
  LAST_7_DAYS: "7 ngày qua",
  THIS_MONTH: "Tháng này",
  LAST_MONTH: "Tháng trước",
  CUSTOM: "Tùy chọn",
};

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function toDateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(dateKey: string, days: number) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return dateKey;

  return toDateKey(new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + days)));
}

function monthStart(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  return parsed ? [parsed.year, String(parsed.month).padStart(2, "0"), "01"].join("-") : dateKey;
}

function previousMonthRange(dateKey: string) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) return { from: "", to: "" };

  return {
    from: toDateKey(new Date(Date.UTC(parsed.year, parsed.month - 2, 1))),
    to: toDateKey(new Date(Date.UTC(parsed.year, parsed.month - 1, 0))),
  };
}

export function getAdminTimePresetRange(
  preset: AdminTimePreset,
  todayKey: string,
  customFrom = "",
  customTo = ""
) {
  if (preset === "TODAY") return { from: todayKey, to: todayKey };
  if (preset === "LAST_7_DAYS") return { from: addDays(todayKey, -6), to: todayKey };
  if (preset === "THIS_MONTH") return { from: monthStart(todayKey), to: todayKey };
  if (preset === "LAST_MONTH") return previousMonthRange(todayKey);
  if (preset === "CUSTOM") return { from: customFrom, to: customTo };
  return { from: "", to: "" };
}

export function matchesAdminTimePreset(
  dateKey: string,
  preset: AdminTimePreset,
  todayKey: string,
  customFrom = "",
  customTo = ""
) {
  if (!dateKey) return preset === "ALL";

  const range = getAdminTimePresetRange(preset, todayKey, customFrom, customTo);
  if (range.from && dateKey < range.from) return false;
  if (range.to && dateKey > range.to) return false;
  return true;
}
