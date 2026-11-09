import { addDays, DEFAULT_TZ, diffDays, utcToLocal } from "@/lib/dates";
import { compareItems } from "@/lib/client/display";
import type { Item } from "./types";

export type HomeFilter = "all" | "today" | "upcoming" | "completed";

export interface Section {
  key: string;
  kind: "today" | "tomorrow" | "day" | "later" | "noDate" | "completed";
  date: string | null;
  items: Item[];
}

const UPCOMING_DAYS = 14;

/**
 * Splits items into the sections Home shows for each filter. Overdue items lead the Today section.
 * Items completed today stay visible (struck through) where they were, so a tap doesn't make them vanish.
 */
export function groupForHome(items: Item[], filter: HomeFilter, today: string, tz: string = DEFAULT_TZ): Section[] {
  if (filter === "completed") {
    const done = items
      .filter((i) => i.status === "done")
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""));
    return done.length ? [{ key: "completed", kind: "completed", date: null, items: done }] : [];
  }

  const overdue = items.filter((i) => i.status === "open" && i.date !== null && i.date < today).sort(compareItems);
  const todayItems = items
    .filter((i) => i.date === today)
    .sort((a, b) => {
      // chronological, done items stay in place (like the mockup)
      if (a.start_at && b.start_at) return a.start_at.localeCompare(b.start_at);
      return compareItems({ ...a, status: "open" }, { ...b, status: "open" });
    });
  const todaySection: Section = { key: "today", kind: "today", date: today, items: [...overdue, ...todayItems] };

  if (filter === "today") return todaySection.items.length ? [todaySection] : [];

  const doneToday = (i: Item) => i.status === "done" && i.completed_at !== null && utcToLocal(i.completed_at, tz).date === today;
  const visible = (i: Item) => i.status === "open" || doneToday(i);

  const future = items.filter((i) => visible(i) && i.date !== null && i.date > today).sort(compareItems);
  const byDay = new Map<string, Item[]>();
  const later: Item[] = [];
  for (const i of future) {
    if (diffDays(i.date!, today) > UPCOMING_DAYS) later.push(i);
    else byDay.set(i.date!, [...(byDay.get(i.date!) ?? []), i]);
  }
  const daySections: Section[] = [...byDay.entries()].map(([date, list]) => ({
    key: date,
    kind: date === addDays(today, 1) ? "tomorrow" : "day",
    date,
    items: list,
  }));
  if (later.length) daySections.push({ key: "later", kind: "later", date: null, items: later });

  if (filter === "upcoming") return daySections;

  const noDate = items.filter((i) => visible(i) && i.date === null).sort(compareItems);
  const sections: Section[] = [];
  if (todaySection.items.length) sections.push(todaySection);
  sections.push(...daySections);
  if (noDate.length) sections.push({ key: "noDate", kind: "noDate", date: null, items: noDate });
  return sections;
}
