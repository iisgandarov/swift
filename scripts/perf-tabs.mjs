// Measures tab-switch latency: pointerdown on a tab → (a) tab highlighted, (b) target screen visible.
// Mid-range Android approximation: CPU 4x slowdown + 150 ms RTT. Usage: node scripts/perf-tabs.mjs [baseUrl]
import { chromium } from "@playwright/test";
const base = process.argv[2] ?? "http://localhost:3100";
const TABS = [
  ["/calendar", 1], ["/focus", 2], ["/stats", 3], ["/settings", 4], ["/", 0],
];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addCookies([{ name: "swift_locale", value: "en", url: base }]);
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8 * 10, uploadThroughput: 750e3 / 8 * 10 });
await p.goto(base + "/", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const results = [];
for (let round = 0; round < 2; round++) {
  for (const [path, idx] of TABS) {
    const r = await p.evaluate(async ({ path, idx }) => {
      const nav = document.querySelector('nav.fixed ul');
      const btn = nav.querySelectorAll("a,button")[idx];
      const t0 = performance.now();
      let highlighted = null, shown = null;
      await new Promise((resolve) => {
        const check = () => {
          const now = performance.now();
          if (highlighted === null && btn.getAttribute("aria-current") === "page") highlighted = now - t0;
          const screen = document.querySelector(`[data-screen="${path}"]`);
          const ok = location.pathname === path && (!screen || screen.offsetParent !== null) && document.querySelector("main h1, main [data-screen-ready]");
          if (shown === null && ok && highlighted !== null) shown = now - t0;
          if (highlighted !== null && shown !== null) return resolve();
          if (now - t0 > 8000) return resolve();
          requestAnimationFrame(check);
        };
        btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
        btn.click();
        requestAnimationFrame(check);
      });
      return { path, highlighted: Math.round(highlighted ?? -1), shown: Math.round(shown ?? -1) };
    }, { path, idx });
    await p.waitForTimeout(400);
    if (round === 1) results.push(r);
  }
}
console.table(results);
const avg = (k) => Math.round(results.reduce((s, r) => s + r[k], 0) / results.length);
console.log("avg highlight ms", avg("highlighted"), "avg screen ms", avg("shown"));
await b.close();
