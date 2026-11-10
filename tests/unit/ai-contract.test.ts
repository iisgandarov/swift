/**
 * AI CONTRACT TESTS — keep them green on every change to the prompt, the schema, the repair
 * step or the item rules (CLAUDE.md). Each sentence gets a realistic, slightly messy Gemini
 * answer (format slips Gemini really makes); text and voice must both open the confirmation
 * sheet with a clean title, in ONE Gemini call, never "couldn't refine". When the AI fails
 * entirely, the on-device draft must still be usable.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { GeminiProvider, resetGeminiMemory } from "@/lib/ai/gemini";
import { parseAudioWithRetry, parseWithRetry } from "@/lib/ai/parse";
import { mockParse } from "@/lib/ai/mock";
import type { ParseContext } from "@/lib/ai/schema";
import { draftIsValid, draftsFromResult, type Draft } from "@/lib/domain/drafts";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/domain/types";

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: `cat-${c.name_en}`, user_id: "u", sort_order: i }));
const ctx: ParseContext = {
  now: "2026-11-10T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-10", localTime: "10:00", weekday: "Tuesday",
  uiLocale: "az", categories: categories.flatMap((c) => [c.name_az, c.name_en]), defaultEventMinutes: 60,
};
const draftOpts = { categories, defaultEventMinutes: 60, today: ctx.localDate };

/** No filler, no clock time, no date word at the edges, not empty. */
function expectCleanTitle(title: string) {
  expect(title.trim().length, title).toBeGreaterThan(0);
  expect(title, title).not.toMatch(/qeyd et|yadda saxla|yadıma sal|xatırlat|remind me|note that|olacaq|(?<!\p{L})saat(?!\p{L})|\d{1,2}[:.]\d{2}|\d{1,2}-?(da|də|de)(?!\p{L})/iu);
  expect(title, title).not.toMatch(/^(sabah|bu gün|tomorrow|today)(?!\p{L})|(?<!\p{L})(sabah|tomorrow|today)$/iu);
}

type Item = Record<string, unknown>;
const item = (o: Item): Item => ({
  type: "task", title: "x", notes: null, date: null, start_time: null, end_time: null, duration_minutes: null, all_day: false,
  priority: "medium", category: null, confidence: 0.9, clarification: null, uncertain_fields: [], ...o,
});

interface Case {
  say: string;
  /** what Gemini answers, slips included; `wrap` changes the envelope */
  answer: unknown[];
  wrap?: "fences" | "chatter" | "single" | "nolang";
  want: { title: string; type: "task" | "event"; date?: string; start?: string | null }[];
  /** what the on-device draft finds when it differs from the AI (a bare hour 1–6 is read as PM, flagged) */
  deviceStart?: string;
}

