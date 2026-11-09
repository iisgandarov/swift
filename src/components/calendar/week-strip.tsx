"use client";

import { motion, type PanInfo } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatLongDate, weekDays, weekdayShort, type UiLocale } from "@/lib/dates";
import { cn } from "@/lib/cn";

/** Mon→Sun strip; swipe or use the arrows to change week. Dots show days with items. */
export function WeekStrip({
  selected,
  today,
  locale,
  dots,
  onSelect,
}: {
  selected: string;
  today: string;
  locale: UiLocale;
  dots: Record<string, string[]>;
  onSelect: (d: string) => void;
}) {
  const t = useTranslations("calendar");
  const days = weekDays(selected);
  const shift = (n: number) => onSelect(addDays(selected, n * 7));

  return (
    <div className="chrome flex items-center gap-1">
      <button type="button" aria-label={t("prevWeek")} onClick={() => shift(-1)} className="hidden size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 sm:flex">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <motion.div
        key={days[0]}
        className="grid flex-1 touch-pan-y grid-cols-7"
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_e, info: PanInfo) => {
          if (info.offset.x < -60) shift(1);
          else if (info.offset.x > 60) shift(-1);
        }}
      >
        {days.map((d) => {
          const isSel = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSel}
              aria-label={formatLongDate(d, locale)}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <span className={cn("text-[12px] font-medium", isToday && !isSel ? "text-primary dark:text-secondary" : "text-muted")}>
                {weekdayShort(d, locale)}
              </span>
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-[17px] transition-colors duration-200",
                  isSel ? "bg-primary font-semibold text-white shadow-[var(--shadow-float)]" : isToday ? "font-bold text-primary dark:text-secondary" : "",
                )}
              >
                {Number(d.slice(8))}
              </span>
              <span className="flex h-1.5 gap-0.5" aria-hidden>
                {(dots[d] ?? []).slice(0, 3).map((c, i) => (
                  <span key={i} className="size-1.5 rounded-full" style={{ background: c }} />
                ))}
              </span>
            </button>
          );
        })}
      </motion.div>
      <button type="button" aria-label={t("nextWeek")} onClick={() => shift(1)} className="hidden size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-2 sm:flex">
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
