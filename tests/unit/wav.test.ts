import { describe, expect, it } from "vitest";
import { trimSilence } from "@/lib/client/wav";

const RATE = 16_000;
/** silence – tone – silence, lengths in seconds */
function clip(before: number, speech: number, after: number) {
  const pcm = new Float32Array(Math.round((before + speech + after) * RATE));
  const s0 = Math.round(before * RATE);
  for (let i = 0; i < Math.round(speech * RATE); i++) pcm[s0 + i] = 0.3 * Math.sin(i / 5);
  return pcm;
}

describe("trimSilence", () => {
  it("cuts leading and trailing silence but keeps 300 ms padding around speech", () => {
    const out = trimSilence(clip(1.5, 2, 1.2), RATE);
    expect(out.length / RATE).toBeGreaterThan(2.5);
    expect(out.length / RATE).toBeLessThan(2.7);
  });
  it("keeps everything when it is all speech", () => {
    expect(trimSilence(clip(0, 2, 0), RATE).length).toBe(2 * RATE);
  });
  it("leaves pure silence untouched (the model reports 'nothing heard')", () => {
    const silent = new Float32Array(RATE);
    expect(trimSilence(silent, RATE).length).toBe(RATE);
  });
  it("keeps quiet pauses inside the speech", () => {
    const pcm = clip(0.5, 3, 0.5);
    pcm.fill(0, Math.round(1.5 * RATE), Math.round(2.5 * RATE)); // a 1 s pause mid-sentence
    expect(trimSilence(pcm, RATE).length / RATE).toBeGreaterThan(3.5);
  });
});
