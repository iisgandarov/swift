import { z } from "zod";
import { withAuth, json, readJson, HttpError } from "@/lib/server/api";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";

const bodySchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** Typed sentence → items (step 3 of the voice pipeline only). */
export const POST = withAuth(async (ctx, req) => {
  const { text } = bodySchema.parse(await readJson(req));
  await enforceAiRateLimit(ctx.repo, "parse");
  const provider = getAiProvider();
  try {
    const result = await parseWithRetry(provider, text, await buildParseContext(ctx));
    return json({ transcript: text, ...result });
  } catch (err) {
    if (err instanceof AiParseError) throw new HttpError(502, "ai_parse_failed");
    throw err;
  }
});
