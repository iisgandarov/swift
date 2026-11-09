"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays } from "lucide-react";
import { addDays, formatDayLabel, formatMonthYear, monthGrid, startOfWeek } from "@/lib/dates";
import { useAppSettings } from "@/hooks/use-app-settings";
import { Sheet } from "@/components/ui/sheet";
import { MonthGrid } from "./month-grid";
import { WeekStrip } from "./week-strip";
import { DayAgenda } from "./day-agenda";
import { useCalendarData } from "./use-calendar-data";

export function CalendarScreen({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const { locale, today, tz, timeFormat } = useAppSettings();
  const [picked, setSelected] = useState<string | null>(null);
  const selected = picked ?? today;
  const [monthOpen, setMonthOpen] = useState(false);
  const [month, setMonth] = useState(selected);

  // fetch the visible week (and the whole month grid while the month sheet is open)
  const grid = monthGrid(month);
  const from = monthOpen ? grid[0] : startOfWeek(selected);
  const to = monthOpen ? grid[41] : addDays(startOfWeek(selected), 6);
  const data = useCalendarData(from, to, tz);
  const weekData = useCalendarData(startOfWeek(selected), addDays(startOfWeek(selected), 6), tz);

  return (
    <div>
      <header className="chrome mb-4 flex min-h-12 items-center justify-between">
        {compact ? (
          <h2 className="text-lg font-bold">{formatMonthYear(selected, locale)}</h2>
        ) : (
          <h1 className="text-[26px] font-bold tracking-tight">{formatMonthYear(selected, locale)}</h1>
        )}
        <button
          type="button"
          aria-label={t("calendar.openMonth")}
          onClick={() => {
            setMonth(selected);
            setMonthOpen(true);
          }}
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
        >
          <CalendarDays className="size-6" aria-hidden />
        </button>
      </header>

      <div className={compact ? "" : "-mx-2"}>
        <WeekStrip selected={selected} today={today} locale={locale} dots={weekData.dots} onSelect={setSelected} />
      </div>

      <div className="mt-5 mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{selected === today ? t("home.today") : formatDayLabel(selected, locale)}</h2>
        {selected !== today && (
          <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-primary dark:text-secondary">
            {t("calendar.today")}
          </button>
        )}
      </div>
      <DayAgenda entries={weekData.byDay[selected] ?? []} locale={locale} timeFormat={timeFormat} loading={weekData.loading} />

      <Sheet open={monthOpen} onClose={() => setMonthOpen(false)} title={t("nav.calendar")}>
        <MonthGrid
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          today={today}
          locale={locale}
          dots={data.dots}
          onSelect={(d) => {
            setSelected(d);
            setMonthOpen(false);
          }}
        />
      </Sheet>
    </div>
  );
}
