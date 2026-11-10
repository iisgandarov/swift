import { beforeEach, describe, expect, it } from "vitest";
import { GeminiProvider, normalizeAudioMime, resetGeminiMemory, thinkingFor } from "@/lib/ai/gemini";
import { parseAudioWithRetry, parseWithRetry } from "@/lib/ai/parse";
import type { ParseContext } from "@/lib/ai/schema";

const ctx: ParseContext = {
  now: "2026-11-09T06:00:00.000Z", timezone: "Asia/Baku", localDate: "2026-11-09", localTime: "10:00",
  weekday: "Monday", uiLocale: "az", categories: ["İş", "Work"], defaultEventMinutes: 60,
};
const noSleep = async () => {};
const VALID = JSON.stringify({ detected_language: "az", items: [], clarification: null });
const okBody = { candidates: [{ content: { parts: [{ text: VALID }] }, finishReason: "STOP" }] };

type Reply = { status: number; body: unknown } | "hang";
function fake(route: (model: string, body: Record<string, unknown>, n: number) => Reply) {
  const calls: { model: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const model = decodeURIComponent(url.split("/models/")[1].split(":")[0]);
    const body = JSON.parse(String(init.body));
    calls.push({ model, body });
    const r = route(model, body, calls.length);
    if (r === "hang") {
      return new Promise((_res, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("timeout"), { name: "TimeoutError" }))));
    }
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}
const err = (status: number, message: string) => ({ status, body: { error: { code: status, message } } });

// what one request learns (unavailable models, hedges used) is shared on a warm instance
beforeEach(() => resetGeminiMemory());

describe("model fallback: GEMINI_MODEL → gemini-3.1-flash-lite → gemini-2.5-flash-lite → gemini-flash-latest → gemini-2.5-flash", () => {
  it("falls back when the configured model does not exist (404) and reports which model answered", async () => {
    const { fetchImpl, calls } = fake((m) => (m === "gemini-3.8-flash" ? err(404, "models/gemini-3.8-flash is not found for API version v1beta") : { status: 200, body: okBody }));
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.1-flash-lite"]);
    expect(g.modelUsed).toBe("gemini-3.1-flash-lite");
    expect(g.attempts[0]).toMatchObject({ model: "gemini-3.8-flash", status: 404, ok: false, error: expect.stringContaining("not found") });
  });

  it("falls back when the model has no free-tier quota (429 limit: 0)", async () => {
    const { fetchImpl, calls } = fake((m) =>
      m === "gemini-2.5-flash" ? { status: 200, body: okBody } : err(429, "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: x"),
    );
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"]);
    expect(g.modelUsed).toBe("gemini-2.5-flash");
  });

  it("a real rate limit (not limit: 0) is not treated as a missing model", async () => {
    const { fetchImpl, calls } = fake(() => err(429, "Resource has been exhausted (e.g. check quota)."));
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await expect(parseWithRetry(g, "x", ctx, noSleep)).rejects.toMatchObject({ code: "ai_quota" });
    expect(calls.every((c) => c.model === "gemini-3.8-flash")).toBe(true);
  });

  it("the retry stays on the model that already answered", async () => {
    let n = 0;
    const { fetchImpl, calls } = fake((m) => {
      if (m === "gemini-3.8-flash") return err(404, "not found");
      n++;
      return n === 1 ? { status: 200, body: { candidates: [{ content: { parts: [{ text: "{bad" }] } }] } } : { status: 200, body: okBody };
    });
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-3.1-flash-lite"]);
  });
});

describe("default model", () => {
  it("is gemini-3.1-flash-lite with minimal thinking, and the chain is de-duplicated", async () => {
    const { fetchImpl, calls } = fake(() => ({ status: 200, body: okBody }));
    const g = new GeminiProvider("AIzaTEST", undefined, fetchImpl);
    expect(g.models).toEqual(["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"]);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect(calls[0].model).toBe("gemini-3.1-flash-lite");
    expect((calls[0].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingLevel: "minimal" });
  });
});

