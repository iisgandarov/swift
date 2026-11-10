import { describe, expect, it } from "vitest";
import { parseWithRetry, AiParseError } from "@/lib/ai/parse";
import type { AiProvider, ParseContext, ParsedItem } from "@/lib/ai/schema";
import { draftsFromResult, draftToInput, matchCategory } from "@/lib/domain/drafts";
import { buildNewItem } from "@/lib/domain/rules";
import { itemInputSchema } from "@/lib/domain/schemas";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/domain/types";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { mockParse } from "@/lib/ai/mock";

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  ...c, id: `c0000000-0000-4000-8000-00000000000${i + 1}`, user_id: "u", sort_order: i,
}));
const catId = (en: string) => categories.find((c) => c.name_en === en)!.id;
const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00",
  weekday: "Monday", uiLocale: "az", categories: categories.flatMap((c) => [c.name_az, c.name_en]), defaultEventMinutes: 60,
};
const opts = { categories, defaultEventMinutes: 60, today: "2026-11-09" };
const rules = { timezone: "Asia/Baku", defaultEventMinutes: 60 };

const base: Omit<ParsedItem, "type" | "title"> = {
  notes: null, date: null, start_time: null, end_time: null, duration_minutes: null, all_day: false,
  priority: "medium", category: null, confidence: 0.9, clarification: null, uncertain_fields: [],
};
const p = (o: Partial<ParsedItem> & Pick<ParsedItem, "type" | "title">): ParsedItem => ({ ...base, ...o });

/** What a well-behaved model returns for the brief's few-shot examples. */
const FEW_SHOT: Record<string, { detected_language: "az" | "en"; items: ParsedItem[] }> = {
  "Sabah saat 10-da Ramizlə EduPo demo görüşü": {
    detected_language: "az",
    items: [p({ type: "event", title: "EduPo demo — Ramiz", date: "2026-11-10", start_time: "10:00", category: "EduPo" })],
  },
  "Cümə gününə qədər Power BI hesabatını bitirməliyəm, təcilidir": {
    detected_language: "az",
    items: [p({ type: "task", title: "Power BI hesabatını bitir", date: "2026-11-13", priority: "high" })],
  },
  "Remind me to call the bank tomorrow afternoon": {
    detected_language: "en",
    items: [p({ type: "task", title: "Call the bank", date: "2026-11-10", notes: "afternoon" })],
  },
  "Çərşənbə axşamı 3-də müştəri zəngi, yarım saatlıq, sonra da TLB üçün post yazmaq": {
    detected_language: "az",
    items: [
      p({ type: "event", title: "Müştəri zəngi", date: "2026-11-10", start_time: "15:00", end_time: "15:30", duration_minutes: 30 }),
      p({ type: "task", title: "TLB postunu yaz", date: "2026-11-10", category: "TLB Academy" }),
    ],
  },
  "Next Friday 7pm dinner with family": {
    detected_language: "en",
    items: [p({ type: "event", title: "Family dinner", date: "2026-11-20", start_time: "19:00", category: "Personal" })],
  },
};

function fakeProvider(responses: string[]): AiProvider & { calls: number } {
  return {
    name: "fake",
    calls: 0,
    async parseAudio() {
      return responses[this.calls++] ?? "";
    },
    async parseItems() {
      return responses[this.calls++] ?? "";
    },
  };
}

async function runExample(text: string) {
  const provider = fakeProvider([JSON.stringify({ ...FEW_SHOT[text], clarification: null })]);
  const result = await parseWithRetry(provider, text, ctx);
  const drafts = draftsFromResult(result, opts);
  return drafts.map((d) => buildNewItem(itemInputSchema.parse(draftToInput(d, { source: "voice", transcript: text, language: result.detected_language })), rules));
}

describe("few-shot examples → stored items", () => {
  it("1: event tomorrow 10:00–11:00, EduPo", async () => {
    const [i] = await runExample("Sabah saat 10-da Ramizlə EduPo demo görüşü");
    expect(i).toMatchObject({ type: "event", title: "EduPo demo — Ramiz", date: "2026-11-10", category_id: catId("EduPo") });
    expect(i.start_at).toBe("2026-11-10T06:00:00.000Z");
    expect(i.end_at).toBe("2026-11-10T07:00:00.000Z");
    expect(i.raw_transcript).toBe("Sabah saat 10-da Ramizlə EduPo demo görüşü");
    expect(i.source).toBe("voice");
  });
  it("2: high-priority task due Friday", async () => {
    const [i] = await runExample("Cümə gününə qədər Power BI hesabatını bitirməliyəm, təcilidir");
    expect(i).toMatchObject({ type: "task", date: "2026-11-13", priority: "high", start_at: null });
  });
  it("3: vague time of day stays a task, detail in notes", async () => {
    const [i] = await runExample("Remind me to call the bank tomorrow afternoon");
    expect(i).toMatchObject({ type: "task", title: "Call the bank", date: "2026-11-10", notes: "afternoon", language: "en" });
  });
  it("4: two items from one utterance", async () => {
    const items = await runExample("Çərşənbə axşamı 3-də müştəri zəngi, yarım saatlıq, sonra da TLB üçün post yazmaq");
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ type: "event", start_at: "2026-11-10T11:00:00.000Z", end_at: "2026-11-10T11:30:00.000Z" });
    expect(items[1]).toMatchObject({ type: "task", date: "2026-11-10", category_id: catId("TLB Academy") });
  });
  it("5: next Friday = Friday of next week; English category name matches", async () => {
    const [i] = await runExample("Next Friday 7pm dinner with family");
    expect(i).toMatchObject({ type: "event", date: "2026-11-20", category_id: catId("Personal") });
    expect(i.start_at).toBe("2026-11-20T15:00:00.000Z");
  });
});