const CASES: Case[] = [
  { say: "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da",
    answer: [item({ type: "event", title: "Dostlarla görüş, qeyd et", date: "2026-11-10", start_time: "20:30:00", confidence: 90 })],
    want: [{ title: "Dostlarla görüş", type: "event", date: "2026-11-10", start: "20:30" }] },
  { say: "Saat 5-də dərman iç",
    answer: [item({ title: "Dərman iç", date: "2026-11-10", start_time: "17:00", duration_minutes: 0, uncertain_fields: ["start_time"] })],
    want: [{ title: "Dərman iç", type: "task", date: "2026-11-10", start: "17:00" }] },
  { say: "Ramizle görüş olacaq saat 7de",
    answer: [item({ type: "Event", title: "Ramizlə görüş saat 7-də", date: "2026-11-10T19:00", start_time: null })],
    want: [{ title: "Ramizlə görüş", type: "event", date: "2026-11-10", start: "19:00" }] },
  { say: "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir",
    answer: [
      item({ type: "event", title: "EduPo demo — Ramiz", date: "2026-11-11", start_time: "10:00", category: "EduPo" }),
      item({ title: "Power BI hesabatını bitir", date: "2026-11-13", priority: "High", notes: undefined }),
    ],
    want: [{ title: "EduPo demo — Ramiz", type: "event", start: "10:00" }, { title: "Power BI hesabatını bitir", type: "task", date: "2026-11-13" }] },
  { say: "Bu axşam saat 8-də ad günü üçün tort al, yadda saxla",
    answer: [item({ title: "Ad günü üçün tort al, yadda saxla", date: "2026-11-10", start_time: "8:00 PM" })],
    want: [{ title: "Ad günü tort al", type: "task", start: "20:00" }] },
  { say: "Sabah həkim qəbulu saat 11-də",
    answer: [item({ type: "event", title: "Sabah həkim qəbulu", date: "2026-11-11", start_time: "11", end_time: "12:00:00" })],
    wrap: "fences",
    want: [{ title: "Həkim qəbulu", type: "event", date: "2026-11-11", start: "11:00" }] },
  { say: "Cümə axşamı saat 3-də müştəri zəngi, yarım saatlıq",
    answer: [item({ type: "event", title: "Müştəri zəngi", date: "2026-11-12", start_time: "15.00", duration_minutes: "30" })],
    want: [{ title: "Müştəri zəngi", type: "event", date: "2026-11-12", start: "15:00" }] },
  { say: "TLB üçün post yaz birigün",
    answer: [item({ title: "TLB üçün post yaz", date: "12.11.2026", category: "TLB Academy" })],
    want: [{ title: "TLB post yaz", type: "task", date: "2026-11-12" }] },
  { say: "Gələn həftə bazar ertəsi layihə təqdimatı saat 14:00",
    answer: [item({ type: "event", title: "Layihə təqdimatı", date: "2026-11-16", start_time: "14:00", confidence: "0.8", all_day: "false" })],
    wrap: "chatter",
    want: [{ title: "Layihə təqdimatı", type: "event", date: "2026-11-16", start: "14:00" }] },
  { say: "Anama zəng et",
    answer: [item({ title: "Anama zəng et", category: null, uncertain_fields: ["start", "category_id"] })],
    want: [{ title: "Anama zəng et", type: "task", start: null }] },
  { say: "Çörək al",
    answer: [item({ title: "Çörək al" })],
    wrap: "single",
    want: [{ title: "Çörək al", type: "task", start: null }] },
  { say: "Sabah saat 9-da ingilis dili dərsi",
    answer: [item({ type: "event", title: "İngilis dili dərsi", date: "2026-11-11", start_time: "9:00", duration_minutes: 90 })],
    wrap: "nolang",
    want: [{ title: "İngilis dili dərsi", type: "event", date: "2026-11-11", start: "09:00" }] },
  { say: "Ofisdə hesabatı göndər tapşırıq kimi saat 16:30-da",
    answer: [item({ title: "Hesabatı göndər", date: "2026-11-10", start_time: "16:30", end_time: "17:30" })],
    want: [{ title: "Hesabatı göndər", type: "task", start: "16:30" }] },
  { say: "Remind me to call the bank tomorrow afternoon",
    answer: [item({ title: "Remind me to call the bank", date: "2026-11-11", notes: "afternoon" })],
    want: [{ title: "Call the bank", type: "task", date: "2026-11-11", start: null }] },
  { say: "Tomorrow 9am call with Aysel, 30 minutes",
    answer: [item({ type: "event", title: "Call with Aysel", date: "2026-11-11", start_time: "9am", duration_minutes: 30, confidence: 95 })],
    want: [{ title: "Call with Aysel", type: "event", start: "09:00" }] },
  { say: "Next Friday 7pm dinner with family",
    answer: [item({ type: "event", title: "Family dinner", date: "2026-11-20", start_time: "19:00:00", end_time: "", category: "Personal" })],
    want: [{ title: "Family dinner", type: "event", date: "2026-11-20", start: "19:00" }] },
  { say: "Send the report to the client by Friday",
    answer: [item({ title: "Send the report to the client by Friday", date: "2026-11-13", priority: "urgent" })],
    want: [{ title: "Send the report to the client by Friday", type: "task", date: "2026-11-13" }] },
  { say: "Buy milk and eggs today",
    answer: [item({ title: "Buy milk and eggs today", date: "2026-11-10", uncertain_fields: ["notes"] })],
    want: [{ title: "Buy milk and eggs", type: "task", date: "2026-11-10" }] },
  { say: "Flight to Istanbul on Saturday at 6:45",
    answer: [item({ type: "event", title: "Flight to Istanbul", date: "2026-11-14", start_time: "06:45 AM", duration_minutes: -5 })],
    want: [{ title: "Flight to Istanbul", type: "event", date: "2026-11-14", start: "06:45" }], deviceStart: "18:45" },
  { say: "Read 3 chapters of the book tonight",
    answer: [item({ title: "Read 3 chapters of the book", date: "2026-11-10", start_time: "25:00" })],
    want: [{ title: "Read 3 chapters of the book", type: "task", date: "2026-11-10", start: null }] },
  { say: "Webinar at 4pm about marketing",
    answer: [item({ type: "meeting", title: "Marketing webinar", date: "2026-11-10", start_time: "16:00", priority: "normal" })],
    want: [{ title: "Marketing webinar", type: "event", start: "16:00" }] },
  { say: "Dişçiyə get saat 12-də, vacibdir",
    answer: [item({ title: "Dişçiyə get", date: "not a date", start_time: "12:00", priority: "Yüksək" }), { title: "" }, "junk"],
    want: [{ title: "Dişçiyə get", type: "task", start: "12:00" }] },
];

