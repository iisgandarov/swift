import "server-only";
import type { Repo } from "./repo";
import { HttpError } from "./api";

export const AI_REQUESTS_PER_HOUR = 30;

/** Throws 429 when the user has made too many AI calls in the last hour, otherwise logs this one. */
export async function enforceAiRateLimit(repo: Repo, kind: "voice" | "parse") {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const used = await repo.countAiRequestsSince(since);
  if (used >= AI_REQUESTS_PER_HOUR) throw new HttpError(429, "rate_limited");
  await repo.logAiRequest(kind);
}
