import { withAuth, json } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { DEFAULT_GEMINI_MODEL, listGeminiModels } from "@/lib/ai/gemini";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";

export const maxDuration = 60;
const SAMPLE = "Axşama görüş olacaq onu qeyd et Dostlarla görüş saat 20.30da";

/**
 * Signed-in diagnostics: one real AI call with a fixed sentence. Shows which provider and
 * model answered, how long it took and what came back — never the API key.
 */
export const GET = withAuth(async (ctx) => {
  const provider = (env.aiProvider || "gemini").toLowerCase();
  const model = env.geminiModel || DEFAULT_GEMINI_MODEL;
  const base = { provider, model: provider === "gemini" ? model : undefined, key_present: Boolean(env.geminiKey), input: SAMPLE };
  await enforceAiRateLimit(ctx.repo, "parse");
  const t0 = Date.now();
  try {
    const result = await parseWithRetry(getAiProvider(), SAMPLE, await buildParseContext(ctx));
    return json({ ...base, ok: true, ms: Date.now() - t0, result });
  } catch (err) {
    const code = err instanceof AiParseError ? err.code : err instanceof Error ? err.message : "error";
    const available = provider === "gemini" && env.geminiKey ? (await listGeminiModels()).filter((m) => m.includes("flash")) : undefined;
    return json({ ...base, ok: false, ms: Date.now() - t0, error: code, available_flash_models: available }, 502);
  }
});
