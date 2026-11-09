import { describe, expect, it } from "vitest";
import { GeminiProvider } from "@/lib/ai/gemini";
import { AiParseError, parseAudioWithRetry, parseWithRetry } from "@/lib/ai/parse";
import { AiProviderError, type ParseContext, type ParsedItem } from "@/lib/ai/schema";
import { applyManualChoices, draftsFromResult, draftToInput } from "@/lib/domain/drafts";
import { buildNewItem } from "@/lib/domain/rules";
import { itemInputSchema } from "@/lib/domain/schemas";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/domain/types";

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  ...c, id: `c0000000-0000-4000-8000-00000000000${i + 1}`, user_id: "u", sort_order: i,
}));
const catId = (en: string) => categories.find((c) => c.name_en === en)!.id;
const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00",
  weekday: "Monday", uiLocale: "az", categories: categories.flatMap((c) => [c.name_az, c.name_en]), defaultEventMinutes: 60,
};
const noSleep = async () => {};
const rules = { timezone: "Asia/Baku", defaultEventMinutes: 60 };

const item = (o: Partial<ParsedItem> & Pick<ParsedItem, "type" | "title">): ParsedItem => ({
  notes: null, date: null, start_time: null, end_time: null, duration_minutes: null, all_day: false,
  priority: "medium", category: null, confidence: 0.9, clarification: null, uncertain_fields: [], ...o,
});

/** A fetch stand-in that records requests and replays canned Gemini responses. */
function fakeGemini(replies: Array<{ status?: number; json?: unknown; text?: string; throws?: boolean }>) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (r.throws) throw new TypeError("fetch failed");
    const json = r.json ?? { candidates: [{ content: { parts: [{ text: r.text ?? "" }] }, finishReason: "STOP" }] };
    return new Response(JSON.stringify(json), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { provider: new GeminiProvider("AIza-test-key", "gemini-test-flash", fetchImpl), calls };
}
const ok = (obj: unknown) => ({ text: JSON.stringify(obj) });

const toItems = (res: Awaited<ReturnType<typeof parseWithRetry>>, text: string) =>
  draftsFromResult(res, { categories, defaultEventMinutes: 60, today: "2026-11-09" }).map((d) =>
    buildNewItem(itemInputSchema.parse(draftToInput(d, { source: "text", transcript: text, language: "az" })), rules),
  );

