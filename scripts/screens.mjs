// Dev helper: screenshots routes at phone + desktop size in both themes/locales.
// Usage: node scripts/screens.mjs <outDir> [baseUrl] [routes,comma,separated]
import { chromium } from "playwright";
const [out = "screens", base = "http://localhost:3100", routesArg = "/"] = process.argv.slice(2);
const routes = routesArg.split(",");
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  for (const locale of ["az", "en"]) {
    for (const [label, vp] of [["phone", { width: 390, height: 844 }], ["desktop", { width: 1280, height: 800 }]]) {
      if (label === "desktop" && locale === "en" && theme === "dark") continue;
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: label === "phone" ? 2 : 1 });
      await ctx.addCookies([
        { name: "swift_theme", value: theme, url: base },
        { name: "swift_locale", value: locale, url: base },
      ]);
      const page = await ctx.newPage();
      for (const r of routes) {
        await page.goto(base + r, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        const name = `${out}/${label}-${theme}-${locale}${r.replace(/[/?=&]/g, "_")}.png`;
        await page.screenshot({ path: name });
      }
      await ctx.close();
    }
  }
}
await browser.close();
console.log("done");
