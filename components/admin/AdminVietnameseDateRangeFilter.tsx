"use client";

import VietnameseDateInput from "@/components/admin/VietnameseDateInput";
import { parseAdminDateInput } from "@/lib/admin-date";
import { formatVietnamDate, getVietnamDateKey } from "@/lib/vietnam-time";

interface AdminVietnameseDateRangeFilterProps {
  className?: string;
  fromDataTestId: string;
  fromLabel?: string;
  fromName: string;
  fromValue: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  toDataTestId: string;
  toLabel?: string;
  toName: string;
  toValue: string;
}

function toDisplayValue(value: string) {
  if (!value) return "";
  const parsed = parseAdminDateInput(value);
  return parsed ? formatVietnamDate(parsed) : value;
}

function toDateKey(value: string) {
  if (!value.trim()) return "";
  const parsed = parseAdminDateInput(value);
  return parsed ? getVietnamDateKey(parsed) : value;
}

export default function AdminVietnameseDateRangeFilter({
  className = "grid gap-3 md:grid-cols-2",
  fromDataTestId,
  fromLabel = "Từ ngày",
  fromName,
  fromValue,
  onFromChange,
  onToChange,
  toDataTestId,
  toLabel = "Đến ngày",
  toName,
  toValue,
}: AdminVietnameseDateRangeFilterProps) {
  return (
    <div className={className}>
      <VietnameseDateInput
        dataTestId={fromDataTestId}
        label={fromLabel}
        name={fromName}
        value={toDisplayValue(fromValue)}
        onChange={(value) => onFromChange(toDateKey(value))}
      />
      <VietnameseDateInput
        dataTestId={toDataTestId}
        label={toLabel}
        name={toName}
        value={toDisplayValue(toValue)}
        onChange={(value) => onToChange(toDateKey(value))}
      />
    </div>
  );
}
