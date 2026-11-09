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

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
}

/**
 * Google Gemini (AI Studio API) — one generateContent call per request, with the
 * structured-output JSON schema. Audio goes in as inline data, so a voice task is
 * transcribed AND parsed in the same call. The API key never leaves the server.
 */
export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly model: string;

  constructor(
    private readonly apiKey: string = env.geminiKey,
    model: string = env.geminiModel || DEFAULT_GEMINI_MODEL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new AiProviderError("config", "GEMINI_API_KEY is not set");
    this.model = model;
  }

  parseItems(text: string, ctx: ParseContext, opts: { retryHint?: string } = {}) {
    return this.generate(buildSystemPrompt(ctx), [{ text: `The user's text:\n"""${text.slice(0, 4000)}"""` }], parseResultJsonSchema, opts.retryHint);
  }

  parseAudio(audio: AudioInput, ctx: ParseContext, opts: { lang?: "az" | "en"; retryHint?: string } = {}) {
    return this.generate(
      buildSystemPrompt(ctx) + "\n\n" + buildAudioInstruction(opts.lang),
      [{ inlineData: { mimeType: audio.mimeType, data: audio.base64 } }, { text: "Transcribe this voice note, then extract the items." }],
      parseAudioJsonSchema,
      opts.retryHint,
    );
  }

  private async generate(system: string, parts: Part[], schema: object, retryHint?: string): Promise<string> {
    const body = {
      systemInstruction: { parts: [{ text: retryHint ? `${system}\n\n${retryHint}` : system }] },
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: schema,
        temperature: 0.1,
      },
    };
    let res: Response;
    try {
      res = await this.fetchImpl(`${ENDPOINT}/${encodeURIComponent(this.model)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (err) {
      throw new AiProviderError("network", err instanceof Error ? err.message : String(err));
    }
    const data = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 429 || data.error?.status === "RESOURCE_EXHAUSTED") throw new AiProviderError("quota", msg);
      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) throw new AiProviderError("config", msg);
      throw new AiProviderError("upstream", msg);
    }
    if (data.promptFeedback?.blockReason) throw new AiProviderError("blocked", data.promptFeedback.blockReason);
    const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    if (!text) throw new AiProviderError("upstream", `empty response (${data.candidates?.[0]?.finishReason ?? "no candidates"})`);
    return text;
  }
}

/** Models this key can call with generateContent (diagnostics only). */
export async function listGeminiModels(apiKey: string = env.geminiKey): Promise<string[]> {
  const res = await fetch(`${ENDPOINT}?pageSize=200`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  return (data.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}
