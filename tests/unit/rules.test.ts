import { describe, expect, it } from "vitest";
import { applyPatch, buildNewItem, isOverdue, planSync, resolveTiming, RuleError, suggestType } from "@/lib/domain/rules";
import type { Item } from "@/lib/domain/types";
import { itemInputSchema } from "@/lib/domain/schemas";

const ctx = { timezone: "Asia/Baku", defaultEventMinutes: 60 };

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1", user_id: "u1", type: "task", title: "T", notes: null, date: null, start_at: null, end_at: null,
    all_day: false, priority: "medium", category_id: null, status: "open", completed_at: null, source: "manual",
    raw_transcript: null, language: null, google_event_id: null, sync_status: "none", sync_error: null,
    created_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z", ...over,
  };
}

describe("suggestType", () => {
  it("time → event, no time → task", () => {
    expect(suggestType("10:00")).toBe("event");
    expect(suggestType(null)).toBe("task");
  });
});

describe("resolveTiming", () => {
  it("tasks keep only the date", () => {
    expect(resolveTiming({ type: "task", date: "2026-11-13", start_time: "10:00" }, ctx)).toEqual({
      type: "task", date: "2026-11-13", start_at: null, end_at: null, all_day: false,
    });
  });
  it("events without an end get the default duration", () => {
    const r = resolveTiming({ type: "event", date: "2026-11-10", start_time: "10:00" }, ctx);
    expect(r.start_at).toBe("2026-11-10T06:00:00.000Z");
    expect(r.end_at).toBe("2026-11-10T07:00:00.000Z");
  });
  it("uses an explicit duration", () => {
    const r = resolveTiming({ type: "event", date: "2026-11-10", start_time: "15:00", duration_minutes: 30 }, ctx);
    expect(r.end_at).toBe("2026-11-10T11:30:00.000Z");
  });
  it("end before start rolls to the next day", () => {
    const r = resolveTiming({ type: "event", date: "2026-11-10", start_time: "23:00", end_time: "01:00" }, ctx);
    expect(r.end_at).toBe("2026-11-10T21:00:00.000Z");
  });
  it("events need a date and a time", () => {
    expect(() => resolveTiming({ type: "event", start_time: "10:00" }, ctx)).toThrow(RuleError);
    expect(() => resolveTiming({ type: "event", date: "2026-11-10" }, ctx)).toThrow(RuleError);
  });
});

describe("buildNewItem", () => {
  it("marks events as pending sync and tasks as none", () => {
    const ev = buildNewItem(itemInputSchema.parse({ type: "event", title: " Call ", date: "2026-11-10", start_time: "09:00" }), ctx);
    expect(ev.sync_status).toBe("pending");
    expect(ev.title).toBe("Call");
    const t = buildNewItem(itemInputSchema.parse({ type: "task", title: "Read" }), ctx);
    expect(t.sync_status).toBe("none");
    expect(t.priority).toBe("medium");
  });
});

describe("applyPatch", () => {
  const ev = item({ type: "event", date: "2026-11-10", start_at: "2026-11-10T06:00:00.000Z", end_at: "2026-11-10T06:30:00.000Z" });
  it("changing the date keeps the time", () => {
    const p = applyPatch(ev, { date: "2026-11-12" }, ctx);
    expect(p.start_at).toBe("2026-11-12T06:00:00.000Z");
    expect(p.end_at).toBe("2026-11-12T06:30:00.000Z");
  });
  it("moving the start keeps the duration", () => {
    const p = applyPatch(ev, { start_time: "14:00" }, ctx);
    expect(p.start_at).toBe("2026-11-10T10:00:00.000Z");
    expect(p.end_at).toBe("2026-11-10T10:30:00.000Z");
  });
  it("event → task drops the time slot", () => {
    const p = applyPatch(ev, { type: "task" }, ctx);
    expect(p).toMatchObject({ type: "task", date: "2026-11-10", start_at: null, end_at: null });
  });
  it("task → event needs a time", () => {
    expect(() => applyPatch(item({ date: "2026-11-10" }), { type: "event" }, ctx)).toThrow(RuleError);
    const p = applyPatch(item({ date: "2026-11-10" }), { type: "event", start_time: "18:00" }, ctx);
    expect(p.end_at).toBe("2026-11-10T15:00:00.000Z");
  });
  it("completing sets completed_at, reopening clears it", () => {
    const now = new Date("2026-11-09T10:00:00Z");
    expect(applyPatch(item(), { status: "done" }, ctx, now)).toEqual({ status: "done", completed_at: now.toISOString() });
    expect(applyPatch(item({ status: "done", completed_at: "x" }), { status: "open" }, ctx)).toEqual({ status: "open", completed_at: null });
  });
});

describe("planSync", () => {
  const ev = item({ type: "event", date: "2026-11-10", start_at: "a", end_at: "b", google_event_id: "g1" });
  it("new event → create; new task → none", () => {
    expect(planSync(null, item({ type: "event" }))).toBe("create");
    expect(planSync(null, item())).toBe("none");
  });
  it("task → event creates, event → task deletes", () => {
    expect(planSync(item(), item({ type: "event" }))).toBe("create");
    expect(planSync(ev, { ...ev, type: "task" })).toBe("delete");
  });
  it("editing synced fields updates, completing does not", () => {
    expect(planSync(ev, { ...ev, title: "New" })).toBe("update");
    expect(planSync(ev, { ...ev, status: "done", completed_at: "x" })).toBe("none");
    expect(planSync(ev, { ...ev, priority: "high" })).toBe("none");
  });
  it("deleting an event with a Google id deletes it there", () => {
    expect(planSync(ev, null)).toBe("delete");
    expect(planSync(item(), null)).toBe("none");
  });
  it("an event that never reached Google is (re)created", () => {
    expect(planSync({ ...ev, google_event_id: null }, { ...ev, google_event_id: null, title: "x" })).toBe("create");
  });
});

describe("isOverdue", () => {
  it("open items dated before today", () => {
    expect(isOverdue({ status: "open", date: "2026-11-08" }, "2026-11-09")).toBe(true);
    expect(isOverdue({ status: "done", date: "2026-11-08" }, "2026-11-09")).toBe(false);
    expect(isOverdue({ status: "open", date: null }, "2026-11-09")).toBe(false);
  });
});
