import { chromium } from "@playwright/test";
const base = "http://localhost:3100";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await ctx.addCookies([{ name: "swift_locale", value: "en", url: base }]);
const p = await ctx.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(p);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 2e6, uploadThroughput: 1e6 });
let doc = 0; p.on("request", (r) => { const u = r.url(); if (!u.includes("/_next/static") && !u.includes("/api/") && !u.includes("/icons/")) doc++; });
await p.goto(base + "/", { waitUntil: "networkidle" });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
for (const [label, wait] of [["immediately", 0], ["after 35s idle", 35000]]) {
  await p.waitForTimeout(wait);
  for (const [path, idx] of [["/calendar", 1], ["/", 0]]) {
    doc = 0;
    const t = await p.evaluate(async ({ path, idx }) => {
      const btn = document.querySelectorAll('nav[aria-label] ul a')[idx];
      const t0 = performance.now(); btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); btn.click();
      return await new Promise((res) => { const c = () => { const s = document.querySelector(`[data-screen="${path}"]`); return (location.pathname === path && s && !s.hidden) ? res(Math.round(performance.now() - t0)) : (performance.now() - t0 > 8000 ? res(-1) : requestAnimationFrame(c)); }; requestAnimationFrame(c); });
    }, { path, idx });
    await p.waitForTimeout(800);
    console.log(label, path, t, "ms, server page/RSC requests:", doc);
  }
}
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await p.locator('nav[aria-label] ul a').nth(3).click(); await p.waitForTimeout(300);
await p.goBack(); await p.waitForTimeout(500);
console.log("after Back:", new URL(p.url()).pathname, "home visible:", await p.locator('[data-screen="/"]').isVisible());
await p.goto(base + "/stats", { waitUntil: "networkidle" });
console.log("deep link /stats visible:", await p.locator('[data-screen="/stats"]').isVisible(), "h1:", await p.locator('[data-screen="/stats"] h1').textContent());
await p.goto(base + "/edit/d0000000-0000-4000-8000-000000000005", { waitUntil: "networkidle" });
console.log("edit deep link title:", await p.locator("#title").inputValue().catch(() => "n/a"));
console.log("errors:", errs);
await b.close();
