import { z } from "zod";
import { withAuth, json, HttpError } from "@/lib/server/api";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { AiParseError, parseAudioWithRetry } from "@/lib/ai/parse";
import { AiProviderError } from "@/lib/ai/schema";

export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // 60 s of 16 kHz mono WAV ≈ 1.9 MB
const MAX_SECONDS = 65;
const ALLOWED = /^audio\/(wav|x-wav|wave|webm|mp4|m4a|x-m4a|aac|mpeg|mp3|ogg|flac)/;

const metaSchema = z.object({
  lang: z.enum(["auto", "az", "en"]).default("auto"),
  duration: z.coerce.number().min(0).max(MAX_SECONDS * 1000),
});

/** Audio → { transcript, detected_language, items, clarification } in ONE model call (retried once). */
export const POST = withAuth(async (ctx, req) => {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "invalid_form");
  }
  const audio = form.get("audio");
  if (!(audio instanceof File)) throw new HttpError(400, "missing_audio");
  if (audio.size === 0) throw new HttpError(400, "empty_audio");
  if (audio.size > MAX_BYTES) throw new HttpError(413, "audio_too_large");
  const mimeType = audio.type.split(";")[0] || "audio/wav";
  if (!ALLOWED.test(mimeType)) throw new HttpError(415, "unsupported_audio");
  const meta = metaSchema.parse({ lang: form.get("lang") ?? undefined, duration: form.get("duration") ?? 0 });

  await enforceAiRateLimit(ctx.repo, "voice");
  const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  try {
    const result = await parseAudioWithRetry(
      getAiProvider(),
      { base64, mimeType },
      await buildParseContext(ctx),
      meta.lang === "auto" ? undefined : meta.lang,
    );
    return json({ ...result, transcript: result.transcript ?? "" });
  } catch (err) {
    if (err instanceof AiParseError) return json({ error: err.code }, err.code === "ai_quota" ? 429 : 502);
    if (err instanceof AiProviderError) return json({ error: "ai_not_configured" }, 503);
    throw err;
  }
});