describe("thinking: lowest level the model allows", () => {
  it("per model family", () => {
    expect(thinkingFor("gemini-3.1-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingFor("gemini-3.8-flash")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingFor("gemini-flash-latest")).toEqual({ thinkingLevel: "minimal" });
    expect(thinkingFor("gemini-2.5-flash")).toEqual({ thinkingBudget: 0 });
    expect(thinkingFor("gemini-2.5-pro")).toEqual({ thinkingBudget: 128 });
    expect(thinkingFor("gemini-2.0-flash")).toBeNull();
  });
  it("is sent in generationConfig; if rejected, 'low' is tried before sending none", async () => {
    const { fetchImpl, calls } = fake((_m, body) =>
      (body.generationConfig as Record<string, unknown>).thinkingConfig ? err(400, "Thinking level minimal is not supported for this model.") : { status: 200, body: okBody },
    );
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect((calls[0].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect((calls[1].body.generationConfig as Record<string, unknown>).thinkingConfig).toEqual({ thinkingLevel: "low" });
    expect((calls[2].body.generationConfig as Record<string, unknown>).thinkingConfig).toBeUndefined();
    expect(g.modelUsed).toBe("gemini-3.8-flash");
  });
  it("uses 'low' when only 'minimal' is rejected", async () => {
    const { fetchImpl, calls } = fake((_m, body) => {
      const t = (body.generationConfig as { thinkingConfig?: { thinkingLevel?: string } }).thinkingConfig;
      return t?.thinkingLevel === "minimal" ? err(400, "Thinking level minimal is not supported for this model.") : { status: 200, body: okBody };
    });
    await parseWithRetry(new GeminiProvider("AIzaTEST", "gemini-3.1-flash-lite", fetchImpl), "x", ctx, noSleep);
    expect(calls.map((c) => (c.body.generationConfig as { thinkingConfig?: unknown }).thinkingConfig)).toEqual([{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }]);
  });
  it("a rejected JSON schema falls back to plain JSON mode on the same model", async () => {
    const { fetchImpl, calls } = fake((_m, body) =>
      (body.generationConfig as Record<string, unknown>).responseJsonSchema ? err(400, "Invalid JSON payload: unknown field response_json_schema") : { status: 200, body: okBody },
    );
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseWithRetry(g, "x", ctx, noSleep);
    expect(calls).toHaveLength(2);
    expect((calls[1].body.generationConfig as Record<string, unknown>).responseMimeType).toBe("application/json");
  });
});

describe("time limits", () => {
  it("a hanging call is cut off and reported as ai_timeout without overrunning the budget", async () => {
    const { fetchImpl } = fake(() => "hang");
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl, { budgetMs: 4_500, callTimeoutMs: 2_000 });
    const t0 = Date.now();
    await expect(parseWithRetry(g, "x", ctx, noSleep)).rejects.toMatchObject({ code: "ai_timeout" });
    expect(Date.now() - t0).toBeLessThan(4_500);
    expect(g.attempts[0]).toMatchObject({ status: null, ok: false, error: expect.stringContaining("no answer within") });
  });
});

describe("audio", () => {
  it("Android webm/opus and other mime variants are normalised", () => {
    expect(normalizeAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMime("audio/x-wav")).toBe("audio/wav");
    expect(normalizeAudioMime("audio/x-m4a")).toBe("audio/mp4");
    expect(normalizeAudioMime("audio/wav")).toBe("audio/wav");
  });
  it("audio is sent inline with the normalised type", async () => {
    const { fetchImpl, calls } = fake(() => ({ status: 200, body: { candidates: [{ content: { parts: [{ text: JSON.stringify({ transcript: "salam", detected_language: "az", items: [], clarification: null }) }] } }] } }));
    const g = new GeminiProvider("AIzaTEST", "gemini-3.8-flash", fetchImpl);
    await parseAudioWithRetry(g, { base64: "AAAA", mimeType: "audio/webm;codecs=opus" }, ctx, undefined, noSleep);
    const parts = (calls[0].body.contents as { parts: Record<string, unknown>[] }[])[0].parts;
    expect(parts.find((p) => "inlineData" in p)).toEqual({ inlineData: { mimeType: "audio/webm", data: "AAAA" } });
  });
});
