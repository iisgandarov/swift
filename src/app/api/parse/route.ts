import { z } from "zod";
import { withAuth, json, readJson } from "@/lib/server/api";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";
import { AiProviderError } from "@/lib/ai/schema";

export const maxDuration = 60;
const bodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** Typed text → items, one model call (retried once). The text is echoed back on failure. */
export const POST = withAuth(async (ctx, req) => {
  const { text } = bodySchema.parse(await readJson(req));
  await enforceAiRateLimit(ctx.repo, "parse");
  try {
    const result = await parseWithRetry(getAiProvider(), text, await buildParseContext(ctx));
    return json({ ...result, transcript: text });
  } catch (err) {
    if (err instanceof AiParseError) return json({ error: err.code, transcript: text }, err.code === "ai_quota" ? 429 : 502);
    if (err instanceof AiProviderError) return json({ error: "ai_not_configured", transcript: text }, 503);
    throw err;
  }
});
