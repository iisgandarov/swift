import { addDays, startOfWeek, utcToLocal } from "@/lib/dates";
import type { FocusSession, Item } from "./types";

export interface Stats {
  completedToday: number;
  completedThisWeek: number;
  /** % of items dated this week (up to today) that are done; null when there's nothing to measure */
  completionRate: number | null;
  streak: number;
  focusMinutesThisWeek: number;
  last7: { date: string; count: number }[];
  byCategory: { categoryId: string | null; count: number }[];
  tasks: number;
  events: number;
}

/** Local day an item was completed on. */
function doneDay(i: Item, tz: string) {
  return i.completed_at ? utcToLocal(i.completed_at, tz).date : null;
}

export function computeStats(items: Item[], sessions: FocusSession[], today: string, tz: string): Stats {
  const weekStart = startOfWeek(today);
  const done = items.filter((i) => i.status === "done" && i.completed_at);
  const doneDays = new Map<string, number>();
  for (const i of done) {
    const d = doneDay(i, tz)!;
    doneDays.set(d, (doneDays.get(d) ?? 0) + 1);
  }

  const completedThisWeek = done.filter((i) => doneDay(i, tz)! >= weekStart).length;

  // completion rate: items planned for this week up to today
  const planned = items.filter((i) => i.date !== null && i.date >= weekStart && i.date <= today);
  const completionRate = planned.length ? Math.round((planned.filter((i) => i.status === "done").length / planned.length) * 100) : null;

  // streak: consecutive days with ≥1 completion, ending today (or yesterday if nothing yet today)
  let streak = 0;
  let cursor = doneDays.has(today) ? today : addDays(today, -1);
  while (doneDays.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }

  const last7 = Array.from({ length: 7 }, (_, k) => {
    const date = addDays(today, k - 6);
    return { date, count: doneDays.get(date) ?? 0 };
  });

  const byCat = new Map<string | null, number>();
  for (const i of done.filter((x) => doneDay(x, tz)! >= addDays(today, -29))) {
    byCat.set(i.category_id, (byCat.get(i.category_id) ?? 0) + 1);
  }

  const focusMinutesThisWeek = sessions
    .filter((s) => utcToLocal(s.started_at, tz).date >= weekStart)
    .reduce((sum, s) => sum + s.actual_minutes, 0);

  return {
    completedToday: doneDays.get(today) ?? 0,
    completedThisWeek,
    completionRate,
    streak,
    focusMinutesThisWeek,
    last7,
    byCategory: [...byCat.entries()].map(([categoryId, count]) => ({ categoryId, count })).sort((a, b) => b.count - a.count),
    tasks: items.filter((i) => i.type === "task").length,
    events: items.filter((i) => i.type === "event").length,
  };
}
