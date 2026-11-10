import "server-only";
import { after } from "next/server";

/**
 * Runs `task` after the response has been sent (Next.js `after()`), so the user doesn't
 * wait for it. Outside a request (unit tests, scripts) it simply runs now. Never throws:
 * failures are logged with `label`.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>) {
  const safe = () => task().catch((err) => console.error(`[${label}]`, err instanceof Error ? err.message : err));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
