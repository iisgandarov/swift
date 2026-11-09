import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/domain/stats";
import type { FocusSession, Item } from "@/lib/domain/types";

const today = "2026-11-12"; // Thursday; week started Monday 2026-11-09
let n = 0;
const item = (o: Partial<Item>): Item => ({
  id: `i${++n}`, user_id: "u", type: "task", title: "t", notes: null, date: null, start_at: null, end_at: null, all_day: false,
  priority: "medium", category_id: null, status: "open", completed_at: null, source: "manual", raw_transcript: null, language: null,
  google_event_id: null, sync_status: "none", sync_error: null, created_at: "", updated_at: "", ...o,
});
// completed at 10:00 Baku on the given day
const doneOn = (d: string, o: Partial<Item> = {}) => item({ status: "done", completed_at: `${d}T06:00:00.000Z`, ...o });

describe("computeStats", () => {
  const items = [
    doneOn("2026-11-12", { date: "2026-11-12", category_id: "work" }),
    doneOn("2026-11-12", { type: "event" }),
    doneOn("2026-11-11", { date: "2026-11-10", category_id: "work" }),
    doneOn("2026-11-10"),
    doneOn("2026-11-07"), // before this week, breaks the streak gap? no: 11-08 and 11-09 missing
    item({ date: "2026-11-11" }), // planned, open
    item({ date: "2026-11-20" }), // future, ignored for rate
  ];
  const sessions: FocusSession[] = [
    { id: "f1", user_id: "u", item_id: null, started_at: "2026-11-10T06:00:00Z", planned_minutes: 25, actual_minutes: 25, completed: true },
    { id: "f2", user_id: "u", item_id: null, started_at: "2026-11-02T06:00:00Z", planned_minutes: 25, actual_minutes: 25, completed: true },
  ];
  const s = computeStats(items, sessions, today, "Asia/Baku");

  it("counts today and this week", () => {
    expect(s.completedToday).toBe(2);
    expect(s.completedThisWeek).toBe(4);
  });
  it("streak counts consecutive days ending today", () => expect(s.streak).toBe(3));
  it("completion rate over items planned this week up to today", () => expect(s.completionRate).toBe(67));
  it("focus minutes only this week", () => expect(s.focusMinutesThisWeek).toBe(25));
  it("last 7 days ends today", () => {
    expect(s.last7.map((d) => d.count)).toEqual([0, 1, 0, 0, 1, 1, 2]);
    expect(s.last7.at(-1)?.date).toBe(today);
  });
  it("groups by category, most first", () => {
    expect(s.byCategory).toEqual([{ categoryId: null, count: 3 }, { categoryId: "work", count: 2 }]);
  });
  it("streak survives a not-yet-productive today", () => {
    expect(computeStats([doneOn("2026-11-11"), doneOn("2026-11-10")], [], today, "Asia/Baku").streak).toBe(2);
  });
  it("no data → null rate, zero streak", () => {
    const e = computeStats([], [], today, "Asia/Baku");
    expect(e.completionRate).toBeNull();
    expect(e.streak).toBe(0);
  });
});