describe("Gemini request", () => {
  it("text: key only in the header, JSON schema output, full rules in the system prompt", async () => {
    const { provider, calls } = fakeGemini([ok({ detected_language: "az", items: [], clarification: null })]);
    await parseWithRetry(provider, "salam", ctx, noSleep);
    const c = calls[0];
    expect(c.url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-test-flash:generateContent");
    expect(c.url).not.toContain("AIza");
    expect(c.headers["x-goog-api-key"]).toBe("AIza-test-key");
    const gen = c.body.generationConfig as Record<string, unknown>;
    expect(gen.responseMimeType).toBe("application/json");
    expect(gen.responseJsonSchema).toMatchObject({ type: "object", required: expect.arrayContaining(["items"]) });
    const system = JSON.stringify(c.body.systemInstruction);
    expect(system).toContain("2026-11-13 Friday");
    expect(system).toContain("20.30da");
    expect(system).toContain("onu qeyd et");
    expect(system).toContain("8 tamamda");
  });

  it("audio: inline WAV data and a schema that requires the transcript", async () => {
    const { provider, calls } = fakeGemini([ok({ transcript: "salam", detected_language: "az", items: [], clarification: null })]);
    const res = await parseAudioWithRetry(provider, { base64: "UklGRg==", mimeType: "audio/wav" }, ctx, "az", noSleep);
    expect(res.transcript).toBe("salam");
    const parts = (calls[0].body.contents as { parts: Record<string, unknown>[] }[])[0].parts;
    expect(parts.find((p) => "inlineData" in p)).toEqual({ inlineData: { mimeType: "audio/wav", data: "UklGRg==" } });
    const schema = (calls[0].body.generationConfig as { responseJsonSchema: { required: string[] } }).responseJsonSchema;
    expect(schema.required).toContain("transcript");
    expect(JSON.stringify(calls[0].body.systemInstruction)).toContain("Azerbaijani");
  });

  it("refuses to start without a key", () => {
    expect(() => new GeminiProvider("", "m")).toThrow(AiProviderError);
  });
});

describe("example sentences (mocked Gemini answers)", () => {
  it("'Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da' → one event today 20:30–21:30", async () => {
    const text = "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da";
    const { provider } = fakeGemini([
      ok({ detected_language: "az", clarification: null, items: [item({ type: "event", title: "Dostlarla görüş", date: "2026-11-09", start_time: "20:30", category: "Görüş" })] }),
    ]);
    const [ev, ...rest] = toItems(await parseWithRetry(provider, text, ctx, noSleep), text);
    expect(rest).toHaveLength(0);
    expect(ev).toMatchObject({ type: "event", title: "Dostlarla görüş", date: "2026-11-09", category_id: catId("Meeting") });
    expect(ev.start_at).toBe("2026-11-09T16:30:00.000Z"); // 20:30 Baku
    expect(ev.end_at).toBe("2026-11-09T17:30:00.000Z"); // + default 60 min
  });

  it("'Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir' → event + high task", async () => {
    const text = "Sabah saat 10-da Ramizlə EduPo demo görüşü, bir də cümə gününə qədər Power BI hesabatını bitir, təcilidir";
    const { provider } = fakeGemini([
      ok({
        detected_language: "az", clarification: null,
        items: [
          item({ type: "event", title: "EduPo demo — Ramiz", date: "2026-11-10", start_time: "10:00", category: "EduPo" }),
          item({ type: "task", title: "Power BI hesabatını bitir", date: "2026-11-13", priority: "high" }),
        ],
      }),
    ]);
    const [ev, task] = toItems(await parseWithRetry(provider, text, ctx, noSleep), text);
    expect(ev).toMatchObject({ type: "event", date: "2026-11-10", start_at: "2026-11-10T06:00:00.000Z", end_at: "2026-11-10T07:00:00.000Z", category_id: catId("EduPo") });
    expect(task).toMatchObject({ type: "task", title: "Power BI hesabatını bitir", date: "2026-11-13", priority: "high", start_at: null });
  });
});

describe("failures: retry once, then a clear error code", () => {
  const valid = ok({ detected_language: "az", items: [], clarification: null });
  it("network error then success", async () => {
    const { provider, calls } = fakeGemini([{ throws: true }, valid]);
    await expect(parseWithRetry(provider, "x", ctx, noSleep)).resolves.toBeTruthy();
    expect(calls).toHaveLength(2);
  });
  it("server error then success", async () => {
    const { provider, calls } = fakeGemini([{ status: 503, json: { error: { message: "overloaded" } } }, valid]);
    await expect(parseWithRetry(provider, "x", ctx, noSleep)).resolves.toBeTruthy();
    expect(calls).toHaveLength(2);
  });
  it("quota twice → ai_quota", async () => {
    const quota = { status: 429, json: { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "quota" } } };
    const { provider, calls } = fakeGemini([quota, quota]);
    await expect(parseWithRetry(provider, "x", ctx, noSleep)).rejects.toMatchObject({ code: "ai_quota" });
    expect(calls).toHaveLength(2);
  });
  it("invalid JSON then valid, the retry tells the model what went wrong", async () => {
    const { provider, calls } = fakeGemini([{ text: "{not json" }, valid]);
    await expect(parseWithRetry(provider, "x", ctx, noSleep)).resolves.toBeTruthy();
    expect(JSON.stringify(calls[1].body.systemInstruction)).toContain("not valid JSON");
  });
  it("invalid JSON twice → ai_parse_failed", async () => {
    const { provider } = fakeGemini([{ text: "nope" }, { text: "still nope" }]);
    const err = await parseWithRetry(provider, "x", ctx, noSleep).catch((e) => e);
    expect(err).toBeInstanceOf(AiParseError);
    expect(err.code).toBe("ai_parse_failed");
  });
  it("a rejected key is not retried", async () => {
    const { provider, calls } = fakeGemini([{ status: 400, json: { error: { message: "API key not valid" } } }]);
    await expect(parseWithRetry(provider, "x", ctx, noSleep)).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(calls).toHaveLength(1);
  });
});

describe("manual choices win over the AI", () => {
  const [d] = draftsFromResult(
    { items: [item({ type: "event", title: "Görüş", date: "2026-11-10", start_time: "10:00", category: "EduPo", uncertain_fields: ["date"] })] },
    { categories, defaultEventMinutes: 60, today: "2026-11-09" },
  );
  const base = { date: null, start: null, end: null, type: "task" as const, categoryId: null, priority: "medium" as const, notes: "" };
  it("only touched fields are overridden", () => {
    const out = applyManualChoices(d, { ...base, touched: new Set(["date", "priority"] as const), date: "2026-11-12", priority: "high" });
    expect(out).toMatchObject({ date: "2026-11-12", priority: "high", start: "10:00", type: "event", categoryId: catId("EduPo") });
    expect(out.uncertain).not.toContain("date");
  });
  it("clearing the time by hand makes it a task", () => {
    const out = applyManualChoices(d, { ...base, touched: new Set(["time"] as const) });
    expect(out).toMatchObject({ type: "task", start: null, end: null });
  });
  it("a manual time makes it an event at that time", () => {
    const out = applyManualChoices({ ...d, type: "task", start: null, end: null }, { ...base, touched: new Set(["time"] as const), start: "18:00", end: "19:00", date: "2026-11-11" });
    expect(out).toMatchObject({ type: "event", start: "18:00", end: "19:00", date: "2026-11-10" });
  });
});
