interface ParseAdminDateOptions {
  endOfDay?: boolean;
}

function buildLocalDate(year: number, month: number, day: number, endOfDay: boolean) {
  const parsed = new Date(year, month - 1, day);
  const isValid =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;

  if (!isValid) return null;

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed;
}

export function parseAdminDateInput(
  value: unknown,
  options: ParseAdminDateOptions = {}
) {
  const endOfDay = Boolean(options.endOfDay);

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    if (!endOfDay) return value;

    const copy = new Date(value);
    copy.setHours(23, 59, 59, 999);
    return copy;
  }

  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw) return null;

  const vietnameseDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vietnameseDate) {
    return buildLocalDate(
      Number(vietnameseDate[3]),
      Number(vietnameseDate[2]),
      Number(vietnameseDate[1]),
      endOfDay
    );
  }

  const isoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDate) {
    return buildLocalDate(
      Number(isoDate[1]),
      Number(isoDate[2]),
      Number(isoDate[3]),
      endOfDay
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}
