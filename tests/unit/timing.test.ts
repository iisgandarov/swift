import { describe, expect, it } from "vitest";
import { Timing, addAiAttempts } from "@/lib/server/timing";
import { BENCH_CASES, checkBench, pct } from "@/lib/ai/bench";
import type { ParseContext, ParsedItem } from "@/lib/ai/schema";

describe("Server-Timing", () => {
  it("records stages and AI attempts and round-trips through the client parser", async () => {
    const t = new Timing();
    await t.time("auth", Promise.resolve(1));
    t.add("rate", 12.4);
    addAiAttempts(t, {
      attempts: [
        { model: "gemini-3.1-flash-lite", ms: 1800, ok: false, status: 429 },
        { model: "gemini-3.1-flash-lite", ms: 900, ok: true, status: 200, hedge: true },
      ],
    });
    expect(t.header()).toMatch(/^auth;dur=\d+, rate;dur=12, ai_1;dur=1800;desc="gemini-3.1-flash-lite 429", ai_2;dur=900;desc="gemini-3.1-flash-lite ok hedge", total;dur=\d+$/);
  });

  it("records the time even when the work fails, and ignores providers without attempts", async () => {
    const t = new Timing();
    await expect(t.time("ai", Promise.reject(new Error("x")))).rejects.toThrow("x");
    addAiAttempts(t, null);
    addAiAttempts(t, {});
    expect(t.stages.map((s) => s.name)).toEqual(["ai"]);
  });

  it("strips characters that would break the header", () => {
    const t = new Timing();
    t.add("ai", 5, 'bad "quote", comma');
    expect(t.header()).toContain('desc="bad quote comma"');
  });

});

describe("percentiles", () => {
  it("uses nearest rank", () => {
    const v = [5, 1, 9, 3, 7, 2, 8, 4, 10, 6];
    expect(pct(v, 50)).toBe(5);
    expect(pct(v, 90)).toBe(9);
    expect(pct([], 50)).toBeNull();
  });
});

describe("benchmark accuracy check", () => {
  const ctx = { localDate: "2026-11-09" } as ParseContext; // Monday
  const item = (o: Partial<ParsedItem>): ParsedItem => ({
    type: "task", title: "x", notes: null, date: null, start_time: null, end_time: null, duration_minutes: null, all_day: false,
    priority: "medium", category: null, confidence: 1, clarification: null, uncertain_fields: [], ...o,
  });
  const result = (items: ParsedItem[]) => ({ detected_language: "az" as const, items, clarification: null });

  it("accepts the expected answer for each sentence", () => {
    const [evening, two, bank, friday, thursday] = BENCH_CASES;
    expect(checkBench(evening, ctx, result([item({ type: "event", date: "2026-11-09", start_time: "20:30" })]))).toEqual([]);
    expect(
      checkBench(two, ctx, result([item({ type: "event", date: "2026-11-10", start_time: "10:00" }), item({ type: "task", date: "2026-11-13", priority: "high" })])),
    ).toEqual([]);
    expect(checkBench(bank, ctx, result([item({ date: "2026-11-10" })]))).toEqual([]);
    expect(checkBench(friday, ctx, result([item({ type: "event", date: "2026-11-20", start_time: "19:00" })]))).toEqual([]);
    expect(checkBench(thursday, ctx, result([item({ type: "event", date: "2026-11-12", start_time: "15:00" })]))).toEqual([]);
  });

  it("lists every mismatch", () => {
    expect(checkBench(BENCH_CASES[0], ctx, result([item({ type: "task", date: "2026-11-10" }), item({})]))).toEqual([
      "items 2≠1",
      "#1 type task≠event",
      "#1 date 2026-11-10≠2026-11-09",
      "#1 time null≠20:30",
    ]);
  });
});