describe("parseWithRetry", () => {
  const valid = JSON.stringify({ detected_language: "az", items: [], clarification: "?" });
  it("retries once on invalid JSON", async () => {
    const prov = fakeProvider(["not json", valid]);
    await expect(parseWithRetry(prov, "x", ctx)).resolves.toMatchObject({ items: [] });
    expect(prov.calls).toBe(2);
  });
  it("retries on JSON that doesn't match the schema", async () => {
    const prov = fakeProvider([JSON.stringify({ items: [{ title: "x" }] }), valid]);
    await expect(parseWithRetry(prov, "x", ctx)).resolves.toBeTruthy();
  });
  it("gives up after the retry", async () => {
    const prov = fakeProvider(["{", "{"]);
    await expect(parseWithRetry(prov, "x", ctx)).rejects.toBeInstanceOf(AiParseError);
    expect(prov.calls).toBe(2);
  });
});

describe("draft mapping rules", () => {
  it("a clock time makes it an event even if the model said task", () => {
    const [d] = draftsFromResult({ items: [p({ type: "task", title: "X", date: "2026-11-10", start_time: "09:00" })] }, opts);
    expect(d.type).toBe("event");
    expect(d.end).toBe("10:00");
  });
  it("an event without a time falls back to task and flags it", () => {
    const [d] = draftsFromResult({ items: [p({ type: "event", title: "X", date: "2026-11-10" })] }, opts);
    expect(d.type).toBe("task");
    expect(d.uncertain).toEqual(expect.arrayContaining(["time", "type"]));
  });
  it("an event without a date gets today and is flagged", () => {
    const [d] = draftsFromResult({ items: [p({ type: "event", title: "X", start_time: "18:00", duration_minutes: 45 })] }, opts);
    expect(d.date).toBe("2026-11-09");
    expect(d.end).toBe("18:45");
    expect(d.uncertain).toContain("date");
  });
  it("matches categories in either language, case-insensitively", () => {
    expect(matchCategory("şəxsi", categories)).toBe(catId("Personal"));
    expect(matchCategory("work", categories)).toBe(catId("Work"));
    expect(matchCategory("TLB", categories)).toBe(catId("TLB Academy"));
    expect(matchCategory("Unknown", categories)).toBeNull();
  });
});

describe("prompt", () => {
  it("includes context, the next-weekday convention and all few-shot examples", () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain("2026-11-09 10:00 (Monday), timezone Asia/Baku");
    expect(prompt).toContain('"next Friday" = 2026-11-20');
    for (const text of Object.keys(FEW_SHOT)) expect(prompt).toContain(text);
  });
  it("tells the model what to do with a time already past today", () => {
    expect(buildSystemPrompt(ctx)).toContain('at 17:20 "saat 7" = 19:00 today');
  });
});

describe("offline mock parser (demo mode)", () => {
  describe("a time already past today (no day given)", () => {
    const at = (localTime: string) => ({ ...ctx, localTime });
    it('"saat 7de" at 17:20 → 19:00 today, flagged, clean title', () => {
      const [i] = mockParse("Ramizle görüş olacaq saat 7de", at("17:20")).items;
      expect(i).toMatchObject({ type: "event", title: "Ramizle görüş", date: "2026-11-09", start_time: "19:00" });
      expect(i.uncertain_fields).toContain("time");
    });
    it("a bare morning hour after its evening has passed too → tomorrow morning", () => {
      expect(mockParse("saat 7de görüş", at("21:00")).items[0]).toMatchObject({ date: "2026-11-10", start_time: "07:00" });
    });
    it("a time still ahead stays today and is not flagged", () => {
      const [i] = mockParse("saat 7de görüş", at("06:00")).items;
      expect(i).toMatchObject({ date: "2026-11-09", start_time: "07:00" });
      expect(i.uncertain_fields).not.toContain("time");
    });
    it("an explicit 24-hour time already past → tomorrow", () => {
      expect(mockParse("saat 15:00-da zəng", at("17:20")).items[0]).toMatchObject({ date: "2026-11-10", start_time: "15:00" });
    });
    it("a named day is kept as said", () => {
      expect(mockParse("sabah saat 7de görüş", at("17:20")).items[0]).toMatchObject({ date: "2026-11-10", start_time: "07:00" });
    });
  });

  it("handles the sample sentence with two items", () => {
    const r = mockParse("Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də TLB üçün post yazmaq", ctx);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ type: "event", date: "2026-11-10", start_time: "10:00", category: "EduPo" });
    expect(r.items[1]).toMatchObject({ type: "task", category: "TLB Academy" });
  });
  it("bare afternoon hours become PM and are flagged", () => {
    const [i] = mockParse("çərşənbə axşamı 3-də müştəri zəngi", ctx).items;
    expect(i).toMatchObject({ date: "2026-11-10", start_time: "15:00" });
    expect(i.uncertain_fields).toContain("time");
  });
});
