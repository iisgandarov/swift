import { describe, expect, it } from "vitest";
import { parseServerTiming, percentile, summarize, type PerfEntry } from "@/lib/client/perf";
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
    const header = t.header();
    expect(header).toMatch(/^auth;dur=\d+, rate;dur=12, ai_1;dur=1800;desc="gemini-3.1-flash-lite 429", ai_2;dur=900;desc="gemini-3.1-flash-lite ok hedge", total;dur=\d+$/);
    const parsed = parseServerTiming(header);
    expect(parsed.stages.rate).toBe(12);
    expect(parsed.stages.ai_2).toBe(900);
    expect(parsed.models).toEqual(["gemini-3.1-flash-lite 429", "gemini-3.1-flash-lite ok hedge"]);
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

  it("parses missing or malformed headers safely", () => {
    expect(parseServerTiming(null)).toEqual({ stages: {}, models: [] });
    expect(parseServerTiming("x;foo, ;dur=3")).toEqual({ stages: {}, models: [] });
  });
});

describe("percentiles", () => {
  it("uses nearest rank", () => {
    const v = [5, 1, 9, 3, 7, 2, 8, 4, 10, 6];
    expect(percentile(v, 50)).toBe(5);
    expect(percentile(v, 90)).toBe(9);
    expect(percentile([], 50)).toBe(0);
    expect(pct(v, 90)).toBe(9);
    expect(pct([], 50)).toBeNull();
  });

  it("summarizes successful entries per kind, with the user's wait first", () => {
    const e = (kind: PerfEntry["kind"], totalMs: number, ok = true): PerfEntry => ({ kind, at: 0, ok, totalMs, stages: { ai: totalMs - 100 } });
    const s = summarize([e("text", 2000), e("text", 3000), e("text", 9000, false), e("voice", 4000)], "text");
    expect(s.count).toBe(2);
    expect(s.rows[0]).toEqual({ stage: "wait", p50: 2000, p90: 3000, n: 2 });
    expect(s.rows[1]).toEqual({ stage: "ai", p50: 1900, p90: 2900, n: 2 });
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
