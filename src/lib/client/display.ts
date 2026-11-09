import type { Category, CategoryColor, Item, Priority } from "@/lib/domain/types";
import { formatShortDate, formatTimeRange, utcToLocal, type UiLocale } from "@/lib/dates";

export function categoryStyle(color: CategoryColor) {
  return {
    dot: `var(--cat-${color})`,
    chipBg: `var(--cat-${color}-chip)`,
    chipText: `var(--cat-${color}-text)`,
  };
}

export const PRIORITY_DOT: Record<Priority, string> = {
  high: "var(--danger)",
  medium: "var(--cat-amber)",
  low: "var(--cat-blue)",
};

export function categoryName(cat: Pick<Category, "name_az" | "name_en">, locale: UiLocale) {
  return locale === "az" ? cat.name_az : cat.name_en;
}

/** Local start/end times of an event, or null for tasks / all-day. */
export function itemTimes(item: Item, tz: string) {
  if (!item.start_at) return null;
  return {
    start: utcToLocal(item.start_at, tz).time,
    end: item.end_at ? utcToLocal(item.end_at, tz).time : null,
  };
}

/** Second-line label: time range for events, date for dated tasks outside "today". */
export function itemWhenLabel(
  item: Item,
  opts: { locale: UiLocale; tz: string; timeFormat: "24h" | "12h"; today: string; showDate: boolean; allDayLabel: string },
) {
  const parts: string[] = [];
  if (opts.showDate && item.date && item.date !== opts.today) {
    parts.push(formatShortDate(item.date, opts.locale, Number(opts.today.slice(0, 4))));
  }
  const times = itemTimes(item, opts.tz);
  if (times) parts.push(formatTimeRange(times.start, times.end, opts.locale, opts.timeFormat));
  else if (item.all_day) parts.push(opts.allDayLabel);
  return parts.join(" · ");
}

/** Sort: timed items by start, then untimed; done items last. */
export function compareItems(a: Item, b: Item) {
  if (a.status !== b.status) return a.status === "open" ? -1 : 1;
  if ((a.date ?? "9999") !== (b.date ?? "9999")) return (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1;
  if (a.start_at && b.start_at) return a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : 0;
  if (a.start_at) return -1;
  if (b.start_at) return 1;
  const pr = { high: 0, medium: 1, low: 2 };
  if (a.priority !== b.priority) return pr[a.priority] - pr[b.priority];
  return a.created_at < b.created_at ? -1 : 1;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toLocaleUpperCase("az");
}
