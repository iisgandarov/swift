import { repairParseResult } from "./repair";
import {
  AiProviderError,
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

const RETRY_HINT =
  "Your previous answer was not a complete JSON object (it was cut off or had text around it). Answer again with ONLY the JSON object, every field present.";

/** Parses + repairs; logs what was repaired so prompt problems show up in the Vercel logs. */
function tryParse(raw: string, audio: boolean): ParseResult | null {
  const r = repairParseResult(raw, { audio });
  if (!r) {
    console.error("[ai] answer is not JSON:", raw.slice(0, 300));
    return null;
  }
  if (r.repairs.length) console.warn("[ai] repaired answer:", r.repairs.join("; "));
  return r.result;
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
 * One model call, repaired (see repair.ts) — an answer is almost never rejected. A real failure
 * (no JSON, timeout, network, Google 5xx) is retried once, silently, without a hedged duplicate;
 * then it fails with a coded AiParseError so the UI can say the real reason and keep the text.
 * Configuration problems and blocked answers are not retried: a retry can't fix them.
 */
async function withRetry(
  call: (opts: { retryHint?: string; retry: boolean }) => Promise<string>,
  audio: boolean,
  sleep: (ms: number) => Promise<unknown> = async () => undefined,
  timeLeft: () => number = () => Infinity,
) {
  let last: AiParseError = new AiParseError();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await call({ retryHint: attempt > 0 && last.code === "ai_parse_failed" ? RETRY_HINT : undefined, retry: attempt > 0 });
      const parsed = tryParse(raw, audio);
      if (parsed) return parsed;
      last = new AiParseError("ai_parse_failed");
    } catch (err) {
      last = new AiParseError(codeFor(err));
      if (last.code === "ai_not_configured" || last.code === "ai_blocked") throw last; // retrying cannot help
      console.error("[ai]", attempt, err instanceof Error ? err.message : err);
    }
    // only retry if there is still time for a real answer before the serverless limit
    if (attempt === 0 && timeLeft() < 10_000) throw last;
    if (attempt === 0) await sleep(0);
  }
  throw last;
}

export function parseWithRetry(provider: AiProvider, text: string, ctx: ParseContext, sleep?: (ms: number) => Promise<unknown>): Promise<ParseResult> {
  return withRetry((o) => provider.parseItems(text, ctx, o), false, sleep, () => provider.timeLeft?.() ?? Infinity);
}

export function parseAudioWithRetry(
  provider: AiProvider,
  audio: AudioInput,
  ctx: ParseContext,
  lang?: "az" | "en",
  sleep?: (ms: number) => Promise<unknown>,
): Promise<ParseResult> {
  return withRetry((o) => provider.parseAudio(audio, ctx, { lang, ...o }), true, sleep, () => provider.timeLeft?.() ?? Infinity);
}
