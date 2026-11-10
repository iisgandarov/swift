import "server-only";
import type { Repo } from "./repo";
import { HttpError } from "./api";
import { runAfterResponse } from "./background";

export const AI_REQUESTS_PER_HOUR = 30;

/**
 * Throws 429 when the user has made too many AI calls in the last hour. The log entry for
 * this call is written after the response, so it never adds to the user's wait.
 */
export async function enforceAiRateLimit(repo: Repo, kind: "voice" | "parse") {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const used = await repo.countAiRequestsSince(since);
  if (used >= AI_REQUESTS_PER_HOUR) throw new HttpError(429, "rate_limited");
  runAfterResponse("rate-limit", () => repo.logAiRequest(kind));
}
