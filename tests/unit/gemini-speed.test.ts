import { beforeEach, describe, expect, it } from "vitest";
import { GeminiProvider, resetGeminiMemory } from "@/lib/ai/gemini";
import { parseAudioWithRetry, parseWithRetry } from "@/lib/ai/parse";
import type { ParseContext } from "@/lib/ai/schema";

const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00",
  weekday: "Monday", uiLocale: "az", categories: ["İş", "Work"], defaultEventMinutes: 60,
};
const VALID = JSON.stringify({ detected_language: "az", items: [], clarification: null });
const ok = { status: 200, body: { candidates: [{ content: { parts: [{ text: VALID }] }, finishReason: "STOP" }] } };
const notFound = { status: 404, body: { error: { code: 404, message: "models/x is not found" } } };

type Reply = { status: number; body: unknown; delay?: number } | "hang";
/** Fake Gemini: each call gets a reply (optionally delayed); aborts are honoured like real fetch. */
function fake(route: (model: string, n: number, body: Record<string, unknown>) => Reply) {
  const calls: { model: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const model = decodeURIComponent(url.split("/models/")[1].split(":")[0]);
    const body = JSON.parse(String(init.body));
    calls.push({ model, body });
    const r = route(model, calls.length, body);
    return new Promise((resolve, reject) => {
      const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      if (init.signal?.aborted) return abort();
      init.signal?.addEventListener("abort", abort);
      if (r === "hang") return;
      setTimeout(() => resolve(new Response(JSON.stringify(r.body), { status: r.status })), r.delay ?? 0);
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const fast = { text: 40, audio: 40 };

beforeEach(() => resetGeminiMemory());

describe("remembering unavailable models", () => {
  it("walks the chain once, then later requests start at the model that works", async () => {
    const { fetchImpl, calls } = fake((m) => (m === "gemini-3.8-flash" ? notFound : ok));
    await parseWithRetry(new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl, { hedgeAfterMs: null }), "x", ctx);
    await parseWithRetry(new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl, { hedgeAfterMs: null }), "x", ctx);
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]);
  });

  it("still tries the configured model when every model was marked unavailable", async () => {
    const { fetchImpl } = fake(() => notFound);
    const only = () => new GeminiProvider("AIzaTEST", "gemini-x", fetchImpl, { fallback: false, hedgeAfterMs: null });
    await expect(parseWithRetry(only(), "x", ctx)).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(only().models).toEqual(["gemini-x"]);
    const g = only();
    await expect(parseWithRetry(g, "x", ctx)).rejects.toMatchObject({ code: "ai_not_configured" });
    expect(g.attempts[0].model).toBe("gemini-x");
  });
});

describe("hedged request", () => {
  it("sends one duplicate when the first call is slow and uses whichever answers first", async () => {
    const { fetchImpl, calls } = fake((_m, n) => (n === 1 ? "hang" : { ...ok, delay: 5 }));
    const g = new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: fast });
    const t0 = Date.now();
    await parseWithRetry(g, "x", ctx);
    expect(Date.now() - t0).toBeLessThan(1_000);
    expect(calls).toHaveLength(2);
    await new Promise((r) => setTimeout(r, 0)); // let the cancelled call record itself
    expect(g.attempts.find((a) => a.hedge)).toMatchObject({ ok: true });
    const cancelled = g.attempts.find((a) => a.cancelled);
    expect(cancelled?.ok).toBe(false);
    expect(cancelled?.hedge).toBeUndefined(); // the slow first call was the one stopped
  });

  it("sends no duplicate when the answer comes quickly", async () => {
    const { fetchImpl, calls } = fake(() => ok);
    await parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: fast }), "x", ctx);
    expect(calls).toHaveLength(1);
  });

  it("if the duplicate fails, the first call can still win", async () => {
    const { fetchImpl } = fake((_m, n) => (n === 1 ? { ...ok, delay: 120 } : { status: 500, body: { error: { message: "boom" } } }));
    const g = new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: fast });
    await expect(parseWithRetry(g, "x", ctx)).resolves.toMatchObject({ items: [] });
  });

  it("spends at most 4 duplicates per minute (free-tier requests/minute)", async () => {
    const { fetchImpl, calls } = fake(() => ({ ...ok, delay: 70 }));
    for (let i = 0; i < 6; i++) await parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: fast }), "x", ctx);
    expect(calls).toHaveLength(6 + 4);
  });
});

describe("request shape and retry", () => {
  it("caps the answer size: 1500 tokens for text, 2500 for audio", async () => {
    const { fetchImpl, calls } = fake(() => ok);
    await parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl), "x", ctx);
    const audioOk = { status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: "", detected_language: "az", items: [], clarification: null }) }] } }] } };
    const a = fake(() => audioOk);
    await parseAudioWithRetry(new GeminiProvider("AIzaTEST", undefined, a.fetchImpl), { base64: "AAAA", mimeType: "audio/wav" }, ctx);
    expect((calls[0].body.generationConfig as Record<string, unknown>).maxOutputTokens).toBe(1500);
    expect((a.calls[0].body.generationConfig as Record<string, unknown>).maxOutputTokens).toBe(2500);
  });

  it("retries straight away, without a fixed pause", async () => {
    const { fetchImpl, calls } = fake((_m, n) => (n === 1 ? { status: 503, body: { error: { message: "overloaded" } } } : ok));
    const t0 = Date.now();
    await parseWithRetry(new GeminiProvider("AIzaTEST", undefined, fetchImpl, { hedgeAfterMs: null }), "x", ctx);
    expect(calls).toHaveLength(2);
    expect(Date.now() - t0).toBeLessThan(200);
  });
});
