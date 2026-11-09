import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/server/env";
import { buildSystemPrompt } from "./prompt";
import { parseResultJsonSchema, type AiProvider, type ParseContext } from "./schema";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private client: OpenAI;

  constructor() {
    if (!env.openaiKey) throw new Error("OPENAI_API_KEY is not set");
    if (!env.sttModel || !env.parseModel) throw new Error("STT_MODEL and PARSE_MODEL must be set");
    this.client = new OpenAI({ apiKey: env.openaiKey, timeout: 45_000, maxRetries: 1 });
  }

  async transcribe(audio: File, lang?: "az" | "en") {
    const res = await this.client.audio.transcriptions.create({
      file: audio,
      model: env.sttModel,
      ...(lang ? { language: lang } : {}),
      // a prompt with domain words improves recognition of names and code-switching
      prompt: "Tapşırıq, görüş, sabah, birigün, saat, EduPo, TLB Academy, meeting, deadline, call.",
    });
    const text = res.text.trim();
    return { text, language: lang ?? null };
  }

  async parseItems(text: string, ctx: ParseContext, opts: { retryHint?: string } = {}) {
    const res = await this.client.chat.completions.create({
      model: env.parseModel,
      messages: [
        { role: "system", content: buildSystemPrompt(ctx) },
        ...(opts.retryHint ? [{ role: "system" as const, content: opts.retryHint }] : []),
        { role: "user", content: text },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "swift_items", strict: true, schema: parseResultJsonSchema as unknown as Record<string, unknown> },
      },
    });
    return res.choices[0]?.message?.content ?? "";
  }
}
