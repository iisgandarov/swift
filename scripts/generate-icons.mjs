// Builds the Swift app icon as a clean SVG (text converted to paths so it renders
// identically everywhere) and rasterises PNG sizes for the manifest / iOS.
// Usage: node scripts/generate-icons.mjs
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const FONT = process.env.INTER_BOLD ?? "/usr/share/fonts/opentype/inter/Inter-Bold.otf";
const out = path.resolve("public/icons");
fs.mkdirSync(out, { recursive: true });

const buf = fs.readFileSync(FONT);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

// Lay out glyphs manually (opentype.js' shaper chokes on Inter's ccmp tables).
function textPath(text, x, y, size) {
  const path = new opentype.Path();
  const scale = size / font.unitsPerEm;
  let pen = x;
  const glyphs = [...text].map((c) => font.charToGlyph(c));
  glyphs.forEach((g, i) => {
    path.extend(g.getPath(pen, y, size));
    pen += g.advanceWidth * scale;
    if (glyphs[i + 1]) pen += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return path;
}
function wordmark(size, cx, cy) {
  const bb = textPath("Swift", 0, 0, size).getBoundingBox();
  const dx = cx - (bb.x1 + bb.x2) / 2;
  const dy = cy - (bb.y1 + bb.y2) / 2;
  return textPath("Swift", dx, dy, size).toPathData(2);
}

// Stylised swift: two swept-back wing blades + crescent body with forked tail.
const bird = `
  <path d="M140 240 C 330 360 500 480 640 610 L 560 700 C 420 560 270 420 140 240 Z"/>
  <path d="M250 200 C 430 320 600 440 720 560 L 660 630 C 520 500 370 370 250 200 Z"/>
  <path d="M520 165 C 720 250 850 430 830 640 C 822 720 790 780 745 820
           C 800 860 840 920 850 990 C 790 930 720 900 640 905
           C 520 912 400 960 290 940 C 200 925 150 880 120 830
           C 230 870 360 870 470 840 C 590 805 660 730 690 620
           C 720 480 640 300 520 165 Z"/>`;

function iconSvg({ maskable = false } = {}) {
  // maskable icons need full-bleed background and content inside the 80% safe zone
  const radius = maskable ? 0 : 228;
  const scale = maskable ? 0.8 : 1;
  const t = (1 - scale) * 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2EA1FF"/>
      <stop offset="0.55" stop-color="#0A6BFF"/>
      <stop offset="1" stop-color="#0057FF"/>
    </linearGradient>
    <clipPath id="c"><rect width="1024" height="1024" rx="${radius}"/></clipPath>
  </defs>
  <g clip-path="url(#c)">
    <rect width="1024" height="1024" fill="url(#g)"/>
    <g transform="translate(${t} ${t}) scale(${scale})">
      <g fill="#9CCBFF" fill-opacity="0.38">${bird}</g>
      <path fill="#FFFFFF" d="${wordmark(300, 512, 540)}"/>
    </g>
  </g>
</svg>`;
}

const svg = iconSvg();
const maskable = iconSvg({ maskable: true });
fs.writeFileSync(path.join(out, "icon.svg"), svg);
fs.writeFileSync(path.join(out, "icon-maskable.svg"), maskable);

const jobs = [
  ["icon-192.png", svg, 192],
  ["icon-512.png", svg, 512],
  ["icon-maskable-512.png", maskable, 512],
  ["apple-touch-icon.png", maskable, 180], // iOS rounds corners itself → full bleed
  ["favicon-32.png", svg, 32],
];
for (const [name, src, size] of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(path.join(out, name));
}
// Simple wordmark (dark text) for login screen / desktop sidebar
fs.writeFileSync(path.join(out, "bird.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 150 780 860" fill="currentColor">${bird}</svg>`);
console.log("icons written to", out);
