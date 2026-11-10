import "server-only";
import { env } from "@/lib/server/env";
import { buildAudioInstruction, buildSystemPrompt } from "./prompt";
import {
  AiProviderError,
  parseAudioJsonSchema,
  parseResultJsonSchema,
  type AiProvider,
  type AudioInput,
  type ParseContext,
} from "./schema";

/** İsrafil's free-tier model (Gemini 3.1 Flash-Lite). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";
/** Tried in this order after GEMINI_MODEL when a model is missing or unavailable for the key. */
export const FALLBACK_GEMINI_MODELS = [DEFAULT_GEMINI_MODEL, "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-2.5-flash"];
/** AI Studio (API key) endpoint — not Vertex AI. */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Total time one request may spend talking to Google (Vercel route maxDuration is 60 s). */
const BUDGET_MS = 50_000;
/** Max time for a single Google call. */
const CALL_TIMEOUT_MS = 15_000;
/** No answer after this long → send ONE duplicate request and use whichever answers first. */
const HEDGE_AFTER_MS = { text: 3_000, audio: 4_000 };
/** Free tier allows ~15 requests/minute: never spend more than this many on duplicates per minute. */
const MAX_HEDGES_PER_MINUTE = 4;
/**
 * Upper bound on the answer size. Generous on purpose: on Gemini 3.x the model's "thinking"
 * tokens count against this limit, and a tight cap (1500/2500 on 2026-11-10) cut answers off
 * before any JSON was written (empty response, finishReason MAX_TOKENS → every request failed).
 */
const MAX_OUTPUT_TOKENS = { text: 8_192, audio: 8_192 };
/** How long a model that answered "not found / not available" is skipped. */
const UNAVAILABLE_FOR_MS = 10 * 60_000;

/**
 * Shared by all requests on a warm server instance: models known to be unavailable for this
 * key (so the fallback chain isn't walked on every request) and recent hedge timestamps.
 */
const memory = { unavailable: new Map<string, number>(), hedges: [] as number[] };

/** Test helper: forget what earlier requests learned. */
export function resetGeminiMemory() {
  memory.unavailable.clear();
  memory.hedges.length = 0;
}

