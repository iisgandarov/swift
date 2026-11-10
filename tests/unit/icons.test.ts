import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

const file = (src: string) => path.join("public", src);

describe("PWA icons", () => {
  const icons = manifest().icons ?? [];

  it("has separate 'any' and 'maskable' entries at 192 and 512, and every file exists", () => {
    const entries = icons.map((i) => `${i.purpose} ${i.sizes}`).sort();
    expect(entries).toEqual(["any 192x192", "any 512x512", "maskable 192x192", "maskable 512x512"]);
    for (const i of icons) expect(fs.existsSync(file(i.src)), i.src).toBe(true);
  });

  it("maskable icons are full-bleed: opaque and blue on every edge, no white or transparency", async () => {
    for (const i of icons.filter((x) => x.purpose === "maskable")) {
      const { data, info } = await sharp(file(i.src)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const n = info.width;
      expect(info.height).toBe(n);
      const at = (x: number, y: number) => [...data.subarray((y * n + x) * 4, (y * n + x) * 4 + 4)];
      for (let k = 0; k < n; k += 7) {
        for (const [x, y] of [[k, 0], [k, n - 1], [0, k], [n - 1, k]]) {
          const [r, , b, a] = at(x, y);
          expect(a, `${i.src} alpha at ${x},${y}`).toBe(255);
          expect(b, `${i.src} blue at ${x},${y}`).toBeGreaterThan(200);
          expect(r, `${i.src} not white at ${x},${y}`).toBeLessThan(80);
        }
      }
    }
  });
});
