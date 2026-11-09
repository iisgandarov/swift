import "server-only";
import { env, isDemoMode } from "@/lib/server/env";
import { GeminiProvider } from "./gemini";
import { MockProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import type { AiProvider } from "./schema";

/**
 * AI_PROVIDER = gemini (default) | openai | mock. In demo/dev without a key the offline
 * mock is used, so the app can be tried without any credentials.
 */
export function getAiProvider(): AiProvider {
  const wanted = (env.aiProvider || "gemini").toLowerCase();
  const devWithoutKey = process.env.NODE_ENV !== "production" && !env.geminiKey && !env.openaiKey;
  if (wanted === "mock" || isDemoMode() || devWithoutKey) return new MockProvider();
  if (wanted === "gemini") return new GeminiProvider();
  if (wanted === "openai") return new OpenAiProvider();
  throw new Error(`Unknown AI_PROVIDER "${wanted}"`);
}