function takeHedgeSlot(now = Date.now()) {
  memory.hedges = memory.hedges.filter((t) => now - t < 60_000);
  if (memory.hedges.length >= MAX_HEDGES_PER_MINUTE) return false;
  memory.hedges.push(now);
  return true;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  usageMetadata?: { thoughtsTokenCount?: number; candidatesTokenCount?: number };
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

/** One HTTP attempt, kept for diagnostics (/api/ai/test) and the server log. Never contains the key. */
export interface GeminiAttempt {
  model: string;
  status: number | null; // null = no HTTP response (network / timeout)
  ok: boolean;
  ms: number;
  error?: string; // Google's exact error message
  thinking: string; // thinking config that was sent
  schema: boolean; // whether responseJsonSchema was sent
  hedge?: boolean; // the duplicate request sent because the first was slow
  cancelled?: boolean; // stopped because the other (hedged) request answered first
}

type CallResult = { ok: true; text: string } | { ok: false; status: number | null; error: AiProviderError };
type Kind = "text" | "audio";

/** Resolves with the first successful result; if all fail, with the first failure. */
function firstOk(calls: Promise<CallResult>[]): Promise<CallResult> {
  return new Promise((resolve) => {
    let pending = calls.length;
    let firstFailure: CallResult | null = null;
    for (const c of calls) {
      void c.then((r) => {
        if (r.ok) return resolve(r);
        firstFailure ??= r;
        if (--pending === 0) resolve(firstFailure);
      });
    }
  });
}

type Thinking = { thinkingLevel: "minimal" | "low" } | { thinkingBudget: number } | null;

/**
 * Lowest thinking the model family allows: this is a small extraction task, and thinking
 * makes newer models slow enough to hit the serverless time limit.
 */
export function thinkingFor(model: string): Thinking {
  const m = model.toLowerCase();
  if (/gemini-2\.5-pro/.test(m)) return { thinkingBudget: 128 }; // pro can't turn thinking off
  if (/gemini-2\.5/.test(m)) return { thinkingBudget: 0 };
  if (/gemini-(3|latest|flash-latest)|-latest$/.test(m)) return { thinkingLevel: "minimal" };
  return null; // older models: no thinking config
}

const describeThinking = (t: Thinking) => (t ? JSON.stringify(t) : "none");

/** The model doesn't exist, isn't enabled for this key / free tier, or has no quota at all → try the next one. */
function isModelUnavailable(status: number, message: string) {
  if (status === 404) return true;
  if (status === 403) return /model|permission|not (?:available|enabled)/i.test(message);
  if (status === 429) return /limit:\s*0\b|free[_ -]?tier|not available/i.test(message);
  if (status === 400) return /model.*(not found|not supported|unsupported|invalid|does not exist)|is not found|not supported for generateContent/i.test(message);
  return false;
}
const mentionsThinking = (msg: string) => /thinking/i.test(msg);
const mentionsSchema = (msg: string) => /response_?json_?schema|responseJsonSchema|response_?schema|schema/i.test(msg);

/**
 * Google Gemini (AI Studio API). One generateContent call per request with JSON output;
 * audio goes in as inline data, so a voice task is transcribed AND parsed in one call.
 * Robustness: per-call timeouts inside a total budget, model fallback
 * (GEMINI_MODEL → gemini-3.1-flash-lite → gemini-2.5-flash-lite → gemini-flash-latest → gemini-2.5-flash, with
 * unavailable models remembered for 10 min), a hedged duplicate when Google is slow, and automatic removal of a
 * thinking/schema setting the model rejects. Every failed call is logged with Google's message.
 * The API key is only sent in the x-goog-api-key header and is never logged.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  readonly models: string[];
  readonly attempts: GeminiAttempt[] = [];
  modelUsed: string | null = null;
  private readonly deadline: number;

  constructor(
    private readonly apiKey: string = env.geminiKey,
    model: string = env.geminiModel || DEFAULT_GEMINI_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
    opts: { budgetMs?: number; callTimeoutMs?: number; fallback?: boolean; hedgeAfterMs?: { text: number; audio: number } | null } = {},
  ) {
    if (!apiKey) throw new AiProviderError("config", "GEMINI_API_KEY is not set");
    // fallback: false = only this model (used by the benchmark to compare models fairly)
    this.models = [...new Set([model.trim(), ...(opts.fallback === false ? [] : FALLBACK_GEMINI_MODELS)].filter(Boolean))];
    this.deadline = Date.now() + (opts.budgetMs ?? BUDGET_MS);
    this.callTimeoutMs = opts.callTimeoutMs ?? CALL_TIMEOUT_MS;
    this.hedgeAfterMs = opts.hedgeAfterMs === undefined ? HEDGE_AFTER_MS : opts.hedgeAfterMs;
  }
  private readonly callTimeoutMs: number;
  private readonly hedgeAfterMs: { text: number; audio: number } | null;

  /** The chain without models that recently answered "unavailable" (unless that would leave none). */
  private usableModels() {
    const now = Date.now();
    const usable = this.models.filter((m) => (memory.unavailable.get(m) ?? 0) <= now);
    return usable.length ? usable : this.models;
  }

  /** Milliseconds left in this request's budget. */
  timeLeft() {
    return this.deadline - Date.now();
  }

  parseItems(text: string, ctx: ParseContext, opts: { retryHint?: string } = {}) {
    return this.generate("text", buildSystemPrompt(ctx), [{ text: `The user's text:\n"""${text.slice(0, 4000)}"""` }], parseResultJsonSchema, opts.retryHint);
  }

  parseAudio(audio: AudioInput, ctx: ParseContext, opts: { lang?: "az" | "en"; retryHint?: string } = {}) {
    return this.generate(
      "audio",
      buildSystemPrompt(ctx) + "\n\n" + buildAudioInstruction(opts.lang),
      [{ text: "Transcribe this voice note, then extract the items." }, { inlineData: { mimeType: normalizeAudioMime(audio.mimeType), data: audio.base64 } }],
      parseAudioJsonSchema,
      opts.retryHint,
    );
  }

  private async generate(kind: Kind, system: string, parts: Part[], schema: object, retryHint?: string): Promise<string> {
    const instruction = retryHint ? `${system}\n\n${retryHint}` : system;
    // once a model has answered, stay on it for the rest of this request (e.g. the retry)
    const models = this.modelUsed ? [this.modelUsed] : this.usableModels();
    let lastError: AiProviderError | null = null;

    for (const model of models) {
      let thinking = thinkingFor(model);
      let useSchema = true;
      // up to 4 tries on the same model: as-is, then with a less strict thinking / without a rejected schema setting
      for (let variant = 0; variant < 4; variant++) {
        const r = await this.hedgedCall(kind, model, instruction, parts, schema, thinking, useSchema);
        if (r.ok) {
          memory.unavailable.delete(model);
          if (this.modelUsed !== model) console.info(`[gemini] model used: ${model}${model !== this.models[0] ? ` (fallback from ${this.models[0]})` : ""}`);
          this.modelUsed = model;
          return r.text;
        }
        lastError = r.error;
        const msg = r.error.message;
        if (r.status === 400 && thinking && mentionsThinking(msg)) {
          // model rejects this thinking setting → "low" (still fast) before sending none, which on
          // Gemini 3.x means the model's default, much longer thinking
          thinking = thinking && "thinkingLevel" in thinking && thinking.thinkingLevel === "minimal" ? { thinkingLevel: "low" } : null;
          continue;
        }
        if (r.status === 400 && useSchema && mentionsSchema(msg) && !isModelUnavailable(400, msg)) {
          useSchema = false; // model rejects the JSON schema → JSON mode + prompt + zod validation
          continue;
        }
        break;
      }
      if (!lastError || lastError.code !== "model") throw lastError ?? new AiProviderError("upstream");
      // model unavailable → remember it for a while and go on with the next model in the chain
      memory.unavailable.set(model, Date.now() + UNAVAILABLE_FOR_MS);
    }
    throw new AiProviderError("config", `no usable Gemini model (tried ${models.join(", ")}): ${lastError?.message ?? ""}`);
  }

  /**
   * One call, plus a duplicate if the first hasn't answered within the hedge delay (free-tier
   * latency varies a lot; a second request often comes back sooner). First success wins and the
   * other request is cancelled. Duplicates are capped per minute to respect the free-tier RPM.
   */
  private async hedgedCall(kind: Kind, model: string, system: string, parts: Part[], schema: object, thinking: Thinking, useSchema: boolean) {
    const maxOutputTokens = MAX_OUTPUT_TOKENS[kind];
    const primaryStop = new AbortController();
    const primary = this.call(model, system, parts, schema, thinking, useSchema, { maxOutputTokens, cancel: primaryStop.signal });
    const after = this.hedgeAfterMs?.[kind];
    if (!after) return primary;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const early = await Promise.race([primary, new Promise<null>((r) => (timer = setTimeout(() => r(null), after)))]);
    clearTimeout(timer);
    if (early) return early;
    // only worth it if a duplicate can still finish in time, and within the per-minute allowance
    if (this.timeLeft() < 6_000 || !takeHedgeSlot()) return primary;

    const hedgeStop = new AbortController();
    const hedge = this.call(model, system, parts, schema, thinking, useSchema, { maxOutputTokens, cancel: hedgeStop.signal, hedge: true });
    const winner = await firstOk([primary, hedge]);
    primaryStop.abort();
    hedgeStop.abort();
    return winner;
  }

  private async call(
    model: string,
    system: string,
    parts: Part[],
    schema: object,
    thinking: Thinking,
    useSchema: boolean,
    opts: { maxOutputTokens?: number; cancel?: AbortSignal; hedge?: boolean } = {},
  ): Promise<CallResult> {
    const left = this.timeLeft();
    const record = (a: Omit<GeminiAttempt, "model" | "thinking" | "schema">) => {
      const attempt: GeminiAttempt = { model, thinking: describeThinking(thinking), schema: useSchema, ...(opts.hedge ? { hedge: true } : {}), ...a };
      this.attempts.push(attempt);
      if (!attempt.ok && !attempt.cancelled) console.error("[gemini] call failed", JSON.stringify(attempt));
    };
    if (left < 3_000) {
      record({ status: null, ok: false, ms: 0, error: "time budget used up" });
      return { ok: false, status: null, error: new AiProviderError("timeout", "time budget used up") };
    }

    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        ...(useSchema ? { responseJsonSchema: schema } : {}),
        temperature: 0.1,
        ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
        ...(thinking ? { thinkingConfig: thinking } : {}),
      },
    };
    const t0 = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: opts.cancel
          ? AbortSignal.any([AbortSignal.timeout(Math.min(this.callTimeoutMs, left - 1_000)), opts.cancel])
          : AbortSignal.timeout(Math.min(this.callTimeoutMs, left - 1_000)),
      });
    } catch (err) {
      if (opts.cancel?.aborted) {
        record({ status: null, ok: false, ms: Date.now() - t0, error: "cancelled: the other request answered first", cancelled: true });
        return { ok: false, status: null, error: new AiProviderError("network", "cancelled") };
      }
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      const message = timedOut ? `no answer within ${Math.round((Date.now() - t0) / 1000)} s` : err instanceof Error ? err.message : String(err);
      record({ status: null, ok: false, ms: Date.now() - t0, error: message });
      return { ok: false, status: null, error: new AiProviderError(timedOut ? "timeout" : "network", message) };
    }
    const ms = Date.now() - t0;
    const data = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      const message = data.error?.message ?? `HTTP ${res.status}`;
      record({ status: res.status, ok: false, ms, error: message });
      const code = isModelUnavailable(res.status, message)
        ? "model"
        : res.status === 429 || data.error?.status === "RESOURCE_EXHAUSTED"
          ? "quota"
          : res.status === 400 || res.status === 401 || res.status === 403
            ? "config"
            : "upstream";
      return { ok: false, status: res.status, error: new AiProviderError(code, message) };
    }
    if (data.promptFeedback?.blockReason) {
      record({ status: res.status, ok: false, ms, error: `blocked: ${data.promptFeedback.blockReason}` });
      return { ok: false, status: res.status, error: new AiProviderError("blocked", data.promptFeedback.blockReason) };
    }
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("");
    if (!text) {
      const used = data.usageMetadata;
      const why = `empty response (finishReason ${data.candidates?.[0]?.finishReason ?? "none"}${used ? `, thinking tokens ${used.thoughtsTokenCount ?? 0}, answer tokens ${used.candidatesTokenCount ?? 0}` : ""})`;
      record({ status: res.status, ok: false, ms, error: why });
      return { ok: false, status: res.status, error: new AiProviderError("upstream", why) };
    }
    record({ status: res.status, ok: true, ms });
    return { ok: true, text };
  }
}

/**
 * Android Chrome records audio/webm;codecs=opus, iOS audio/mp4. The app normally converts to
 * WAV on the device first; if that failed, send the container type Gemini knows without codec params.
 */
export function normalizeAudioMime(mime: string) {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base === "audio/x-wav" || base === "audio/wave") return "audio/wav";
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/mpeg") return "audio/mp3";
  return base || "audio/wav";
}

/** Models this key can call with generateContent (diagnostics only). */
export async function listGeminiModels(apiKey: string = env.geminiKey): Promise<string[]> {
  try {
    const res = await fetch(`${ENDPOINT}?pageSize=200`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    return (data.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""));
  } catch {
    return [];
  }
}
