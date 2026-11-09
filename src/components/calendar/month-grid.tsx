"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  addMonths, AZ_WEEKDAYS_SHORT, EN_WEEKDAYS_SHORT, formatLongDate, formatMonthYear, monthGrid, type UiLocale,
} from "@/lib/dates";
import { cn } from "@/lib/cn";

interface MonthGridProps {
  month: string; // any date inside the shown month
  onMonthChange: (month: string) => void;
  selected: string | null;
  today: string;
  locale: UiLocale;
  onSelect: (date: string) => void;
  /** dots under days, keyed by date → css colors */
  dots?: Record<string, string[]>;
}

export function MonthGrid({ month, onMonthChange, selected, today, locale, onSelect, dots }: MonthGridProps) {
  const t = useTranslations("calendar");
  const days = monthGrid(month);
  const monthKey = month.slice(0, 7);
  const labels = locale === "az" ? AZ_WEEKDAYS_SHORT : EN_WEEKDAYS_SHORT;

  return (
    <div>
      <div className="chrome mb-3 flex items-center justify-between">
        <button type="button" aria-label="‹" onClick={() => onMonthChange(addMonths(month, -1))} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="text-base font-semibold">{formatMonthYear(month, locale)}</span>
        <button type="button" aria-label="›" onClick={() => onMonthChange(addMonths(month, 1))} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="chrome grid grid-cols-7 text-center text-[11px] font-medium text-muted" aria-hidden>
        {labels.map((l) => (
          <span key={l} className="py-1">
            {l}
          </span>
        ))}
      </div>
      <div role="grid" aria-label={formatMonthYear(month, locale)} className="grid grid-cols-7 gap-y-1">
        {days.map((d) => {
          const inMonth = d.slice(0, 7) === monthKey;
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={formatLongDate(d, locale) + (isToday ? ` (${t("today")})` : "")}
              onClick={() => onSelect(d)}
              className="flex h-12 flex-col items-center justify-center gap-0.5"
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[15px] transition-colors",
                  isSel ? "sel font-semibold" : isToday ? "font-bold text-accent" : "",
                  !inMonth && !isSel && "text-subtle",
                  !isSel && "hover:bg-surface-2",
                )}
              >
                {Number(d.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {dots?.[d]?.slice(0, 3).map((c, i) => (
                  <span key={i} className="size-1.5 rounded-full" style={{ background: c }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
