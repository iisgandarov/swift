import { withAuth, json } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { buildParseContext } from "@/lib/ai/context";
import { GeminiProvider, listGeminiModels } from "@/lib/ai/gemini";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";

// Gemini calls are capped at 50 s in total (see GeminiProvider), safely inside this limit.
export const maxDuration = 60;
const SAMPLE = "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da";

/**
 * Signed-in diagnostics for the AI setup. Makes one real Gemini call with a fixed sentence and
 * reports: env vars present, the key's first 4 characters (never the key), every model tried,
 * HTTP statuses, Google's exact error messages, latency and the parsed result.
 */
export const GET = withAuth(async (ctx) => {
  const report: Record<string, unknown> = {
    env: {
      AI_PROVIDER: env.aiProvider || "(not set → gemini)",
      GEMINI_API_KEY_present: Boolean(env.geminiKey),
      GEMINI_API_KEY_prefix: env.geminiKey ? env.geminiKey.slice(0, 4) : null,
      GEMINI_MODEL: env.geminiModel || "(not set → default)",
    },
    input: SAMPLE,
  };
  const provider = (env.aiProvider || "gemini").toLowerCase();
  if (provider !== "gemini") return json({ ...report, ok: false, error: `AI_PROVIDER is "${provider}", not "gemini"` }, 400);
  if (!env.geminiKey) return json({ ...report, ok: false, error: "GEMINI_API_KEY is not set in this deployment" }, 503);

  await enforceAiRateLimit(ctx.repo, "parse");
  const gemini = new GeminiProvider();
  const t0 = Date.now();
  let result: unknown = null;
  let error: string | null = null;
  try {
    result = await parseWithRetry(gemini, SAMPLE, await buildParseContext(ctx));
  } catch (err) {
    error = err instanceof AiParseError ? err.code : err instanceof Error ? err.message : String(err);
  }
  const last = gemini.attempts.at(-1);
  const failed = gemini.attempts.filter((a) => !a.ok);
  const body = {
    ...report,
    ok: !error,
    ms: Date.now() - t0,
    models_in_order: gemini.models,
    model_used: gemini.modelUsed,
    fallback_used: Boolean(gemini.modelUsed && gemini.modelUsed !== gemini.models[0]),
    http_status: last?.status ?? null,
    google_error: failed.at(-1)?.error ?? null,
    attempts: gemini.attempts,
    error,
    result,
    available_models: error ? (await listGeminiModels()).filter((m) => /flash/i.test(m)) : undefined,
  };
  return json(body, error ? 502 : 200);
});
