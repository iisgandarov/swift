import { describe, expect, it } from "vitest";
import {
  addDays, addMinutesToTime, diffDays, formatDayLabel, formatMonthYear, formatTime, formatTimeRange,
  greetingKey, localToUtcIso, monthGrid, startOfWeek, todayLocal, utcToLocal, weekDays, weekdayIndex, zonedParts,
} from "@/lib/dates";

describe("Asia/Baku conversions", () => {
  it("converts local Baku time to UTC (+04:00, no DST)", () => {
    expect(localToUtcIso("2026-11-10", "10:00")).toBe("2026-11-10T06:00:00.000Z");
    expect(localToUtcIso("2026-07-01", "02:30")).toBe("2026-06-30T22:30:00.000Z");
  });
  it("round-trips UTC back to local", () => {
    expect(utcToLocal("2026-11-10T06:00:00.000Z")).toEqual({ date: "2026-11-10", time: "10:00" });
  });
  it("computes 'today' in Baku, not UTC", () => {
    // 21:30 UTC on Nov 9 is already 01:30 on Nov 10 in Baku
    expect(todayLocal("Asia/Baku", new Date("2026-11-09T21:30:00Z"))).toBe("2026-11-10");
    expect(zonedParts("Asia/Baku", new Date("2026-11-09T21:30:00Z")).hour).toBe(1);
  });
});

describe("weeks start on Monday", () => {
  it("2026-11-09 is a Monday", () => expect(weekdayIndex("2026-11-09")).toBe(0));
  it("Sunday belongs to the week that started the previous Monday", () => {
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09");
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
  });
  it("weekDays returns Mon→Sun", () => {
    expect(weekDays("2026-11-12")).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
  });
  it("month grid starts on a Monday and has 42 days", () => {
    const g = monthGrid("2026-11-20");
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-10-26");
    expect(weekdayIndex(g[0])).toBe(0);
  });
});

describe("date math", () => {
  it("adds days across month/year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-13", "2026-11-09")).toBe(4);
  });
  it("adds minutes to a time with day overflow", () => {
    expect(addMinutesToTime("23:30", 60)).toEqual({ time: "00:30", dayOffset: 1 });
    expect(addMinutesToTime("10:00", 30)).toEqual({ time: "10:30", dayOffset: 0 });
  });
});

describe("labels", () => {
  it("formats day labels like the mockups", () => {
    expect(formatDayLabel("2026-11-09", "az")).toBe("9 Noy, B.E.");
    expect(formatDayLabel("2026-11-09", "en")).toBe("Mon, Nov 9");
    expect(formatMonthYear("2026-11-09", "az")).toBe("Noyabr 2026");
    expect(formatMonthYear("2025-02-04", "en")).toBe("February 2025");
  });
  it("uses 24h in az, 12/24h in en", () => {
    expect(formatTime("15:00", "az", "12h")).toBe("15:00");
    expect(formatTime("15:00", "en", "12h")).toBe("3:00 PM");
    expect(formatTime("00:05", "en", "12h")).toBe("12:05 AM");
    expect(formatTimeRange("11:00", "12:00", "en")).toBe("11:00 – 12:00");
  });
  it("greets by time of day", () => {
    expect(greetingKey(5)).toBe("morning");
    expect(greetingKey(11)).toBe("morning");
    expect(greetingKey(12)).toBe("afternoon");
    expect(greetingKey(18)).toBe("evening");
    expect(greetingKey(3)).toBe("evening");
  });
});
