import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";
import { AiProviderError, type AiProvider } from "@/lib/ai/schema";
import { addAiAttempts, timingFor } from "@/lib/server/timing";

// Gemini calls are capped at 50 s in total (see GeminiProvider), safely inside this limit.
export const maxDuration = 60;
const bodySchema = z.object({ text: z.string().trim().min(1).max(2000), type: z.enum(["task", "event"]).optional() });

/** Typed text → items, one model call (retried once). The text is echoed back on failure. */
export const POST = withAuth(async (ctx, req) => {
  const timing = timingFor(req);
  const { text, type } = bodySchema.parse(await readJson(req));
  // the rate-limit check and the profile/categories lookup are independent: run them together
  const [, baseCtx] = await Promise.all([
    timing.time("rate", enforceAiRateLimit(ctx.repo, "parse")),
    timing.time("context", buildParseContext(ctx)),
  ]);
  const parseCtx = { ...baseCtx, preferredType: type };
  let provider: AiProvider | null = null;
  try {
    provider = getAiProvider();
    const result = await timing.time("ai", parseWithRetry(provider, text, parseCtx));
    return json({ ...result, transcript: text });
  } catch (err) {
    if (err instanceof AiParseError) return json({ error: err.code, transcript: text }, err.code === "ai_quota" ? 429 : err.code === "ai_timeout" ? 504 : 502);
    if (err instanceof AiProviderError) return json({ error: "ai_not_configured", transcript: text }, 503);
    throw err;
  } finally {
    addAiAttempts(timing, provider);
  }
});
