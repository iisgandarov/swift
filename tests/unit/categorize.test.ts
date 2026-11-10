import { describe, expect, it } from "vitest";
import { bucketFor, categoryNameFor } from "@/lib/domain/categorize";
import { draftFromParsed } from "@/lib/domain/drafts";
import { mockParse } from "@/lib/ai/mock";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/domain/types";
import type { ParseContext, ParsedItem } from "@/lib/ai/schema";

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `cat-${c.name_en}`, user_id: "u", sort_order: i }));
const names = categories.flatMap((c) => [c.name_az, c.name_en]);
const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00",
  weekday: "Monday", uiLocale: "az", categories: names, defaultEventMinutes: 60,
};

describe("category rules: own name → Meeting → Work → Personal", () => {
  it.each([
    ["Ramizlə görüş", "Görüş"],
    ["Anamla zəng", "Görüş"],
    ["Call with Aysel about the trip", "Görüş"],
    ["Power BI hesabatını bitir", "İş"],
    ["Ofisdə layihə təqdimatı", "İş"],
    ["Send the report to the client", "İş"],
    ["Dərman al", "Şəxsi"],
    ["Buy milk", "Şəxsi"],
    ["EduPo demo hazırla", "EduPo"],
    ["TLB üçün post yaz", "TLB Academy"],
  ])("%s → %s", (text, want) => {
    expect(categoryNameFor(text, names)).toBe(want);
  });

  it("a meeting about work is a Meeting; words inside other words don't count", () => {
    expect(bucketFor("Müştəri ilə görüş")).toBe("meeting");
    expect(bucketFor("Bişmiş yemək al")).toBe("personal"); // "iş" inside "bişmiş"
  });

  it("works with English-only names and when Personal was deleted", () => {
    expect(categoryNameFor("Dərman al", ["Work", "Meeting", "Personal"])).toBe("Personal");
    expect(categoryNameFor("Dərman al", ["İş", "Work", "Hobbi"])).toBe("Hobbi");
    expect(categoryNameFor("x", [])).toBeNull();
  });
});

describe("never empty", () => {
  const item = (o: Partial<ParsedItem>): ParsedItem => ({
    type: "task", title: "x", notes: null, date: null, start_time: null, end_time: null, duration_minutes: null, all_day: false,
    priority: "medium", category: null, confidence: 1, clarification: null, uncertain_fields: [], ...o,
  });
  const draft = (p: ParsedItem) => draftFromParsed(p, { categories, defaultEventMinutes: 60, today: "2026-11-09", key: "k" });

  it("the AI's choice wins; when the AI leaves it empty, the rules fill it", () => {
    expect(draft(item({ title: "Dərman al", category: "EduPo" })).categoryId).toBe("cat-EduPo");
    expect(draft(item({ title: "Layihə hesabatı", category: null })).categoryId).toBe("cat-Work");
    expect(draft(item({ title: "Dərman al", category: "Unknown" })).categoryId).toBe("cat-Personal");
  });

  it("the on-device draft always sets one", () => {
    const r = mockParse("Sabah saat 10-da Ramizlə görüş, bir də hesabatı bitir, sonra da çörək al", ctx);
    expect(r.items.map((i) => i.category)).toEqual(["Görüş", "İş", "Şəxsi"]);
  });

  it("the prompt says never null, with the order and examples", () => {
    const p = buildSystemPrompt(ctx);
    expect(p).toContain("ALWAYS exactly one of the user's category names, never null");
    expect(p).toContain('"Dərman al" → task "Dərman al", Şəxsi');
  });
});
