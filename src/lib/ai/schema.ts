import { z } from "zod";

/** Fields the model can flag as uncertain so the confirmation sheet can highlight them. */
export const UNCERTAIN_FIELDS = ["title", "type", "date", "time", "category", "priority"] as const;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const parsedItemSchema = z.object({
  type: z.enum(["task", "event"]),
  title: z.string().trim().min(1).max(200),
  notes: z.string().nullable(),
  date: ymd.nullable(),
  start_time: hhmm.nullable(),
  end_time: hhmm.nullable(),
  duration_minutes: z.number().int().min(1).max(24 * 60).nullable(),
  all_day: z.boolean(),
  priority: z.enum(["low", "medium", "high"]),
  category: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  clarification: z.string().nullable(),
  uncertain_fields: z.array(z.enum(UNCERTAIN_FIELDS)),
});
export type ParsedItem = z.infer<typeof parsedItemSchema>;

export const parseResultSchema = z.object({
  /** only for audio input: what was said, verbatim */
  transcript: z.string().nullish(),
  detected_language: z.enum(["az", "en"]),
  items: z.array(parsedItemSchema).max(20),
  clarification: z.string().nullable(),
});
export type ParseResult = z.infer<typeof parseResultSchema>;

/** JSON Schema for OpenAI structured outputs (strict: every key required, nulls explicit). */
export const parseResultJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["detected_language", "items", "clarification"],
  properties: {
    detected_language: { type: "string", enum: ["az", "en"] },
    clarification: { type: ["string", "null"], description: "Only when items is empty: what was unclear, in the user's language." },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type", "title", "notes", "date", "start_time", "end_time", "duration_minutes",
          "all_day", "priority", "category", "confidence", "clarification", "uncertain_fields",
        ],
        properties: {
          type: { type: "string", enum: ["task", "event"] },
          title: { type: "string", description: "Short and concise, max ~6 words, in the spoken language." },
          notes: { type: ["string", "null"] },
          date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          start_time: { type: ["string", "null"], description: "HH:mm 24h" },
          end_time: { type: ["string", "null"], description: "HH:mm 24h" },
          duration_minutes: { type: ["integer", "null"] },
          all_day: { type: "boolean" },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          category: { type: ["string", "null"], description: "Exactly one of the user's category names. Never null: Meeting, Work or Personal when nothing more specific fits." },
          confidence: { type: "number" },
          clarification: { type: ["string", "null"] },
          uncertain_fields: { type: "array", items: { type: "string", enum: [...UNCERTAIN_FIELDS] } },
        },
      },
    },
  },
} as const;

/** Same schema plus a required `transcript` field, for audio input. */
export const parseAudioJsonSchema = {
  ...parseResultJsonSchema,
  required: ["transcript", ...parseResultJsonSchema.required],
  properties: {
    transcript: { type: "string", description: "Everything the user said, verbatim, in the spoken language." },
    ...parseResultJsonSchema.properties,
  },
} as const;

export interface ParseContext {
  /** ISO timestamp of "now" */
  now: string;
  timezone: string;
  /** local date and weekday name in English, e.g. 2026-11-09 Monday */
  localDate: string;
  localTime: string;
  weekday: string;
  uiLocale: "az" | "en";
  categories: string[];
  defaultEventMinutes: number;
}

export interface AudioInput {
  /** base64 of the audio bytes */
  base64: string;
  mimeType: string;
}

/** Normalised provider failure, so the retry logic and the UI can react per cause. */
export class AiProviderError extends Error {
  constructor(
    public code: "quota" | "network" | "upstream" | "config" | "blocked" | "timeout" | "model",
    message?: string,
  ) {
    super(message ?? code);
  }
}

export interface AiProvider {
  readonly name: string;
  /** Text → raw JSON string matching parseResultSchema (validated by the caller). */
  parseItems(text: string, ctx: ParseContext, opts?: { retryHint?: string }): Promise<string>;
  /** Audio → raw JSON string matching parseResultSchema including `transcript`, in ONE call. */
  parseAudio(audio: AudioInput, ctx: ParseContext, opts?: { lang?: "az" | "en"; retryHint?: string }): Promise<string>;
  /** ms left in this request's time budget (providers with a budget only) */
  timeLeft?(): number;
}
