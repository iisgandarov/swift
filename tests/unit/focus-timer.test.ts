import { describe, expect, it } from "vitest";
import * as timer from "@/lib/focus-timer";

describe("focus timer (timestamp based)", () => {
  it("counts down from timestamps, not intervals", () => {
    const s = timer.start(timer.initialTimer(25, 5), 0);
    expect(timer.remaining(s, 60_000)).toBe(24 * 60_000);
    // screen locked for 10 minutes: still correct when we look again
    expect(timer.remaining(s, 11 * 60_000)).toBe(14 * 60_000);
  });
  it("pause freezes and resume continues", () => {
    let s = timer.start(timer.initialTimer(25, 5), 0);
    s = timer.pause(s, 5 * 60_000);
    expect(timer.remaining(s, 99 * 60_000)).toBe(20 * 60_000);
    s = timer.start(s, 100 * 60_000);
    expect(timer.remaining(s, 101 * 60_000)).toBe(19 * 60_000);
    expect(s.startedAt).toBe(0); // original start kept for logging
  });
  it("never goes below zero and switches phases", () => {
    const s = timer.start(timer.initialTimer(1, 2), 0);
    expect(timer.remaining(s, 10 * 60_000)).toBe(0);
    const b = timer.nextPhase(s);
    expect(b).toMatchObject({ phase: "break", running: false, remainingMs: 2 * 60_000 });
    expect(timer.nextPhase(b).phase).toBe("focus");
  });
  it("reports focused minutes for partial sessions", () => {
    const s = timer.start(timer.initialTimer(25, 5), 0);
    expect(timer.focusedMinutes(s, 7 * 60_000 + 10_000)).toBe(7);
  });
});
