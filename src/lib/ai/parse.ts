import {
  AiProviderError,
  parseResultSchema,
  type AiProvider,
  type AudioInput,
  type ParseContext,
  type ParseResult,
} from "./schema";

export type AiErrorCode = "ai_parse_failed" | "ai_quota" | "ai_unavailable" | "ai_not_configured" | "ai_blocked" | "ai_timeout";

export class AiParseError extends Error {
  constructor(public code: AiErrorCode = "ai_parse_failed") {
    super(code);
  }
}

const RETRY_HINT = "Your previous answer was not valid JSON for the schema. Answer again with valid JSON only.";

function tryParse(raw: string): ParseResult | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "");
    const result = parseResultSchema.safeParse(JSON.parse(cleaned));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function codeFor(err: unknown): AiErrorCode {
  if (err instanceof AiProviderError) {
    if (err.code === "quota") return "ai_quota";
    if (err.code === "config" || err.code === "model") return "ai_not_configured";
    if (err.code === "timeout") return "ai_timeout";
    if (err.code === "blocked") return "ai_blocked";
    return "ai_unavailable";
  }
  return "ai_unavailable";
}

/**
 * One model call, validated. Any failure — invalid JSON, network, quota, server error —
 * is retried exactly once; then it fails with a coded AiParseError so the UI can say
 * what happened and keep the user's text.
 */
async function withRetry(
  call: (retryHint?: string) => Promise<string>,
  sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms)),
  timeLeft: () => number = () => Infinity,
) {
  let last: AiParseError = new AiParseError();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await call(attempt > 0 && last.code === "ai_parse_failed" ? RETRY_HINT : undefined);
      const parsed = tryParse(raw);
      if (parsed) return parsed;
      last = new AiParseError("ai_parse_failed");
      console.error("[ai] answer was not valid JSON for the schema:", raw.slice(0, 300));
      if (attempt === 0 && timeLeft() < 10_000) throw last;
    } catch (err) {
      last = new AiParseError(codeFor(err));
      if (last.code === "ai_not_configured" || last.code === "ai_blocked") throw last; // retrying cannot help
      console.error("[ai]", attempt, err instanceof Error ? err.message : err);
      // only retry if there is still time for a real answer before the serverless limit
      if (attempt === 0 && timeLeft() < 10_000) throw last;
      if (attempt === 0) await sleep(last.code === "ai_quota" ? 1500 : 400);
    }
  }
  throw last;
}

export function parseWithRetry(provider: AiProvider, text: string, ctx: ParseContext, sleep?: (ms: number) => Promise<unknown>): Promise<ParseResult> {
  return withRetry((hint) => provider.parseItems(text, ctx, { retryHint: hint }), sleep, () => provider.timeLeft?.() ?? Infinity);
}

export function parseAudioWithRetry(
  provider: AiProvider,
  audio: AudioInput,
  ctx: ParseContext,
  lang?: "az" | "en",
  sleep?: (ms: number) => Promise<unknown>,
): Promise<ParseResult> {
  return withRetry((hint) => provider.parseAudio(audio, ctx, { lang, retryHint: hint }), sleep, () => provider.timeLeft?.() ?? Infinity);
}