/** Gemini's HTTP answer around the JSON, with the envelope slips. */
function geminiReply(c: Case, audio: boolean) {
  const body: Item = { detected_language: "az", clarification: null, items: c.answer };
  if (audio) body.transcript = c.say;
  if (c.wrap === "single") body.items = c.answer[0];
  if (c.wrap === "nolang") delete body.detected_language;
  let text = JSON.stringify(body);
  if (c.wrap === "fences") text = "```json\n" + text + "\n```";
  if (c.wrap === "chatter") text = `Here is the JSON:\n${text}\nHope this helps.`;
  return { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] };
}

function fakeGemini(c: Case, audio: boolean) {
  let calls = 0;
  const fetchImpl = (async () => {
    calls++;
    return new Response(JSON.stringify(geminiReply(c, audio)), { status: 200 });
  }) as unknown as typeof fetch;
  return { provider: new GeminiProvider("AIzaTEST", "gemini-3.1-flash-lite", fetchImpl, { hedgeAfterMs: null }), calls: () => calls };
}

function checkDrafts(drafts: Draft[], c: Case) {
  expect(drafts.length, c.say).toBe(c.want.length);
  c.want.forEach((w, i) => {
    const d = drafts[i];
    expect(d.title, c.say).toBe(w.title);
    expectCleanTitle(d.title);
    expect(d.type, c.say).toBe(w.type);
    if (w.date !== undefined) expect(d.date, c.say).toBe(w.date);
    if (w.start !== undefined) expect(d.start, c.say).toBe(w.start);
    expect(d.categoryId, `${c.say}: category never empty`).toBeTruthy();
  });
}

beforeEach(() => resetGeminiMemory());

describe("AI contract: messy Gemini answers still open the confirmation sheet", () => {
  it("has 20+ sentences", () => expect(CASES.length).toBeGreaterThanOrEqual(20));

  describe.each(CASES)("$say", (c) => {
    it("text: one Gemini call, repaired, clean title", async () => {
      const g = fakeGemini(c, false);
      const res = await parseWithRetry(g.provider, c.say, ctx);
      expect(g.calls()).toBe(1); // repaired, never re-asked
      checkDrafts(draftsFromResult(res, draftOpts), c);
    });

    it("voice: same answer with the transcript, same result", async () => {
      const g = fakeGemini(c, true);
      const res = await parseAudioWithRetry(g.provider, { base64: "UklGRg==", mimeType: "audio/wav" }, ctx);
      expect(g.calls()).toBe(1);
      expect(res.transcript).toBe(c.say);
      checkDrafts(draftsFromResult(res, draftOpts), c);
    });

    it("AI down: the on-device draft is usable — clean title, the found time kept", () => {
      const drafts = draftsFromResult(mockParse(c.say, ctx), draftOpts);
      expect(drafts.length, c.say).toBeGreaterThan(0);
      for (const d of drafts) {
        expectCleanTitle(d.title);
        expect(d.categoryId).toBeTruthy();
      }
      const firstStart = c.deviceStart ?? c.want[0].start;
      if (firstStart) expect(drafts[0].start, c.say).toBe(firstStart);
      expect(drafts.every((d) => draftIsValid(d) || d.uncertain.length > 0), c.say).toBe(true);
    });
  });
});

describe("AI contract: only a truly broken answer is re-asked, once", () => {
  it("cut-off JSON → one silent retry → success", async () => {
    let n = 0;
    const ok = geminiReply(CASES[1], false);
    const fetchImpl = (async () =>
      new Response(JSON.stringify(n++ === 0 ? { candidates: [{ content: { parts: [{ text: '{"items":[{"type":"task","tit' }] } }] } : ok), { status: 200 })) as unknown as typeof fetch;
    const res = await parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: null }), "x", ctx);
    expect(n).toBe(2);
    expect(res.items[0].title).toBe("Dərman iç");
  });

  it("a Google error → one silent retry (no duplicate request on the retry) → success", async () => {
    let n = 0;
    const ok = geminiReply(CASES[1], false);
    const fetchImpl = (async () =>
      n++ === 0 ? new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 503 }) : new Response(JSON.stringify(ok), { status: 200 })) as unknown as typeof fetch;
    await expect(parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl), "x", ctx)).resolves.toBeTruthy();
    expect(n).toBe(2);
  });
});
