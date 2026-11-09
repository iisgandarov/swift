import { parseResultSchema, type AiProvider, type ParseContext, type ParseResult } from "./schema";

export class AiParseError extends Error {
  constructor(message = "ai_parse_failed") {
    super(message);
  }
}

function tryParse(raw: string): ParseResult | null {
  try {
    const result = parseResultSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Calls the model and validates its JSON. Invalid output is retried once, then fails with AiParseError. */
export async function parseWithRetry(provider: AiProvider, text: string, ctx: ParseContext): Promise<ParseResult> {
  const first = tryParse(await provider.parseItems(text, ctx));
  if (first) return first;
  const second = tryParse(
    await provider.parseItems(text, ctx, {
      retryHint: "Your previous answer was not valid JSON for the schema. Answer again with valid JSON only.",
    }),
  );
  if (second) return second;
  throw new AiParseError();
}
