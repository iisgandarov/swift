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

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** The logo as is (transparent corners), resized. */
const plain = (size) => sharp(square).resize(size, size, { kernel: "lanczos3" }).png({ compressionLevel: 9 });

/** The logo scaled to `scale` of the canvas, centred on a solid background (maskable / iOS). */
async function padded(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await sharp(square).resize(inner, inner, { kernel: "lanczos3" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: "center" }])
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9 });
}

// New file names on purpose: the service worker serves /icons/* cache-first, so reusing the
// old names would keep showing the old icon on devices that already have the app.
const jobs = [
  ["swift-192.png", plain(192)],
  ["swift-512.png", plain(512)],
  // maskable: the launcher may crop to a circle — keep the logo inside the 80% safe zone
  ["swift-maskable-192.png", await padded(192, 0.8)],
  ["swift-maskable-512.png", await padded(512, 0.8)],
  // iOS has no transparency and rounds the corners itself: small white margin, no black corners
  ["swift-apple-180.png", await padded(180, 0.92)],
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
