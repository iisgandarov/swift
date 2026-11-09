import { z } from "zod";
import { withAuth, json, HttpError } from "@/lib/server/api";
import { enforceAiRateLimit } from "@/lib/server/rate-limit";
import { getAiProvider } from "@/lib/ai";
import { buildParseContext } from "@/lib/ai/context";
import { AiParseError, parseWithRetry } from "@/lib/ai/parse";

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024; // ~60 s of compressed audio is far below this
const MAX_SECONDS = 65;
const ALLOWED = /^audio\/(webm|mp4|m4a|x-m4a|aac|mpeg|mp3|ogg|wav|x-wav)/;

const metaSchema = z.object({
  lang: z.enum(["auto", "az", "en"]).default("auto"),
  duration: z.coerce.number().min(0).max(MAX_SECONDS * 1000),
});

/** Audio → transcript → items. Returns { transcript, detected_language, items, clarification }. */
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
  const type = audio.type.split(";")[0];
  if (!ALLOWED.test(type)) throw new HttpError(415, "unsupported_audio");
  const meta = metaSchema.parse({ lang: form.get("lang") ?? undefined, duration: form.get("duration") ?? 0 });

  await enforceAiRateLimit(ctx.repo, "voice");
  const provider = getAiProvider();
  const lang = meta.lang === "auto" ? undefined : meta.lang;

  // give the file a name with an extension the STT API recognises
  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.split("/")[1].replace("x-", "");
  const file = new File([await audio.arrayBuffer()], `voice.${ext}`, { type });

  const { text, language } = await provider.transcribe(file, lang);
  if (!text.trim()) return json({ transcript: "", detected_language: language ?? "az", items: [], clarification: null });

  try {
    const result = await parseWithRetry(provider, text, await buildParseContext(ctx));
    return json({ transcript: text, ...result, detected_language: language ?? result.detected_language });
  } catch (err) {
    // keep the transcript so the user can fix it as text
    if (err instanceof AiParseError) return json({ error: "ai_parse_failed", transcript: text }, 502);
    throw err;
  }
});
