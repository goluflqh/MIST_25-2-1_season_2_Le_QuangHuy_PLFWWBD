export function parseMoneyText(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value) : 0;
  }

  const normalized = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized) return 0;

  const isThousandsShortcut = normalized.endsWith("k");
  const rawNumber = isThousandsShortcut ? normalized.slice(0, -1) : normalized;
  const parsed = Number.parseInt(rawNumber.replace(/[^\d]/g, ""), 10);

  if (!Number.isFinite(parsed)) return 0;
  return parsed * (isThousandsShortcut ? 1000 : 1);
}

export function formatMoneyInputValue(value: unknown) {
  const parsed = parseMoneyText(value);
  return parsed > 0 ? parsed.toLocaleString("vi-VN") : "";
}
