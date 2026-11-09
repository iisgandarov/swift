import { describe, expect, it } from "vitest";
import { groupForHome } from "@/lib/domain/grouping";
import type { Item } from "@/lib/domain/types";

const today = "2026-11-09";
let n = 0;
function item(over: Partial<Item>): Item {
  n++;
  return {
    id: `i${n}`, user_id: "u", type: "task", title: `t${n}`, notes: null, date: null, start_at: null, end_at: null,
    all_day: false, priority: "medium", category_id: null, status: "open", completed_at: null, source: "manual",
    raw_transcript: null, language: null, google_event_id: null, sync_status: "none", sync_error: null,
    created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", ...over,
  };
}

describe("groupForHome", () => {
  const overdue = item({ title: "overdue", date: "2026-11-07" });
  const morning = item({ title: "morning", type: "event", date: today, start_at: "2026-11-09T05:00:00Z" });
  const doneMeeting = item({ title: "done", type: "event", date: today, start_at: "2026-11-09T07:00:00Z", status: "done", completed_at: "2026-11-09T08:00:00Z" });
  const tomorrow = item({ title: "tomorrow", date: "2026-11-10" });
  const far = item({ title: "far", date: "2026-12-30" });
  const undated = item({ title: "undated" });
  const undatedDoneToday = item({ title: "undated-done", status: "done", completed_at: "2026-11-09T09:00:00Z" });
  const oldDone = item({ title: "old-done", date: "2026-11-01", status: "done", completed_at: "2026-11-01T09:00:00Z" });
  const all = [far, undated, tomorrow, doneMeeting, morning, overdue, undatedDoneToday, oldDone];

  it("All: today (overdue first, chronological, done inline), tomorrow, later, no date", () => {
    const s = groupForHome(all, "all", today);
    expect(s.map((x) => x.kind)).toEqual(["today", "tomorrow", "later", "noDate"]);
    expect(s[0].items.map((i) => i.title)).toEqual(["overdue", "morning", "done"]);
    expect(s[3].items.map((i) => i.title)).toEqual(["undated", "undated-done"]);
  });
  it("Today only", () => {
    expect(groupForHome(all, "today", today).map((x) => x.kind)).toEqual(["today"]);
  });
  it("Upcoming has no today/no-date", () => {
    expect(groupForHome(all, "upcoming", today).map((x) => x.kind)).toEqual(["tomorrow", "later"]);
  });
  it("Completed: newest first", () => {
    const s = groupForHome(all, "completed", today);
    expect(s[0].items.map((i) => i.title)).toEqual(["undated-done", "done", "old-done"]);
  });
  it("empty → no sections", () => {
    expect(groupForHome([], "all", today)).toEqual([]);
  });
});
