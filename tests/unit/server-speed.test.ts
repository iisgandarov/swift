import { describe, expect, it, vi } from "vitest";
import { enforceAiRateLimit, AI_REQUESTS_PER_HOUR } from "@/lib/server/rate-limit";
import { runAfterResponse } from "@/lib/server/background";
import type { Repo } from "@/lib/server/repo";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("rate limit", () => {
  it("checks the count and logs the call without making the caller wait for the insert", async () => {
    let release!: () => void;
    const logAiRequest = vi.fn(() => new Promise<void>((r) => (release = r)));
    const repo = { countAiRequestsSince: vi.fn(async () => 3), logAiRequest } as unknown as Repo;
    await enforceAiRateLimit(repo, "parse"); // resolves although the insert is still pending
    expect(logAiRequest).toHaveBeenCalledWith("parse");
    release();
  });

  it("refuses when the hourly limit is reached and logs nothing", async () => {
    const repo = { countAiRequestsSince: vi.fn(async () => AI_REQUESTS_PER_HOUR), logAiRequest: vi.fn() } as unknown as Repo;
    await expect(enforceAiRateLimit(repo, "voice")).rejects.toMatchObject({ status: 429, code: "rate_limited" });
    expect(repo.logAiRequest).not.toHaveBeenCalled();
  });
});

describe("runAfterResponse", () => {
  it("runs the task (outside a request: right away) and swallows its failure", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const task = vi.fn(async () => {
      throw new Error("boom");
    });
    runAfterResponse("test", task);
    await flush();
    expect(task).toHaveBeenCalledOnce();
    expect(err).toHaveBeenCalledWith("[test]", "boom");
    err.mockRestore();
  });
});
