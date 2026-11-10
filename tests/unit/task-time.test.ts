import { describe, expect, it } from "vitest";
import { mockParse } from "@/lib/ai/mock";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import type { ParseContext } from "@/lib/ai/schema";

const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00", weekday: "Monday",
  uiLocale: "az", categories: ["İş", "Work", "Görüş", "Meeting", "Şəxsi", "Personal"], defaultEventMinutes: 60,
};
const one = (text: string, c: ParseContext = ctx) => mockParse(text, c).items[0];

describe("type: chosen → explicit word → meeting/call/with someone → task (a time alone is not an event)", () => {
  it("a time alone keeps it a task, with the time", () => {
    expect(one("sabah saat 17:00-da dərman iç")).toMatchObject({ type: "task", start_time: "17:00", date: "2026-11-10" });
  });
  it("meeting, call/zəng and plans with a person are events", () => {
    expect(one("sabah saat 10-da Ramizlə görüş").type).toBe("event");
    expect(one("sabah saat 3-də anamla zəng").type).toBe("event");
    expect(one("sabah axşam 7-də ailə ilə şam yeməyi").type).toBe("event");
    expect(one("tomorrow at 7pm dinner with family").type).toBe("event");
  });
  it.each([
    "sabah saat 11-də həkim qəbulu",
    "sabah saat 11-də dentist appointment",
    "sabah saat 6-da ingilis dili dərsi",
    "sabah saat 6-da kursa get",
    "tomorrow at 6pm yoga class",
    "tomorrow at 9am piano lesson",
    "sabah saat 9-da İstanbula uçuş",
    "tomorrow at 7am flight to Baku",
    "sabah saat 2-də müsahibə",
    "tomorrow at 3pm job interview",
    "sabah saat 4-də vebinar",
    "tomorrow at 4pm marketing webinar",
    "sabah saat 8-də konsert",
    "tomorrow at 8pm jazz concert",
    "sabah saat 10-da təlim",
    "tomorrow at 10am sales training",
    "sabah saat 7-də toya get",
    "sabah saat 7-də ad günü",
    "tomorrow at 8pm birthday party",
  ])("appointment / fixed-time activity is an event: %s", (text) => {
    expect(one(text).type).toBe("event");
  });
  it("an activity word inside another word doesn't count", () => {
    expect(one("sabah saat 5-də kursoru düzəlt").type).toBe("task"); // kursor ≠ kurs
    expect(one("sabah saat 5-də toyuq al").type).toBe("task"); // toyuq ≠ toy
    expect(one("sabah saat 5-də dərslik al").type).toBe("task"); // dərslik ≠ dərs
  });
  it("explicit words win and are dropped from the title", () => {
    expect(one("sabah saat 10-da görüş, tapşırıq kimi")).toMatchObject({ type: "task", start_time: "10:00" });
    const ev = one("sabah saat 4-də tədbir: kitab oxu");
    expect(ev).toMatchObject({ type: "event", start_time: "16:00" });
    expect(ev.title.toLowerCase()).not.toContain("tədbir");
  });
  it("the user's choice wins over everything", () => {
    expect(one("sabah saat 10-da Ramizlə görüş", { ...ctx, preferredType: "task" })).toMatchObject({ type: "task", start_time: "10:00" });
    expect(one("sabah saat 5-də dərman iç", { ...ctx, preferredType: "event" }).type).toBe("event");
  });
});

describe("prompt", () => {
  it("states the type order, that tasks keep their time, and the user's choice", () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain("A clock time alone does NOT make an event");
    expect(p).toContain('"Saat 5-də dərman iç" → task "Dərman iç", 17:00 (task WITH a time)');
    expect(p).not.toContain("The user CHOSE");
    for (const w of ["qəbul", "həkim", "dərs", "kurs", "lesson", "uçuş", "flight", "müsahibə", "interview", "vebinar", "webinar", "konsert", "concert", "təlim", "training", "toy", "ad günü", "party"]) expect(p).toContain(w);
    expect(p).toContain('"Sabah saat 11-də həkim qəbulu" → event');
    expect(buildSystemPrompt({ ...ctx, preferredType: "event" })).toContain('The user CHOSE the type EVENT: return every item as type "event".');
  });
});
