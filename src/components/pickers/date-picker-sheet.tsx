"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sheet } from "@/components/ui/sheet";
import { MonthGrid } from "@/components/calendar/month-grid";
import { addDays, startOfWeek, type UiLocale } from "@/lib/dates";

export function DatePickerSheet({
  open,
  onClose,
  value,
  today,
  locale,
  onChange,
  allowNone = true,
}: {
  open: boolean;
  onClose: () => void;
  value: string | null;
  today: string;
  locale: UiLocale;
  onChange: (date: string | null) => void;
  allowNone?: boolean;
}) {
  const t = useTranslations();
  const [month, setMonth] = useState(value ?? today);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMonth(value ?? today);
  }
  const nextMonday = addDays(startOfWeek(today), 7);
  const quick: { label: string; value: string | null }[] = [
    { label: t("home.today"), value: today },
    { label: t("home.tomorrow"), value: addDays(today, 1) },
    { label: t("calendar.nextWeek"), value: nextMonday },
    ...(allowNone ? [{ label: t("field.none"), value: null }] : []),
  ];
  const pick = (d: string | null) => {
    onChange(d);
    onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} title={t("field.date")}>
      <div className="chrome mb-4 flex flex-wrap gap-2">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => pick(q.value)}
            className={
              "h-10 rounded-full px-4 text-sm font-medium " +
              (q.value === value ? "bg-primary text-white" : "bg-chip text-chip-fg")
            }
          >
            {q.label}
          </button>
        ))}
      </div>
      <MonthGrid month={month} onMonthChange={setMonth} selected={value} today={today} locale={locale} onSelect={pick} />
    </Sheet>
  );
}
