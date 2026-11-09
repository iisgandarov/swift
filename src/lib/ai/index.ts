import "server-only";
import { env, isDemoMode } from "@/lib/server/env";
import { MockProvider } from "./mock";
import { OpenAiProvider } from "./openai";
import type { AiProvider } from "./schema";

/** Chosen by AI_PROVIDER; falls back to the offline mock when no key is configured (demo/dev). */
export function getAiProvider(): AiProvider {
  const wanted = env.aiProvider || "openai";
  if (wanted === "mock" || isDemoMode() || (!env.openaiKey && process.env.NODE_ENV !== "production")) {
    return new MockProvider();
  }
  if (wanted === "openai") return new OpenAiProvider();
  throw new Error(`Unknown AI_PROVIDER "${wanted}"`);
}
