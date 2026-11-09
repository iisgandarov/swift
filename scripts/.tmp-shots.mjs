import { chromium } from "@playwright/test";
const [out, routes, prefix = ""] = process.argv.slice(2);
const b = await chromium.launch();
for (const theme of ["light", "dark"]) for (const loc of ["az"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "swift_theme", value: theme, url: "http://localhost:3100" }, { name: "swift_locale", value: loc, url: "http://localhost:3100" }]);
  const p = await ctx.newPage();
  for (const r of routes.split(",")) { await p.goto("http://localhost:3100" + r, { waitUntil: "networkidle" }); await p.waitForTimeout(600); await p.screenshot({ path: `${out}/${prefix}${theme}${r.replace(/\//g, "-") || "-home"}.png` }); }
  await ctx.close();
}
await b.close();
