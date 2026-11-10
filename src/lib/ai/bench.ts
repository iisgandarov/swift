import { addDays, startOfWeek, weekdayIndex } from "@/lib/dates";
import type { ParseContext, ParseResult } from "./schema";

/**
 * Fixed sentences with the answer we expect, used by /api/ai/test?runs=N to compare
 * models on speed AND accuracy. Expectations are computed from the request's real "today".
 */
export interface BenchCase {
  text: string;
  expect: (today: string) => {
    count: number;
    items: { type: "task" | "event"; date?: string; start_time?: string | null; priority?: "low" | "medium" | "high" }[];
  };
}

const nextWeekday = (today: string, target: number) => addDays(today, (target - weekdayIndex(today) + 7) % 7);

export const BENCH_CASES: BenchCase[] = [
  {
    text: "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da",
    expect: (today) => ({ count: 1, items: [{ type: "event", date: today, start_time: "20:30" }] }),
  },
  {
    text: "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir",
    expect: (today) => ({
      count: 2,
      items: [
        { type: "event", date: addDays(today, 1), start_time: "10:00" },
        { type: "task", start_time: null, priority: "high" },
      ],
    }),
  },
  {
    text: "Remind me to call the bank tomorrow afternoon",
    expect: (today) => ({ count: 1, items: [{ type: "task", date: addDays(today, 1), start_time: null }] }),
  },
  {
    text: "Next Friday 7pm dinner with family",
    expect: (today) => ({ count: 1, items: [{ type: "event", date: addDays(startOfWeek(today), 7 + 4), start_time: "19:00" }] }),
  },
  {
    text: "Cümə axşamı saat 3-də müştəri zəngi",
    expect: (today) => ({ count: 1, items: [{ type: "event", date: nextWeekday(today, 3), start_time: "15:00" }] }),
  },
];

/** Compares a parse result with the expectation; returns the mismatches (empty = correct). */
export function checkBench(c: BenchCase, ctx: ParseContext, result: ParseResult): string[] {
  const want = c.expect(ctx.localDate);
  const errors: string[] = [];
  if (result.items.length !== want.count) errors.push(`items ${result.items.length}≠${want.count}`);
  want.items.forEach((w, i) => {
    const got = result.items[i];
    if (!got) return;
    if (got.type !== w.type) errors.push(`#${i + 1} type ${got.type}≠${w.type}`);
    if (w.date !== undefined && got.date !== w.date) errors.push(`#${i + 1} date ${got.date}≠${w.date}`);
    if (w.start_time !== undefined && got.start_time !== w.start_time) errors.push(`#${i + 1} time ${got.start_time}≠${w.start_time}`);
    if (w.priority !== undefined && got.priority !== w.priority) errors.push(`#${i + 1} priority ${got.priority}≠${w.priority}`);
  });
  return errors;
}

/** Nearest-rank percentile. */
export function pct(values: number[], p: number) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length, Math.max(1, Math.ceil((p / 100) * s.length))) - 1];
}
