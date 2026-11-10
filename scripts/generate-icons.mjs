// Exports the app icons from İsrafil's ORIGINAL logo (design/logo-original.png).
// The artwork itself is never redrawn or altered: the script only trims the empty
// transparent margin, resizes, and for maskable / iOS icons places the logo on a
// plain background with safe padding.
// Usage: node scripts/generate-icons.mjs
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE = path.resolve("design/logo-original.png");
const out = path.resolve("public/icons");
fs.mkdirSync(out, { recursive: true });

// trim the transparent margin around the rounded square, then centre it on a square canvas
const trimmed = await sharp(SOURCE).trim({ threshold: 10 }).png().toBuffer();
const { width, height } = await sharp(trimmed).metadata();
const side = Math.max(width, height);
const square = await sharp(trimmed)
  .extend({
    top: Math.floor((side - height) / 2),
    bottom: Math.ceil((side - height) / 2),
    left: Math.floor((side - width) / 2),
    right: Math.ceil((side - width) / 2),
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();


/** The logo as is (transparent corners), resized. */
const plain = (size) => sharp(square).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 });

// ---- full-bleed background (maskable / iOS) --------------------------------------------
// Launchers crop maskable icons to their own shape, so the canvas must be blue to every edge.
// The background continues the logo's OWN gradient: a linear colour model (r,g,b = a + b·x + c·y)
// is fitted to the plain blue pixels of the logo, so the logo — placed unchanged at 80% — blends
// into it and its rounded corners disappear. Nothing in the logo itself is redrawn.
const { data: px, info } = await sharp(square).raw().toBuffer({ resolveWithObject: true });
const N = info.width;

function solve3(m, v) {
  // Cramer's rule for a 3×3 system
  const det = (a) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const d = det(m);
  return [0, 1, 2].map((k) => det(m.map((row, i) => row.map((x, j) => (j === k ? v[i] : x)))) / d);
}

function fitGradient() {
  // samples: opaque pixels near the logo's edge; outliers (text, bird) are dropped below
  let pts = [];
  for (let y = 0; y < N; y += 4) {
    for (let x = 0; x < N; x += 4) {
      const i = (y * N + x) * 4;
      if (px[i + 3] < 255) continue;
      // only the border band: that is where the logo must blend into the background
      const u = x / N, v = y / N;
      if (u > 0.14 && u < 0.86 && v > 0.14 && v < 0.86) continue;
      pts.push([u, v, px[i], px[i + 1], px[i + 2]]);
    }
  }
  let model = null;
  for (let pass = 0; pass < 4; pass++) {
    const coef = [2, 3, 4].map((c) => {
      const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const v = [0, 0, 0];
      for (const p of pts) {
        const f = [1, p[0], p[1]];
        for (let a = 0; a < 3; a++) {
          v[a] += f[a] * p[c];
          for (let b = 0; b < 3; b++) m[a][b] += f[a] * f[b];
        }
      }
      return solve3(m, v);
    });
    model = coef;
    // drop pixels far from the fit (text, bird), keep the plain gradient
    const err = (p) => Math.hypot(...[0, 1, 2].map((c) => p[2 + c] - (coef[c][0] + coef[c][1] * p[0] + coef[c][2] * p[1])));
    const errs = pts.map(err).sort((a, b) => a - b);
    const cut = Math.max(6, errs[Math.floor(errs.length * 0.6)]);
    pts = pts.filter((p) => err(p) <= cut);
  }
  return model;
}
const gradient = fitGradient();

/** The logo at `scale` of the canvas, centred on its own gradient continued to every edge. */
async function fullBleed(size, scale) {
  const inner = Math.round(size * scale);
  const off = (size - inner) / 2;
  const bg = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // canvas pixel → position in the logo's own 0..1 coordinates (may be outside it)
      const u = (x + 0.5 - off) / inner;
      const v = (y + 0.5 - off) / inner;
      for (let c = 0; c < 3; c++) {
        const val = gradient[c][0] + gradient[c][1] * u + gradient[c][2] * v;
        bg[(y * size + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
  // soften only the outer rim of the rounded square (its transparency, not the artwork),
  // so no outline of the old corners remains against the background
  const { data: rgba } = await sharp(square).resize(inner, inner, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(inner * inner);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  const sigma = Math.max(0.6, inner * 0.012);
  const blurred = await sharp(alpha, { raw: { width: inner, height: inner, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  for (let i = 0; i < alpha.length; i++) {
    const fade = Math.max(0, Math.min(1, (blurred[i] - 128) / 127)); // 0 at the rim → 1 inside
    rgba[i * 4 + 3] = Math.round(rgba[i * 4 + 3] * fade);
  }
  const logo = await sharp(rgba, { raw: { width: inner, height: inner, channels: 4 } }).png().toBuffer();
  return sharp(bg, { raw: { width: size, height: size, channels: 3 } })
    .composite([{ input: logo, left: Math.round(off), top: Math.round(off) }])
    .removeAlpha()
    .png({ compressionLevel: 9 });
}

// New file names on purpose: the service worker serves /icons/* cache-first, so reusing the
// old names would keep showing the old icon on devices that already have the app.
const jobs = [
  ["swift-192.png", plain(192)],
  ["swift-512.png", plain(512)],
  // maskable: the launcher may crop to a circle — keep the logo inside the 80% safe zone
  ["swift-maskable-v2-192.png", await fullBleed(192, 0.8)],
  ["swift-maskable-v2-512.png", await fullBleed(512, 0.8)],
  // iOS has no transparency and rounds the corners itself: full-bleed too
  ["swift-apple-v2-180.png", await fullBleed(180, 0.8)],
  ["swift-16.png", plain(16)],
  ["swift-32.png", plain(32)],
  ["swift-48.png", plain(48)],
  // in-app header / sign-in screen (shown at 40–96 px, 2–3× screens)
  ["swift-logo-256.png", plain(256)],
  // precached by the service worker under this name: keep it, with the real logo
  ["icon-192.png", plain(192)],
];
for (const [name, img] of jobs) await img.toFile(path.join(out, name));
console.log(`exported ${jobs.length} icons from ${path.relative(process.cwd(), SOURCE)}`);
